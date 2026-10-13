import type { GameState, Id } from '../core/types.ts';
import type { AdventureCondition, AdventureEffect, AdventureField } from '../core/adventure-types.ts';
import type { Registry } from '../content/registry.ts';
import type { EffectContext } from './effects.ts';
import { adventure, initialAdventure } from './narrative.ts';
import { RuleError } from '../core/errors.ts';
import { bodyTraits } from './body.ts';
import { environment } from './query.ts';

export function adventureValue(s:GameState,field:AdventureField|'victories'):number { const a=s.adventure??initialAdventure();return field==='victories'?Object.values(a.victories).reduce((n,v)=>n+v,0):a[field]; }
export function progressionCheck(s:GameState,r:Registry,move:Extract<AdventureCondition,{op:'progression.available'}>['move'],id?:Id):{pass:boolean;reason:string} {
  const a=s.adventure??initialAdventure(),v=s.player.variables,day=Math.floor(s.clock.totalMinutes/1440),used=(key:string)=>a.daily[day+':'+key]??0;
  const fail=(reason:string)=>({pass:false,reason});
  const service=environment(s,r).service,at=(x:string)=>service.known&&service.value===x;
  if(s.district?.combat||s.district?.scene)return fail('先结束眼前的交锋或互动。');
  if(move==='train'){
    if(!id||!['core:attack','core:defense','core:speed','core:skillPower','core:hit','core:evasion','core:crit'].includes(id))return fail('训练项目无效。');
    const cap=id==='core:hit'?95:id==='core:crit'?30:40;
    if(v[id]!>=cap)return fail('已达到当前训练上限。');
    if(used('training')>=3||used('training:'+id)>=2)return fail('今天的训练额度已用完，休息后明天再来。');
    if(v['core:stamina']!<8||v['core:energy']!<4||v['core:money']!<8)return fail('训练需要体力8、精力4、零钱8。');
    if(!at('workshop')&&!at('commons'))return fail('到工坊或公共训练区训练。');
  }else if(move==='buy'){
    const item=r.equipment.find(e=>e.id===id);if(!item)return fail('装备不存在。');
    if(!at('market')&&!at('workshop'))return fail('到市场或工坊购买装备。');
    if(s.district?.inventory.includes(item.id))return fail('已经拥有这件装备。');
    const price=item.slot==='weapon'?25:30;if(v['core:money']!<price)return fail(`需要零钱${price}。`);
  }else if(move==='order'){
    if(!at('market')&&!at('workshop'))return fail('到市场或工坊承接订单。');
    if(!bodyTraits(s.player.body,r).grasp)return fail('需要可用的抓握部位。');
    if(used('orders')>=3)return fail('今天的公开订单已经完成，明天再来。');
    if(v['core:stamina']!<8||v['core:energy']!<5)return fail('完成订单需要体力8、精力5。');
  }else if(move==='invest'){
    if(!at('market'))return fail('在市场登记经营份额。');if(v['core:money']!<30)return fail('登记经营份额需要零钱30。');
    if(used('invest')>=1)return fail('今天已登记过经营份额。');
  }else if(move==='patrol'){
    if(used('patrol')>=1)return fail('今天已经完成巡查。');if(v['core:stamina']!<10)return fail('巡查需要体力10。');
  }else if(move==='aid'){
    if(used('aid')>=1)return fail('今天的公共协作已记录。');if(v['core:stamina']!<4)return fail('协作需要体力4。');
  }else if(move==='reconcile'){
    if(used('reconcile')>=1)return fail('今天已经完成调解。');if(v['core:energy']!<4)return fail('调解需要精力4。');
  }
  return {pass:true,reason:''};
}
export function applyProgression(e:Extract<AdventureEffect,{op:'progression.act'|'adventure.change'}>,s:GameState,r:Registry,c:EffectContext,apply:(effects:import('../core/types.ts').Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
  const a=adventure(s);
  const change=(field:AdventureField,amount:number)=>{const before=a[field];a[field]=Math.max(0,Math.min(1000000,before+amount));if(a[field]!==before)c.changes.push({label:({assets:'经营份额',influence:'组织影响',safety:'街区安全',reputation:'公共声望',orders:'已完成订单',contracts:'登记契约'})[field],before,after:a[field]});};
  if(e.op==='adventure.change'){change(e.field,e.amount);return;}
  const check=progressionCheck(s,r,e.move,e.id);if(!check.pass)throw new RuleError('PROGRESSION_BLOCKED',check.reason);
  const day=Math.floor(s.clock.totalMinutes/1440),use=(key:string)=>{a.daily[day+':'+key]=(a.daily[day+':'+key]??0)+1;};
  const pay=(id:Id,amount:number)=>apply([{op:'var.change',id,amount}],s,r,c);
  let minutes=30,line='';
  if(e.move==='train'){
    pay('core:money',-8);pay('core:stamina',-8);pay('core:energy',-4);pay(e.id!,1);use('training');use('training:'+e.id);minutes=45;line=`你完成了${r.variable(e.id!).label}训练，提升1点。每项每天最多2次，所有项目合计每天3次。`;
  }else if(e.move==='buy'){
    const item=r.equipment.find(x=>x.id===e.id)!;pay('core:money',-(item.slot==='weapon'?25:30));s.district!.inventory.push(item.id);line=`你买下${item.name}，已放入背包。`;minutes=10;
  }else if(e.move==='order'){
    pay('core:stamina',-8);pay('core:energy',-5);pay('core:money',12+Math.min(8,Math.floor(a.reputation/5)));change('orders',1);change('assets',1);change('reputation',1);use('orders');line='订单已经交付，报酬到账；你保留了一份可持续结算的经营份额。';
  }else if(e.move==='invest'){
    pay('core:money',-30);change('assets',2);change('contracts',1);use('invest');minutes=45;line='经营份额与契约已经登记。之后跨日可结算经营收入，收入每天最多20币。';
  }else if(e.move==='patrol'){
    pay('core:stamina',-10);change('safety',2);change('influence',1);pay('core:money',5);use('patrol');minutes=45;line='你完成一次实际巡查，通道安全提高，组织影响与报酬已记录。';
  }else if(e.move==='aid'){
    pay('core:stamina',-4);change('reputation',2);change('safety',1);use('aid');line='你完成公共协作，声望和街区安全有所提高。';
  }else{
    pay('core:energy',-4);change('reputation',1);change('influence',1);change('safety',1);use('reconcile');line='你完成当面调解，组织影响和街区安全有所提高。';
  }
  apply([{op:'clock.advance',minutes}],s,r,c);c.resolvedTexts.push(line);a.journal.push({at:s.clock.totalMinutes,title:'当地进展',text:line});a.journal=a.journal.slice(-64);
}
export function advanceAdventureDay(s:GameState,r:Registry):void {
  if(!s.adventure)return;const a=s.adventure,day=Math.floor(s.clock.totalMinutes/1440),last=a.daily['world.day']??day;a.daily['world.day']=day;
  if(day>last){const income=Math.min(20,a.assets*2)*(day-last);s.player.variables['core:money']=Math.min(r.variable('core:money').max,(s.player.variables['core:money']??0)+income);a.journal.push({at:s.clock.totalMinutes,title:'经营结算',text:`过去${day-last}天经营收入${income}币，经营份额${a.assets}。`});a.journal=a.journal.slice(-64);for(const key of Object.keys(a.daily))if(/^\d+:/.test(key)&&Number(key.split(':')[0])<day-7)delete a.daily[key];}
}
