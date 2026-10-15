import type {ContentPack,Id} from '../core/types.ts';
import type {Registry} from '../content/registry.ts';
import type {WorldDef} from './types.ts';
import type {ProseMode} from '../core/prose-types.ts';
import {A_TEMPLATE_CATALOG} from './a-template-data.ts';
import {B_FIVE_THEME_OBSERVATIONS} from './b-five-theme-data.ts';
const labels={environment:'细看周边环境',person:'观察在场人物',body:'查看身体细节'};
export function compileATemplates(pack:ContentPack,world:WorldDef,source:Registry,seed:number):void{
 if(pack.manifest.schemaVersion!==2||!source.narrativeNodes.length)return;
 const modes:ProseMode[]=['environment','person','body'];
 for(const mode of modes){
  const tag:Id=`worldgen:context.a-${mode}`,nodeIds:Id[]=[],profile:Id=`worldgen:profile.a-${mode}`;
  (pack.tags??=[]).push({id:tag,label:labels[mode],definition:'依据当前快照拼装普通观察正文；不执行任务、交易或身体变化。',facets:['context'],status:'active',aliases:[]});
  (pack.narrativeProfiles??=[]).push({id:profile,tags:[tag],goals:[],tendencies:[],nodeIds});
  for(const n of pack.narrativeNodes??[])if(n.kind==='exploration')n.excludesTags.push({role:'opponent',tagId:tag});
  const rules=A_TEMPLATE_CATALOG.rules.filter(r=>mode==='body'?r.domain==='08':mode==='environment'?['01','03','05'].includes(r.domain):!['01','03','05','08'].includes(r.domain));
  for(const rule of rules){
   const suffix=rule.id.replace('assembly.',''),id:Id=`worldgen:node.a.${suffix}`,textKey:Id=`worldgen:text.a.${suffix}`,resultText:Id='worldgen:text.a.continue',exitText:Id='worldgen:text.a.exit';
   nodeIds.push(id);pack.texts[textKey]=rule.prose;pack.texts[resultText]='你继续留意当前的细节。';pack.texts[exitText]='你结束观察，继续自己的安排。';
   (pack.narrativeNodes??=[]).push({id,kind:'exploration',stage:'start',title:`{place} · ${labels[mode]}`,textKey,requiresTags:[{role:'opponent',tagId:tag}],excludesTags:[],conditions:[],tendencies:[],weight:1,priority:20,maxVisits:3,proseAssembly:{version:1,mode,rule:structuredClone(rule)},choices:[{label:'换个角度看看',resultText,conditions:[],effects:[],setTags:[],unsetTags:[],next:'start'},{label:'返回地点',resultText:exitText,conditions:[],effects:[],setTags:[],unsetTags:[],next:null}]});
  }
  for(const [i,place]of world.locations.entries()){
   const location=pack.locations.find(l=>l.id===place.id)!,id:Id=`worldgen:action.a-${mode}.${i}`,resultText:Id=`worldgen:text.a-${mode}.${i}`;
   pack.texts[resultText]='你停下脚步，留意眼前的实际情况。';
   pack.actions.push({id,label:labels[mode],hint:'按当前情况描写 · 可免费返回',group:'explore',conditions:[{op:'location.is',id:place.id}],effects:[{op:'narrative.start',kind:'exploration',profileId:profile}],resultText});pack.contributions.push({hookId:location.actionHook,actionIds:[id]});
  }
 }
 const ecology=world.setting?.ecologyTag.replace('foundation:setting.','');
 for(const place of world.locations){
  const location=pack.locations.find(l=>l.id===place.id)!;
  const candidates=B_FIVE_THEME_OBSERVATIONS.filter(r=>r.service===place.service&&world.setting?.tag==='worlds:setting.'+r.theme&&(!('allowedEcologies'in r)||!!ecology&&(r.allowedEcologies as readonly string[]).includes(ecology))&&(r.id.startsWith('word.prop.')||r.id.startsWith('word.sense.'))).sort((a,b)=>rank(seed,place.id+a.id)-rank(seed,place.id+b.id));
  const props=candidates.filter(r=>r.id.startsWith('word.prop.')),senses=candidates.filter(r=>r.id.startsWith('word.sense.'));
  const anytime=props.find(r=>!('timeWindow'in r));
  const selected=[...(anytime?[anytime]:[]),...props.filter(r=>r!==anytime).slice(0,3),...senses.slice(0,3)];
  location.proseScenery=selected.map((r,j)=>({id:`${place.id}:scenery:${j}`,sourceId:r.id,kind:r.id.startsWith('word.prop.')?'prop':'sense',text:r.fragments[1],conditions:'timeWindow'in r?[{op:'time.window',start:r.timeWindow.start,end:r.timeWindow.end}]:[]}));
  if(!location.proseScenery.some(o=>o.kind==='prop')){
   const names={seat:'供人休息的座位',bed:'供人休息的床铺',care:'护理设施',workplace:'工作设施',training:'训练设施',publicDesk:'公共办事台',lightSwitch:'工作灯开关'};
   for(const f of (location.facilities??[]).slice(0,3))location.proseScenery.push({id:`${place.id}:facility:${f}`,sourceId:`worldgen:facility.${f}`,kind:'prop',text:names[f],conditions:[]});
  }
  // Instances belong only to this saved location; they grant no inventory or service.
 }
}
function rank(seed:number,text:string):number{let h=(seed^2166136261)>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
