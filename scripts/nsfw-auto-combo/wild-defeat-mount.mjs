/**
 * 野外 4+1 战败合载工厂：敌人定义、环境规则、A/B 叙事、试跑 action。
 */

import { WILD_DEFEAT_SPEC_FACTORIES } from './wild-defeat-enemy-specs.mjs';

export function mountAllWildDefeatEnemies(p, h) {
  const metas = [];
  for (const factory of WILD_DEFEAT_SPEC_FACTORIES) {
    metas.push(mountWildDefeatEnemy(p, h, factory(h)));
  }
  return metas;
}

export function mountWildDefeatEnemy(p, h, spec) {
  const {
    id,
    tag,
    scoped,
    has,
    choice,
    exit,
    time,
    health,
    adultGate,
    action,
    envRule,
  } = h;

  const flag = (key) => {
    const fid = id(`flag.${key}`);
    if (!p.flags.some((f) => f.id === fid)) p.flags.push({ id: fid, initial: false });
    return fid;
  };
  const flagHas = (fid, value = true) => ({ op: 'flag.has', id: fid, value });
  const flagSet = (fid, value = true) => ({ op: 'flag.set', id: fid, value });
  const grasp = { op: 'body.hasCapability', capability: 'grasp', count: 1 };

  const FLAG_DEFEAT_DONE = flag(spec.flags.defeatDone);
  const FLAG_MARK = flag(spec.flags.markUnwiped);
  const FLAG_CORRUPTION = flag(spec.flags.corruption);

  for (const t of spec.tags) {
    p.tags.push({
      id: tag(t.key),
      label: t.label,
      definition: t.definition,
      facets: ['context'],
      status: 'active',
      aliases: [],
    });
  }

  const enemyId = id(`enemy.${spec.slug}`);
  p.enemies.push({
    id: enemyId,
    name: spec.displayName,
    ...spec.enemy,
    victoryEventId: id('event.victory'),
    defeatEventId: id('event.defeat'),
    escapeEventId: id('event.escape'),
  });

  const profileId = id(`profile.${spec.profileNs}.${spec.slug}`);
  const corruptionProfileId = id(`profile.${spec.profileNs}.${spec.slug}.corruption`);
  const nodeBase = `node.defeat.${spec.profileNs}.${spec.slug}`;
  const textBase = `text.node.defeat.${spec.profileNs}.${spec.slug}`;

  const nodeIdsA = [
    id(`${nodeBase}.capture`),
    id(`${nodeBase}.press`),
    id(`${nodeBase}.press.adult`),
    id(`${nodeBase}.peak`),
    id(`${nodeBase}.peak.adult`),
    id(`${nodeBase}.resolve`),
  ];
  const nodeIdsB = [
    id(`${nodeBase}.corruption.seed`),
    id(`${nodeBase}.corruption.slip`),
    id(`${nodeBase}.corruption.sink`),
  ];

  const defeatTagScoped = scoped('opponent', spec.defeatTag);
  const playerMark = scoped('player', spec.playerMarkTag);

  p.narrativeProfiles.push({
    id: profileId,
    enemyId,
    tags: [tag(spec.defeatTag)],
    goals: [],
    tendencies: [],
    defeatTags: [scoped('player', 'clear'), scoped('player', 'injured'), playerMark],
    nodeIds: nodeIdsA,
  });
  p.narrativeProfiles.push({
    id: corruptionProfileId,
    enemyId,
    tags: [tag(spec.defeatTag)],
    goals: [],
    tendencies: [],
    defeatTags: [],
    nodeIds: nodeIdsB,
  });

  envRule(spec.env.ruleId, enemyId, spec.env.requiresTags, {
    weight: spec.env.weight ?? 20,
    priority: spec.env.priority ?? 6,
    name: spec.env.name,
    hp: spec.env.hp,
    combat: spec.env.combat,
    defeatTags: [scoped('player', 'clear'), scoped('player', 'injured'), playerMark],
  });

  const comboCond = (comboKey) => {
    const row = spec.combos.find((c) => c.key === comboKey);
    if (!row) throw new Error(`combo ${comboKey} missing on ${spec.slug}`);
    return has('opponent', row.tagKey);
  };

  const opp = defeatTagScoped;
  const px = spec.stagePrefix;

  const defeatNode = (suffix, kind, stage, title, textSuffix, choices, extra = {}) => {
    const textKey = id(`${textBase}.${textSuffix}`);
    const nid = id(`${nodeBase}.${suffix}`);
    p.texts[textKey] = p.texts[textKey] ?? `【槽·${spec.slug}·${textSuffix}】`;
    const all = [...choices, exit()];
    if (all.length > 4) throw new Error(`${spec.slug} 节点选项超过 4：${suffix}`);
    p.narrativeNodes.push({
      id: nid,
      kind,
      stage,
      title,
      textKey,
      requiresTags: [opp],
      excludesTags: [],
      conditions: [],
      tendencies: [],
      weight: 10,
      priority: 18,
      maxVisits: 1,
      choices: all,
      ...extra,
    });
  };

  const sets = spec.buildChoices({ comboCond, grasp, adultGate, flagSet, FLAG_DEFEAT_DONE, FLAG_MARK, FLAG_CORRUPTION, time, health, choice, px });

  defeatNode('capture', 'defeat', 'start', sets.titles.capture, 'capture', sets.capture);
  defeatNode('press', 'defeat', `${px}-press`, sets.titles.press, 'press', sets.press);
  defeatNode(
    'press.adult',
    'defeat',
    `${px}-press-adult`,
    sets.titles.pressAdult,
    'press.adult',
    sets.pressAdult,
    { conditions: adultGate, priority: 19 },
  );
  defeatNode('peak', 'defeat', `${px}-peak`, sets.titles.peak, 'peak', sets.peak);
  defeatNode(
    'peak.adult',
    'defeat',
    `${px}-peak-adult`,
    sets.titles.peakAdult,
    'peak.adult',
    sets.peakAdult,
    { conditions: adultGate, priority: 19 },
  );
  defeatNode('resolve', 'defeat', `${px}-resolve`, sets.titles.resolve, 'resolve', sets.resolve);

  const seedKey = id(`${textBase}.corruption.seed`);
  p.texts[seedKey] = p.texts[seedKey] ?? `【槽·${spec.slug}·B1】`;
  p.narrativeNodes.push({
    id: id(`${nodeBase}.corruption.seed`),
    kind: 'defeat',
    stage: 'start',
    title: sets.titles.corrSeed,
    textKey: seedKey,
    requiresTags: [opp],
    excludesTags: [],
    conditions: [],
    tendencies: [],
    weight: 10,
    priority: 18,
    maxVisits: 1,
    choices: [...sets.corrSeed, exit()],
  });

  const slipKey = id(`${textBase}.corruption.slip`);
  p.texts[slipKey] = p.texts[slipKey] ?? `【槽·${spec.slug}·B2】`;
  p.narrativeNodes.push({
    id: id(`${nodeBase}.corruption.slip`),
    kind: 'defeat',
    stage: `${px}-corr-slip`,
    title: sets.titles.corrSlip,
    textKey: slipKey,
    requiresTags: [opp],
    excludesTags: [],
    conditions: adultGate,
    tendencies: [],
    weight: 10,
    priority: 18,
    maxVisits: 1,
    choices: [...sets.corrSlip, exit()],
  });

  const sinkKey = id(`${textBase}.corruption.sink`);
  p.texts[sinkKey] = p.texts[sinkKey] ?? `【槽·${spec.slug}·B3】`;
  p.narrativeNodes.push({
    id: id(`${nodeBase}.corruption.sink`),
    kind: 'defeat',
    stage: `${px}-corr-sink`,
    title: sets.titles.corrSink,
    textKey: sinkKey,
    requiresTags: [opp],
    excludesTags: [],
    conditions: sets.corrSinkAdultOnly ? adultGate : [],
    tendencies: [],
    weight: 10,
    priority: 18,
    maxVisits: 1,
    choices: [...sets.corrSink, exit()],
  });

  action(
    `wild.defeat.${spec.slug}`,
    `试跑：${spec.displayName}战败链`,
    [{ op: 'narrative.start', kind: 'defeat', profileId }],
    [],
    spec.hintA ?? '不必先战斗；Material×Part×Action 抽选后进入 A 链',
    'explore',
  );
  action(
    `wild.defeat.corruption.${spec.slug}`,
    `试跑：${spec.displayName}恶堕链`,
    [{ op: 'narrative.start', kind: 'defeat', profileId: corruptionProfileId }],
    [flagHas(FLAG_DEFEAT_DONE), flagHas(FLAG_MARK), { op: 'not', condition: flagHas(FLAG_CORRUPTION) }],
    spec.hintB ?? '须已战败且保留痕迹；与 A4 分账',
    'explore',
  );
  action(
    `challenge.${spec.slug}`,
    `挑战：${spec.displayName}`,
    [{ op: 'combat.start', id: enemyId }],
    spec.challengeConditions ?? [{ op: 'environment.service', value: 'commons' }],
    '野外环境可匹配时亦可调查遇敌',
    'explore',
  );

  return {
    slug: spec.slug,
    profileNs: spec.profileNs,
    displayName: spec.displayName,
    enemyId,
    profileId,
    corruptionProfileId,
    nodeIdsA,
    nodeIdsB,
    defeatTag: spec.defeatTag,
    flags: spec.flags,
    combos: spec.combos,
  };
}

export async function applyWildDefeatFills(p, _metas, json) {
  let fillCount = 0;
  const fills = await json('content/nsfw-auto-combo/wild-defeat-fills.json');
  if (fills.format !== 'aetheria-wild-defeat-prose-fills' || fills.schemaVersion !== 2) {
    throw new Error('wild-defeat-fills 格式无效（需 schemaVersion 2）');
  }
  for (const [key, body] of Object.entries(fills.texts ?? {})) {
    if (typeof body !== 'string' || !body.trim()) throw new Error(`野外战败散文空槽：${key}`);
    if (!(key in p.texts)) throw new Error(`野外战败散文目标不存在：${key}`);
    p.texts[key] = body;
    fillCount += 1;
  }
  return { fills, fillCount };
}

export function writeWildDefeatCandidates(path, writeFile, payload) {
  return writeFile(
    path,
    JSON.stringify(
      {
        format: 'aetheria-wild-defeat-candidates',
        schemaVersion: 2,
        splitNote: 'A4 出口不回 B1；恶堕走 wild.defeat.corruption.*',
        comboSource: 'src/engine/wild-defeat-draws.ts',
        proseFillsApplied: payload.fillCount,
        enemies: payload.metas,
      },
      null,
      2,
    ) + '\n',
  );
}
