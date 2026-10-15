import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadBundle} from '../production/collaboration-pack/load-source.mjs';
import {validateDelivery} from '../production/collaboration-pack/tools/authoring.mjs';
import {assembleProse} from '../production/tag-matrices/assembly.mjs';
import {FIVE_THEMES,THEME_NAMES,sceneryRecipe} from './lexicon/five-theme-scenery.mjs';

const root=process.argv[2];if(!root)throw Error('Supply the original delivery directory.');
const out='deliverables/B-five-themes-reviewed-2026-10-15';
const sha=x=>createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const bundle=await loadBundle(),originals=[],changes=[],deliveries=[];
const edits={
 'word.prop.fantasy.ceramic-medicine-jar':'一只塞着软木塞的陶制药罐',
 'word.action.post-apocalypse.scrape-rust-with-file':'握着钢锉刀用力锉去铁板接缝处的浮锈',
 'word.form.fantasy.map-guide':'佩戴行会铜徽的向导',
 'word.form.fantasy.rock-skin-guard':'小臂带有岩石纹理的守卫',
 'word.prop.xianxia.celadon-porridge-bowl':'一只盖着瓷盖、盛着温热白粥的青瓷碗',
 'word.prop.modern.blinking-charger':'一只指示灯闪烁的充电器',
 'word.prop.modern.tangled-earphones':'一副线缆缠在一起的有线耳机',
 'word.sense.modern.dry-indoor-air':'通风室内的干燥空气触感',
 'word.sense.xianxia.pavilion-mild':'竹轩内不冷不热的温和体感',
 'word.sense.cyberpunk.diffraction-grid':'潮湿薄雾中交错的细碎光纹',
 'word.sense.xianxia.mist-diffraction':'晨光映照山间薄雾时浮现的淡淡七彩光晕',
 'word.sense.xianxia.distant-crane-call':'云雾深处偶尔传来的清越鹤唳鸟声',
 'word.form.xianxia.sibling-disciple':'在宗门修行的弟子',
 'word.form.xianxia.quiet-housemate':'在院中清修的同道',
 'word.form.post-apocalypse.housemate-bunker':'同住地下宿舍的住户',
};
for(const task of ['B1','B2'])for(const theme of FIVE_THEMES){
 const name=`${task}-${theme}-delivery.json`,bytes=await fs.readFile(path.join(root,name)),d=JSON.parse(bytes);validateDelivery(d,bundle);originals.push({name,sha256:sha(bytes),bytes});
 d.batchId=`${task.toLowerCase()}-${theme}-reviewed-v2`;d.revision=2;d.author+='；Codex 编辑修订';
 for(const e of d.entries){
  const before=structuredClone(e);if(edits[e.id])e.text=edits[e.id];e.text=e.text.replaceAll('偶而','偶尔');
  if(e.id.endsWith('.nearby-figure'))e.text='同处此地的身影';
  if(e.id==='word.prop.fantasy.ceramic-medicine-jar'){
   e.tagIds=e.tagIds.filter(t=>t!=='general-taxonomy:common.object.medicine-box');e.pendingFacts=['确认同一药罐为陶制、由软木塞封口，并存在于当前观察场景。'];
  }
  if(e.id==='word.prop.xianxia.celadon-porridge-bowl'){
   e.tagIds=e.tagIds.filter(t=>t!=='general-taxonomy:common.object.lunchbox');e.tagIds.push('general-taxonomy:object.bowl');e.pendingFacts=['确认同一青瓷碗配有瓷盖，内部盛有白粥且当前温热。'];
  }
  if(e.id==='word.prop.modern.blinking-charger')e.pendingFacts=['确认同一充电器的指示灯当前闪烁；不能用通电或常亮代替。'];
  if(e.id==='word.prop.modern.tangled-earphones')e.pendingFacts=['确认同一有线耳机的线缆当前缠绕在一起。'];
  if(e.id==='word.form.xianxia.sibling-disciple')e.pendingFacts=['确认同一人物在该宗门修行；不默认与玩家有同门或辈分关系。'];
  if(e.id==='word.form.xianxia.quiet-housemate')e.pendingFacts=['确认同一人物当前在院中清修；不默认与玩家同住。'];
  if(e.id==='word.form.post-apocalypse.housemate-bunker')e.pendingFacts=['确认同一住户住在地下宿舍；不默认与玩家同住。'];
  if(e.id==='word.sense.cyberpunk.diffraction-grid')e.tagIds=e.tagIds.filter(t=>t!=='general-taxonomy:v2.sensory.diffraction').concat('general-taxonomy:v2.sensory.light-pool');
  if(e.id==='word.sense.xianxia.mist-diffraction')e.tagIds=e.tagIds.filter(t=>t!=='general-taxonomy:v2.sensory.diffraction'&&t!=='general-taxonomy:v2.hydrology.rainbow').concat('general-taxonomy:v2.sensory.glow');
  e.tagIds=[...new Set(e.tagIds)];
  e.requires=e.requires.filter(c=>c.fact!=='scene.setting');e.requires.unshift({fact:'scene.setting',comparison:'eq',value:theme});
  const genericForm=e.id.endsWith('.present-person')||e.id.endsWith('.nearby-figure');
  if(!genericForm){
   e.review='hold';
   e.pendingFacts=[...new Set([...e.pendingFacts,`核实当前同一绑定实例完整符合“${e.text}”；类型、Tag或概括动作记录不能代替其中的材质、外观、位置、时段、持物及关系细节。`])];
  }
  if(JSON.stringify(before)!==JSON.stringify(e))changes.push({id:e.id,textBefore:before.text,textAfter:e.text,reviewBefore:before.review,reviewAfter:e.review,addedTheme:theme});
 }
 d.handPreviews=[];d.notes=`${THEME_NAMES[theme]}修订交付，共${d.entries.length}条；保留稳定ID，补真实题材前置。详细描写在通用作者层保留hold和逐条语义要求，不批量批准。游戏通过单独审定的背景场景配方使用这些文字；晨/昼/夜描写另加运行时段门控。编号只用于稳定引用，不能按编号猜物件或事实。预览来自synthetic参考拼装，不是生产现场证据。`;
 deliveries.push(d);
}
const all=deliveries.flatMap(d=>d.entries),byId=new Map(all.map(e=>[e.id,e]));assert.equal(all.length,675);assert.equal(byId.size,675);
const token=(key,slot,poolId,bindTo,prefix,required=true)=>({key,slot,poolId,bindTo,prefix,suffix:'。',required});
const baseWord=(id,slot,poolId,binding,extra)=>({id,allowedSlots:[slot],poolIds:[poolId],priority:500,review:'approved',status:'active',role:'core',binding,requires:[],excludes:[],exclusive:[],contentTier:'general',tagIds:[],...extra});
const previewCases=[];
function preview(d,ids,serial){
 const words=ids.map(id=>byId.get(id));assert(words.every(Boolean));
 const bindings={place:{subject:'synthetic:place',instanceId:'synthetic:place'},actor:{subject:'synthetic:actor',instanceId:'synthetic:actor'},prop:{subject:'synthetic:prop',instanceId:'synthetic:prop'},sense:{subject:'synthetic:place',instanceId:'synthetic:place'},exit:{subject:'player',instanceId:'synthetic:exit'}};
 const context={fixtureId:`synthetic-five-themes-${d.task}-${d.theme}-${serial}`,seed:42+serial,revision:2,bindings,facts:{},registeredTags:[],displayValues:[{binding:bindings.place,name:THEME_NAMES[d.theme]+'的公共区',revision:2,source:'snapshot'}],exitChoice:{actionId:'synthetic:action.exit',label:'结束观察',next:null,conditions:[],effects:[],setTags:[],unsetTags:[]}};
 const lexemes=words.map(word=>{const e=structuredClone(word);delete e.pendingFacts;e.review='approved';const pool=e.poolIds[0];const key=pool==='environment.prop'?'prop':pool.startsWith('environment.sense.')?'sense':'actor';e.binding=bindings[key];if(pool.startsWith('environment.sense.'))e.poolIds.push('environment.sense');for(const c of e.requires){const prior=context.facts[c.fact];if(prior)assert.equal(prior.value,c.value);context.facts[c.fact]={known:true,source:'snapshot',value:c.value};}return e;});
 const tags=new Set(words.flatMap(w=>w.tagIds));context.registeredTags=[...tags].map(id=>({id,status:'active'}));
 lexemes.push(baseWord('runtime:display.place','place','place.current',bindings.place,{displayRef:{field:'name'}}),baseWord('runtime:display.exit','exitChoice','exit.current',bindings.exit,{text:'结束观察',actionId:'synthetic:action.exit'}));
 const tokens=[token('where','place','place.current','place','在')];tokens[0].suffix='，';
 for(const w of words){const pool=w.poolIds[0];if(pool==='environment.prop')tokens.push(token('prop','propEnv',pool,'prop','你看见'));else if(pool.startsWith('environment.sense.'))tokens.push(token('sense','senseMod','environment.sense','sense','你察觉到'));else if(pool==='actor.form')tokens.push(token('actor','opponentForm',pool,'actor','你留意到'));else tokens.push(token('act','actionCore',pool,'actor','你观察到对方的动作：'));}
 const actor=tokens.find(t=>t.key==='actor'),act=tokens.find(t=>t.key==='act');if(actor&&act)act.sameAs=['actor'];
 tokens.push(token('exit','exitChoice','exit.current','exit','你可以'));
 const rule={id:`assembly.delivery.${d.task.toLowerCase()}.${d.theme}.${serial}`,domain:d.task==='B1'?'05':'02',mode:'prose',contentTier:'general',fallbackTier:'general',proseTemplate:tokens,prose:'你可以结束观察，继续自己的安排。',checks:['T32','T33','T34','T35','T36','T37']};
 const catalog={...structuredClone(bundle.baseCatalog),rules:[rule]},input={catalog,assemblyRuleId:rule.id,lexemes,context};
 const result=assembleProse(input);assert.equal(result.mode,'assembled',JSON.stringify(result));assert(!result.text.includes('其中盛着'));
 assert.deepEqual(result,assembleProse(input));
 previewCases.push({input,expectedText:result.text,scope:'synthetic-only; original holds not approved'});
 d.handPreviews.push({templateId:rule.id,entryIds:result.selected.map(s=>s.entryId),fixtureId:context.fixtureId,seed:context.seed,revision:2,mode:'reference-assembler',text:result.text,evidenceStatus:'fixture-verified'});
}
for(const d of deliveries){
 if(d.task==='B1'){
  preview(d,[d.entries[0].id,d.entries[40].id],0);preview(d,[d.entries[1].id,d.entries[42].id],1);preview(d,[d.entries[44].id],2);preview(d,[d.entries[46].id],3);
 }else{
  const work={modern:['doorframe-short-hair','check-list'],cyberpunk:['goggles-mechanic','report-system-fault'],fantasy:['scale-weigher','weigh-grain-sack'],xianxia:['herb-basket-gardener','sort-medicinal-herbs'],'post-apocalypse':['goggles-mechanic','sort-salvaged-parts']}[d.theme];
  const forms=d.entries.filter(e=>e.poolIds[0]==='actor.form'),actions=d.entries.filter(e=>e.poolIds[0]==='action.observed');
  const f=forms.find(e=>e.id.endsWith('.'+work[0]))??forms[2],a=actions.find(e=>e.id.endsWith('.'+work[1]))??actions[4];
  preview(d,[f.id,a.id],0);preview(d,[forms[1].id,actions[0].id],1);preview(d,[forms[0].id,actions[20].id],2);preview(d,[forms[3].id],3);
 }
 validateDelivery(d,bundle);
}
await fs.mkdir(out,{recursive:true});await fs.mkdir('content/prose',{recursive:true});
for(const d of deliveries){
 const name=`${d.task}-${d.theme}-reviewed-v2`;await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(d,null,2)+'\n');
 const changed=changes.filter(c=>d.entries.some(e=>e.id===c.id)&&c.textBefore!==c.textAfter);
 const md=`# ${name}\n\n修订日期：2026-10-15。规范v1.3。保留${d.entries.length}条稳定ID。全部新增scene.setting=${d.theme}题材前置；详细描写在作者通用层仍需逐条事实映射，实际游戏使用独立生成背景配方，不向现有NPC或玩家注入事实。\n\n## 文字修改\n\n${changed.map(c=>`- ${c.id}：${c.textBefore} → ${c.textAfter}`).join('\n')||'没有改动正文。'}\n\n## 正式预览\n\n以下4条由参考拼装器在显式synthetic快照中生成；仅证明句式、绑定、引用和可复现性，不授予生产审批。人物预览包含本批form及action，道具与感官分句，不再假定物件能盛水。\n\n${d.handPreviews.map((p,i)=>`${i+1}. ${p.text}`).join('\n\n')}\n\n编号遗留语义与正文不同时保持ID，语义依据正文和独立配方，不能按jade-hairpin等编号推定物件。\n`;
 await fs.writeFile(path.join(out,name+'.md'),md);
}
const source={format:'aetheria-five-theme-observation-sources',version:2,originalFiles:originals.map(({name,sha256})=>({name,sha256})),deliveries};
await fs.writeFile('content/prose/b-five-themes-v2.json',JSON.stringify(source,null,2)+'\n');
const recipes=deliveries.flatMap(d=>d.entries.map(e=>({...sceneryRecipe(e,d.theme),sourceHash:sha(e)})));
await fs.mkdir('production/text-slot-integration',{recursive:true});
await fs.writeFile('production/text-slot-integration/b-five-themes-v2.json',JSON.stringify({format:'aetheria-reviewed-five-theme-scenery',version:2,sourceHash:sha(source),scope:'generated-incidental-scenery-only',recipes},null,2)+'\n');
await fs.writeFile(path.join(out,'preview-replay.json'),JSON.stringify(previewCases)+'\n');
await fs.writeFile('tests/fixtures/b-five-themes-preview-replay.json',JSON.stringify(previewCases)+'\n');
const report={entries:675,files:10,previews:40,sourceIdsPreserved:true,originalsUnchanged:true,themeConditions:675,originalDraft:235,revisedDraft:all.filter(e=>e.review==='draft').length,revisedHold:all.filter(e=>e.review==='hold').length,reviewedSceneryRecipes:675,scope:'generated-background-scenes-only',changes};
await fs.writeFile(path.join(out,'review-report.json'),JSON.stringify(report,null,2)+'\n');
for(const original of originals)assert.equal(sha(await fs.readFile(path.join(root,original.name))),original.sha256);
console.log(JSON.stringify({...report,changes:undefined,out},null,2));
