import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import type { ContentPack, Id } from '../src/core/types.ts';

const START_ACTION = 'playtest-r003-mire:action.start' as Id;
const EVENT_ID = 'playtest-r003-mire:event.trap';

async function loadPlaytestRegistry() {
  const index = JSON.parse(await readFile('content/index.playtest-r003-mire.json', 'utf8')) as { packs: string[] };
  const packs = await Promise.all(
    index.packs.map(async p => JSON.parse(await readFile('content/' + p.replace(/^\.\//, ''), 'utf8')) as ContentPack),
  );
  return loadPacks(packs);
}

test('playtest-r003-mire index loads and exposes street hook + event graph', async () => {
  const registry = await loadPlaytestRegistry();
  const start = registry.action(START_ACTION);
  assert.equal(start.label, '走近黑沼迷雾带（试玩）');

  const streetActions = registry.actionsForHook('aetheria:hook.street.actions' as Id);
  assert.ok(streetActions.some(a => a.id === START_ACTION));

  const event = registry.event(EVENT_ID as Id);
  assert.equal(event.startNode, 'N01');
  assert.deepEqual(event.nodes.map(n => n.id), ['N01', 'N02', 'N03', 'N04', 'N05']);
  assert.equal(event.nodes[4]!.type, 'exit');
  assert.ok(event.nodes[4]!.onEnter?.some(e => e.op === 'event.exit'));
});

test('default content/index.json does not include playtest-r003-mire pack', async () => {
  const index = JSON.parse(await readFile('content/index.json', 'utf8')) as { packs: string[] };
  assert.ok(!index.packs.some(p => p.includes('playtest-r003-mire')));
});
