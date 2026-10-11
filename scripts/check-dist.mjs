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
assert.equal(engine.performAction({ actionId: 'aetheria-tf:action.travel.clinic_street' }, engine.snapshot().meta.revision, 'compiled-return').ok, true);
for (const actionId of ['aetheria-social:action.travel.street_salon', 'aetheria-social:action.velvet.meet', 'aetheria-social:action.talk.order', 'aetheria-social:action.talk.order.accept', 'aetheria-social:action.travel.salon_street', 'aetheria:action.travel.street_market', 'aetheria-social:action.market.order', 'aetheria:action.travel.market_street', 'aetheria-social:action.travel.street_salon', 'aetheria-social:action.velvet.return', 'aetheria-social:action.talk.report']) {
  const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, `compiled-npc-${engine.snapshot().meta.revision}`);
  assert.equal(result.ok, true, `${actionId}: ${result.message}`);
}
assert.equal(engine.snapshot().npcs[0].relationship.trust, 7);
const codec = new SaveCodec(registry); const decoded = await codec.decode(await codec.encode(engine.snapshot()));
assert.equal(decoded.status, 'ready'); assert.deepEqual(decoded.state, engine.snapshot());
const html = await readFile(path.join(root, 'index.html'), 'utf8'); assert.ok(html.includes('./src/ui/main.js'));
const legacy = await codec.decode(await readFile(new URL('../tests/fixtures/stage1-save.json', import.meta.url), 'utf8'));
assert.equal(legacy.status, 'ready'); assert.equal(legacy.state.meta.schemaVersion, 3);
const stage2 = await codec.decode(await readFile(new URL('../tests/fixtures/stage2-save.json', import.meta.url), 'utf8'));
assert.equal(stage2.status, 'ready'); assert.equal(stage2.state.tfQueues[0].status, 'paused'); assert.equal(stage2.state.tfQueues[0].elapsedMinutes, 15);
const stage3 = await codec.decode(await readFile(new URL('../tests/fixtures/stage3-npc-save.json', import.meta.url), 'utf8'));
assert.equal(stage3.status, 'ready'); assert.match(stage3.migration, /第三阶段|街区模块/); assert.equal(stage3.state.npcs[0].relationship.trust, 7);
const exhausted = await codec.decode(await readFile(new URL('../tests/fixtures/stage3-exhausted-save.json', import.meta.url), 'utf8'));
assert.equal(exhausted.status, 'ready'); const recovered = new ActionExecutor(registry, exhausted.state);
assert.equal(recovered.view().actions.find(a => a.definition.id === 'aetheria-social:action.travel.salon_street').available, false);
assert.equal(recovered.performAction({ actionId: 'aetheria-recovery:action.salon.rest' }, recovered.snapshot().meta.revision, 'compiled-recover').ok, true);
assert.equal(recovered.snapshot().player.variables['core:energy'], 10);
assert.equal(recovered.performAction({ actionId: 'aetheria-social:action.travel.salon_street' }, recovered.snapshot().meta.revision, 'compiled-leave').ok, true);
console.log('Distribution check passed: ESM imports, JSON loading, daily/event/BodyGraph/TF/NPC quest execution, schema-3 save round trip, stage-1/2/3 exact migration, exhausted-salon recovery. This is not browser QA.');
