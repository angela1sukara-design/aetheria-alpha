import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { evaluate } from '../src/engine/conditions.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import type { Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));

async function registryOf() {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  return loadPacks(inputs);
}

test('defeat-play G1–G8 multi-beat prose fills loaded and free of meta-prose', async () => {
  const fills = await json('content/nsfw-auto-combo/defeat-play-fills.json');
  assert.equal(fills.format, 'aetheria-defeat-play-prose-fills');
  assert.equal(fills.schemaVersion, 2);
  assert.equal(Object.keys(fills.texts).length, 64);
  assert.equal(fills.worldTag, 'worlds:setting.fantasy');
  assert.equal(fills.gameplayCategories.length, 8);
  assert.equal(Object.keys(fills.peakSamplesNotInstalled || {}).length, 0);

  const candidates = await json('content/nsfw-auto-combo/defeat-play-candidates.json');
  assert.equal(candidates.plays.length, 8);
  assert.equal(candidates.proseFillsApplied, 64);
  assert.deepEqual(candidates.stageChain, ['capture', 'press', 'peak', 'resolve']);
  assert.deepEqual(candidates.hubPages.hub3, ['G5', 'G6']);
  assert.equal(candidates.plays[0].multiBeat, true);
  assert.equal(candidates.plays[3].multiBeat, true);
  assert.ok(candidates.plays[0].stages.press);
  assert.ok(candidates.plays[0].stages.resolve);
  assert.ok(candidates.plays[4].stages.press);
  assert.ok(candidates.plays[4].stages.resolve);
  assert.equal(candidates.plays[4].stages.escalate, undefined);

  const draws = await json('content/nsfw-auto-combo/defeat-play-draws.json');
  assert.equal(draws.format, 'aetheria-defeat-play-draws');
  assert.ok(draws.tfs.every((t: string) => t === '黏液化' || t === '黑胶化'));

  const registry = await registryOf();
  const internalPlayNames = ['束缚制服', '材质覆层转化', '侵犯插入', '口封感官剥夺', '产卵灌注', '公开羞辱', '主从调教', '多体围攻'];
  for (let n = 1; n <= 8; n++) {
    for (const stage of ['capture', 'press', 'peak', 'resolve']) {
      assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.${stage}`), `missing g${n}.${stage}`);
      assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.${stage}.adult`), `missing g${n}.${stage}.adult`);
      const body = registry.text(`progression:text.node.defeat.g${n}.${stage}` as Id);
      assert.ok(body.length >= 40, body.slice(0, 40));
      assert.ok(!body.includes('【槽'), 'should not be empty stub slot');
      assert.ok(!body.includes('故事侧可填'), 'should not be engine placeholder');
      const adult = registry.text(`progression:text.node.defeat.g${n}.${stage}.adult` as Id);
      assert.ok(adult.length >= 40, adult.slice(0, 40));
      assert.ok(!adult.includes('成人门'), 'adult body must not carry gate copy');
    }
    for (const suffix of ['resolve.escape', 'resolve.marked', 'resolve.tf']) {
      const node = registry.narrativeNodes.find(nd => nd.id === `progression:node.defeat.g${n}.${suffix}`)!;
      assert.ok(node, `missing g${n}.${suffix}`);
      const body = registry.text(node.textKey);
      for (const playName of internalPlayNames) {
        assert.ok(!body.includes(playName), `${node.id} body must not leak internal play name ${playName}`);
      }
      assert.ok(!body.includes('这让脱困不再只有'), `${node.id} body must not contain engineering meta explanation`);
      for (const ch of node.choices) {
        assert.ok(!ch.label.includes('（'), `${node.id} choice label must not contain parenthetical explanation: ${ch.label}`);
      }
    }
    assert.ok(!registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.0${n}.escalate`));
  }
  assert.ok(!registry.narrativeNodes.some(n => n.id.includes('.escalate')));
  assert.ok(!registry.narrativeNodes.some(n => n.id.includes('.aftermath')));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub'));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub3'));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub4'));
  assert.equal(registry.action('progression:action.defeat.play' as Id).label, '试跑战败后 8 玩法');
});

test('defeat.play action opens hub under fantasy play entry tag', async () => {
  const registry = await registryOf();
  const s = createGameState(registry, 17);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  const act = e.view().actions.find(o => o.definition.id === 'progression:action.defeat.play');
  assert.ok(act?.available);
  const result = e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, 'defeat-play-1');
  assert.equal(result.ok, true, result.message);
  const story = e.snapshot().adventure!.story!;
  assert.equal(story.kind, 'defeat');
  assert.equal(story.profileId, 'progression:profile.defeat.play');
  assert.ok(story.nodeId.includes('defeat.play'));
  assert.ok(story.tags.some(t => t.tagId === 'progression:tag.defeat.play.active' && t.role === 'opponent'));
  assert.ok(story.fills?.material, 'entry draw should fill material');
  assert.ok(story.fills?.part, 'entry draw should fill part');
  assert.ok(story.fills?.tf === '黏液化' || story.fills?.tf === '黑胶化');
  assert.doesNotMatch(story.opponentName, /占位/);
  assert.ok(story.opponentName.length > 0);
});

test('G1–G8 beats mount and clear all 9 live state tags (progression:tag.state.*)', async () => {
  const registry = await registryOf();
  const expectedTags = [
    'progression:tag.state.bound',
    'progression:tag.state.coated',
    'progression:tag.state.suspended',
    'progression:tag.state.gagged',
    'progression:tag.state.blindfolded',
    'progression:tag.state.ear-sealed',
    'progression:tag.state.sensory-deprived',
    'progression:tag.state.cocooned',
    'progression:tag.state.exposed',
  ];
  const mountedAcrossNodes = new Set<string>();
  for (const node of registry.narrativeNodes) {
    if (!node.id.startsWith('progression:node.defeat.')) continue;
    for (const ch of node.choices) {
      for (const st of ch.setTags ?? []) {
        if (st.tagId.startsWith('progression:tag.state.')) {
          mountedAcrossNodes.add(st.tagId);
        }
      }
    }
  }
  for (const tagId of expectedTags) {
    assert.ok(mountedAcrossNodes.has(tagId), `expected live state tag ${tagId} to be mounted in defeat nodes`);
  }

  // Runtime verification on G1 chain: bound on capture, suspended on press/peak, cleared on exit
  const s = createGameState(registry, 17);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  assert.equal(e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, 'g1-chain').ok, true);

  const pick = (label: string) => {
    const view = e.view();
    const idx = view.actions.findIndex(a => a.definition.label === label && a.available);
    assert.ok(idx >= 0, `missing choice ${label}; have ${view.actions.map(a => a.definition.label).join(' | ')}`);
    const r = e.performAction({ actionId: view.actions[idx]!.definition.id }, e.snapshot().meta.revision, `c-${label}`);
    assert.equal(r.ok, true, r.message);
  };

  pick('进入：束缚制服');
  assert.ok(e.snapshot().adventure!.story!.tags.some(t => t.tagId === 'progression:tag.state.bound' && t.role === 'player'));
  pick('继续：加压收紧');
  assert.ok(e.snapshot().adventure!.story!.tags.some(t => t.tagId === 'progression:tag.state.suspended' && t.role === 'player'));
  pick('继续：推向高峰');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01-peak');
  pick('继续：收束脱困');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01-resolve');
  pick('结束当前经历，回到安全位置');
  assert.equal(e.snapshot().adventure!.story, null);
});

test('hub3 path reaches play-05 four-beat chain and mounts bound/cocooned/coated tags', async () => {
  const registry = await registryOf();
  const s = createGameState(registry, 17);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  assert.equal(e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, 'hub3-path').ok, true);

  const pick = (label: string) => {
    const view = e.view();
    const idx = view.actions.findIndex(a => a.definition.label === label && a.available);
    assert.ok(idx >= 0, `missing choice ${label}; have ${view.actions.map(a => a.definition.label).join(' | ')}`);
    const r = e.performAction({ actionId: view.actions[idx]!.definition.id }, e.snapshot().meta.revision, `c-${label}`);
    assert.equal(r.ok, true, r.message);
  };
  pick('查看更多玩法…');
  pick('查看其余玩法…');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-hub-rest');
  pick('进入：产卵灌注');
  assert.ok(e.snapshot().adventure!.story!.tags.some(t => t.tagId === 'progression:tag.state.bound'));
  assert.ok(e.snapshot().adventure!.story!.tags.some(t => t.tagId === 'progression:tag.state.cocooned'));
  pick('继续：加压收紧');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-05-press');
  pick('继续：推向高峰');
  assert.ok(e.snapshot().adventure!.story!.tags.some(t => t.tagId === 'progression:tag.state.coated'));
  pick('继续：收束脱困');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-05-resolve');
});

test('two seeds (or redraws) produce different defeat-play fillings', async () => {
  const registry = await registryOf();
  const run = (seed: number, tx: string) => {
    const s = createGameState(registry, seed);
    s.world.locationId = 'district:location.canal' as Id;
    if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
    const e = new ActionExecutor(registry, s);
    assert.equal(e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, tx).ok, true);
    const story = e.snapshot().adventure!.story!;
    return `${story.opponentName}|${story.fills!.material}|${story.fills!.part}|${story.fills!.tf}|${story.fills!.comboSample}`;
  };
  const a = run(17, 'draw-a');
  const b = run(99, 'draw-b');
  const c = run(17, 'draw-a');
  assert.equal(a, c, 'same seed+transactionId should redraw identically');
  assert.notEqual(a, b, `expected different fills: ${a} vs ${b}`);
});

test('gel defeat chain nodes remain untouched', async () => {
  const registry = await registryOf();
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.control'));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.coat'));
  assert.ok(registry.narrativeProfiles.some(p => p.id === 'progression:profile.gel'));
  assert.equal(registry.event('progression:event.defeat' as Id).id, 'progression:event.defeat');
  const gel = registry.narrativeProfiles.find(p => p.id === 'progression:profile.gel')!;
  assert.ok(gel.defeatTags?.some(t => t.tagId === 'progression:tag.coat.stuck'));
});

test('wild enemies, generic-only TF pipeline, E2 vine tfs:[], and E4 cocooned state work end-to-end', async () => {
  const registry = await registryOf();
  // Verify species TFs are absent and only generic slime/latex coatings + cleanse-coatings + tail-maintenance exist in progression pack
  const progressionTfs = registry.transformations.filter(t => t.id.startsWith('progression:tf.'));
  assert.deepEqual(
    progressionTfs.map(t => t.id).sort(),
    [
      'progression:tf.cleanse-coatings',
      'progression:tf.latex-coating',
      'progression:tf.slime-coating',
      'progression:tf.tail-maintenance',
    ],
    'species TFs must be removed; only generic slime/latex coatings and cleanse-coatings remain alongside tail-maintenance',
  );
  assert.throws(() => registry.action('progression:action.tf.cleanse-species' as Id));

  // Verify E2 tentacle-vine has tfs: [] and mounts state.suspended + state.bound
  const vine = registry.enemies.find(e => e.id === 'progression:enemy.tentacle-vine')!;
  assert.deepEqual(vine.defeatCombo?.materials, ['M7', 'M8', 'M9']);
  assert.deepEqual(vine.defeatCombo?.tfs, []);
  const vineStartNode = registry.narrativeNodes.find(n => n.id === 'progression:node.defeat.wild.tentacle-vine')!;
  const vineSetTags = vineStartNode.choices[0]!.setTags?.map(t => t.tagId) ?? [];
  assert.ok(vineSetTags.includes('progression:tag.state.suspended' as Id));
  assert.ok(vineSetTags.includes('progression:tag.state.bound' as Id));

  // Verify E4 hive-crawler mounts state.cocooned
  const crawlerStartNode = registry.narrativeNodes.find(n => n.id === 'progression:node.defeat.wild.hive-crawler')!;
  const crawlerSetTags = crawlerStartNode.choices[0]!.setTags?.map(t => t.tagId) ?? [];
  assert.ok(crawlerSetTags.includes('progression:tag.state.cocooned' as Id));

  // Verify b0018 action lexicon has 倒挂 (0009) and 勒紧 (0010)
  const b0018Action = await json('docs/tag-hub/nsfw-batches/nsfw-action.b0018.json');
  assert.ok(b0018Action.entries.some((x: any) => x.id === 'lx.nsfw-action.b0018.0009' && x.name === '倒挂'));
  assert.ok(b0018Action.entries.some((x: any) => x.id === 'lx.nsfw-action.b0018.0010' && x.name === '勒紧'));

  // Combat defeat -> generic TF pipeline -> cleanse
  const s2 = createGameState(registry, 23);
  s2.world.locationId = 'aetheria:location.street' as Id;
  if (!s2.world.knownLocationIds.includes(s2.world.locationId)) s2.world.knownLocationIds.push(s2.world.locationId);
  s2.player.variables['core:health'] = 1;
  s2.player.variables['core:defense'] = 0;
  s2.player.variables['core:evasion'] = 0;
  const e2 = new ActionExecutor(registry, s2);
  assert.equal(e2.performAction({ actionId: 'progression:action.encounter.env' as Id }, e2.snapshot().meta.revision, 'wild-enc-2').ok, true);
  const foughtEnemyId = e2.snapshot().district!.combat!.enemyId;
  const foughtEnemy = registry.enemies.find(x => x.id === foughtEnemyId)!;
  for (let i = 0; i < 10 && e2.snapshot().district!.combat; i++) {
    e2.performAction({ actionId: 'district:action.combat.guard' as Id }, e2.snapshot().meta.revision, 'wild-guard-' + i);
  }
  const story = e2.snapshot().adventure!.story!;
  assert.ok(story, 'should enter defeat story');
  assert.equal(story.opponentName, foughtEnemy.name);
  assert.ok(story.nodeId.startsWith('progression:node.defeat.wild.'), `expected wild start node, got ${story.nodeId}`);

  // Verify opponent.matches condition evaluation
  assert.equal(evaluate({ op: 'opponent.matches', enemyId: foughtEnemyId }, e2.snapshot(), registry).pass, true);
  assert.equal(evaluate({ op: 'opponent.matches', speciesKind: foughtEnemy.speciesKind }, e2.snapshot(), registry).pass, true);
  assert.equal(evaluate({ op: 'opponent.matches', attributeTag: foughtEnemy.attributeTags![0] }, e2.snapshot(), registry).pass, true);
  assert.equal(evaluate({ op: 'opponent.matches', fetishTag: foughtEnemy.fetishTags![0] }, e2.snapshot(), registry).pass, true);

  const pick2 = (labelSubstr: string, tx: string) => {
    const view = e2.view();
    const act = view.actions.find(a => a.definition.label.includes(labelSubstr) && a.available);
    assert.ok(act, `missing choice ${labelSubstr}; have ${view.actions.map(a => a.definition.label).join(' | ')}`);
    const res = e2.performAction({ actionId: act!.definition.id }, e2.snapshot().meta.revision, tx);
    assert.equal(res.ok, true, res.message);
  };
  pick2('撑起双臂阻挡合拢的胶浪', 'wild-to-capture');
  pick2('继续：加压收紧', 'wild-to-press');
  pick2('继续：推向高峰', 'wild-to-peak');
  pick2('继续：收束脱困', 'wild-to-resolve');
  pick2('检视体表覆层与转化感应', 'wild-to-resolve-tf');
  assert.ok(e2.snapshot().adventure!.story!.nodeId.endsWith('.resolve.tf'));
  pick2('接纳黏液化覆层转化', 'wild-enqueue-slime-tf');
  assert.equal(e2.snapshot().adventure!.story, null);
  assert.equal(e2.snapshot().player.flags['progression:flag.aftermath.mark'], true);
  assert.equal(e2.snapshot().player.flags['district:flag.injury'], false);
  assert.ok(e2.snapshot().tfQueues.some(j => j.definitionId === 'progression:tf.slime-coating' && j.status === 'active'));

  // Advance time via rest (2x 30 min = 60 min) to complete all 3 stages of progression:tf.slime-coating
  assert.equal(e2.performAction({ actionId: 'progression:action.rest' as Id }, e2.snapshot().meta.revision, 'tf-rest-1').ok, true);
  assert.equal(e2.performAction({ actionId: 'progression:action.rest' as Id }, e2.snapshot().meta.revision, 'tf-rest-2').ok, true);
  const slimeJob = e2.snapshot().tfQueues.find(j => j.definitionId === 'progression:tf.slime-coating')!;
  assert.equal(slimeJob.status, 'completed');
  const leftArm = e2.snapshot().player.body!.parts.find(p => p.instanceId === 'arm.left')!;
  assert.equal(leftArm.overrides?.materialId, 'progression:material.slime-mucus');

  validateState(e2.snapshot(), registry);
  const codec = new SaveCodec(registry);
  const decoded = await codec.decode(await codec.encode(e2.snapshot()));
  assert.equal(decoded.status, 'ready');

  const cleanseAct = e2.view().actions.find(a => a.definition.id === 'progression:action.tf.cleanse-coatings' && a.available);
  assert.ok(cleanseAct, 'cleanse coatings action should be available when coated');
  assert.equal(e2.performAction({ actionId: 'progression:action.tf.cleanse-coatings' as Id }, e2.snapshot().meta.revision, 'tf-cleanse').ok, true);
  assert.equal(e2.snapshot().player.body!.parts.find(p => p.instanceId === 'arm.left')!.overrides?.materialId, undefined);
  assert.equal(e2.snapshot().player.flags['progression:flag.aftermath.mark'], false);
});

test('DefeatReactionRule player+enemy rules, threshold gte 12, resolve.marked, and separated B1/B2 aftermath chains', async () => {
  const registry = await registryOf();
  // 1. First-class DefeatReactionRule table: 4 player reactions + 3 enemy reactions = 7 rules
  assert.equal(registry.defeatReactionRules.length, 7);
  const vineSlip = registry.defeatReactionRules.find(r => r.id === 'progression:reaction.defeat.vine-slip')!;
  const cocoonGuard = registry.defeatReactionRules.find(r => r.id === 'progression:reaction.defeat.cocoon-guard')!;
  assert.deepEqual(vineSlip.playerConditions, [{ op: 'var.compare', id: 'core:speed', comparison: 'gte', value: 12 }]);
  assert.deepEqual(cocoonGuard.playerConditions, [{ op: 'var.compare', id: 'core:defense', comparison: 'gte', value: 12 }]);
  assert.ok(registry.defeatReactionRules.some(r => r.id === 'progression:reaction.defeat.enemy-vine-tighten'));
  assert.ok(registry.defeatReactionRules.some(r => r.id === 'progression:reaction.defeat.enemy-mucus-recoat'));
  assert.ok(registry.defeatReactionRules.some(r => r.id === 'progression:reaction.defeat.enemy-cocoon-wrap'));

  // 2. Test resolve -> resolve.marked -> sets progression:flag.aftermath.mark (without TF) -> unlocks B1 & B2
  const s = createGameState(registry, 31);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  s.district!.profile = { name: '旅人', created: true, adultOptional: true };
  const e = new ActionExecutor(registry, s);
  assert.equal(e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, 'mark-flow-start').ok, true);

  const pick = (labelSubstr: string, tx: string) => {
    const act = e.view().actions.find(a => a.definition.label.includes(labelSubstr) && a.available);
    assert.ok(act, `missing choice ${labelSubstr}; have ${e.view().actions.map(a => a.definition.label).join(' | ')}`);
    const res = e.performAction({ actionId: act!.definition.id }, e.snapshot().meta.revision, tx);
    assert.equal(res.ok, true, res.message);
  };
  pick('进入：束缚制服', 'mark-g1');
  pick('继续：加压收紧', 'mark-press');
  pick('继续：推向高峰', 'mark-peak');
  pick('继续：收束脱困', 'mark-resolve');
  pick('带着残迹退回安全位置', 'mark-to-marked-node');
  assert.equal(e.snapshot().adventure!.story!.nodeId, 'progression:node.defeat.g1.resolve.marked');
  pick('拢紧衣襟护住手腕先退开', 'mark-exit-with-mark');
  assert.equal(e.snapshot().adventure!.story, null);
  assert.equal(e.snapshot().player.flags['progression:flag.aftermath.mark'], true);
  assert.equal(e.snapshot().player.flags['district:flag.injury'], false);
  assert.equal(e.snapshot().tfQueues.length, 0, 'resolve.marked must not enqueue TF');

  // Verify B2 (aftermath.corruption) is strictly separated from TF (no residue-deepen jump, no AI meta text)
  const corrNode = registry.narrativeNodes.find(n => n.id === 'progression:node.transformation.corruption.start')!;
  const corrText = registry.text(corrNode.textKey);
  assert.ok(!corrText.includes('不再直接塞入机械队列'), 'corruption text must not contain AI meta explanation');
  assert.ok(corrNode.choices.every(c => c.next === null), 'corruption choices must not jump into TF residue-deepen');

  const b1 = e.view().actions.find(a => a.definition.id === 'progression:action.residue.trace');
  const b2 = e.view().actions.find(a => a.definition.id === 'progression:action.aftermath.corruption');
  assert.ok(b1?.available, 'B1 residue.trace should be available');
  assert.ok(b2?.available, 'B2 aftermath.corruption should be available when adultOptional is on');
  assert.equal(e.performAction({ actionId: b2!.definition.id }, e.snapshot().meta.revision, 'b2-enter').ok, true);
  assert.equal(e.snapshot().adventure!.story!.nodeId, 'progression:node.transformation.corruption.start');
  pick('定神敛息，拂去脑海中的支配回响', 'b2-cleanse');
  assert.equal(e.snapshot().player.flags['progression:flag.aftermath.mark'], false);
});
