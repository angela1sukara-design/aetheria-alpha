import type {ContentPack, Id} from '../core/types.ts';
import type {Registry} from '../content/registry.ts';
import type {WorldDef} from './types.ts';
import {B_OBSERVATIONS} from './b-observation-data.ts';
import {B_FIVE_THEME_OBSERVATIONS} from './b-five-theme-data.ts';
import type {Service} from './types.ts';

export interface ObservationRecipe {
  readonly id:string;readonly service:Service;readonly theme:string;readonly context:string;
  readonly fragments:readonly string[];readonly entryIds:readonly string[];readonly priority?:number;
  readonly timeWindow?:{readonly start:number;readonly end:number};
  readonly allowedEcologies?:readonly string[];
}
export const OBSERVATION_CATALOG:readonly ObservationRecipe[]=[...B_OBSERVATIONS,...B_FIVE_THEME_OBSERVATIONS];
const expansionIds=new Set<string>(B_FIVE_THEME_OBSERVATIONS.map(r=>r.id));

/** Incidental scenery generated with the world, not descriptions of live residents.
 * Each recipe binds only its explicitly reviewed phrases. No author hold is approved
 * and no body, occupation, inventory, resource or relationship is changed by looking.
 * Compiled nodes/texts live in the world's ContentPack snapshot, so old saves never
 * reselect or acquire descriptions from a future version of this catalogue.
 */
export function compileBObservations(pack:ContentPack,world:WorldDef,source:Registry,seed:number):void {
  if(pack.manifest.schemaVersion!==2||!source.narrativeNodes.length)return;
  const tag:Id='worldgen:context.observation';
  const profileId:Id='worldgen:profile.observation';
  (pack.tags??=[]).push({id:tag,label:'周围一瞥',definition:'当前正在查看生成世界中已保存的普通背景观察场景；不是人物、身体或道具状态。',facets:['context'],status:'active',aliases:[]});
  const nodeIds:Id[]=[];
  (pack.narrativeProfiles??=[]).push({id:profileId,tags:[tag],goals:[],tendencies:[],nodeIds});
  // Isolate the dedicated action from quests and existing exploration pools.
  for(const node of pack.narrativeNodes??[])if(node.kind==='exploration')node.excludesTags.push({role:'opponent',tagId:tag});
  for(const [index,place]of world.locations.entries()){
    const location=pack.locations.find(l=>l.id===place.id)!;
    const ecology=world.setting?.ecologyTag?.replace('foundation:setting.','');
    const recipes=OBSERVATION_CATALOG.filter(r=>r.service===place.service&&(r.theme==='generic'||world.setting?.tag==='worlds:setting.'+r.theme)&&(!r.allowedEcologies||!!ecology&&r.allowedEcologies.includes(ecology)));
    if(!recipes.length)continue;
    const actionId:Id=`worldgen:action.observe.${index}`,resultText:Id=`worldgen:text.observe.${index}`;
    pack.texts[resultText]='你停下脚步，看看周围的细节。';
    pack.actions.push({id:actionId,label:'观察周围的细节',hint:'看看街景与日常 · 可免费返回',group:'explore',conditions:[{op:'location.is',id:place.id}],effects:[{op:'narrative.start',kind:'exploration',profileId}],resultText});
    pack.contributions.push({hookId:location.actionHook,actionIds:[actionId]});
    const exitKey:Id=`worldgen:text.observe.exit.${index}`;pack.texts[exitKey]='你结束观察，继续自己的安排。';
    // Keep the generated pack bounded, including at the 20-location maximum.
    // A separate hash stream preserves all existing map/NPC/economy RNG results.
    const sorted=[...recipes].sort((a,b)=>(b.priority??500)-(a.priority??500)||rank(seed,place.id,a.id)-rank(seed,place.id,b.id)||a.id.localeCompare(b.id,'en'));
    // Reserve an anytime scene so timed imagery cannot make the entry unavailable.
    // Prefer a newly installed, theme-matched scene; generic 400-priority forms
    // remain fallback material rather than displacing richer ordinary candidates.
    const starter=sorted.find(r=>expansionIds.has(r.id)&&!r.timeWindow&&(r.priority??500)>=500)??sorted.find(r=>!r.timeWindow);
    const selected:ObservationRecipe[]=starter?[starter]:[];
    const remaining=sorted.filter(r=>r!==starter);
    const pools=[remaining.filter(r=>r.id.startsWith('word.prop.')||r.id.startsWith('word.sense.')),
      remaining.filter(r=>r.id.startsWith('word.form.')||r.id.startsWith('word.action.')),
      remaining.filter(r=>!r.id.startsWith('word.prop.')&&!r.id.startsWith('word.sense.')&&!r.id.startsWith('word.form.')&&!r.id.startsWith('word.action.'))];
    for(let round=0;selected.length<8&&pools.some(pool=>pool.length);round++){
      const candidate=pools[round%pools.length]!.shift();if(candidate)selected.push(candidate);
    }
    for(const [j,recipe]of selected.entries()){
      const textKey:Id=`worldgen:text.observe.${index}.${j}`;
      nodeIds.push(`worldgen:node.observe.${index}.${j}`);
      pack.texts[textKey]=`你在${location.name}附近停留片刻。\n\n${recipe.context}。${recipe.fragments.join('')}\n\n你可以结束观察，继续自己的安排。`;
      (pack.narrativeNodes??=[]).push({id:`worldgen:node.observe.${index}.${j}`,kind:'exploration',stage:'start',title:`${location.name} · 周围一瞥`,textKey,
        requiresTags:[{role:'opponent',tagId:tag}],excludesTags:[],conditions:[{op:'location.is',id:place.id},...(recipe.timeWindow?[{op:'time.window' as const,start:recipe.timeWindow.start,end:recipe.timeWindow.end}]:[]),...(recipe.allowedEcologies?[{op:'any' as const,conditions:recipe.allowedEcologies.map(eco=>({op:'narrative.tag' as const,role:'environment' as const,id:`foundation:setting.${eco}` as Id,value:true}))}]:[])],tendencies:[],weight:1,priority:20,maxVisits:3,
        choices:[{label:'再看看周围',resultText:resultText,conditions:[],effects:[],setTags:[],unsetTags:[],next:'start'},
          {label:'返回地点',resultText:exitKey,conditions:[],effects:[],setTags:[],unsetTags:[],next:null}]});
    }
  }
}
function rank(seed:number,location:string,entry:string):number {
  let value=(seed^2166136261)>>>0;
  for(const char of location+':'+entry)value=Math.imul(value^char.charCodeAt(0),16777619)>>>0;
  return value;
}
