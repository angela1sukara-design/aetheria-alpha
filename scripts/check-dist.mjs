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
const codec = new SaveCodec(registry); const decoded = await codec.decode(await codec.encode(engine.snapshot()));
assert.equal(decoded.status, 'ready'); assert.deepEqual(decoded.state, engine.snapshot());
const html = await readFile(path.join(root, 'index.html'), 'utf8'); assert.ok(html.includes('./src/ui/main.js'));
console.log('Distribution check passed: emitted ESM imports, JSON loading, action/event execution, save round trip. This is not browser QA.');
