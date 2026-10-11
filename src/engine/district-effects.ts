import type { ActionDef, Effect, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { DistrictEffect } from '../core/district-types.ts';
import type { EffectContext } from './effects.ts';
import { district } from './district.ts';
import { evaluate } from './conditions.ts';
import { RuleError } from '../core/errors.ts';
import { bodyTraits } from './body.ts';
import { draw } from './rng.ts';
export function applyDistrictEffect(e:DistrictEffect,s:GameState,r:Registry,c:EffectContext,apply:(e:Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
 const d=district(s);
 if(e.op==='player.create') {if(d.profile.created)throw new RuleError('CREATED','角色已经创建。');d.profile={name:e.name,ageYears:e.ageYears,created:true,adultOptional:false};c.resolvedTexts.push(`${e.name}，${e.ageYears}岁。你在租约上签下名字，把这座城市当作新的起点。`);}
 else if(e.op==='preference.set')d.profile.adultOptional=e.value;
 else if(e.op==='combat.start') {
  const enemy=r.enemies.find(x=>x.id===e.id);if(!enemy||d.combat||d.scene||s.activeEventStack.length)throw new RuleError('COMBAT_CONTEXT','现在不能开始战斗。');
  if(s.player.variables['district:health']!<1)throw new RuleError('NEED_RECOVERY','需要先休息恢复。');
  d.combat={enemyId:e.id,hp:enemy.hp,turn:0,log:[`${enemy.name}挡住了你的路线。观察对方的意图，再决定行动。`]};
 }
 else if(e.op==='combat.turn') {
  const battle=d.combat;if(!battle)throw new RuleError('NO_COMBAT','当前没有战斗。');
  const enemy=r.enemies.find(x=>x.id===battle.enemyId)!,intent=enemy.intents[battle.turn%enemy.intents.length]!;
  const end=(result:'victory'|'defeat'|'escape')=>{d.combat=null;c.resolvedTexts.push(result==='victory'?'你赢得了交锋。':result==='defeat'?'你失去继续战斗的力气，后续仍有恢复路径。':'你找到空隙离开了交锋。');apply([{op:'event.start',id:result==='victory'?enemy.victoryEventId:result==='defeat'?enemy.defeatEventId:enemy.escapeEventId}],s,r,c);};
  const energy=s.player.variables['core:energy']!,health=s.player.variables['district:health']!;
  let line='';
  if(e.move==='flee'&&(battle.turn>0||draw(s,`combat:${c.transactionId}`)<0.65)){end('escape');return;}
  if(e.move==='attack') {if(energy<3)throw new RuleError('EXHAUSTED','进攻需要3点精力，防守可恢复。');s.player.variables['core:energy']=energy-3;const damage=Math.max(1,12+(bodyTraits(s.player.body,r).tailGrip?3:0)-intent.guard);battle.hp=Math.max(0,battle.hp-damage);line=`你的进攻造成${damage}点伤害。`;}
  else if(e.move==='guard'){s.player.variables['core:energy']=Math.min(r.variable('core:energy').max,energy+4);line='你稳住重心，防守并恢复4点精力。';}
  else if(e.move==='recover'){if(energy<6)throw new RuleError('EXHAUSTED','临时包扎需要6点精力。');s.player.variables['core:energy']=energy-6;s.player.variables['district:health']=Math.min(40,health+10);line='你抓紧空隙包扎，恢复10点体力。';}
  else line='你尝试脱离，第一道出口被挡住；下一回合可以安全撤出。';
  if(battle.hp===0){const before=s.player.variables['core:money']!;s.player.variables['core:money']=Math.min(r.variable('core:money').max,before+enemy.reward);c.changes.push({label:'战斗报酬',before,after:s.player.variables['core:money']!});end('victory');return;}
  const damage=e.move==='guard'?Math.max(0,intent.damage-8):intent.damage;
  s.player.variables['district:health']=Math.max(0,s.player.variables['district:health']!-damage);
  s.player.variables['core:energy']=Math.max(0,s.player.variables['core:energy']!-intent.drain);
  line+=` ${intent.label}，你受到${damage}点伤害。`;
  battle.log.push(line);battle.log=battle.log.slice(-4);battle.turn++;c.resolvedTexts.push(line);
  c.changes.push({label:'体力',before:health,after:s.player.variables['district:health']!});
  if(s.player.variables['district:health']===0)end('defeat');
 }
 else throw new RuleError('MODULE_PENDING','该模块尚未接入。');
}
export function districtOptions(s:GameState,r:Registry,actions:ActionDef[]):ActionDef[] {
 if(s.district?.combat)return r.actionsForHook('district:hook.runtime').filter(a=>a.effects.some(e=>e.op==='combat.turn'));
 return actions;
}
export function districtText(s:GameState,r:Registry,base:string):string {
 if(!s.district)return base;
 if(s.district.combat){const b=s.district.combat,e=r.enemies.find(x=>x.id===b.enemyId)!;return `交锋：${e.name}\n\n对方体力 ${b.hp}/${e.hp} · 第${b.turn+1}回合\n\n下一步意图：${e.intents[b.turn%e.intents.length]!.label}\n\n${b.log.join('\n\n')}`;}
 const variants=r.sceneTexts.filter(v=>v.locationId===s.world.locationId&&v.conditions.every(c=>evaluate(c,s,r).pass)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id,'en'));
 return base+(s.activeEventStack.length?'':variants[0]?'\n\n'+r.text(variants[0].textKey):'');
}
