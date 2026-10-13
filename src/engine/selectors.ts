import { activityEligibility } from '../world/adaptation.ts';
import { entityBody } from './query.ts';
import type { ActionDef, ActionOption, GameState, GameView, Id } from '../core/types.ts';
import { clone, freeze } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { evaluate } from './conditions.ts';
import { transformationCheck } from './transformations.ts';
import { eventNode } from './events.ts';
import { npcPresent } from './npc.ts';
import { districtOptions, districtText } from './district-effects.ts';
import { directResourceCheck } from './resource-check.ts';
import type { TextLibrary } from '../content/text-variants.ts';
import { routeDistanceTier, routeStaminaCost, staminaGate, STAMINA_COST } from './numerics.ts';

const STAMINA_ID = 'core:stamina' as Id;

/** 所有可执行入口同一个选择器：UI 可见动作与引擎授权集合完全一致。 */
export function actionOptions(state: GameState, registry: Registry): ActionOption[] {
  const current = eventNode(state, registry);
  const actions: ActionDef[] = current ? current.node.actionIds.map(id => registry.action(id)).filter(x => x.context?.eventId === current.event.definitionId && x.context.nodeId === current.node.id) : registry.actionsAt(state.world.locationId).filter(x => !x.context);
  const topics = current ? [] : registry.npcs.filter(n => npcPresent(state, registry, n.id)).flatMap(n => registry.actionsForHook(n.topicHook));
  const allActions = [...new Map([...actions, ...topics, ...registry.globalActions()].map(a => [a.id, a])).values()];
  const stamina = state.player.variables[STAMINA_ID] ?? 100;
  const gate = staminaGate(stamina);
  return districtOptions(state, registry, allActions).map(definition => {
    const checks = definition.conditions.map(c => evaluate(c, state, registry));
    for (const e of definition.effects) {
      if (e.op === 'resident.help') {
        const resident = state.district?.residents.find(n => n.id === state.district?.currentResidentId), t = registry.residentTemplates.find(t => t.id === resident?.templateId);
        if (resident && t) checks.push(activityEligibility(resident.body, t, registry));
        checks.push({ pass: gate.allowLabor && stamina >= STAMINA_COST.labor, reason: stamina < STAMINA_COST.labor ? `体力不足：当前 ${stamina}，本次需要 ${STAMINA_COST.labor}。` : '体力过低，无法从事体力劳动。' });
      }
      if (e.op === 'scene.start') checks.push({ pass: !!state.district?.profile.created, reason: '先在公寓签下租约，确认成年角色身份。' });
      if (e.op === 'combat.turn' && e.move === 'attack') {
        checks.push({ pass: gate.allowAttack && stamina >= STAMINA_COST.attack, reason: gate.combatOnlyGuardOrFlee || !gate.allowAttack ? '体力过低，本回合只能防守或撤离。' : `进攻需要${STAMINA_COST.attack}点体力。` });
      }
      if (e.op === 'combat.turn' && e.move === 'recover') {
        checks.push({ pass: !gate.combatOnlyGuardOrFlee && stamina >= STAMINA_COST.recover, reason: gate.combatOnlyGuardOrFlee ? '体力耗尽，只能防守或撤离。' : `临时包扎需要${STAMINA_COST.recover}点体力。` });
      }
      if (e.op === 'combat.turn' && e.move === 'flee') {
        checks.push({ pass: stamina >= STAMINA_COST.flee, reason: `撤离需要${STAMINA_COST.flee}点体力。` });
      }
      if (e.op === 'combat.turn' && e.move === 'guard') {
        checks.push({ pass: stamina >= STAMINA_COST.guard, reason: '防守需要1点体力。' });
      }
      if (e.op === 'location.move') {
        const route = registry.route(e.routeId);
        const tier = routeDistanceTier(route);
        const cost = routeStaminaCost(route);
        checks.push({ pass: stamina >= cost, reason: `体力不足：当前 ${stamina}，本次移动需要 ${cost}。` });
        if (tier !== 'adjacent' && !gate.allowFarMove) {
          checks.push({ pass: false, reason: '体力不足，无法走远路/跨区' });
        }
      }
      if (e.op === 'scene.act' && e.move === 'contact') {
        const scene = state.district?.scene, def = registry.interactions.find(i => i.id === scene?.definitionId), pose = def?.poses.find(p => p.id === scene?.poseId);
        checks.push({ pass: pose?.facing === 'front' && pose.zone === 'near', reason: '面对面坐近后才可建立接触。' });
        checks.push({ pass: !!state.player.body?.parts.some(p => registry.bodyPart(p.definitionId).kind === 'hand' && !scene?.contacts.some(c => c.playerPartId === p.instanceId)), reason: '没有空闲的手部资源，先释放接触。' });
      }
    }
    for (const e of definition.effects) if (e.op === 'scene.act' && e.move === 'contact') {
      const scene = state.district?.scene;
      if (scene) {
        const b = entityBody(state, scene.actors[1]!.entity ?? { kind: 'npc', id: scene.actors[1]!.id as Id });
        checks.push({ pass: b.known && b.value.parts.some(p => registry.bodyPart(p.definitionId).kind === 'hand' && registry.bodyPart(p.definitionId).capabilities.includes('grasp') && !scene.contacts.some(c => c.npcPartId === p.instanceId)), reason: '对方没有空闲的抓握部位。' });
      }
    }
    checks.push(directResourceCheck(definition.effects, state, registry));
    for (const e of definition.effects) if (e.op === 'tf.apply' || e.op === 'tf.enqueue' || e.op === 'tf.pause' || e.op === 'tf.resume' || e.op === 'tf.cancel') checks.push(transformationCheck(state, registry, e.id, e.op, e.target));
    for (const e of definition.effects) if (e.op === 'event.start') for (const npcId of registry.event(e.id).participantIds ?? []) checks.push({ pass: npcPresent(state, registry, npcId), reason: `${registry.npc(npcId).name}此刻不在这里。` });
    const failed = checks.find(x => !x.pass);
    return { definition, available: !failed, reason: failed?.reason ?? '' };
  });
}
export function selectGameView(state: GameState, registry: Registry, texts?: TextLibrary): GameView {
  const current = eventNode(state, registry); const location = registry.location(state.world.locationId);
  const slot = current ? registry.textSlots.find(s => s.owner.eventId === current.event.definitionId && s.owner.nodeId === current.node.id) : undefined;
  const base = slot && texts ? texts.resolve(slot.id, state, registry) : current ? registry.text(current.event.textByNode[current.node.id]) : registry.text(location.textKey);
  return freeze({
    location, state: clone(state), actions: actionOptions(state, registry),
    sceneText: districtText(state, registry, base),
    ...(current ? { eventTitle: '正在发生' } : {}),
  });
}
