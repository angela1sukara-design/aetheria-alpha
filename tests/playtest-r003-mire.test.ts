import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import type { ContentPack, Id } from '../src/core/types.ts';

const START_ACTION = 'stories:action.mire-trap.start' as Id;
const EVENT_ID = 'stories:event.mire-trap';

async function loadPlaytestRegistry() {
  const index = JSON.parse(await readFile('content/index.playtest-r003-mire.json', 'utf8')) as { packs: string[] };
  const packs = await Promise.all(
    index.packs.map(async p => JSON.parse(await readFile('content/' + p.replace(/^\.\//, ''), 'utf8')) as ContentPack),
  );
  return loadPacks(packs);
}

test('old r003 preview URL loads the real attribute-driven story instead of the draft observation graph', async () => {
  const registry = await loadPlaytestRegistry();
  const start = registry.action(START_ACTION);
  assert.equal(start.label, '穿过湿地边缘的狭窄通道');

  const streetActions = registry.actionsForHook('stories:hook.entries' as Id);
  assert.ok(streetActions.some(a => a.id === START_ACTION));

  const event = registry.event(EVENT_ID as Id);
  assert.equal(event.startNode, 'entry');
  assert.ok(event.binding?.environmentTags?.includes('foundation:setting.wet'));
  assert.deepEqual(event.nodes.filter(n=>n.type==='choice').map(n => n.id), ['entry', 'trapped', 'defeat', 'edge']);
  assert.ok(event.nodes.filter(n=>n.type==='exit').every(n=>n.onEnter.some(e=>e.op==='event.exit')));
});

test('default content/index.json does not include playtest-r003-mire pack', async () => {
  const index = JSON.parse(await readFile('content/index.json', 'utf8')) as { packs: string[] };
  assert.ok(!index.packs.some(p => p.includes('playtest-r003-mire')));
});
