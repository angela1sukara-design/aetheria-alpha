import { respondConversation } from './personality.ts';
import type { Change, Effect, EventInstance, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { advanceTransformationTime, performTransformation } from './transformations.ts';
import { formatClock } from './clock.ts';
import { draw } from './rng.ts';
import { activeEvent } from './events.ts';
import { encounter, residentInteraction } from './district.ts';
import { applyDistrictEffect } from './district-effects.ts';
import { aftertasteDecay, isSanityHostileLocation, routeDistanceTier, routeDurationMinutes, routeStaminaCost, SANITY_PASSIVE_DRAIN_ENABLED, SANITY_PASSIVE_DRAIN_INTERVAL, sanityPassiveDrainSteps, sanityRestDelta, skillResourceOutOfCombatRegen, staminaGate } from './numerics.ts';
import { SANITY_BREAK_FLAG, SANITY_ID } from '../persistence/vars-migration.ts';
import { npcPresent, rememberNPC } from './npc.ts';
import { residentPresent, rememberResident } from './resident-quests.ts';
import { startNarrative, advanceNarrative } from './narrative.ts';
import { advanceAdventureDay, applyProgression } from './progression.ts';
export interface EffectContext { budget: number; changes: Change[]; resolvedTexts: string[]; transactionId: string; actionId: import('../core/types.ts').Id; narrativeChoice?: { nodeId: import('../core/types.ts').Id; index: number } }
export function applyEffects(effects: Effect[], draft: GameState, registry: Registry, context: EffectContext): void {
  // 旅行 Action 常仍带 clock.advance 10；时钟改由 location.move 按 Route 推进，同批效果内跳过以免双计（保留旧包指纹）。
  const routeOwnsClock = effects.some(e => e.op === 'location.move');
  for (const effect of effects) {
    if (--context.budget < 0) throw new RuleError('EFFECT_BUDGET', '单次事务效果超过安全上限。');
    switch (effect.op) {
      case 'conversation.respond': {const delta=respondConversation(draft,registry,effect.reaction);if(delta.before!==delta.after)context.changes.push({label:`${delta.name}的信任`,before:delta.before,after:delta.after});break;}
      case 'narrative.start': startNarrative(draft,registry,context,effect.kind,effect.profileId);break;
      case 'narrative.choose': advanceNarrative(draft,registry,context,effect.index,applyEffects);break;
      case 'adventure.change': case 'progression.act': applyProgression(effect,draft,registry,context,applyEffects);break;
      case 'resident.remember': rememberResident(draft, registry, effect.residentId, effect.memoryId); break;
      case 'world.encounter': { const id = encounter(draft,registry,effect.events !== false); if(id) applyEffects([{op:'event.start',id}],draft,registry,context); else context.resolvedTexts.push(effect.events === false ? (draft.district?.currentResidentId ? '你向另一位在场居民打了招呼，可以继续交谈或协助。' : '此刻没有居民在这里停留。可以查看公共活动时段，再等候或前往其他地点。') : '街区暂时平静。你留意了周围的人与路况。'); break; }
      case 'resident.talk': case 'resident.help': context.resolvedTexts.push(residentInteraction(draft,registry,effect.op === 'resident.help')); break;
      case 'combat.start': case 'combat.encounter': case 'combat.turn': case 'scene.start': case 'scene.act': case 'equipment.wear': case 'equipment.remove': case 'item.use': case 'item.gain': case 'item.consume': case 'player.create': case 'preference.set':
        applyDistrictEffect(effect,draft,registry,context,applyEffects); break;
      case 'environment.setLight': {
        if(draft.meta.schemaVersion!==4)throw new RuleError('STATE_VERSION','环境覆盖需要存档 v4。');
        registry.location(effect.locationId);(draft.environment??={})[effect.locationId]={light:effect.value};break;
      }
      case 'var.change': {
        const def = registry.variable(effect.id); const before = draft.player.variables[effect.id];
        const after = Math.min(def.max, before + effect.amount);
        if (after < def.min) throw new RuleError('INSUFFICIENT_RESOURCE', `${def.label}不足：当前 ${before}，本次需要 ${-effect.amount}。`);
        draft.player.variables[effect.id] = after;
        if (before !== after) context.changes.push({ label: def.label, before, after });
        break;
      }
      case 'flag.set': {
        registry.flag(effect.id); const before = draft.player.flags[effect.id]; draft.player.flags[effect.id] = effect.value;
        if (effect.value && draft.district && draft.district.factsAt[effect.id] === undefined) draft.district.factsAt[effect.id] = draft.clock.totalMinutes;
        if (before !== effect.value) context.changes.push({ label: '记录已更新', before, after: effect.value });
        break;
      }
      case 'clock.advance': {
        if (routeOwnsClock) break;
        const before = draft.clock.totalMinutes; advanceTransformationTime(draft, effect.minutes, registry, context.changes);
        advanceAdventureDay(draft,registry);
        if (effect.minutes) context.changes.push({ label: '时间', before: formatClock(before), after: formatClock(draft.clock.totalMinutes) });
        const restLike = /(?:^|:)action\.(?:rest|waitday|sleep)\b/.test(context.actionId) || context.actionId.includes('.rest.') || context.actionId.includes('.waitday.');
        if (effect.minutes > 0 && !draft.district?.combat) {
          const recovery = draft.clock.recovery ?? { aftertasteMinutes: 0, skillMinutes: 0, sanityHostileMinutes: 0 };
          const aftertasteMinutes = recovery.aftertasteMinutes + effect.minutes;
          const skillMinutes = recovery.skillMinutes + effect.minutes;
          const atDef = registry.variables.find(v => v.id === 'core:aftertaste');
          const srDef = registry.variables.find(v => v.id === 'core:skillResource');
          if (atDef && 'core:aftertaste' in draft.player.variables) {
            const b = draft.player.variables[atDef.id]!;
            const a = aftertasteDecay(b, aftertasteMinutes);
            if (a !== b) { draft.player.variables[atDef.id] = a; context.changes.push({ label: atDef.label, before: b, after: a }); }
          }
          if (srDef && 'core:skillResource' in draft.player.variables) {
            const b = draft.player.variables[srDef.id]!;
            const a = skillResourceOutOfCombatRegen(b, skillMinutes, srDef.max);
            if (a !== b) { draft.player.variables[srDef.id] = a; context.changes.push({ label: srDef.label, before: b, after: a }); }
          }
          draft.clock.recovery = {
            aftertasteMinutes: aftertasteMinutes % 60,
            skillMinutes: skillMinutes % 30,
            sanityHostileMinutes: recovery.sanityHostileMinutes ?? 0,
          };
        }
        if(context.actionId==='aetheria:action.rest'&&effect.minutes>=30){const id='core:stamina' as const,def=registry.variables.find(v=>v.id===id);if(def){const before=draft.player.variables[id]!;draft.player.variables[id]=Math.min(def.max,before+Math.floor(effect.minutes/30)*12);if(before!==draft.player.variables[id])context.changes.push({label:def.label,before,after:draft.player.variables[id]!});}}
        if (restLike && effect.minutes >= 30) {
          const def = registry.variables.find(v => v.id === SANITY_ID);
          const delta = sanityRestDelta(effect.minutes);
          if (def && delta && SANITY_ID in draft.player.variables) {
            const b = draft.player.variables[SANITY_ID]!;
            const a = Math.min(def.max, Math.max(def.min, b + delta));
            if (a !== b) { draft.player.variables[SANITY_ID] = a; context.changes.push({ label: def.label, before: b, after: a }); }
          }
        } else if (
          SANITY_PASSIVE_DRAIN_ENABLED
          && effect.minutes > 0
          && !restLike
          && SANITY_ID in draft.player.variables
          && isSanityHostileLocation(draft.world.locationId)
        ) {
          const recovery = draft.clock.recovery ?? { aftertasteMinutes: 0, skillMinutes: 0, sanityHostileMinutes: 0 };
          const hostileMinutes = (recovery.sanityHostileMinutes ?? 0) + effect.minutes;
          const steps = sanityPassiveDrainSteps(hostileMinutes);
          const def = registry.variable(SANITY_ID);
          if (steps > 0) {
            const b = draft.player.variables[SANITY_ID]!;
            const a = Math.max(def.min, b - steps);
            draft.player.variables[SANITY_ID] = a;
            if (a !== b) context.changes.push({ label: def.label, before: b, after: a });
            if (a <= def.min) draft.player.flags[SANITY_BREAK_FLAG] = true;
          }
          draft.clock.recovery = {
            aftertasteMinutes: recovery.aftertasteMinutes ?? 0,
            skillMinutes: recovery.skillMinutes ?? 0,
            sanityHostileMinutes: hostileMinutes % SANITY_PASSIVE_DRAIN_INTERVAL,
          };
        }
        break;
      }
      case 'location.move': {
        if (activeEvent(draft)) throw new RuleError('EVENT_ACTIVE', '先完成或退出当前事件。');
        const route = registry.route(effect.routeId);
        if (route.from !== draft.world.locationId) throw new RuleError('INVALID_ROUTE_ORIGIN', '当前地点不是这条路线的起点。');
        const tier = routeDistanceTier(route);
        const staminaCost = routeStaminaCost(route);
        const duration = routeDurationMinutes(route);
        const staminaId = 'core:stamina' as import('../core/types.ts').Id;
        if (staminaId in draft.player.variables) {
          const def = registry.variable(staminaId);
          const beforeSt = draft.player.variables[staminaId]!;
          if (tier !== 'adjacent' && !staminaGate(beforeSt).allowFarMove) {
            throw new RuleError('EXHAUSTED', '体力不足，无法走远路/跨区');
          }
          const afterSt = beforeSt - staminaCost;
          if (afterSt < def.min) throw new RuleError('INSUFFICIENT_RESOURCE', `${def.label}不足：当前 ${beforeSt}，本次需要 ${staminaCost}。`);
          draft.player.variables[staminaId] = afterSt;
          context.changes.push({ label: def.label, before: beforeSt, after: afterSt });
        }
        const before = registry.location(route.from).name;
        draft.world.locationId = route.to;
        if (!draft.world.knownLocationIds.includes(route.to)) draft.world.knownLocationIds.push(route.to);
        context.changes.push({ label: '地点', before, after: registry.location(route.to).name });
        // 时钟单一来源：按 Route duration 推进（旅行 Action 不再硬编码 10min）
        if (duration > 0) applyEffects([{ op: 'clock.advance', minutes: duration }], draft, registry, context);
        break;
      }
      case 'event.start': {
        if (activeEvent(draft)) throw new RuleError('EVENT_ACTIVE', '本切片暂不支持嵌套事件。');
        const def = registry.event(effect.id);
        for (const residentId of def.residentIds ?? []) {
          if (!residentPresent(draft, residentId)) throw new RuleError('RESIDENT_ABSENT', '约定的居民此刻不在这里。');
          draft.district!.residents.find(r => r.id === residentId)!.persistent = true;
        }
        for (const id of def.participantIds ?? []) if (!npcPresent(draft, registry, id)) throw new RuleError('NPC_ABSENT', `${registry.npc(id).name}不在这里。`);
        const instance: EventInstance = {
          instanceId: `event-${context.transactionId}`, definitionId: def.id, nodeId: def.startNode,
          status: 'active', textByNode: {}, draws: [], locals: {},
        };
        draft.eventInstances.push(instance); draft.activeEventStack.push(instance.instanceId);
        enterNode(instance, draft, registry, context);
        break;
      }
      case 'event.advance': {
        const instance = activeEvent(draft);
        if (!instance) throw new RuleError('NO_EVENT', '没有正在进行的事件。');
        instance.nodeId = effect.nodeId; enterNode(instance, draft, registry, context); break;
      }
      case 'event.exit': {
        const instance = activeEvent(draft);
        if (!instance) throw new RuleError('NO_EVENT', '没有正在进行的事件。');
        instance.status = 'completed'; draft.activeEventStack.pop(); break;
      }
      case 'tf.apply': case 'tf.enqueue': case 'tf.pause': case 'tf.resume': case 'tf.cancel':
        performTransformation(effect.op, effect.id, draft, registry, context.transactionId, context.actionId, context.changes,effect.target); break;
      case 'npc.remember': rememberNPC(draft, registry, effect.npcId, effect.memoryId, effect.relationship, context.actionId, context.transactionId, context.changes); break;
      default: throw new RuleError('UNSUPPORTED_EFFECT', '效果未实现，事务未提交。');
    }
  }
}
function enterNode(instance: EventInstance, draft: GameState, registry: Registry, context: EffectContext): void {
  const node = registry.event(instance.definitionId).nodes.find(x => x.id === instance.nodeId);
  if (!node) throw new RuleError('INVALID_NODE', '事件节点不存在。');
  // 已抽结果固化到实例；重绘、存读和查看地图只读 textByNode，不重抽、不重放 onEnter。
  if (!instance.textByNode[node.id]) {
    if (registry.event(instance.definitionId).textMode === 'fixed') instance.textByNode[node.id] = node.textVariants[0]!;
    else {
      const value = draw(draft, `event:${instance.instanceId}`);
      instance.draws.push({ nodeId: node.id, value });
      instance.textByNode[node.id] = node.textVariants[Math.floor(value * node.textVariants.length)];
    }
    applyEffects(node.onEnter, draft, registry, context);
  }
  if (node.type === 'exit') context.resolvedTexts.push(registry.text(instance.textByNode[node.id]));
}
