import type { GameState } from '../core/types.ts';import type { Registry } from '../content/registry.ts';import type { EffectContext } from './effects.ts';import { bodyTraits } from './body.ts';import { evaluate } from './conditions.ts';
export function revalidateDistrict(s:GameState,r:Registry,c:EffectContext):void {
 const d=s.district;if(!d)return;
 if(d.currentResidentId){const resident=d.residents.find(x=>x.id===d.currentResidentId),template=r.residentTemplates.find(t=>t.id===resident?.templateId),minute=s.clock.totalMinutes%1440;if(template&&!(template.start<template.end?minute>=template.start&&minute<template.end:minute>=template.start||minute<template.end))d.currentResidentId=null;}
 if(d.equipped){const item=r.equipment.find(x=>x.id===d.equipped)!;if(!item.requires.every(x=>evaluate(x,s,r).pass)){d.equipped=null;c.resolvedTexts.push(`${item.name}与变化后的身体不再兼容，已卸下并保留在背包。`);}}
 if(d.scene){const scene=d.scene,def=r.interactions.find(x=>x.id===scene.definitionId)!,pose=def.poses.find(p=>p.id===scene.poseId)!;
 scene.actors[0]!.body=structuredClone(s.player.body!);
 scene.contacts=scene.contacts.filter(c=>s.player.body?.parts.some(p=>p.instanceId===c.playerPartId&&r.bodyPart(p.definitionId).kind==='hand'));
 if(pose.requires&&bodyTraits(s.player.body,r)[pose.requires]<1){scene.contacts=[];scene.phase='paused';c.resolvedTexts.push('身体变化使当前姿态失去稳定条件，场景暂停并释放接触；可以退出后重新进入。');}
 }
}
