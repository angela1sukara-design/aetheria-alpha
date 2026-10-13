import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadAtoms, combine, sampleCombos, enumerateCombos, toEncounterCandidate, verifyLexiconRefs } from '../scripts/nsfw-auto-combo/combiner.mjs';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { Id } from '../src/core/types.ts';

const hub = path.resolve('docs/tag-hub/nsfw-batches');
const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));

test('combiner builds C1–C6 from production-card atoms with real hub IDs', async () => {
  const atoms = await loadAtoms();
  assert.equal(atoms.samples.length, 6);
  const combos = sampleCombos(atoms);
  assert.equal(combos.length, 6);
  assert.equal(combos[0]!.sampleId, 'C1');
  assert.match(combos[0]!.comboKey, /触手黏液/);
  assert.match(combos[0]!.fragment, /缠绕/);
  assert.equal(combos[3]!.adultRequired, true); // C4 封口
  for (const c of combos) {
    assert.ok(c.lexiconRefs.every((id: string) => id.startsWith('lx.nsfw-')));
    const missing = await verifyLexiconRefs(c, hub);
    assert.equal(missing.length, 0, JSON.stringify(missing));
    // 禁止物种 TF 专条名
    if (c.optionalTf) assert.ok(['黏液化', '黑胶化'].includes(c.optionalTf.name));
  }
});

test('combine rejects unknown atoms and non-generic species TF names', async () => {
  const atoms = await loadAtoms();
  assert.throws(() => combine(atoms, { material: 'M9', targets: ['Pt5'], action: 'A1' }), /未知材质/);
  const forged = structuredClone(atoms);
  forged.tfs.push({ key: 'TfX', id: 'lx.nsfw-tf.fake.0001', name: '蛞蝓黏液化', kind: 'L' });
  assert.throws(
    () => combine(forged, { material: 'M1', targets: ['Pt7'], action: 'A2', optionalTf: 'TfX' }),
    /禁止物种 TF 专条/,
  );
});

test('enumerateCombos stays bounded and fills slots', async () => {
  const atoms = await loadAtoms();
  const list = enumerateCombos(atoms, { limit: 8 });
  assert.equal(list.length, 8);
  assert.ok(list.every((c) => c.slots['材质'] && c.slots['动作'] && c.fragment.includes(c.action.name)));
});

test('adventure pack exposes nsfwcombo encounter action and sample nodes', async () => {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
  assert.ok(registry.tags.some((t) => t.id === 'progression:tag.nsfwcombo.active'));
  assert.ok(registry.narrativeProfiles.some((p) => p.id === 'progression:profile.nsfwcombo.matrix'));
  const nodes = registry.narrativeNodes.filter((n) => n.id.includes('nsfwcombo'));
  assert.ok(nodes.length >= 12, `expected start+detail per sample, got ${nodes.length}`);
  assert.equal(registry.action('progression:action.nsfwcombo.encounter' as Id).label, '试跑 NSFW 材质组合遭遇');
  assert.ok(registry.globalActions().some((a) => a.id === 'progression:action.nsfwcombo.encounter'));

  const candidates = await json('content/nsfw-auto-combo/candidates.json');
  assert.equal(candidates.format, 'aetheria-nsfw-auto-combo-candidates');
  assert.equal(candidates.count, 6);

  const s = createGameState(registry, 17);
  s.world.locationId = 'district:location.canal' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  const act = e.view().actions.find((o) => o.definition.id === 'progression:action.nsfwcombo.encounter');
  assert.ok(act?.available);
  const result = e.performAction({ actionId: 'progression:action.nsfwcombo.encounter' as Id }, e.snapshot().meta.revision, 'nsfwcombo-1');
  assert.equal(result.ok, true, result.message);
  const story = e.snapshot().adventure!.story!;
  assert.equal(story.kind, 'encounter');
  assert.equal(story.profileId, 'progression:profile.nsfwcombo.matrix');
  assert.ok(story.nodeId.includes('nsfwcombo'));
  assert.ok(story.tags.some((t) => t.tagId === 'progression:tag.nsfwcombo.active' && t.role === 'opponent'));
});

test('toEncounterCandidate never forges foundation material.gel', async () => {
  const atoms = await loadAtoms();
  const c3 = sampleCombos(atoms).find((c) => c.sampleId === 'C3')!;
  const cand = toEncounterCandidate(c3, {
    nodeId: 'progression:node.encounter.nsfwcombo.c3',
    textKey: 'progression:text.node.encounter.nsfwcombo.c3',
    requireTagId: 'progression:tag.nsfwcombo.active',
  });
  assert.ok(!JSON.stringify(cand).includes('foundation:material.gel'));
  assert.match(cand.fragment, /凝胶膜/);
});
