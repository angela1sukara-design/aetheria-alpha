import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));

test('defeat-play 8 gameplay nodes and prose fills are loaded', async () => {
  const fills = await json('content/nsfw-auto-combo/defeat-play-fills.json');
  assert.equal(fills.format, 'aetheria-defeat-play-prose-fills');
  assert.equal(Object.keys(fills.texts).length, 16);
  assert.equal(fills.worldTag, 'worlds:setting.fantasy');
  assert.equal(fills.gameplayCategories.length, 8);

  const candidates = await json('content/nsfw-auto-combo/defeat-play-candidates.json');
  assert.equal(candidates.plays.length, 8);
  assert.equal(candidates.proseFillsApplied, 16);

  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
  for (let n = 1; n <= 8; n++) {
    const pad = String(n).padStart(2, '0');
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}`));
    assert.ok(registry.narrativeNodes.some(node => node.id === `progression:node.defeat.play.${pad}.adult`));
    const body = registry.text(`progression:text.node.defeat.play.p${n}` as Id);
    assert.ok(body.includes('战败'), body.slice(0, 40));
    const adult = registry.text(`progression:text.node.defeat.play.p${n}.adult` as Id);
    assert.ok(adult.includes('成人门') || adult.includes('adultOptional'), adult.slice(0, 60));
  }
  assert.ok(registry.narrativeNodes.some(n => n.id === 'progression:node.defeat.play.hub'));
  assert.equal(registry.action('progression:action.defeat.play' as Id).label, '试跑战败后 8 玩法');
});

test('defeat.play action opens hub under fantasy play entry tag', async () => {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
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
});
