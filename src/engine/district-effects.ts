import { derivedSemantics, presentationText } from './semantic-query.ts';
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
  sumEquipmentBonuses,
  type CombatActorStats,
} from './numerics.ts';
import { transformProgress } from './transform-perception.ts';
import { adventure, narrativeActions, startNarrative } from './narrative.ts';
import { matchingEnvironmentEnemyRules, overlayEnvironmentEnemy, selectEnvironmentEnemyRule } from './environment-enemies.ts';

export const SANITY_BREAK_EVENT = 'district:event.sanity_break' as Id;
const STAMINA_ID = 'core:stamina' as Id;
const ENERGY_ID = 'core:energy' as Id;
const SKILL_RES_ID = 'core:skillResource' as Id;
const AP_ID = 'core:actionPoints' as Id;
const AFTERTASTE_ID = 'core:aftertaste' as Id;
const SUBMISSION_ID = 'core:submissionTendency' as Id;

function playerCombatStats(s: GameState, r?: Registry): CombatActorStats {
  const v = s.player.variables;
  const baseAtk = v['core:attack'] ?? 10;
  const baseDef = v['core:defense'] ?? 10;
  const baseEva = v['core:evasion'] ?? 10;
  let gear = { attack: 0, defense: 0, evasion: 0 };
  if (r) {
    const worn=[...new Set([s.district?.equipped,...Object.values(s.adventure?.equipment??{})])].flatMap(id=>r.equipment.find(e=>e.id===id)??[]);
    gear = sumEquipmentBonuses(worn);
  }
  return {
    attack: baseAtk + gear.attack,
    defense: baseDef + gear.defense,
    speed: v['core:speed'] ?? 10,
    skillPower: v['core:skillPower'] ?? 10,
    crit: v['core:crit'] ?? 5,
    hit: v['core:hit'] ?? 80,
    evasion: Math.min(100, baseEva + gear.evasion),
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
    if(e.id.startsWith('progression:')&&!d.inventory.includes(e.id))throw new RuleError('EQUIPMENT_NOT_OWNED','先购买这件装备。');
    if (!d.inventory.includes(e.id)) d.inventory.push(e.id);
    d.equipped = e.id;
    if(s.adventure)s.adventure.equipment[item.slot??'cosmetic']=item.id;
    c.resolvedTexts.push(item.description);
  } else if (e.op === 'equipment.remove') {
    d.equipped = null;
    if(s.adventure)s.adventure.equipment={};
    c.resolvedTexts.push('你把装备收进背包，物品仍然保留。');
  } else if (e.op === 'item.gain') {
    const item = r.items.find(x => x.id === e.id);
    if (!item) throw new RuleError('ITEM_MISSING', '消耗品不存在。');
    const a = adventure(s);
    const bag = a.items ?? (a.items = {});
    const max = item.maxStack ?? 20;
    const next = (bag[item.id] ?? 0) + e.amount;
    if (next > max) throw new RuleError('ITEM_STACK', `${item.name}超过携带上限。`);
    bag[item.id] = next;
    c.resolvedTexts.push(`获得${item.name}×${e.amount}。`);
  } else if (e.op === 'item.use') {
    if (d.combat) throw new RuleError('ITEM_IN_COMBAT', '交锋中请使用战内消耗品行动。');
    const item = r.items.find(x => x.id === e.id);
    if (!item) throw new RuleError('ITEM_MISSING', '消耗品不存在。');
    const a = adventure(s);
    const bag = a.items ?? (a.items = {});
    const have = bag[item.id] ?? 0;
    if (have < 1) throw new RuleError('ITEM_EMPTY', `没有${item.name}。`);
    apply(item.effects as Effect[], s, r, c);
    bag[item.id] = have - 1;
    if (bag[item.id]! <= 0) delete bag[item.id];
    apply([{ op: 'clock.advance', minutes: 5 }], s, r, c);
    c.resolvedTexts.push(`你使用了${item.name}。`);
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
  } else if (e.op === 'combat.start' || e.op === 'combat.encounter') {
    if (d.combat || d.scene || s.activeEventStack.length) throw new RuleError('COMBAT_CONTEXT', '现在不能开始战斗。');
    if (s.player.variables[PLAYER_HP_ID]! < 1) throw new RuleError('NEED_RECOVERY', '需要先休息恢复。');
    const rule = e.op === 'combat.encounter'
      ? selectEnvironmentEnemyRule(s, r, `combat:encounter:${c.transactionId}`)
      : selectEnvironmentEnemyRule(s, r, `combat:overlay:${c.transactionId}:${e.id}`, e.id);
    if (e.op === 'combat.encounter' && !rule) throw new RuleError('NO_ENV_ENEMY', '当前地点环境没有可匹配的敌人。');
    const enemyId = e.op === 'combat.encounter' ? rule!.enemyId : e.id;
    const enemy = r.enemies.find(x => x.id === enemyId);
    if (!enemy) throw new RuleError('COMBAT_CONTEXT', '现在不能开始战斗。');
    // combat.start 无匹配规则时仍用原 EnemyDef；有规则则注入数值与 defeatTags。
    const applied = overlayEnvironmentEnemy(enemy, resolveEnemyRuntime({ ...enemy, hp: rule?.hp ?? enemy.hp }), rule);
    d.combat = {
      enemyId,
      hp: applied.hp,
      turn: 0,
      log: [],
      enemy: applied.runtime,
      playerAp: refreshPlayerAp(s),
      guarding: false,
      ...(applied.selectionRuleId ? { selectionRuleId: applied.selectionRuleId } : {}),
      ...(rule ? { enemyName: applied.name, reward: applied.reward } : {}),
      ...(applied.defeatTags ? { defeatTags: applied.defeatTags } : {}),
    };
    if (rule) c.resolvedTexts.push(`环境条件匹配：${applied.name}（规则 ${rule.id}）。`);
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
      if(r.narrativeNodes.length){const a=adventure(s),profile=r.narrativeProfiles.find(p=>p.enemyId===enemy.id);const defeat=battle.defeatTags??profile?.defeatTags??[];a.lastCombat={enemyId:enemy.id,enemyName:battle.enemyName??enemy.name,result,turn:battle.turn+1,tags:result==='defeat'?[...defeat]:[]};}
      c.resolvedTexts.push(result === 'victory' ? '你赢得了交锋。' : result === 'defeat' ? '你失去继续战斗的力气，后续仍有恢复路径。' : '你找到空隙离开了交锋。');
      let eventId = result === 'victory' ? enemy.victoryEventId : result === 'defeat' ? enemy.defeatEventId : enemy.escapeEventId;
      if (result === 'defeat') {
        const badEnd = applyDefeatSanity(s, r, c);
        if(!badEnd&&r.narrativeNodes.some(n=>n.kind==='defeat')){startNarrative(s,r,c,'defeat');return;}
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
    const enemyBefore=battle.hp;
    const player = playerCombatStats(s, r);
    const card = COMBAT_CARD[e.move];
    battle.playerAp = refreshPlayerAp(s);
    if(e.move==='flee'&&(stamina<STAMINA_COST.flee||battle.playerAp<card.ap)){
      c.resolvedTexts.push(`状态：我方生命${health}，体力${stamina}；敌方生命${enemyBefore}\n行动：应急撤离\n造成效果：离开交锋，无战斗奖励，无额外行动点或体力费用。`);end('escape');return;
    }
    if (card.ap > battle.playerAp) throw new RuleError('NO_AP', `本回合行动点不足（需要 ${card.ap}）。`);
    battle.playerAp -= card.ap;
    battle.guarding = false;

    // intent.guard → 本回合敌方 DEF 临时提高（文本战：用 guard 值当加成）
    battle.enemy.defenseBonus = intent.guard > 0 ? intent.guard : 0;
    applyBossPhase(enemy, battle.enemy, battle.hp);

    let line = '';

    if (e.move === 'flee') {
      if (stamina < STAMINA_COST.flee) {
        c.resolvedTexts.push(`状态：我方生命${health}，体力${stamina}；敌方生命${enemyBefore}\n行动：应急撤离\n造成效果：离开交锋，无战斗奖励，无额外体力费用。`);
        end('escape'); return;
      }
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.flee);
      const chance = fleeChancePercent(player.speed, battle.enemy.speed, battle.enemy.fleeBonus);
      const ok = battle.turn > 0 || draw(s, `combat:flee:${c.transactionId}`) * 100 < chance;
      if (ok) { c.resolvedTexts.push(`状态：我方生命${health}，体力${stamina}；敌方生命${enemyBefore}\n行动：撤离\n造成效果：成功离开交锋，体力−${STAMINA_COST.flee}。`);end('escape'); return; }
      line = `撤离失败（成功率${chance}%）；下回合撤离必定成功。`;
    } else if (e.move === 'attack'||e.move==='skill') {
      const cost=e.move==='skill'?STAMINA_COST.skill:STAMINA_COST.attack;
      if (stamina < cost) throw new RuleError('EXHAUSTED', `进攻需要${cost}点体力。`);
      if(e.move==='skill'&&(s.player.variables[SKILL_RES_ID]??0)<15)throw new RuleError('NO_SKILL_RESOURCE','技能资源不足15。');
      if(e.move==='skill')applyVar(s,r,c,SKILL_RES_ID,-15);
      applyVar(s, r, c, STAMINA_ID, -cost);
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
        line = `进攻未命中（命中率${hitChance}%）。`;
      } else {
        const crit = draw(s, `combat:crit:${c.transactionId}`) * 100 < atkStats.crit;
        const damage = combatDamage({
          attack: atkStats.attack,
          skillPower: atkStats.skillPower,
          defense: defStats.defense,
          powerMult: card.powerMult,
          skill: e.move==='skill',
          crit,
        });
        battle.hp = Math.max(0, battle.hp - damage);
        line = `${crit?'暴击；':''}敌方受到${damage}点伤害。`;
      }
    } else if (e.move === 'guard') {
      if (stamina < STAMINA_COST.guard) throw new RuleError('EXHAUSTED', '防守需要1点体力。');
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.guard);
      applyVar(s, r, c, ENERGY_ID, 2);
      battle.guarding = true;
      line = '防守生效：本回合承伤减半，精力+2。';
    } else if (e.move === 'recover') {
      if (stamina < STAMINA_COST.recover) throw new RuleError('EXHAUSTED', `临时包扎需要${STAMINA_COST.recover}点体力。`);
      applyVar(s, r, c, STAMINA_ID, -STAMINA_COST.recover);
      applyVar(s, r, c, PLAYER_HP_ID, COMBAT_CARD.recover.heal);
      applyVar(s, r, c, SKILL_RES_ID, 8);
      line = `包扎生效：生命+${COMBAT_CARD.recover.heal}，技能资源+8。`;
    } else if (e.move === 'item') {
      if (!e.id) throw new RuleError('ITEM_MISSING', '未指定消耗品。');
      const item = r.items.find(x => x.id === e.id);
      if (!item || !item.usableInCombat) throw new RuleError('ITEM_COMBAT', '该消耗品不能在交锋中使用。');
      const a = adventure(s);
      const bag = a.items ?? (a.items = {});
      const have = bag[item.id] ?? 0;
      if (have < 1) throw new RuleError('ITEM_EMPTY', `没有${item.name}。`);
      apply(item.effects as Effect[], s, r, c);
      bag[item.id] = have - 1;
      if (bag[item.id]! <= 0) delete bag[item.id];
      line = `使用${item.name}。`;
    }

    if (battle.hp === 0) {
      c.resolvedTexts.push(`状态：我方生命${health}，体力${stamina}；敌方生命${enemyBefore}\n行动：${e.move==='skill'?'技能击':'进攻'}\n造成效果：${line} 敌方生命归零。`);
      const before = s.player.variables['core:money']!;
      let reward=battle.reward??enemy.reward;
      if(r.narrativeNodes.length){const a=adventure(s),day=Math.floor(s.clock.totalMinutes/1440),key=`${day}:reward:${enemy.id}`;if(a.daily[key]){reward=0;c.resolvedTexts.push('今天该对手的奖励已领取，本次不重复结算。');}else{a.daily[key]=1;a.victories[enemy.id]=(a.victories[enemy.id]??0)+1;a.safety++;a.influence++;a.reputation++;}}
      s.player.variables['core:money'] = Math.min(r.variable('core:money').max, before + reward);
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
        line += ` 敌方第${i+1}次行动未命中。`;
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
      line += ` 敌方第${i+1}次行动命中，我方受到${dmg}点伤害。`;
    }

    s.player.variables[PLAYER_HP_ID] = Math.max(0, s.player.variables[PLAYER_HP_ID]! - incoming);
    // 回合末 skillResource +5
    applyVar(s, r, c, SKILL_RES_ID, 5);

    const record=`状态：我方生命${health}，体力${stamina}；敌方生命${enemyBefore}/${battle.enemy.hpMax}\n行动：${({attack:'进攻',skill:'技能击',guard:'防守',recover:'临时包扎',flee:'撤离',item:'使用消耗品'})[e.move]}；敌方${intent.label}\n造成效果：${line}`;
    battle.log.push(record);
    battle.log = battle.log.slice(-4);
    battle.turn++;
    battle.enemy.defenseBonus = 0;
    c.resolvedTexts.push(record);
    c.changes.push({ label: '生命', before: health, after: s.player.variables[PLAYER_HP_ID]! });
    if (s.player.variables[PLAYER_HP_ID] === 0) end('defeat');
  } else throw new RuleError('MODULE_PENDING', '该模块尚未接入。');
}

