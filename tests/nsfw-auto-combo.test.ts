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

test('combiner builds C1–C12 from production-card atoms with real hub IDs', async () => {
  const atoms = await loadAtoms();
  assert.equal(atoms.samples.length, 12);
  const combos = sampleCombos(atoms);
  assert.equal(combos.length, 12);
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
  assert.ok(nodes.length >= 12, `expected start (+adult) per sample, got ${nodes.length}`);
  assert.equal(nodes.filter((n) => n.id.endsWith('.detail')).length, 0, 'nsfwcombo detail nodes must not be playable');
  assert.ok(!nodes.some((n) => n.choices.some((c) => /核对组合/.test(c.label))), 'no 核对组合二次确认');
  assert.equal(registry.action('progression:action.nsfwcombo.encounter' as Id).label, '试跑 NSFW 材质组合遭遇');
  assert.ok(registry.globalActions().some((a) => a.id === 'progression:action.nsfwcombo.encounter'));

  const candidates = await json('content/nsfw-auto-combo/candidates.json');
  assert.equal(candidates.format, 'aetheria-nsfw-auto-combo-candidates');
  assert.equal(candidates.count, 12);

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

test('adult samples expose gated adult text slots', async () => {
  const candidates = await json('content/nsfw-auto-combo/candidates.json');
  const adults = candidates.candidates.filter((c: { adultRequired: boolean }) => c.adultRequired);
  assert.ok(adults.length >= 6, `adult samples ${adults.length}`);
  for (const c of adults) {
    assert.ok(c.adultTextKey?.endsWith('.adult'), c.sampleId);
    assert.ok(c.fillable?.adultNodeId?.includes('.adult'), c.sampleId);
  }
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
  const adultNode = registry.narrativeNodes.find((n) => n.id === 'progression:node.encounter.nsfwcombo.c8.adult');
  assert.ok(adultNode);
  assert.ok(adultNode!.conditions.some((c) => c.op === 'preference.adultOptional' && c.value === true));
});

test('prose-fills applied to start and adult text slots (P0+P1)', async () => {
  const fills = await json('content/nsfw-auto-combo/prose-fills.json');
  assert.equal(fills.format, 'aetheria-nsfw-auto-combo-prose-fills');
  assert.equal(Object.keys(fills.texts).length, 20);
  const pack = await json('content/adventure/pack.json');
  for (const [key, body] of Object.entries(fills.texts) as [string, string][]) {
    assert.equal(pack.texts[key], body, key);
    assert.ok(!String(body).includes('可填成人正文槽'), key);
  }
  // dual-slot adult samples
  for (const slug of ['c4', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12']) {
    assert.ok(pack.texts[`progression:text.node.encounter.nsfwcombo.${slug}`]);
    assert.ok(pack.texts[`progression:text.node.encounter.nsfwcombo.${slug}.adult`]);
  }
  assert.match(pack.texts['progression:text.node.encounter.nsfwcombo.c6'], /胯下/);
  assert.ok(!pack.texts['progression:text.node.encounter.nsfwcombo.c6'].includes('倒挂'));
  // detail text kept for authoring, but not playable
  assert.match(pack.texts['progression:text.node.encounter.nsfwcombo.c1.detail'], /组合键/);
  assert.ok(!pack.narrativeNodes.some((n: { id: string }) => n.id.endsWith('nsfwcombo.c1.detail')));
});

test('local encounter action skips empty shell and 核对细节', async () => {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
  const encounterAct = registry.action('progression:action.narrative.encounter' as Id);
  assert.ok(encounterAct.effects.some((e) => e.op === 'narrative.start' && e.kind === 'encounter' && !('profileId' in e && e.profileId)));
  const emptyStart = registry.narrativeNodes.find((n) => n.id === 'progression:node.encounter.start');
  assert.ok(emptyStart, 'schema fallback start retained');
  assert.ok(!emptyStart!.choices.some((c) => /核对细节/.test(c.label)), 'empty start must not offer 继续核对细节');
  assert.match(registry.text(emptyStart!.textKey), /退路|绕开/);
  assert.ok(!registry.narrativeNodes.some((n) => n.id === 'progression:node.encounter.detail'), 'encounter.detail shell removed');
  const inn = registry.narrativeNodes.find((n) => n.id === 'progression:node.encounter.inn.gate.capture');
  assert.ok(inn);
  assert.ok(inn!.conditions.some((c) => c.op === 'environment.service' && c.value === 'home'));
  assert.ok(!inn!.choices.some((c) => /核对/.test(c.label)));

  // 城门旅馆（home）：应抽到 inn.gate capture，而非空壳
  const s = createGameState(registry, 42);
  s.world.locationId = 'aetheria:location.apartment' as Id;
  if (!s.world.knownLocationIds.includes(s.world.locationId)) s.world.knownLocationIds.push(s.world.locationId);
  const e = new ActionExecutor(registry, s);
  const result = e.performAction({ actionId: 'progression:action.narrative.encounter' as Id }, e.snapshot().meta.revision, 'encounter-inn');
  assert.equal(result.ok, true, result.message);
  const story = e.snapshot().adventure!.story!;
  assert.equal(story.nodeId, 'progression:node.encounter.local');
  const node = registry.narrativeNodes.find((n) => n.id === story.nodeId)!;
  assert.ok(!node.choices.some((c) => /核对/.test(c.label)), JSON.stringify(node.choices.map((c) => c.label)));
  assert.ok(e.view().sceneText.includes('公寓'));assert.doesNotMatch(e.view().sceneText,/城门旅馆/);
});

test('C6/C7 offer engage/avoid/alt without 核对组合', async () => {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  const registry = await loadPacks(inputs);
  for (const slug of ['c6', 'c7']) {
    const node = registry.narrativeNodes.find((n) => n.id === `progression:node.encounter.nsfwcombo.${slug}`);
    assert.ok(node, slug);
    const labels = node!.choices.map((c) => c.label);
    assert.ok(!labels.some((l) => /核对/.test(l)), labels.join(','));
    assert.ok(node!.choices.length === 4, labels.join(','));
    assert.ok(!registry.text(node!.textKey).includes('可填成人正文槽'));
    assert.ok(!registry.text(`progression:text.node.encounter.nsfwcombo.${slug}.adult` as Id).includes('可填成人正文槽'));
  }
});

test('atoms expose 8 gameplay categories and samples cover all', async () => {
  const atoms = await loadAtoms();
  assert.equal((atoms.gameplayCategories ?? []).length, 8);
  const combos = sampleCombos(atoms);
  const keys = new Set(combos.map((c: { gameplay?: { key: string } }) => c.gameplay?.key).filter(Boolean));
  assert.equal(keys.size, 8, JSON.stringify([...keys]));
});
