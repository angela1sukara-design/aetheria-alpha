import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec} from '../src/persistence/codec.ts';

const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json('content/index.json'),packs=await Promise.all(index.packs.map(p=>json('content/'+p)));
const registry=await loadPacks([...packs,await json('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(n=>json('content/generation/'+n+'.json')))]);
const rules=await json('content/generation/rules.json'),reference=await json('content/generation/lexicon-reference.json'),fantasy=await json('content/generation/fantasy-reference.json'),worldProfiles=await json('content/generation/world-profiles.json');
let world,roles;
for(const seed of [7,42,19]){
  const sample=await new WorldGenerator().generate({seed,registry,rules:{...rules,startMinutes:600},references:[reference,fantasy],worldProfiles,worldTag:'worlds:setting.fantasy',parameters:{npcCount:20}});
  const residents=sample.state.district.residents;
  const services=n=>sample.registry.residentTemplates.find(t=>t.id===n.templateId).services;
  const found={
    smith:residents.find(n=>services(n)?.trade?.includes('progression:equipment.blade')),
    merchant:residents.find(n=>services(n)?.trade?.includes('fantasy:item.ration')),
    healer:residents.find(n=>services(n)?.trade?.includes('fantasy:item.bandage')),
    passerby:residents.find(n=>services(n)!==undefined&&Object.keys(services(n)).length===0),
  };
  if(Object.values(found).every(Boolean)){world=sample;roles=found;break;}
}
assert.ok(world&&roles,'Normal seeded generation must produce all four example roles.');
const engine=new ActionExecutor(world.registry,world.state);
let serial=0;
const act=(id,params)=>{const result=engine.performAction({actionId:id,...(params?{params}:{})},engine.snapshot().meta.revision,'example-'+ ++serial);assert.equal(result.ok,true,result.message);return result;};
act('district:action.create',{name:'旅人'});
function routeTo(target){
  const start=engine.snapshot().world.locationId,queue=[[start,[]]],seen=new Set();
  while(queue.length){const [at,path]=queue.shift();if(at===target)return path;if(seen.has(at))continue;seen.add(at);for(const route of world.registry.routes.filter(r=>r.from===at))queue.push([route.to,[...path,route]]);}
  throw Error('Example destination is unreachable');
}
for(const route of routeTo(roles.smith.locationId)){const action=engine.view().actions.find(a=>a.definition.effects.some(e=>e.op==='location.move'&&e.routeId===route.id));assert.ok(action?.available);act(action.definition.id);}
const placeIndex=world.world.definition.locations.findIndex(p=>p.id===roles.smith.locationId);
for(let i=0;i<world.state.district.residents.length&&engine.snapshot().district.currentResidentId!==roles.smith.id;i++)act(`worldgen:action.meet.${placeIndex}`);
assert.equal(engine.snapshot().district.currentResidentId,roles.smith.id);
const codec=new SaveCodec(world.registry),save=await codec.encode(engine.snapshot()),decoded=await codec.decode(save);assert.equal(decoded.status,'ready',decoded.status==='quarantined'?decoded.reason:'');
const rows=[];
for(const [kind,actor]of Object.entries(roles)){
  const state=structuredClone(engine.snapshot());state.world.locationId=actor.locationId;state.district.currentResidentId=actor.id;
  const view=new ActionExecutor(world.registry,state).view(),location=world.registry.location(actor.locationId);
  rows.push({kind,name:actor.name,profession:actor.profession,residentId:actor.id,locationId:actor.locationId,location:location.name,facilities:location.facilities,services:world.registry.residentTemplates.find(t=>t.id===actor.templateId).services,actions:view.actions.filter(a=>a.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='resident')).map(a=>({id:a.definition.id,label:a.definition.label,available:a.available,hint:a.definition.hint}))});
}
const html=await readFile('dist/Aetheria-Folio.html','utf8'),marker='<script>globalThis.aetheriaEmbedded=';
assert.ok(html.includes(marker));
const launch=`globalThis.aetheriaInitialSave=${JSON.stringify(save).replaceAll('<','\\u003c')};globalThis.aetheriaSaveSlot="function-example-0.10";`;
await mkdir('examples',{recursive:true});await mkdir('artifacts/capability-batch',{recursive:true});
await writeFile('examples/首批NPC与地点功能示例.html',html.replace(marker,'<script>'+launch+'globalThis.aetheriaEmbedded='));
const report={generator:'0.10.0',seed:world.state.rng.seed,npcCount:world.state.district.residents.length,world:world.world.definition.name,region:world.world.definition.regions[0].name,startLocationId:engine.snapshot().world.locationId,startNpc:roles.smith.name,roles:rows,routes:world.registry.routes.filter(r=>r.id.startsWith('worldgen:')).map(r=>({from:r.from,to:r.to,actionId:world.registry.actionsAt(r.from).find(a=>a.effects.some(e=>e.op==='location.move'&&e.routeId===r.id))?.id})),locations:world.world.definition.locations.map(p=>({id:p.id,name:world.registry.location(p.id).name,service:p.service,facilities:world.registry.location(p.id).facilities})),saveValidated:true};
await writeFile('artifacts/capability-batch/example.json',JSON.stringify(report,null,2));
const types={smith:'铁匠',merchant:'摊主',healer:'护理员',passerby:'路人'};
const table=rows.map(r=>`| ${types[r.kind]}：${r.name} | ${r.location} | ${r.actions.map(a=>a.label).join('；')} |`).join('\n');
await writeFile('examples/首批功能示例.md',`# 首批 NPC 与地点功能示例\n\n打开同目录的 **首批NPC与地点功能示例.html** 即可试玩。它使用正常生成器产生的种子 ${report.seed}、${report.npcCount} 名居民；初始化在上午营业时段，并通过真实创建、行走和找人动作来到铁匠面前。没有替换生成出的身份或塞入只能看的展示按钮。\n\n世界 **${report.world}** → 区域 **${report.region}** → 地点 **${rows[0].location}** → 铁匠 **${rows[0].name}**。打开“身边的人”即可查看其提供的服务；列表中的行动点击一次直接执行。\n\n| 人物 | 所在地点 | 当前实际提供的功能入口 |\n| --- | --- | --- |\n${table}\n\n从地图前往其他地点，再“看看在场居民”可切换到表中的人物。同一地点可以同时有经营者和路人，换人后服务列表会随之变化；在对方离开工作地点后，不再提供营业服务。\n\n## 可实际操作的例子\n\n- 向铁匠买工具：扣除标价，物品进入背包；向其请教基础训练：45 分钟、零钱 8、体力 8、精力 4，对应能力提高 1。这里是已实现的基础训练。\n- 协助铁匠分拣锻件：15 分钟、体力 8、精力最多 2，报酬 3 币；每天一次，重复领取被拦截。\n- 摊主出售黑麦干粮，护理员出售草药绷带和安神药饮；可以买入并在背包使用。草药绷带使用一份恢复生命 10，耗时 5 分钟。\n- 路人可交谈，不会出现交易、教学和打工按钮，包括“暂不可用”折叠栏。\n- 缺钱时，真正提供的商品仍显示具体价格并不可执行；不存在的货物不会显示。\n\n## 地点差异\n\n- 旅馆有床，才能睡觉；铁匠铺没有睡觉或护理入口。\n- 护理地点才提供伤势处理；每个地点只保留一个短休息和一个等候入口。没有灯具开关的地方不出现开关工作灯。\n- 无休息设施且体力接近耗尽时，可原地喘息恢复，避免无法离开的死路。\n\n当前首批机制覆盖服务配置、功能筛选、真实结算与保存恢复。角色能力与地点设施可由数据调整；修改数据即可添加或移除现有服务，无需按人物姓名写判断。模块 D 已接入：正常交谈根据实际性格展开，正向、中性与冒犯有不同后果；赠礼扣除真实干粮且每日限一次，人物离场会安全收尾。新任务链与装备耐久修理仍属后续批次。\n`, 'utf8');
console.log(JSON.stringify({file:'examples/首批NPC与地点功能示例.html',seed:report.seed,region:report.region,start:report.startNpc,roles:rows.map(r=>({kind:r.kind,name:r.name,place:r.location,actions:r.actions.length}))},null,2));
