import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';

test('general-lexicon pack loads into default index path', async () => {
  const index = JSON.parse(await readFile('content/index.json', 'utf8')) as { packs: string[] };
  assert.ok(index.packs.includes('./general-lexicon/pack.json'));
  const packs = await Promise.all(index.packs.map(async p => JSON.parse(await readFile('content/' + p.replace(/^\.\//, ''), 'utf8'))));
  const registry = await loadPacks(packs);
  const general = registry.tags.filter(t => t.id.startsWith('general-taxonomy:'));
  assert.equal(general.length, 1932);
  assert.ok(general.every(t => t.status === 'active'));
  assert.ok(general.every(t => /[\u3400-\u9fff]/.test(t.label)));
  // NSFW not smuggled as approved prose via this pack
  const pack = packs.find(p => p.manifest?.id === 'aetheria/general-lexicon');
  assert.equal(pack.manifest.status, 'reviewed');
  assert.equal((pack.proseMaterials ?? []).length, 0);
});

test('sanity remaining model: initial full, rest recovers, pressure magnitude positive', async () => {
  const { sanityGain, sanityRestDelta } = await import('../src/engine/numerics.ts');
  assert.equal(sanityGain({ base: 6 }), 6);
  assert.equal(sanityRestDelta(30), 8);
  const core = JSON.parse(await readFile('content/core/pack.json', 'utf8'));
  const sanity = core.variables.find((v: { id: string }) => v.id === 'core:sanity');
  assert.equal(sanity.initial, 100);
  assert.ok(core.flags.some((f: { id: string }) => f.id === 'core:flag.sanity_remaining'));
});
