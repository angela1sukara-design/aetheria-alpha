import { presentationText } from './semantic-query.ts';
import { entityBody, PLAYER } from './query.ts';
import type { ActionDef, Effect, GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { CombatEnemyRuntime, DistrictEffect, EnemyDef } from '../core/district-types.ts';
import type { EffectContext } from './effects.ts';
import { district } from './district.ts';
import { evaluate } from './conditions.ts';
import { RuleError } from '../core/errors.ts';
import { bodyTraits } from './body.ts';
import { draw } from './rng.ts';
import { npcPresent, adultNPCEligibility } from './npc.ts';
import { PLAYER_HP_ID, SANITY_BREAK_FLAG, SANITY_ID } from '../persistence/vars-migration.ts';
import {
  aftertasteOnExit,
  BOSS_TEMPLATE,
  COMBAT_CARD,
  combatDamage,
  combatHitChance,
  ENEMY_TIER_TEMPLATES,
  fleeChancePercent,
  sanityGain,
  STAMINA_COST,
  type CombatActorStats,
} from './numerics.ts';
import { transformProgress } from './transform-perception.ts';

export const SANITY_BREAK_EVENT = 'district:event.sanity_break' as Id;
const STAMINA_ID = 'core:stamina' as Id;
const ENERGY_ID = 'core:energy' as Id;
const SKILL_RES_ID = 'core:skillResource' as Id;
const AP_ID = 'core:actionPoints' as Id;
const AFTERTASTE_ID = 'core:aftertaste' as Id;
const SUBMISSION_ID = 'core:submissionTendency' as Id;

function playerCombatStats(s: GameState): CombatActorStats {
  const v = s.player.variables;
  return {
    attack: v['core:attack'] ?? 10,
    defense: v['core:defense'] ?? 10,
    speed: v['core:speed'] ?? 10,
    skillPower: v['core:skillPower'] ?? 10,
    crit: v['core:crit'] ?? 5,
    hit: v['core:hit'] ?? 80,
    evasion: v['core:evasion'] ?? 10,
  };
}

export function resolveEnemyRuntime(enemy: EnemyDef): CombatEnemyRuntime {
  const tier = enemy.tier ?? (enemy.hp >= 140 ? 'boss' : enemy.hp >= 80 ? 'L' : enemy.hp >= 50 ? 'M' : 'S');
  const base = tier === 'boss' ? BOSS_TEMPLATE : ENEMY_TIER_TEMPLATES[tier];
  const c = enemy.combat;
  return {
    hpMax: enemy.hp,
    attack: c?.attack ?? base.attack,
    defense: c?.defense ?? base.defense,
    speed: c?.speed ?? base.speed,
    skillPower: c?.skillPower ?? base.skillPower,
    crit: c?.crit ?? base.crit,
    hit: c?.hit ?? base.hit,
    evasion: c?.evasion ?? base.evasion,
    skillResource: c?.skillResource ?? base.skillResource,
    actionsPerTurn: c?.actionsPerTurn ?? base.actionsPerTurn,
    defenseBonus: 0,
    tier,
    fleeBonus: tier === 'boss' ? BOSS_TEMPLATE.fleeBonus : ENEMY_TIER_TEMPLATES[tier].fleeBonus,
  };
}

function applyVar(s: GameState, r: Registry, c: EffectContext, id: Id, delta: number): void {
  const def = r.variable(id);
  const before = s.player.variables[id] ?? def.initial;
  const after = Math.min(def.max, Math.max(def.min, before + delta));
  s.player.variables[id] = after;
  if (before !== after) c.changes.push({ label: def.label, before, after });
}

/** 战败理智：公式 base=6（5–8 中位）+ 乘区；≥100 置 flag，优先 Bad End 事件。 */
function applyDefeatSanity(s: GameState, r: Registry, c: EffectContext): boolean {
  const def = r.variable(SANITY_ID);
  const before = s.player.variables[SANITY_ID] ?? def.initial;
  const scene = s.district?.scene;
  const gain = sanityGain({
    base: 6,
    arousal: scene?.arousal ?? 0,
    submissionTendency: s.player.variables[SUBMISSION_ID] ?? 0,
    transformProgress: transformProgress(s, r),
  });
  const after = Math.min(def.max, before + gain);
  s.player.variables[SANITY_ID] = after;
  if (before !== after) c.changes.push({ label: def.label, before, after });
  if (after >= def.max) {
    s.player.flags[SANITY_BREAK_FLAG] = true;
    return true;
  }
  return false;
}

function refreshPlayerAp(s: GameState): number {
  const cap = Math.min(10, s.player.variables[AP_ID] ?? 3);
  return cap;
}

function enemyEffectiveDefense(enemy: CombatEnemyRuntime): number {
  return enemy.defense + enemy.defenseBonus;
}

function applyBossPhase(enemy: EnemyDef, runtime: CombatEnemyRuntime, hp: number): void {
  if (runtime.tier !== 'boss' || !enemy.phases?.length) return;
  for (const phase of enemy.phases) {
    if (hp <= runtime.hpMax * phase.hpRatio) {
      runtime.defenseBonus = Math.max(runtime.defenseBonus, phase.defenseBonus);
      runtime.actionsPerTurn = Math.max(runtime.actionsPerTurn, (enemy.combat?.actionsPerTurn ?? BOSS_TEMPLATE.actionsPerTurn) + phase.extraActions);
    }
  }
}

export function applyDistrictEffect(e: DistrictEffect, s: GameState, r: Registry, c: EffectContext, apply: (e: Effect[], s: GameState, r: Registry, c: EffectContext) => void): void {
  const d = district(s);
  if (e.op === 'player.create') {
    if (d.profile.created) throw new RuleError('CREATED', '角色已经创建。');
    d.profile = { name: e.name, ageYears: e.ageYears, created: true, adultOptional: false };
    c.resolvedTexts.push(`${e.name}，${e.ageYears}岁。你在租约上签下名字，把这座城市当作新的起点。`);
  } else if (e.op === 'preference.set') d.profile.adultOptional = e.value;
  else if (e.op === 'equipment.wear') {
    const item = r.equipment.find(x => x.id === e.id);
    if (!item || !item.requires.every(x => evaluate(x, s, r).pass)) throw new RuleError('EQUIPMENT_FIT', '装备与当前身体不兼容。');
    if (!d.inventory.includes(e.id)) d.inventory.push(e.id);
    d.equipped = e.id;
    c.resolvedTexts.push(item.description);
  } else if (e.op === 'equipment.remove') {
    d.equipped = null;
    c.resolvedTexts.push('你把装备收进背包，物品仍然保留。');
  } else if (e.op === 'scene.start') {
    const def = r.interactions.find(x => x.id === e.id);
    if (!def || d.scene || d.combat || !npcPresent(s, r, def.npcId) || !def.conditions.every(x => evaluate(x, s, r).pass) || !d.profile.created || d.profile.ageYears < 18 || (r.textSlots.find(x => x.id === def.textSlotId)?.contentTier === 'adult_optional' && !adultNPCEligibility(r, def.npcId).pass)) throw new RuleError('SCENE_UNWILLING', '当前身份、意愿或处境不适合继续。');
    const owner = r.textSlots.find(x => x.id === def.textSlotId)!;
    const current = s.eventInstances.find(x => x.instanceId === s.activeEventStack.at(-1));
    if (current?.definitionId !== owner.owner.eventId || current.nodeId !== owner.owner.nodeId) throw new RuleError('SCENE_CONTEXT', '互动必须从约定的事件节点进入。');
    const pose = def.poses.find(p => !p.requires || bodyTraits(s.player.body, r)[p.requires] > 0);
    if (!pose || !s.player.body) throw new RuleError('SCENE_BODY', '没有兼容的姿态。');
    const npcBody = entityBody(s, { kind: 'npc', id: def.npcId });
    if (!npcBody.known) throw new RuleError('SCENE_BODY_UNKNOWN', npcBody.reason);
    s.meta.schemaVersion = 4;
    s.meta.engineVersion = '0.2-foundation';
    s.environment ??= {};
    d.scene = { definitionId: e.id, phase: 'active', poseId: pose.id, turn: 0, actors: [{ id: 'player', entity: PLAYER, facing: pose.facing, zone: pose.zone }, { id: def.npcId, entity: { kind: 'npc', id: def.npcId }, facing: 'front', zone: 'near' }], contacts: [], arousal: 0, restraint: 0 };
    if (!d.discovered.includes(def.id)) d.discovered.push(def.id);
    c.resolvedTexts.push('双方确认可以暂停或离开。你们在约定的位置坐定，尚未建立接触。');
  } else if (e.op === 'scene.act') {
    const scene = d.scene;
    if (!scene) throw new RuleError('NO_SCENE', '当前没有互动场景。');
    const def = r.interactions.find(x => x.id === scene.definitionId)!;
    if (e.move === 'exit') {
      const before = s.player.variables[AFTERTASTE_ID] ?? 0;
      const after = aftertasteOnExit(before, scene.arousal, scene.restraint);
      s.player.variables[AFTERTASTE_ID] = after;
      if (before !== after) c.changes.push({ label: r.variable(AFTERTASTE_ID).label, before, after });
      scene.contacts = [];
      d.scene = null;
      const slot = r.textSlots.find(x => x.id === def.textSlotId)!;
      apply([{ op: 'event.advance', nodeId: slot.nextNodeId }], s, r, c);
      c.resolvedTexts.push('你们释放所有接触，各自收回动作资源，回到普通交谈。');
      return;
    }
    if (e.move === 'pause') { scene.phase = 'paused'; scene.contacts = []; c.resolvedTexts.push('你提出暂停，对方立即停止并松开接触。场景与前情保留。'); return; }
    if (e.move === 'resume') {
      const b = entityBody(s, { kind: 'npc', id: def.npcId });
      if (!b.known) throw new RuleError('SCENE_BODY_UNKNOWN', b.reason);
      if (!npcPresent(s, r, def.npcId) || !def.conditions.every(x => evaluate(x, s, r).pass)) throw new RuleError('SCENE_CONTEXT', '需要重新确认对方是否在场并愿意继续。');
      scene.phase = 'active';
      c.resolvedTexts.push('你们重新确认意愿，从没有接触的位置继续。');
      return;
    }
    if (scene.phase !== 'active') throw new RuleError('SCENE_PAUSED', '先恢复场景或退出。');
    if (e.move === 'pose') {
      const pose = def.poses.find(p => p.id === e.poseId);
      if (!pose || (pose.requires && bodyTraits(s.player.body, r)[pose.requires] < 1)) throw new RuleError('POSE_BODY', '身体不具备该姿态的稳定条件。');
      scene.contacts = [];
      scene.poseId = pose.id;
      scene.actors[0]!.facing = pose.facing;
      scene.actors[0]!.zone = pose.zone;
      c.resolvedTexts.push(`先松开接触，再调整位置：${pose.label}。`);
    } else if (e.move === 'release') { scene.contacts = []; c.resolvedTexts.push('你松开接触，对方也收回动作。'); }
    else if (e.move === 'contact') {
      const pose = def.poses.find(p => p.id === scene.poseId)!;
      if (pose.facing !== 'front' || pose.zone !== 'near') throw new RuleError('CONTACT_POSITION', '需要面对面且处于近处。');
      const free = s.player.body?.parts.find(p => r.bodyPart(p.definitionId).kind === 'hand' && r.bodyPart(p.definitionId).capabilities.includes('grasp') && !scene.contacts.some(c => c.playerPartId === p.instanceId));
      const npc = entityBody(s, scene.actors[1]!.entity!);
      const target = (npc.known ? npc.value.parts : []).find(p => r.bodyPart(p.definitionId).kind === 'hand' && !scene.contacts.some(c => c.npcPartId === p.instanceId));
      if (!free || !target) throw new RuleError('CONTACT_RESOURCE', '没有空闲的抓握部位。');
      scene.contacts.push({ playerPartId: free.instanceId, npcPartId: target.instanceId, sinceTurn: scene.turn });
      c.resolvedTexts.push('对方点头后，你们建立短暂的手部接触。双方的对应部位被占用，直到释放、转身、暂停或退出。');
    }
    scene.turn++;
  } else if (e.op === 'combat.start') {
    const enemy = r.enemies.find(x => x.id === e.id);
    if (!enemy || d.combat || d.scene || s.activeEventStack.length) throw new RuleError('COMBAT_CONTEXT', '现在不能开始战斗。');
    if (s.player.variables[PLAYER_HP_ID]! < 1) throw new RuleError('NEED_RECOVERY', '需要先休息恢复。');
    const runtime = resolveEnemyRuntime(enemy);
    d.combat = {
      enemyId: e.id,
      hp: enemy.hp,
      turn: 0,
      log: [`${enemy.name}挡住了你的路线。观察对方的意图，再决定行动。`],
      enemy: runtime,
      playerAp: refreshPlayerAp(s),
      guarding: false,
    };
  } else if (e.op === 'combat.turn') {
    const battle = d.combat;
    if (!battle) throw new RuleError('NO_COMBAT', '当前没有战斗。');
    // 旧存档缺运行时字段时补齐
    if (!battle.enemy) {
      const enemyDef = r.enemies.find(x => x.id === battle.enemyId)!;
      battle.enemy = resolveEnemyRuntime(enemyDef);
      battle.playerAp = refreshPlayerAp(s);
      battle.guarding = false;
    }
    const enemy = r.enemies.find(x => x.id === battle.enemyId)!;
    const intent = enemy.intents[battle.turn % enemy.intents.length]!;
    apply([{ op: 'clock.advance', minutes: 5 }], s, r, c);
    const end = (result: 'victory' | 'defeat' | 'escape') => {
      d.combat = null;
      c.resolvedTexts.push(result === 'victory' ? '你赢得了交锋。' : result === 'defeat' ? '你失去继续战斗的力气，后续仍有恢复路径。' : '你找到空隙离开了交锋。');
      let eventId = result === 'victory' ? enemy.victoryEventId : result === 'defeat' ? enemy.defeatEventId : enemy.escapeEventId;
      if (result === 'defeat') {
        const badEnd = applyDefeatSanity(s, r, c);
        if (badEnd) {
          let has = false; try { r.event(SANITY_BREAK_EVENT); has = true; } catch { has = false; }
          if (has) {
            eventId = SANITY_BREAK_EVENT;
            c.resolvedTexts.push('理智已满：崩坏积蓄触及阈值，进入 Bad End。');
          } else {
            c.resolvedTexts.push('【占位】理智已满：已置 core:flag.sanity_break；Bad End 事件尚未装入内容包。');
          }
        }
      }
      apply([{ op: 'event.start', id: eventId }], s, r, c);
    };

    const health = s.player.variables[PLAYER_HP_ID]!;
    const stamina = s.player.variables[STAMINA_ID] ?? 100;
    const player = playerCombatStats(s);
    const card = COMBAT_CARD[e.move];
    battle.playerAp = refreshPlayerAp(s);
    if (card.ap > battle.playerAp) throw new RuleError('NO_AP', `本回合行动点不足（需要 ${card.ap}）。`);
    battle.playerAp -= card.ap;
    battle.guarding = false;

    // intent.guard → 本回合敌方 DEF 临时提高（文本战：用 guard 值当加成）
    battle.enemy.defenseBonus = intent.guard > 0 ? intent.guard : 0;
    applyBossPhase(enemy, battle.enemy, battle.hp);

    let line = '';

    if (e.move === 'flee') {
      if (stamina < STAMINA_COST.flee) throw new RuleError('EXHAUSTED', `撤离需要${STAMINA_COST.flee}点体力。`);
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.flee);
      const chance = fleeChancePercent(player.speed, battle.enemy.speed, battle.enemy.fleeBonus);
      const ok = battle.turn > 0 || draw(s, `combat:flee:${c.transactionId}`) * 100 < chance;
      if (ok) { end('escape'); return; }
      line = `你尝试脱离（成功率约${chance}%），第一道出口被挡住；下一回合可以安全撤出。`;
    } else if (e.move === 'attack') {
      if (stamina < STAMINA_COST.attack) throw new RuleError('EXHAUSTED', `进攻需要${STAMINA_COST.attack}点体力。`);
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.attack);
      const atkStats = { ...player, attack: player.attack + (bodyTraits(s.player.body, r).tailGrip ? 3 : 0) };
      const defStats: CombatActorStats = {
        attack: battle.enemy.attack,
        defense: enemyEffectiveDefense(battle.enemy),
        speed: battle.enemy.speed,
        skillPower: battle.enemy.skillPower,
        crit: battle.enemy.crit,
        hit: battle.enemy.hit,
        evasion: battle.enemy.evasion,
      };
      const hitChance = combatHitChance(atkStats, defStats);
      const hitRoll = draw(s, `combat:hit:${c.transactionId}`);
      if (hitRoll * 100 >= hitChance) {
        line = `你的进攻未命中（命中率${hitChance}%）。`;
      } else {
        const crit = draw(s, `combat:crit:${c.transactionId}`) * 100 < atkStats.crit;
        const damage = combatDamage({
          attack: atkStats.attack,
          skillPower: atkStats.skillPower,
          defense: defStats.defense,
          powerMult: card.powerMult,
          skill: false,
          crit,
        });
        battle.hp = Math.max(0, battle.hp - damage);
        line = crit ? `暴击！你造成${damage}点伤害。` : `你的进攻造成${damage}点伤害。`;
      }
    } else if (e.move === 'guard') {
      if (stamina < STAMINA_COST.guard) throw new RuleError('EXHAUSTED', '防守需要1点体力。');
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.guard);
      applyVar(s, r, c, ENERGY_ID, 2);
      battle.guarding = true;
      line = '你稳住重心，防守并略微喘息（承伤减半，精力+2）。';
    } else if (e.move === 'recover') {
      if (stamina < STAMINA_COST.recover) throw new RuleError('EXHAUSTED', `临时包扎需要${STAMINA_COST.recover}点体力。`);
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.recover);
      applyVar(s, r, c, PLAYER_HP_ID, COMBAT_CARD.recover.heal);
      applyVar(s, r, c, SKILL_RES_ID, 8);
      line = `你抓紧空隙包扎，恢复${COMBAT_CARD.recover.heal}点生命，并稳住气息。`;
    }

    if (battle.hp === 0) {
      const before = s.player.variables['core:money']!;
      s.player.variables['core:money'] = Math.min(r.variable('core:money').max, before + enemy.reward);
      c.changes.push({ label: '战斗报酬', before, after: s.player.variables['core:money']! });
      end('victory');
      return;
    }

    // 敌方行动（可多段）；drain 改扣 stamina
    let incoming = 0;
    const actions = Math.max(1, battle.enemy.actionsPerTurn);
    for (let i = 0; i < actions; i++) {
      const stepIntent = enemy.intents[(battle.turn + i) % enemy.intents.length]!;
      const enemyAtk: CombatActorStats = {
        attack: battle.enemy.attack,
        defense: enemyEffectiveDefense(battle.enemy),
        speed: battle.enemy.speed,
        skillPower: battle.enemy.skillPower,
        crit: battle.enemy.crit,
        hit: battle.enemy.hit,
        evasion: battle.enemy.evasion,
      };
      const hitChance = combatHitChance(enemyAtk, player);
      if (draw(s, `combat:enemyhit:${c.transactionId}:${i}`) * 100 >= hitChance) {
        line += i === 0 ? ` ${stepIntent.label}，但你躲开了。` : ' 追加攻击未命中。';
        continue;
      }
      const crit = draw(s, `combat:enemycrit:${c.transactionId}:${i}`) * 100 < enemyAtk.crit;
      // intent.damage 映射为倍率提示：高伤意图用 1.4，低伤用 0.7，其余 1.0
      const powerMult = stepIntent.damage >= 12 ? 1.4 : stepIntent.damage <= 4 ? 0.7 : 1.0;
      let dmg = combatDamage({
        attack: enemyAtk.attack,
        skillPower: enemyAtk.skillPower,
        defense: player.defense,
        powerMult,
        skill: false,
        crit,
      });
      if (battle.guarding) dmg = Math.max(0, Math.floor(dmg * 0.5));
      incoming += dmg;
      if (stepIntent.drain > 0) applyVar(s, r, c, STAMINA_ID, -stepIntent.drain);
      line += i === 0 ? ` ${stepIntent.label}，你受到${dmg}点伤害。` : ` 追加命中${dmg}点。`;
    }

    s.player.variables[PLAYER_HP_ID] = Math.max(0, s.player.variables[PLAYER_HP_ID]! - incoming);
    // 回合末 skillResource +5
    applyVar(s, r, c, SKILL_RES_ID, 5);

    battle.log.push(line);
    battle.log = battle.log.slice(-4);
    battle.turn++;
    battle.enemy.defenseBonus = 0;
    c.resolvedTexts.push(line);
    c.changes.push({ label: '生命', before: health, after: s.player.variables[PLAYER_HP_ID]! });
    if (s.player.variables[PLAYER_HP_ID] === 0) end('defeat');
  } else throw new RuleError('MODULE_PENDING', '该模块尚未接入。');
}

