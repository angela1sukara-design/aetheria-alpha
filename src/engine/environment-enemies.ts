import type { GameState, Id } from '../core/types.ts';
import type { EnvironmentEnemyRule, ScopedTag } from '../core/adventure-types.ts';
import type { CombatEnemyRuntime, EnemyCombatStats, EnemyDef } from '../core/district-types.ts';
import type { Registry } from '../content/registry.ts';
import { environment } from './query.ts';
import { derivedSemantics } from './semantic-query.ts';
import { draw } from './rng.ts';

/** 地点层环境 tag：service / locationProfile.tags / 世界地点·区域 tags / 派生世界语义。词条本身不结算。 */
export function locationEnvironmentTags(s: GameState, r: Registry, locationId: Id = s.world.locationId): Id[] {
  const tags: Id[] = [];
  const has = (id: string) => typeof r.hasTag === 'function' ? r.hasTag(id) : r.tags.some(t => t.id === id);
  const push = (id: string) => { if (has(id) && !tags.includes(id as Id)) tags.push(id as Id); };
  const profile = r.locationProfiles.find(p => p.locationId === locationId);
  const service = environment(s, r, locationId).service;
  if (service.known) push(`foundation:service.${service.value}`);
  for (const tag of profile?.tags ?? []) push(tag);
  for (const tag of s.worldInstance?.definition.locations.find(l => l.id === locationId)?.tags ?? []) push(tag);
  const regionId = s.worldInstance?.definition.locations.find(l => l.id === locationId)?.regionId;
  for (const tag of s.worldInstance?.definition.regions.find(x => x.id === regionId)?.environmentTags ?? []) push(tag);
  for (const tag of derivedSemantics(s, r, { world: true })) push(tag);
  return tags;
}

export function matchingEnvironmentEnemyRules(s: GameState, r: Registry, enemyId?: Id): EnvironmentEnemyRule[] {
  const env = new Set(locationEnvironmentTags(s, r));
  return r.environmentEnemyRules.filter(rule => {
    if (enemyId && rule.enemyId !== enemyId) return false;
    if (!r.enemies.some(e => e.id === rule.enemyId)) return false;
    if (!rule.requiresTags.every(t => env.has(t))) return false;
    if ((rule.excludesTags ?? []).some(t => env.has(t))) return false;
    return true;
  });
}

/** 在匹配规则中按 priority 再 weight 抽一条；无可匹配时返回 undefined。 */
export function selectEnvironmentEnemyRule(s: GameState, r: Registry, streamKey: string, enemyId?: Id): EnvironmentEnemyRule | undefined {
  let pool = matchingEnvironmentEnemyRules(s, r, enemyId);
  if (!pool.length) return;
  const priority = Math.max(...pool.map(x => x.priority ?? 0));
  pool = pool.filter(x => (x.priority ?? 0) === priority).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  let roll = draw(s, streamKey) * pool.reduce((sum, x) => sum + Math.max(1, x.weight), 0);
  return pool.find(x => (roll -= Math.max(1, x.weight)) < 0) ?? pool.at(-1);
}

/** 把规则覆盖叠进已解析的运行时；hpMax/显示名/战败 tag/报酬一并返回。 */
export function overlayEnvironmentEnemy(
  enemy: EnemyDef,
  runtime: CombatEnemyRuntime,
  rule?: EnvironmentEnemyRule,
): { runtime: CombatEnemyRuntime; hp: number; reward: number; name: string; defeatTags?: ScopedTag[]; selectionRuleId?: Id } {
  const hp = rule?.hp ?? enemy.hp;
  const next: CombatEnemyRuntime = { ...runtime, hpMax: hp };
  const c = rule?.combat as Partial<EnemyCombatStats> | undefined;
  if (c) {
    if (c.attack !== undefined) next.attack = c.attack;
    if (c.defense !== undefined) next.defense = c.defense;
    if (c.speed !== undefined) next.speed = c.speed;
    if (c.skillPower !== undefined) next.skillPower = c.skillPower;
    if (c.crit !== undefined) next.crit = c.crit;
    if (c.hit !== undefined) next.hit = c.hit;
    if (c.evasion !== undefined) next.evasion = c.evasion;
    if (c.actionsPerTurn !== undefined) next.actionsPerTurn = c.actionsPerTurn;
    if (c.skillResource !== undefined) next.skillResource = c.skillResource;
  }
  return {
    runtime: next,
    hp,
    reward: rule?.reward ?? enemy.reward,
    name: rule?.name ?? enemy.name,
    defeatTags: rule?.defeatTags,
    selectionRuleId: rule?.id,
  };
}
