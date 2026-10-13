import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { dictionaryRegistry, validateSemanticBatch } from '../scripts/lexicon/semantic-format.mjs';

const hub = path.resolve('docs/tag-hub/nsfw-batches');
const draft = path.join(hub, 'v2-draft');

test('b0017 v1 hub batches are present and schema-shaped', async () => {
  const files = (await readdir(hub)).filter((f) => f.includes('b0017') && f.endsWith('.json'));
  assert.equal(files.length, 7);
  let total = 0;
  for (const f of files.sort()) {
    const raw = JSON.parse(await readFile(path.join(hub, f), 'utf8'));
    assert.equal(raw.format, 'aetheria-nsfw-lexicon-batch');
    assert.equal(raw.schemaVersion, 1);
    assert.ok(raw.library.startsWith('nsfw-'));
    assert.ok(Array.isArray(raw.entries) && raw.entries.length >= 1);
    total += raw.entries.length;
    raw.entries.forEach((e: { id: string; name: string; description: string }, i: number) => {
      assert.equal(e.id, `lx.${raw.batchId}.${String(i + 1).padStart(4, '0')}`);
      assert.ok(e.name.trim());
      assert.ok(e.description.includes('待审定'));
    });
  }
  assert.equal(total, 54);
});

test('b0017 v2 drafts pass validate-v2 and stay uninstalled', async () => {
  const registry = await dictionaryRegistry(process.cwd());
  const files = (await readdir(draft)).filter((f) => f.endsWith('.v2.json') && f.includes('b0017'));
  assert.equal(files.length, 7);
  for (const f of files.sort()) {
    const batch = JSON.parse(await readFile(path.join(draft, f), 'utf8'));
    const ok = validateSemanticBatch(batch, registry);
    assert.equal(ok.format, 'aetheria-lexicon-materials');
    assert.equal(ok.schemaVersion, 2);
    assert.equal(ok.domain, 'nsfw');
    for (const e of ok.entries) {
      assert.deepEqual(e.tags, []);
      assert.equal(e.classification.tier, 'adult_optional');
    }
  }
  const manifest = JSON.parse(await readFile(path.join(draft, 'MANIFEST.json'), 'utf8'));
  assert.equal(manifest.status, 'pending-review');
  assert.equal(manifest.runtime, 'not-installed');
});