export function districtOptions(s: GameState, r: Registry, actions: ActionDef[]): ActionDef[] {
  if (!s.district) return actions;
  const runtime = r.actionsForHook('district:hook.runtime'), settings = runtime.filter(a => a.effects.some(e => e.op === 'preference.set'));
  if (s.district.combat) return [...runtime.filter(a => a.effects.some(e => e.op === 'combat.turn')), ...settings];
  if (s.district.scene) return [...runtime.filter(a => a.effects.some(e => e.op === 'scene.act' && (s.district!.scene!.phase === 'active' ? e.move !== 'resume' : ['resume', 'exit'].includes(e.move)))), ...r.globalActions(), ...settings];
  return [...actions, ...settings];
}

export function districtText(s: GameState, r: Registry, base: string): string {
  if (!s.district) return base;
  if (s.district.combat) {
    const b = s.district.combat, e = r.enemies.find(x => x.id === b.enemyId)!;
    const hpMax = b.enemy?.hpMax ?? e.hp;
    return `交锋：${e.name}\n\n对方生命 ${b.hp}/${hpMax} · 第${b.turn + 1}回合\n\n下一步意图：${e.intents[b.turn % e.intents.length]!.label}\n\n${b.log.join('\n\n')}`;
  }
  if (s.district.scene) {
    const scene = s.district.scene, i = r.interactions.find(x => x.id === scene.definitionId)!, p = i.poses.find(p => p.id === scene.poseId)!;
    return `${r.npc(i.npcId).name}与你 · ${scene.phase === 'paused' ? '暂停中' : '正在相处'}\n\n姿态：${p.label}；朝向：${p.facing === 'front' ? '面向对方' : '背向对方'}；位置：${p.zone === 'near' ? '近处' : '桌子另一侧'}。\n\n${scene.contacts.length ? `已建立${scene.contacts.length}条手部接触；对应动作资源被占用。` : '尚未建立接触，身体部位空闲。'}\n\n${base}`;
  }
  const event = s.eventInstances.find(x => x.instanceId === s.activeEventStack.at(-1));
  const variants = r.sceneTexts.filter(v => v.locationId === s.world.locationId && (v.owner ? v.owner.eventId === event?.definitionId && v.owner.nodeId === event.nodeId : !event) && v.conditions.every(c => evaluate(c, s, r).pass)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'));
  const observation = presentationText(s, r, 'environment');
  return base + (observation ? '\n\n' + observation : '') + (variants[0] ? '\n\n' + r.text(variants[0].textKey) : '');
}
