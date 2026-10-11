import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { validateBody } from '../engine/body.ts';
export function validateDistrictState(s:GameState,r:Registry):void {
 const d=s.district;if(!d){if(r.storylets.length)throw Error('缺少街区存档模块。');return;}
 const int=(v:number,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('街区数值无效。');};
 if(d.version!==1||Object.keys(d).sort().join('|')!==['version','profile','residents','currentResidentId','storyletHistory','factsAt','discovered','inventory','equipped','combat','scene'].sort().join('|'))throw Error('街区模块版本或字段无效。');
 if(typeof d.profile.name!=='string'||!d.profile.name.trim()||d.profile.name.length>40||typeof d.profile.created!=='boolean'||typeof d.profile.adultOptional!=='boolean')throw Error('玩家身份无效。');int(d.profile.ageYears,18,120);
 const ids=new Set<string>();for(const n of d.residents){const t=r.residentTemplates.find(t=>t.id===n.templateId);if(!t||ids.has(n.id)||n.id!==`resident:${n.locationId}:${t.id}`||!t.locationIds.includes(n.locationId)||!t.names.includes(n.name)||!t.appearance.includes(n.appearance)||!t.personality.includes(n.personality)||n.ageYears!==t.ageYears||n.speciesId!==t.speciesId||n.profession!==t.profession||typeof n.persistent!=='boolean')throw Error('路人身份无效。');ids.add(n.id);validateBody(n.body,r);int(n.visits);int(n.trust);int(n.lastTalkDay,-1,Math.floor(s.clock.totalMinutes/1440));if(new Set(n.memories).size!==n.memories.length||n.memories.some(m=>! /^(talk|help):\d+$/.test(m)))throw Error('路人记忆无效。');}
 if(d.currentResidentId!==null&&!ids.has(d.currentResidentId))throw Error('当前路人缺失。');
 for(const h of d.storyletHistory){if(!r.storylets.some(t=>t.id===h.id))throw Error('Storylet缺失。');int(h.at,0,s.clock.totalMinutes);}
 for(const [id,at]of Object.entries(d.factsAt)){r.flag(id as `${string}:${string}`);int(at,0,s.clock.totalMinutes);}
 for(const id of d.discovered)if(!r.storylets.some(x=>x.id===id)&&!r.interactions.some(x=>x.id===id))throw Error('发现记录无效。');
 for(const id of d.inventory)if(!r.equipment.some(x=>x.id===id))throw Error('装备缺失。');if(d.equipped&&!d.inventory.includes(d.equipped))throw Error('装备不在背包中。');
 if(d.combat){const e=r.enemies.find(x=>x.id===d.combat!.enemyId);if(!e)throw Error('敌人缺失。');int(d.combat.hp,1,e.hp);int(d.combat.turn);if(s.activeEventStack.length)throw Error('战斗与事件状态冲突。');}
 if(d.scene){const i=r.interactions.find(x=>x.id===d.scene!.definitionId);if(!i||!i.poses.some(p=>p.id===d.scene!.poseId)||!['active','paused'].includes(d.scene.phase))throw Error('互动状态无效。');int(d.scene.turn);for(const a of d.scene.actors)validateBody(a.body,r);if(d.scene.actors.length!==2||d.scene.actors[0]?.id!=='player'||d.scene.actors[1]?.id!==i.npcId)throw Error('互动角色无效。');const used=new Set<string>();for(const edge of d.scene.contacts){if(used.has(edge.playerPartId)||!s.player.body?.parts.some(p=>p.instanceId===edge.playerPartId&&r.bodyPart(p.definitionId).kind==='hand')||!d.scene.actors[1].body.parts.some(p=>p.instanceId===edge.npcPartId&&r.bodyPart(p.definitionId).kind==='hand'))throw Error('接触端点无效。');used.add(edge.playerPartId);int(edge.sinceTurn,0,d.scene.turn);}}
}
