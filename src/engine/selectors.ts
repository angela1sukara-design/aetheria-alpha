import { activityEligibility } from '../world/adaptation.ts';
import { entityBody } from './query.ts';
import type { ActionDef, ActionOption, GameState, GameView } from '../core/types.ts';
import { clone, freeze } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { evaluate } from './conditions.ts';
import { transformationCheck } from './transformations.ts';
import { eventNode } from './events.ts';
import { npcPresent } from './npc.ts';
import { districtOptions, districtText } from './district-effects.ts';
import { directResourceCheck } from './resource-check.ts';
import type { TextLibrary } from '../content/text-variants.ts';
/** 所有可执行入口同一个选择器：UI 可见动作与引擎授权集合完全一致。 */
export function actionOptions(state: GameState, registry: Registry): ActionOption[] {
  const current = eventNode(state, registry);
  const actions: ActionDef[] = current ? current.node.actionIds.map(id => registry.action(id)).filter(x => x.context?.eventId === current.event.definitionId && x.context.nodeId === current.node.id) : registry.actionsAt(state.world.locationId).filter(x => !x.context);
  const topics = current ? [] : registry.npcs.filter(n => npcPresent(state, registry, n.id)).flatMap(n => registry.actionsForHook(n.topicHook));
  const allActions = [...new Map([...actions, ...topics, ...registry.globalActions()].map(a => [a.id, a])).values()];
  return districtOptions(state,registry,allActions).map(definition => {
    const checks = definition.conditions.map(c => evaluate(c, state, registry));
    for (const e of definition.effects) {
      if(e.op==='resident.help'){const resident=state.district?.residents.find(n=>n.id===state.district?.currentResidentId),t=registry.residentTemplates.find(t=>t.id===resident?.templateId);if(resident&&t)checks.push(activityEligibility(resident.body,t,registry));}
      if(e.op==='scene.start')checks.push({pass:!!state.district?.profile.created,reason:'先在公寓签下租约，确认成年角色身份。'});
      if(e.op==='combat.turn'&&e.move==='attack')checks.push({pass:state.player.variables['core:energy']!>=3,reason:'进攻需要3点精力，防守可恢复。'});
      if(e.op==='combat.turn'&&e.move==='recover')checks.push({pass:state.player.variables['core:energy']!>=6,reason:'临时包扎需要6点精力。'});
      if(e.op==='scene.act'&&e.move==='contact') {const scene=state.district?.scene,def=registry.interactions.find(i=>i.id===scene?.definitionId),pose=def?.poses.find(p=>p.id===scene?.poseId);checks.push({pass:pose?.facing==='front'&&pose.zone==='near',reason:'面对面坐近后才可建立接触。'});checks.push({pass:!!state.player.body?.parts.some(p=>registry.bodyPart(p.definitionId).kind==='hand'&&!scene?.contacts.some(c=>c.playerPartId===p.instanceId)),reason:'没有空闲的手部资源，先释放接触。'});}
    }
    for(const e of definition.effects)if(e.op==='scene.act'&&e.move==='contact'){const scene=state.district?.scene;if(scene){const b=entityBody(state,scene.actors[1]!.entity??{kind:'npc',id:scene.actors[1]!.id as import('../core/types.ts').Id});checks.push({pass:b.known&&b.value.parts.some(p=>registry.bodyPart(p.definitionId).kind==='hand'&&registry.bodyPart(p.definitionId).capabilities.includes('grasp')&&!scene.contacts.some(c=>c.npcPartId===p.instanceId)),reason:'对方没有空闲的抓握部位。'});}}
    checks.push(directResourceCheck(definition.effects, state, registry));
    for (const e of definition.effects) if (e.op === 'tf.apply' || e.op === 'tf.enqueue' || e.op === 'tf.pause' || e.op === 'tf.resume' || e.op === 'tf.cancel') checks.push(transformationCheck(state, registry, e.id, e.op,e.target));
    for (const e of definition.effects) if (e.op === 'event.start') for (const npcId of registry.event(e.id).participantIds ?? []) checks.push({ pass: npcPresent(state, registry, npcId), reason: `${registry.npc(npcId).name}此刻不在这里。` });
    const failed = checks.find(x => !x.pass);
    return { definition, available: !failed, reason: failed?.reason ?? '' };
  });
}
export function selectGameView(state: GameState, registry: Registry, texts?: TextLibrary): GameView {
  const current = eventNode(state, registry); const location = registry.location(state.world.locationId);
  const slot=current?registry.textSlots.find(s=>s.owner.eventId===current.event.definitionId&&s.owner.nodeId===current.node.id):undefined;
  const base=slot&&texts?texts.resolve(slot.id,state,registry):current?registry.text(current.event.textByNode[current.node.id]):registry.text(location.textKey);
  return freeze({ location, state: clone(state), actions: actionOptions(state, registry),
    sceneText: districtText(state,registry,base),
    ...(current ? { eventTitle: '正在发生' } : {}),
  });
}
