import type { ContentPack, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { WorldDef } from './types.ts';

/** Ordinary exploration offers a visible threat, with fight/avoid choices. */
export function compileCombatEncounters(pack:ContentPack,world:WorldDef,source:Registry):void {
  if(!source.environmentEnemyRules.length)return;
  const id=(s:string):Id=>`worldgen:${s}`;
  const fantasy=world.setting?.tag==='worlds:setting.fantasy';
  const mechanical=world.setting&&/cyberpunk|space|industrial|postapocalypse/.test(world.setting.tag);
  for(const [i,place]of world.locations.entries()){
    if(place.service!=='commons')continue;
    const wet=place.tags.some(t=>/waterways|wet|tidal/.test(t));
    const enemyId:Id=fantasy&&wet?'district:enemy.gel':mechanical?'district:enemy.scavenger':'progression:enemy.raider';
    if(!source.enemies.some(e=>e.id===enemyId))continue;
    const location=pack.locations.find(l=>l.id===place.id)!,enemy=source.enemies.find(e=>e.id===enemyId)!;
    const threat=enemyId==='district:enemy.gel'?'盘踞路面的黏液生物':enemyId==='district:enemy.scavenger'?'失控的巡行机械':'拦路的游荡者';
    const danger=id(`tag.danger.${i}`),event=id(`event.danger.${i}`),prompt=id(`text.danger.${i}`),end=id(`text.danger.${i}.end`),fight=id(`action.danger.${i}.fight`),avoid=id(`action.danger.${i}.avoid`);
    (pack.tags??=[]).push({id:danger,label:location.name+'的道路危险',definition:'探索此地时存在拦路遭遇。',facets:['context'],status:'active',aliases:[]});place.tags.push(danger);
    (pack.environmentEnemyRules??=[]).push({id:id(`env-enemy.danger.${i}`),enemyId,requiresTags:[danger],weight:10,priority:10,name:threat,hp:enemy.hp,reward:enemy.reward});
    pack.texts[prompt]=`你在${location.name}沿通道前行，${threat}挡住了去路。对方正在逼近，旁边还有一条可以绕开的通道。\n\n可以迎战，也可以现在离开，避开这次冲突。`;
    pack.texts[end]=`你绕开${threat}，回到${location.name}的公共通道。`;
    const fightText=id(`text.danger.${i}.fight`);pack.texts[fightText]=`你站稳脚步，准备应对${threat}。`;
    pack.actions.push({id:fight,label:`迎战${threat}`,hint:'进入战斗；可以防守或撤离',group:'event',context:{eventId:event,nodeId:'start'},conditions:[],effects:[{op:'event.exit'},{op:'combat.encounter'}],resultText:fightText},
      {id:avoid,label:'绕开，避开冲突',hint:'免费避开；保留其他探索机会',group:'event',context:{eventId:event,nodeId:'start'},conditions:[],effects:[{op:'event.advance',nodeId:'end'}],resultText:end});
    pack.events.push({id:event,startNode:'start',rating:'general',nodes:[{id:'start',type:'choice',textVariants:[prompt],actionIds:[fight,avoid],onEnter:[]},{id:'end',type:'exit',textVariants:[end],actionIds:[],onEnter:[{op:'event.exit'}]}]});
    pack.storylets!.push({id:id(`storylet.danger.${i}`),locationId:place.id,conditions:[],eventId:event,weight:10,priority:2,cooldownMinutes:60,cooldownGroup:`danger-${i}`,repeat:'daily',hidden:true,tags:[danger]});
  }
}
