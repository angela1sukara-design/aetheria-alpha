import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalize } from './library.mjs';
export async function inventory(project) {
 const sources=[];
 async function load(relative) {
  const bytes=await readFile(path.join(project,relative));
  sources.push({file:relative,sha256:createHash('sha256').update(bytes).digest('hex')});
  return JSON.parse(bytes.toString('utf8'));
 }
 const index=await load('content/index.json'),packs=[];
 for(const f of index.packs)packs.push(await load('content/'+f.replace(/^\.\//,'')));
 const types=['locations','routes','actions','events','npcs','npcMemories','residentTemplates','bodyParts','bodyTemplates','bodyPatches','transformations','species','storylets','textSlots','sceneTexts','equipment','interactions'];
 const totals={},byPack=packs.map(p=>{
  const counts=Object.fromEntries(types.map(t=>[t,(p[t]??[]).length]));counts.textKeys=Object.keys(p.texts).length;
  for(const [k,v]of Object.entries(counts))totals[k]=(totals[k]??0)+v;
  return {id:p.manifest.id,version:p.manifest.version,counts};
 });
 const texts=packs.flatMap(p=>Object.values(p.texts)),count = a=>({occurrences:a.length,uniqueNormalized:new Set(a.map(normalize)).size});
 const residents=packs.flatMap(p=>p.residentTemplates??[]),npcs=packs.flatMap(p=>p.npcs??[]);
 const fields={
  npcNames:count(npcs.map(n=>n.name)),npcRoles:count(npcs.map(n=>n.role)),
  residentNames:count(residents.flatMap(r=>r.names)),residentProfessions:count(residents.map(r=>r.profession)),
  residentAppearances:count(residents.flatMap(r=>r.appearance)),residentPersonalities:count(residents.flatMap(r=>r.personality)),
  bodyPartLabels:count(packs.flatMap(p=>(p.bodyParts??[]).map(b=>b.label))),
  equipmentDescriptions:count(packs.flatMap(p=>(p.equipment??[]).map(e=>e.description))),
  textValues:count(texts),
 };
 const refs={locationDescription:[],npcDescription:[],npcSchedule:[],npcMemory:[],eventNode:[],actionResult:[],tfStage:[],sceneText:[]};
 for(const p of packs) {
  refs.locationDescription.push(...p.locations.map(l=>l.textKey));
  refs.npcDescription.push(...(p.npcs??[]).map(n=>n.descriptionText));
  refs.npcSchedule.push(...(p.npcs??[]).flatMap(n=>n.schedule.map(s=>s.activityText)));
  refs.npcMemory.push(...(p.npcMemories??[]).map(n=>n.textKey));
  refs.eventNode.push(...p.events.flatMap(e=>e.nodes.flatMap(n=>n.textVariants)));
  refs.actionResult.push(...p.actions.map(a=>a.resultText));
  refs.tfStage.push(...(p.transformations??[]).flatMap(t=>t.stages.flatMap(s=>s.textKey?[s.textKey]:[])));
  refs.sceneText.push(...(p.sceneTexts??[]).map(s=>s.textKey));
 }
 const textUses=Object.fromEntries(Object.entries(refs).map(([k,v])=>[k,{references:v.length,uniqueTextKeys:new Set(v).size}]));
 const referenceFiles=['content/generation/reference.json','content/generation/addon-reference.json'];
 const references=[];
 for(const file of referenceFiles) {
  const p=await load(file);
  const templates=p.templates,places=templates.filter(t=>t.kind==='place'),environments=templates.filter(t=>t.kind==='environment');
  references.push({file,id:p.id,version:p.version,templates:templates.length,
   byKind:Object.fromEntries(['environment','place','npc','faction','event'].map(k=>[k,templates.filter(t=>t.kind===k).length])),
   textFields:{placeNames:count(places.flatMap(t=>t.data.names)),placeDescriptions:count(places.map(t=>t.data.description)),
    environmentDescriptions:count(environments.map(t=>t.data.description)),professions:count(places.flatMap(t=>t.data.professions)),economicActivities:count(places.flatMap(t=>t.data.economy))},
  });
 }
 const optional=[];
 for(const file of ['content/extension-event/pack.json','content/generation/addon-content.json']) {
  const p=await load(file);optional.push({file,id:p.manifest.id,version:p.manifest.version,textKeys:Object.keys(p.texts).length,events:p.events.length,residentTemplates:(p.residentTemplates??[]).length,loadedByDefault:false});
 }
 const prose=await load('content/author-example/text-pack.json');
 return {format:'aetheria-material-inventory',schemaVersion:1,scope:'content/index.json 默认加载包；生成参考包与可选包另计，不扫描测试存档或 dist 副本。',
  byPack,totals,fields,textUses,references,optional,textExpansionExample:{variants:prose.variants.length,loadedByDefault:false},sources,
  caveats:[
   '这是工程字段盘点，不是经过编辑拆分的独立词条数量。长事件正文、重复引用、机制定义不得冒充纯素材条目。',
   'uniqueNormalized 仅合并 Unicode/空白/标点/大小写相同的文本，不等于语义去重。不同字段的独立计数不能直接相加。',
   '事件节点正文包含上下文，不能直接随机拼接。NPC/身体定义数量表示机制定义数，不表示基础词条数。',
   '参考包有规则字段，不能整包搬进新词库；本轮没有自动拆解、抄入或改写任何既有剧情。',
   '新增词库正式收录与游戏使用均从零计；示例另存，不冒充生产成果。',
  ]};
}
