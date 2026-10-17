import type { EventContext, EventDef, EventInstance, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { ScopedTag } from '../core/adventure-types.ts';
import { RuleError } from '../core/errors.ts';
import { activeEvent } from './events.ts';
import { locationEnvironmentTags, matchingEnvironmentEnemyRules, selectEnvironmentEnemyRule } from './environment-enemies.ts';
import { residentTraits } from './personality.ts';
import { serviceAvailable } from './entity-functions.ts';
import { sceneContext } from './scene-context.ts';
import { drawDefeatPlayFills } from './defeat-play-draws.ts';

function candidates(s: GameState, r: Registry, def: EventDef) {
  const request = def.binding?.resident;
  return (s.district?.residents ?? []).filter(n => {
    if (n.locationId !== s.world.locationId) return false;
    if (!request?.tags.every(t => residentTraits(s, r, n).includes(t))) return false;
    return !request.service || serviceAvailable({ ...s, district: { ...s.district!, currentResidentId: n.id } }, r, request.service);
  }).sort((a, b) => Number(b.id === s.district?.currentResidentId) - Number(a.id === s.district?.currentResidentId) || a.id.localeCompare(b.id, 'en'));
}

/** Availability is a query: never draw, reserve an actor, or mutate the world. */
export function eventBindingCheck(s: GameState, r: Registry, def: EventDef): { pass: boolean; reason: string } {
  const b = def.binding;
  if (!b) return { pass: true, reason: '' };
  const tags = locationEnvironmentTags(s, r);
  if (!b.environmentTags?.every(t => tags.includes(t)) && b.environmentTags) return { pass: false, reason: '此地不具备这段故事需要的环境。' };
  if (b.resident && !candidates(s, r, def).length) return { pass: false, reason: '没有符合条件且能提供相应服务的在场居民。' };
  if (b.enemy && !matchingEnvironmentEnemyRules(s, r).length) return { pass: false, reason: '此地没有符合环境的对手。' };
  if (b.partKind && !s.player.body?.parts.some(p => r.bodyPart(p.definitionId).kind === b.partKind)) return { pass: false, reason: '当前身体没有故事需要的部位。' };
  return { pass: true, reason: '' };
}

/** Resolve once inside performAction; every label comes from a real saved source. */
export function bindEventContext(s: GameState, r: Registry, def: EventDef, transactionId: string): EventContext | undefined {
  if (!def.binding) return;
  const check = eventBindingCheck(s, r, def);
  if (!check.pass) throw new RuleError('EVENT_BINDING', check.reason);
  const context: EventContext = { locationId: s.world.locationId, fills: sceneContext(s, r) };
  const resident = def.binding.resident ? candidates(s, r, def)[0] : undefined;
  if (resident) {
    context.residentId = resident.id;
    context.fills.resident = resident.name;
    context.fills.opponent = resident.name;
    resident.persistent = true;
  }
  if (def.binding.enemy) {
    const rule = selectEnvironmentEnemyRule(s, r, `event-binding:${transactionId}`)!;
    const enemy = r.enemies.find(e => e.id === rule.enemyId)!;
    context.enemyId = enemy.id;
    context.enemyRuleId = rule.id;
    context.fills.opponent = rule.name ?? enemy.name;
    const combo = rule.defeatCombo ?? enemy.defeatCombo;
    // An enemy without a declared material pool must not acquire a random material.
    if (combo?.materials?.length) Object.assign(context.fills, drawDefeatPlayFills(s, `event-combo:${transactionId}`, { speciesKind: rule.speciesKind ?? enemy.speciesKind, defeatCombo: combo }));
  }
  if (def.binding.partKind) {
    const part = s.player.body!.parts.find(p => r.bodyPart(p.definitionId).kind === def.binding!.partKind)!;
    context.partId = part.instanceId;
    context.fills.part = r.bodyPart(part.definitionId).label.replace(/^人类(?=.{2,})/, '');
  }
  return context;
}

export function eventContextTags(s: GameState, r: Registry): ScopedTag[] {
  const context = activeEvent(s)?.context;
  if (!context) return [];
  const resident = s.district?.residents.find(n => n.id === context.residentId);
  const enemy = r.enemies.find(e => e.id === context.enemyId);
  const rule = r.environmentEnemyRules.find(e => e.id === context.enemyRuleId);
  return [
    ...locationEnvironmentTags(s, r, context.locationId).map(tagId => ({ role: 'environment' as const, tagId })),
    ...residentTraits(s, r, resident).map(tagId => ({ role: 'opponent' as const, tagId })),
    ...[...(enemy?.attributeTags ?? []), ...(enemy?.fetishTags ?? []), ...(rule?.attributeTags ?? []), ...(rule?.fetishTags ?? [])].map(tagId => ({ role: 'opponent' as const, tagId })),
  ];
}

export function eventText(text: string, event: EventInstance | undefined): string {
  if (!event?.context) return text;
  const result = text.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, key: string) => event.context!.fills[key] ?? token);
  if (/\{[a-zA-Z][a-zA-Z0-9]*\}/.test(result)) throw new RuleError('EVENT_TEXT', '故事缺少已绑定的正文信息。');
  return result;
}
