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

test('defeat-play 8 gameplay nodes, multi-stage slots, and prose fills are loaded', async () => {
  const fills = await json('content/nsfw-auto-combo/defeat-play-fills.json');
  assert.equal(fills.format, 'aetheria-defeat-play-prose-fills');
  assert.equal(Object.keys(fills.texts).length, 16);
  assert.equal(fills.worldTag, 'worlds:setting.fantasy');
  assert.equal(fills.gameplayCategories.length, 8);

  const candidates = await json('content/nsfw-auto-combo/defeat-play-candidates.json');
  assert.equal(candidates.plays.length, 8);
  assert.equal(candidates.proseFillsApplied, 16);
  assert.deepEqual(candidates.stageChain, ['capture', 'escalate', 'peak', 'aftermath']);
  assert.deepEqual(candidates.hubPages.hub3, ['G5', 'G6']);

  const draws = await json('content/nsfw-auto-combo/defeat-play-draws.json');
  assert.equal(draws.format, 'aetheria-defeat-play-draws');
  assert.ok(draws.tfs.every((t: string) => t === '黏液化' || t === '黑胶化'));

  const registry = await registryOf();
  for (let n = 1; n <= 8; n++) {
    const pad = String(n).padStart(2, '0');
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}.adult`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}.escalate`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}.peak`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}.aftermath`));
    const body = registry.text(`progression:text.node.defeat.play.p${n}` as Id);
    assert.ok(body.includes('战败') || body.includes('{opponent}'), body.slice(0, 40));
    assert.ok(body.includes('{opponent}') || body.includes('{material}'), 'capture text should carry placeholders');
    const adult = registry.text(`progression:text.node.defeat.play.p${n}.adult` as Id);
    assert.ok(adult.includes('成人门') || adult.includes('adultOptional'), adult.slice(0, 60));
  }
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

test('hub3 path reaches play-05 and multi-stage capture stays playable', async () => {
  const registry = await registryOf();
  const s = createGameState(registry, 17);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  assert.equal(e.performAction({ actionId: 'progression:action.defeat.play' as Id }, e.snapshot().meta.revision, 'hub3-path').ok, true);

  // hub → more (play-hub-more)
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
  assert.ok(story.nodeId.endsWith('defeat.play.05'));
  const text = e.view().sceneText;
  // visible fill
  assert.ok(text.includes(story.opponentName) || text.includes(story.fills!.material!), text.slice(0, 120));
  pick('继续：升级压迫');
  assert.equal(e.snapshot().adventure!.story!.stage, 'play-05-escalate');
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
});
