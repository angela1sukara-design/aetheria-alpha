import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { Id } from '../src/core/types.ts';
import { SALIVA_WOLF_COMBOS, drawSalivaWolfCombo } from '../src/engine/wild-defeat-draws.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));

async function registryOf() {
  const index = await json('content/index.json');
  const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
  return loadPacks(inputs);
}

function withAdult(s: ReturnType<typeof createGameState>) {
  s.district ??= { residents: [], currentResidentId: null, profile: { name: '旅人', created: true, adultOptional: true, ageYears: 20 } } as never;
  s.district!.profile = { name: '旅人', created: true, adultOptional: true, ageYears: 20 };
  return s;
}

test('wild-defeat fills and candidates loaded', async () => {
  const fills = await json('content/nsfw-auto-combo/wild-defeat-fills.json');
  assert.equal(fills.format, 'aetheria-wild-defeat-prose-fills');
  assert.equal(fills.schemaVersion, 2);
  assert.equal(Object.keys(fills.texts).length, 54);

  const candidates = await json('content/nsfw-auto-combo/wild-defeat-candidates.json');
  assert.equal(candidates.format, 'aetheria-wild-defeat-candidates');
  assert.equal(candidates.schemaVersion, 2);
  assert.ok(candidates.proseFillsApplied >= 54);
  assert.equal(candidates.enemies?.length, 6);

  const registry = await registryOf();
  assert.ok(registry.enemies.some(e => e.id === 'progression:enemy.saliva_wolf'));
  assert.ok(registry.narrativeProfiles.some(p => p.id === 'progression:profile.beast.saliva_wolf'));
  assert.ok(registry.environmentEnemyRules.some(r => r.enemyId === 'progression:enemy.saliva_wolf'));
  for (const suffix of ['capture', 'press', 'peak', 'resolve']) {
    assert.ok(
      registry.narrativeNodes.some(n => n.id === `progression:node.defeat.beast.saliva_wolf.${suffix}`),
      suffix,
    );
  }
});

test('drawSalivaWolfCombo maps stream to combo tag', async () => {
  const registry = await registryOf();
  const tags = new Set<string>();
  for (let seed = 0; seed < 48; seed++) {
    const s = createGameState(registry, seed);
    const d = drawSalivaWolfCombo(s, `combo-scan:${seed}`);
    tags.add(d.comboKey);
    assert.ok(SALIVA_WOLF_COMBOS.some(c => c.key === d.comboKey));
  }
  assert.equal(tags.size, 3, '48 seeds should hit all three combo rows');
});

test('A chain: combo tag filters capture choice', async () => {
  const registry = await registryOf();
  const tx = 'sw-a-neck';
  let neckSeed: number | undefined;
  for (let seed = 0; seed < 120; seed++) {
    const s = createGameState(registry, seed);
    const d = drawSalivaWolfCombo(s, `wild-defeat:fill:${tx}`);
    if (d.comboKey === 'saliva_neck') {
      neckSeed = seed;
      break;
    }
  }
  assert.ok(neckSeed !== undefined);

  const e = new ActionExecutor(registry, withAdult(createGameState(registry, neckSeed)));
  assert.equal(
    e.performAction(
      { actionId: 'progression:action.wild.defeat.saliva_wolf' as Id },
      e.snapshot().meta.revision,
      tx,
    ).ok,
    true,
  );
  const story = e.snapshot().adventure!.story!;
  assert.equal(story.fills?.comboKey, 'saliva_neck');
  assert.ok(story.tags.some(t => t.tagId === 'progression:tag.beast.combo.saliva_neck'));

  const labels = e.view().actions.filter(a => a.available).map(a => a.definition.label);
  assert.ok(labels.some(l => l.includes('兽吻舔颈')), labels.join(' | '));
  assert.ok(!labels.some(l => l === '护住脖颈侧滚'), 'neck combo should hide generic roll');
});

test('A4 resolve does not open B; corruption entry needs flags', async () => {
  const registry = await registryOf();
  const e = new ActionExecutor(registry, withAdult(createGameState(registry, 11)));
  assert.equal(
    e.performAction(
      { actionId: 'progression:action.wild.defeat.saliva_wolf' as Id },
      e.snapshot().meta.revision,
      'sw-a',
    ).ok,
    true,
  );
  const advance = (label?: string) => {
    const view = e.view();
    const act = label
      ? view.actions.find(a => a.available && a.definition.label === label)
      : view.actions.find(a => a.available && a.definition.id.startsWith('progression:action.story.'));
    assert.ok(act, label ?? view.actions.map(a => a.definition.label).join(' | '));
    assert.equal(e.performAction({ actionId: act.definition.id }, e.snapshot().meta.revision, act.definition.label).ok, true);
  };
  advance();
  advance();
  advance();
  advance('撑起来往火堆方向挪');
  assert.equal(e.snapshot().adventure!.story, null);
  assert.equal(e.snapshot().player.flags['progression:flag.defeat.beast.saliva_wolf.done'], true);
  assert.equal(e.snapshot().player.flags['progression:flag.saliva_wolf.neck_unwiped'], true);

  const e2 = new ActionExecutor(registry, e.snapshot());
  const corrupt = e2.view().actions.find(a => a.definition.id === 'progression:action.wild.defeat.corruption.saliva_wolf');
  assert.ok(corrupt?.available);
  assert.equal(
    e2.performAction(
      { actionId: 'progression:action.wild.defeat.corruption.saliva_wolf' as Id },
      e2.snapshot().meta.revision,
      'sw-b',
    ).ok,
    true,
  );
  assert.ok(e2.snapshot().adventure!.story!.nodeId.includes('corruption.seed'));
});