export function districtOptions(s: GameState, r: Registry, actions: ActionDef[]): ActionDef[] {
  if (!s.district) return actions;
  const runtime = r.actionsForHook('district:hook.runtime'), settings = runtime.filter(a => a.effects.some(e => e.op === 'preference.set'));
  const story=narrativeActions(s,r);if(story)return story;
  if (s.district.combat) {
    const turns=[...runtime.filter(a => a.effects.some(e => e.op === 'combat.turn')), ...r.globalActions().filter(a=>a.effects.some(e=>e.op==='combat.turn'))];
    const combatItems=r.globalActions().filter(a=>a.effects.some(e=>e.op==='combat.turn'&&e.move==='item'));
    return [...turns, ...combatItems.filter(a=>!turns.includes(a)), ...settings];
  }
  if (s.district.scene) return [...runtime.filter(a => a.effects.some(e => e.op === 'scene.act' && (s.district!.scene!.phase === 'active' ? e.move !== 'resume' : ['resume', 'exit'].includes(e.move)))), ...r.globalActions().filter(a=>a.surface==='body'), ...settings];
  return [...actions, ...settings].filter(a=>{
    if(a.effects.some(e=>e.op==='narrative.choose'||e.op==='combat.turn'))return false;
    if(a.effects.some(e=>e.op==='combat.encounter')&&!matchingEnvironmentEnemyRules(s,r).length)return false;
    return !s.activeEventStack.length||!!a.context||!a.id.startsWith('progression:')&&!a.effects.some(e=>e.op==='narrative.start'||e.op==='progression.act'||e.op==='combat.start'||e.op==='combat.encounter');
  });
}

