import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));

async function registryOf() {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  return loadPacks(inputs);
}

test('defeat-play G1–G3 multi-beat + G4–G8 single capture, prose fills loaded', async () => {
  const fills = await json('content/nsfw-auto-combo/defeat-play-fills.json');
  assert.equal(fills.format, 'aetheria-defeat-play-prose-fills');
  assert.equal(fills.schemaVersion, 2);
  assert.equal(Object.keys(fills.texts).length, 34);
  assert.equal(fills.worldTag, 'worlds:setting.fantasy');
  assert.equal(fills.gameplayCategories.length, 8);
  assert.ok(fills.peakSamplesNotInstalled['progression:text.node.defeat.g4.peak']);

  const candidates = await json('content/nsfw-auto-combo/defeat-play-candidates.json');
  assert.equal(candidates.plays.length, 8);
  assert.equal(candidates.proseFillsApplied, 34);
  assert.deepEqual(candidates.stageChain, ['capture', 'press', 'peak', 'resolve']);
  assert.deepEqual(candidates.hubPages.hub3, ['G5', 'G6']);
  assert.equal(candidates.plays[0].multiBeat, true);
  assert.equal(candidates.plays[3].multiBeat, false);
  assert.ok(candidates.plays[0].stages.press);
  assert.ok(candidates.plays[0].stages.resolve);
  assert.equal(candidates.plays[4].stages.press, undefined);
  assert.equal(candidates.plays[4].stages.escalate, undefined);

  const draws = await json('content/nsfw-auto-combo/defeat-play-draws.json');
  assert.equal(draws.format, 'aetheria-defeat-play-draws');
  assert.ok(draws.tfs.every((t: string) => t === '黏液化' || t === '黑胶化'));

  const registry = await registryOf();
  for (const n of [1, 2, 3]) {
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
      assert.ok(!adult.includes('【可填成人'), 'adult should be filled prose');
    }
  }
  for (const n of [4, 5, 6, 7, 8]) {
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.capture`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.capture.adult`));
    assert.ok(!registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.press`), `G${n} must not install empty press`);
    assert.ok(!registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.peak`), `G${n} must not install empty peak`);
    assert.ok(!registry.narrativeNodes.some(node => node.id === `progression:node.defeat.g${n}.resolve`), `G${n} must not install empty resolve`);
    assert.ok(!registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.0${n}.escalate`));
    const body = registry.text(`progression:text.node.defeat.g${n}.capture` as Id);
    assert.ok(body.includes('战败') || body.includes('{opponent}'), body.slice(0, 40));
  }
  assert.ok(!registry.narrativeNodes.some(n => n.id.includes('.escalate')));
  assert.ok(!registry.narrativeNodes.some(n => n.id.includes('.aftermath')));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub'));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub3'));
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub4'));
  assert.equal(registry.action('progression:action.defeat.play' as Id).label, '试跑战败后 8 玩法');

  const hub3 = registry.narrativeNodes.find(n => n.id === 'progression:node.defeat.play.hub3')!;
  assert.ok(hub3.choices.some(c => c.next === 'play-05'), 'hub3 must expose play-05 产卵灌注');
  assert.ok(hub3.choices.some(c => c.next === 'play-06'));
  assert.ok(hub3.choices.some(c => c.next === 'play-hub-last'), 'hub3 continues to hub4 for G7/G8');
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
  assert.match(story.opponentName, /占位/);
});

test('G1 four-beat chain: capture→press→peak→resolve with exit kept', async () => {
  const registry = await registryOf();
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
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01');
  assert.ok(e.snapshot().adventure!.story!.nodeId.endsWith('defeat.g1.capture'));
  const captureText = e.view().sceneText;
  assert.ok(captureText.includes('束缚带') || captureText.includes('{opponent}') || captureText.length > 40, captureText.slice(0, 80));
  assert.ok(e.view().actions.some(a => a.definition.label === '结束当前经历，回到安全位置' && a.available));

  pick('继续：加压收紧');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01-press');
  assert.ok(e.snapshot().adventure!.story!.nodeId.endsWith('defeat.g1.press'));

  pick('继续：推向高峰');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01-peak');

  pick('继续：收束脱困');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-01-resolve');
  assert.ok(e.snapshot().adventure!.story!.nodeId.endsWith('defeat.g1.resolve'));
  assert.ok(e.view().actions.some(a => a.definition.label === '结束当前经历，回到安全位置' && a.available));
});

test('hub3 path reaches play-05 single capture without empty multi-chain', async () => {
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
  const story = e.snapshot().adventure!.story!;
  assert.equal(story.stage, 'play-05');
  assert.ok(story.nodeId.endsWith('defeat.g5.capture'));
  assert.ok(!e.view().actions.some(a => /加压|高峰|升级压迫|余波/.test(a.definition.label)));
  assert.ok(e.view().actions.some(a => a.definition.label === '结束当前经历，回到安全位置' && a.available));
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
    const visible = `${story.opponentName}|${story.fills!.material}|${story.fills!.part}|${story.fills!.tf}|${story.fills!.comboSample}`;
    return visible;
  };
  const a = run(17, 'draw-a');
  const b = run(99, 'draw-b');
  const c = run(17, 'draw-a'); // same seed+tx → same
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
