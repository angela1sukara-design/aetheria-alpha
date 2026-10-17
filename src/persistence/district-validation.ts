import { validateTraitTags,personalityEnabled } from '../engine/personality.ts';
import { validResidentQuestMemory } from '../engine/resident-quests.ts';
import { entityRef } from '../content/foundation-schema.ts';
import { bodyTraits } from '../engine/body.ts';
import { entityBody } from '../engine/query.ts';
import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { validateBody } from '../engine/body.ts';
import { validatePersonalName, formatName } from '../world/names.ts';
import { stableJson } from '../core/types.ts';
import { eventNode } from '../engine/events.ts';
export function validateDistrictState(s:GameState,r:Registry):void {
 const d=s.district;if(!d){if(r.storylets.length)throw Error('缺少街区存档模块。');return;}
 const int=(v:number,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('街区数值无效。');};
 if(d.version!==1||Object.keys(d).sort().join('|')!==['version','profile','residents','currentResidentId','storyletHistory','factsAt','discovered','inventory','equipped','combat','scene'].sort().join('|'))throw Error('街区模块版本或字段无效。');
 if(Object.keys(d.profile).some(k=>!['name','ageYears','created','adultOptional'].includes(k))||typeof d.profile.name!=='string'||!d.profile.name.trim()||d.profile.name.length>40||typeof d.profile.created!=='boolean'||typeof d.profile.adultOptional!=='boolean')throw Error('玩家身份无效。');if(d.profile.ageYears!==undefined)int(d.profile.ageYears,18,120);
 const ids=new Set<string>();for(const n of d.residents){const t=r.residentTemplates.find(t=>t.id===n.templateId);const origin=s.worldInstance?.agents.find(a=>a.residentId===n.id)?.originLocationId??n.locationId;if(!t||ids.has(n.id)||n.id!==`resident:${origin}:${t.id}`||!t.locationIds.includes(n.locationId)||!t.names.includes(n.name)||!t.appearance.includes(n.appearance)||!t.personality.includes(n.personality)||n.ageYears!==t.ageYears||n.speciesId!==t.speciesId||n.profession!==t.profession||typeof n.persistent!=='boolean')throw Error('路人身份无效。');ids.add(n.id);validateBody(n.body,r);if(n.traitTags!==undefined)validateTraitTags(n.traitTags,r);if(personalityEnabled(s)){if(JSON.stringify([...(n.traitTags??[])].sort())!==JSON.stringify([...(t.traitTags??[])].sort()))throw Error('居民性格与模板不符。');}else if(n.traitTags?.length)throw Error('旧世界不能注入结构化性格。');int(n.visits);int(n.trust);int(n.lastTalkDay,-1,Math.floor(s.clock.totalMinutes/1440));if(new Set(n.memories).size!==n.memories.length||n.memories.some(m=>! /^(talk|help):\d+$/.test(m) && !(personalityEnabled(s)&&/^conversation:(welcomed|declined|gift):\d+$/.test(m)&&Number(m.split(':')[2])<=Math.floor(s.clock.totalMinutes/1440)) && !validResidentQuestMemory(r,n.id,m)))throw Error('路人记忆无效。');}
 for(const n of d.residents){const t=r.residentTemplates.find(t=>t.id===n.templateId)!;const modern=s.worldInstance?.generation.generatorVersion==='0.11.0';if(modern&&!t.personalName)throw Error('新世界缺少结构化姓名模板。');if(t.personalName||n.personalName){validatePersonalName(t.personalName);validatePersonalName(n.personalName);if(formatName(n.personalName)!==n.name||stableJson(n.personalName)!==stableJson(t.personalName))throw Error('居民姓与名和身份模板不一致。');}}
 if(d.currentResidentId!==null&&!ids.has(d.currentResidentId))throw Error('当前路人缺失。');
 for(const h of d.storyletHistory){if(!r.storylets.some(t=>t.id===h.id))throw Error('Storylet缺失。');int(h.at,0,s.clock.totalMinutes);}
 for(const [id,at]of Object.entries(d.factsAt)){r.flag(id as `${string}:${string}`);int(at,0,s.clock.totalMinutes);}
 for(const id of d.discovered)if(!r.storylets.some(x=>x.id===id)&&!r.interactions.some(x=>x.id===id))throw Error('发现记录无效。');
 for(const id of d.inventory)if(!r.equipment.some(x=>x.id===id))throw Error('装备缺失。');if(d.equipped&&!d.inventory.includes(d.equipped))throw Error('装备不在背包中。');
 if(d.combat){const e=r.enemies.find(x=>x.id===d.combat!.enemyId);if(!e)throw Error('敌人缺失。');
  const c=d.combat as unknown as {enemy?:Record<string,unknown>;playerAp?:number;guarding?:boolean;selectionRuleId?:string;enemyName?:string;defeatTags?:{role:string;tagId:string}[];reward?:number};
  const hpMax=typeof c.enemy?.hpMax==='number'?c.enemy.hpMax as number:e.hp;int(d.combat.hp,1,hpMax);int(d.combat.turn);if(s.activeEventStack.length){const current=eventNode(s,r);if(!current?.node.combatOutcomes||current.event.context?.enemyId&&current.event.context.enemyId!==d.combat.enemyId)throw Error('战斗与事件状态冲突。');}
  if(c.enemy){for(const k of ['hpMax','attack','defense','speed','skillPower','crit','hit','evasion','skillResource','actionsPerTurn','defenseBonus','fleeBonus'] as const){const v=c.enemy[k];if(typeof v!=='number'||!Number.isSafeInteger(v))throw Error('战斗敌方运行时无效。');}
   if(!['S','M','L','boss'].includes(String(c.enemy.tier)))throw Error('战斗敌方档位无效。');}
  if(c.playerAp!==undefined)int(c.playerAp,0,10);if(c.guarding!==undefined&&typeof c.guarding!=='boolean')throw Error('战斗防守标记无效。');
  if(c.selectionRuleId!==undefined&&!r.environmentEnemyRules.some(x=>x.id===c.selectionRuleId))throw Error('环境选敌规则缺失。');
  if(c.enemyName!==undefined&&(typeof c.enemyName!=='string'||!c.enemyName.trim()||c.enemyName.length>100))throw Error('战斗敌方名称无效。');
  if(c.reward!==undefined)int(c.reward,0,100);
  if(c.defeatTags!==undefined){if(!Array.isArray(c.defeatTags))throw Error('战败标签无效。');for(const t of c.defeatTags){if(!['player','opponent','environment'].includes(t.role))throw Error('战败标签作用域无效。');r.tag(t.tagId as `${string}:${string}`);}}}
 if(d.scene){
  const scene=d.scene,i=r.interactions.find(x=>x.id===scene.definitionId),pose=i?.poses.find(p=>p.id===scene.poseId);
  if(!i||!pose||!['active','paused'].includes(scene.phase))throw Error('互动状态无效。');
  int(scene.turn);
  int(scene.arousal,0,100);int(scene.restraint,0,100);
  if(scene.actors.length!==2||scene.actors[0]?.id!=='player'||scene.actors[1]?.id!==i.npcId)throw Error('互动角色无效。');
  for(const a of scene.actors){
   if(s.meta.schemaVersion===3){if(a.entity)throw Error('v3 场景不能带实体引用。');validateBody(a.body,r);}
   else {if(Object.hasOwn(a,'body')||!a.entity||Object.keys(a).sort().join('|')!==['id','entity','facing','zone'].sort().join('|'))throw Error('场景必须引用权威实体。');entityRef(a.entity);if(a.id==='player'?a.entity.kind!=='player':a.entity.kind!=='npc'||a.entity.id!==a.id)throw Error('场景实体错配。');}
   if(!['front','away'].includes(a.facing)||!['near','across'].includes(a.zone))throw Error('场景朝向或位置无效。');
  }
  const player=s.player.body,npc=s.meta.schemaVersion===3?scene.actors[1].body:(()=>{const b=entityBody(s,scene.actors[1].entity!);return b.known?b.value:null;})();
  if(s.meta.schemaVersion===4&&scene.phase==='active'&&(!player||!npc||(pose.requires&&(bodyTraits(player,r)[pose.requires]<1))))throw Error('活动场景的真实身体未知或姿态不适配。');
  if(scene.phase==='paused'&&scene.contacts.length)throw Error('暂停场景不得保留接触。');
  const usedPlayer=new Set<string>(),usedNPC=new Set<string>();
  for(const edge of scene.contacts){
   const available=(body:typeof player,id:string)=>body?.parts.some(p=>p.instanceId===id&&r.bodyPart(p.definitionId).kind==='hand'&&r.bodyPart(p.definitionId).capabilities.includes('grasp'));
   if(usedPlayer.has(edge.playerPartId)||usedNPC.has(edge.npcPartId)||!available(player,edge.playerPartId)||!available(npc??null,edge.npcPartId))throw Error('接触端点缺失、无能力或重复占用。');
   usedPlayer.add(edge.playerPartId);usedNPC.add(edge.npcPartId);int(edge.sinceTurn,0,scene.turn);
  }
 }
}