export function districtText(s: GameState, r: Registry, base: string): string {
  if (!s.district) return base;
  if(s.adventure?.story)return base;
  if (s.district.combat) {
    const b = s.district.combat, e = r.enemies.find(x => x.id === b.enemyId)!;
    const hpMax = b.enemy?.hpMax ?? e.hp;
    const player=playerCombatStats(s,r);
    const labels=(ids:Id[])=>ids.map(id=>`【${r.tag(id).label}】`).join('')||'无已登记标签';
    const profile=r.narrativeProfiles.find(p=>p.enemyId===e.id);
    return `交锋：${b.enemyName??e.name}\n\n我方：生命${s.player.variables[PLAYER_HP_ID]}；体力${s.player.variables[STAMINA_ID]}；攻击${player.attack}；防御${player.defense}；速度${player.speed}；技能强度${player.skillPower}；技能资源${s.player.variables[SKILL_RES_ID]}；行动点${s.player.variables[AP_ID]}\n我方Tag：${labels(derivedSemantics(s,r,{entity:{kind:'player'}}))}\n敌方：生命${b.hp}/${hpMax}；攻击${b.enemy.attack}；防御${b.enemy.defense}；速度${b.enemy.speed}；每回合行动${b.enemy.actionsPerTurn}次\n敌方Tag：${labels([...(profile?.tags??[]),...(profile?.goals.slice(0,1)??[])])}\n\n第${b.turn+1}回合；下一步意图：${e.intents[b.turn % e.intents.length]!.label}\n\n${b.log.join('\n\n')}`;
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
