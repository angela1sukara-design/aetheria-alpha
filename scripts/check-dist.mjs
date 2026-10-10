import { readdir, readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPacks } from '../dist/src/content/loader.js';
import { ActionExecutor } from '../dist/src/engine/executor.js';
import { createGameState } from '../dist/src/engine/state.js';
import { SaveCodec } from '../dist/src/persistence/codec.js';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function imports(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name); if (e.isDirectory()) { await imports(file); continue; }
    if (!e.name.endsWith('.js')) continue;
    const text = await readFile(file, 'utf8');
    assert.ok(!/from\s+['"][^'"]+\.ts['"]/.test(text), `Unconverted import: ${file}`);
    for (const match of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) assert.ok((await stat(path.resolve(path.dirname(file), match[1]))).isFile());
  }
}
await imports(path.join(root, 'src'));
const index = JSON.parse(await readFile(path.join(root, 'content/index.json'), 'utf8'));
const packs = await Promise.all(index.packs.map(async p => JSON.parse(await readFile(path.join(root, 'content', p), 'utf8'))));
const registry = await loadPacks(packs); const engine = new ActionExecutor(registry, createGameState(registry, 42));
for (const suffix of ['travel.apartment_street', 'street.notice', 'notice.help', 'travel.street_market', 'market.work']) {
  assert.equal(engine.performAction({ actionId: `aetheria:action.${suffix}` }, engine.snapshot().meta.revision, `compiled-${suffix}`).ok, true);
}
for (const suffix of ['travel.market_street']) assert.equal(engine.performAction({ actionId: `aetheria:action.${suffix}` }, engine.snapshot().meta.revision, `compiled-${suffix}`).ok, true);
for (const suffix of ['travel.street_clinic', 'clinic.consult', 'consult.offer.accept', 'clinic.wait', 'clinic.wait', 'clinic.wait']) {
  assert.equal(engine.performAction({ actionId: `aetheria-tf:action.${suffix}` }, engine.snapshot().meta.revision, `compiled-tf-${engine.snapshot().meta.revision}`).ok, true);
}
assert.equal(engine.snapshot().tfQueues.at(-1).status, 'completed');
assert.ok(engine.snapshot().player.body.parts.some(p => p.definitionId === 'aetheria-tf:part.tail.mechanical'));
const codec = new SaveCodec(registry); const decoded = await codec.decode(await codec.encode(engine.snapshot()));
assert.equal(decoded.status, 'ready'); assert.deepEqual(decoded.state, engine.snapshot());
const html = await readFile(path.join(root, 'index.html'), 'utf8'); assert.ok(html.includes('./src/ui/main.js'));
const legacy = await codec.decode(await readFile(new URL('../tests/fixtures/stage1-save.json', import.meta.url), 'utf8'));
assert.equal(legacy.status, 'ready'); assert.equal(legacy.state.meta.schemaVersion, 2);
console.log('Distribution check passed: ESM imports, JSON loading, daily/event/BodyGraph/TF execution, schema-2 save round trip, stage-1 migration. This is not browser QA.');
