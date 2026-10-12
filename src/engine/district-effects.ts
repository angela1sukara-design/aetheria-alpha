import { entityBody, PLAYER } from './query.ts';
import type { ActionDef, Effect, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { DistrictEffect } from '../core/district-types.ts';
import type { EffectContext } from './effects.ts';
import { district } from './district.ts';
import { evaluate } from './conditions.ts';
import { RuleError } from '../core/errors.ts';
import { bodyTraits } from './body.ts';
import { draw } from './rng.ts';
import { npcPresent, adultNPCEligibility } from './npc.ts';
export function applyDistrictEffect(e:DistrictEffect,s:GameState,r:Registry,c:EffectContext,apply:(e:Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
 const d=district(s);
 if(e.op==='player.create') {if(d.profile.created)throw new RuleError('CREATED','角色已经创建。');d.profile={name:e.name,ageYears:e.ageYears,created:true,adultOptional:false};c.resolvedTexts.push(`${e.name}，${e.ageYears}岁。你在租约上签下名字，把这座城市当作新的起点。`);}
 else if(e.op==='preference.set')d.profile.adultOptional=e.value;
 else if(e.op==='equipment.wear') {const item=r.equipment.find(x=>x.id===e.id);if(!item||!item.requires.every(x=>evaluate(x,s,r).pass))throw new RuleError('EQUIPMENT_FIT','装备与当前身体不兼容。');if(!d.inventory.includes(e.id))d.inventory.push(e.id);d.equipped=e.id;c.resolvedTexts.push(item.description);}
 else if(e.op==='equipment.remove') {d.equipped=null;c.resolvedTexts.push('你把装备收进背包，物品仍然保留。');}
 else if(e.op==='scene.start') {
  const def=r.interactions.find(x=>x.id===e.id);if(!def||d.scene||d.combat||!npcPresent(s,r,def.npcId)||!def.conditions.every(x=>evaluate(x,s,r).pass)||!d.profile.created||d.profile.ageYears<18||(r.textSlots.find(x=>x.id===def.textSlotId)?.contentTier==='adult_optional'&&!adultNPCEligibility(r,def.npcId).pass))throw new RuleError('SCENE_UNWILLING','当前身份、意愿或处境不适合继续。');
  const owner=r.textSlots.find(x=>x.id===def.textSlotId)!;const current=s.eventInstances.find(x=>x.instanceId===s.activeEventStack.at(-1));if(current?.definitionId!==owner.owner.eventId||current.nodeId!==owner.owner.nodeId)throw new RuleError('SCENE_CONTEXT','互动必须从约定的事件节点进入。');
  const pose=def.poses.find(p=>!p.requires||bodyTraits(s.player.body,r)[p.requires]>0);if(!pose||!s.player.body)throw new RuleError('SCENE_BODY','没有兼容的姿态。');
  const npcBody=entityBody(s,{kind:'npc',id:def.npcId});if(!npcBody.known)throw new RuleError('SCENE_BODY_UNKNOWN',npcBody.reason);
  s.meta.schemaVersion=4;s.meta.engineVersion='0.2-foundation';s.environment??={};
  d.scene={definitionId:e.id,phase:'active',poseId:pose.id,turn:0,actors:[{id:'player',entity:PLAYER,facing:pose.facing,zone:pose.zone},{id:def.npcId,entity:{kind:'npc',id:def.npcId},facing:'front',zone:'near'}],contacts:[]};
  if(!d.discovered.includes(def.id))d.discovered.push(def.id);c.resolvedTexts.push('双方确认可以暂停或离开。你们在约定的位置坐定，尚未建立接触。');
 }
 else if(e.op==='scene.act') {
  const scene=d.scene;if(!scene)throw new RuleError('NO_SCENE','当前没有互动场景。');const def=r.interactions.find(x=>x.id===scene.definitionId)!;
  if(e.move==='exit'){scene.contacts=[];d.scene=null;const slot=r.textSlots.find(x=>x.id===def.textSlotId)!;apply([{op:'event.advance',nodeId:slot.nextNodeId}],s,r,c);c.resolvedTexts.push('你们释放所有接触，各自收回动作资源，回到普通交谈。');return;}
  if(e.move==='pause'){scene.phase='paused';scene.contacts=[];c.resolvedTexts.push('你提出暂停，对方立即停止并松开接触。场景与前情保留。');return;}
  if(e.move==='resume'){if(!npcPresent(s,r,def.npcId)||!def.conditions.every(x=>evaluate(x,s,r).pass))throw new RuleError('SCENE_CONTEXT','需要重新确认对方是否在场并愿意继续。');scene.phase='active';c.resolvedTexts.push('你们重新确认意愿，从没有接触的位置继续。');return;}
  if(scene.phase!=='active')throw new RuleError('SCENE_PAUSED','先恢复场景或退出。');
  if(e.move==='pose'){const pose=def.poses.find(p=>p.id===e.poseId);if(!pose||(pose.requires&&bodyTraits(s.player.body,r)[pose.requires]<1))throw new RuleError('POSE_BODY','身体不具备该姿态的稳定条件。');scene.contacts=[];scene.poseId=pose.id;scene.actors[0]!.facing=pose.facing;scene.actors[0]!.zone=pose.zone;c.resolvedTexts.push(`先松开接触，再调整位置：${pose.label}。`);}
  else if(e.move==='release'){scene.contacts=[];c.resolvedTexts.push('你松开接触，对方也收回动作。');}
  else if(e.move==='contact'){const pose=def.poses.find(p=>p.id===scene.poseId)!;if(pose.facing!=='front'||pose.zone!=='near')throw new RuleError('CONTACT_POSITION','需要面对面且处于近处。');const free=s.player.body?.parts.find(p=>r.bodyPart(p.definitionId).kind==='hand'&&!scene.contacts.some(c=>c.playerPartId===p.instanceId));const npc=entityBody(s,scene.actors[1]!.entity!);const target=(npc.known?npc.value.parts:[]).find(p=>r.bodyPart(p.definitionId).kind==='hand'&&!scene.contacts.some(c=>c.npcPartId===p.instanceId));if(!free||!target)throw new RuleError('CONTACT_RESOURCE','没有空闲的抓握部位。');scene.contacts.push({playerPartId:free.instanceId,npcPartId:target.instanceId,sinceTurn:scene.turn});c.resolvedTexts.push('对方点头后，你们建立短暂的手部接触。双方的对应部位被占用，直到释放、转身、暂停或退出。');}
  scene.turn++;
 }
 else if(e.op==='combat.start') {
  const enemy=r.enemies.find(x=>x.id===e.id);if(!enemy||d.combat||d.scene||s.activeEventStack.length)throw new RuleError('COMBAT_CONTEXT','现在不能开始战斗。');
  if(s.player.variables['district:health']!<1)throw new RuleError('NEED_RECOVERY','需要先休息恢复。');
  d.combat={enemyId:e.id,hp:enemy.hp,turn:0,log:[`${enemy.name}挡住了你的路线。观察对方的意图，再决定行动。`]};
 }
 else if(e.op==='combat.turn') {
  const battle=d.combat;if(!battle)throw new RuleError('NO_COMBAT','当前没有战斗。');
  const enemy=r.enemies.find(x=>x.id===battle.enemyId)!,intent=enemy.intents[battle.turn%enemy.intents.length]!;
  apply([{op:'clock.advance',minutes:5}],s,r,c);
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
 if(!s.district)return actions;
 const runtime=r.actionsForHook('district:hook.runtime'),settings=runtime.filter(a=>a.effects.some(e=>e.op==='preference.set'));
 if(s.district.combat)return [...runtime.filter(a=>a.effects.some(e=>e.op==='combat.turn')),...settings];
 if(s.district.scene)return [...runtime.filter(a=>a.effects.some(e=>e.op==='scene.act'&&(s.district!.scene!.phase==='active'?e.move!=='resume':['resume','exit'].includes(e.move)))),...r.globalActions(),...settings];
 return [...actions,...settings];
}
export function districtText(s:GameState,r:Registry,base:string):string {
 if(!s.district)return base;
 if(s.district.combat){const b=s.district.combat,e=r.enemies.find(x=>x.id===b.enemyId)!;return `交锋：${e.name}\n\n对方体力 ${b.hp}/${e.hp} · 第${b.turn+1}回合\n\n下一步意图：${e.intents[b.turn%e.intents.length]!.label}\n\n${b.log.join('\n\n')}`;}
 if(s.district.scene){const scene=s.district.scene,i=r.interactions.find(x=>x.id===scene.definitionId)!,p=i.poses.find(p=>p.id===scene.poseId)!;return `${r.npc(i.npcId).name}与你 · ${scene.phase==='paused'?'暂停中':'正在相处'}\n\n姿态：${p.label}；朝向：${p.facing==='front'?'面向对方':'背向对方'}；位置：${p.zone==='near'?'近处':'桌子另一侧'}。\n\n${scene.contacts.length?`已建立${scene.contacts.length}条手部接触；对应动作资源被占用。`:'尚未建立接触，身体部位空闲。'}\n\n${base}`;}
 const event=s.eventInstances.find(x=>x.instanceId===s.activeEventStack.at(-1));
 const variants=r.sceneTexts.filter(v=>v.locationId===s.world.locationId&&(v.owner?v.owner.eventId===event?.definitionId&&v.owner.nodeId===event.nodeId:!event)&&v.conditions.every(c=>evaluate(c,s,r).pass)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id,'en'));
 return base+(variants[0]?'\n\n'+r.text(variants[0].textKey):'');
}
