import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { Id } from '../src/core/types.ts';
import { drawWildDefeatCombo, WILD_DEFEAT_COMBOS_BY_BASE_PROFILE } from '../src/engine/wild-defeat-draws.ts';
import { evaluate } from '../src/engine/conditions.ts';

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

const ENEMIES = [
  {
    slug: 'saliva_wolf',
    profileNs: 'beast',
    profileId: 'progression:profile.beast.saliva_wolf' as Id,
    comboKey: 'saliva_neck',
    comboChoice: '顺着兽吻舔颈的角度侧颈',
    hiddenChoice: '护住脖颈侧滚',
    resolveLabel: '撑起来往火堆方向挪',
    flags: { done: 'progression:flag.defeat.beast.saliva_wolf.done', mark: 'progression:flag.saliva_wolf.neck_unwiped' },
  },
  {
    slug: 'forest_slug',
    profileNs: 'beast',
    profileId: 'progression:profile.beast.forest_slug' as Id,
    comboKey: 'slug_ankle_coat',
    comboChoice: '任它把黏液涂覆在脚踝',
    hiddenChoice: null,
    resolveLabel: '留着覆层先回营地',
    flags: { done: 'progression:flag.defeat.beast.forest_slug.done', mark: 'progression:flag.forest_slug.coat_unwiped' },
  },
  {
    slug: 'tentacle_vine',
    profileNs: 'monster',
    profileId: 'progression:profile.monster.tentacle_vine' as Id,
    comboKey: 'vine_neck_tight',
    comboChoice: '随缠绕茎勒紧固定脖颈',
    hiddenChoice: '收颈护住喉结',
    resolveLabel: '保留腕勒痕先回营地',
    flags: { done: 'progression:flag.defeat.monster.tentacle_vine.done', mark: 'progression:flag.tentacle_vine.bind_unwiped' },
  },
  {
    slug: 'bog_slime',
    profileNs: 'monster',
    profileId: 'progression:profile.monster.bog_slime' as Id,
    comboKey: 'slime_lip_seal',
    comboChoice: '任封口包覆贴上嘴唇',
    hiddenChoice: '捂嘴偏头躲膜面',
    resolveLabel: '留着包覆先回营地',
    flags: { done: 'progression:flag.defeat.monster.bog_slime.done', mark: 'progression:flag.bog_slime.wrap_unwiped' },
  },
  {
    slug: 'hive_crawler',
    profileNs: 'beast',
    profileId: 'progression:profile.beast.hive_crawler' as Id,
    comboKey: 'hive_back_clamp',
    comboChoice: '随节肢钳制把背脊送实',
    hiddenChoice: '耸肩甩开背后节肢',
    resolveLabel: '保留结茧痕回营地',
    flags: { done: 'progression:flag.defeat.beast.hive_crawler.done', mark: 'progression:flag.hive_crawler.cocoon_unwiped' },
  },
  {
    slug: 'gel_warden',
    profileNs: 'boss',
    profileId: 'progression:profile.boss.gel_warden' as Id,
    comboKey: 'gel_lip_seal',
    comboChoice: '随活体黑胶封口包覆嘴唇',
    hiddenChoice: '捂唇退半步',
    resolveLabel: '保留封口痕撤离',
    flags: { done: 'progression:flag.defeat.boss.gel_warden.done', mark: 'progression:flag.gel_warden.seal_unwiped' },
  },
] as const;

for (const enemy of ENEMIES) {
  test(`${enemy.slug}: combo draw, A/B split, adult gate`, async () => {
    const registry = await registryOf();
    assert.ok(registry.enemies.some(e => e.id === `progression:enemy.${enemy.slug}`));
    assert.equal(WILD_DEFEAT_COMBOS_BY_BASE_PROFILE[enemy.profileId]?.length, 3);

    const tx = `wd-${enemy.slug}`;
    let seed: number | undefined;
    for (let s = 0; s < 160; s++) {
      const st = createGameState(registry, s);
      if (drawWildDefeatCombo(st, enemy.profileId, `wild-defeat:fill:${tx}`).comboKey === enemy.comboKey) {
        seed = s;
        break;
      }
    }
    assert.ok(seed !== undefined, enemy.comboKey);

    const e = new ActionExecutor(registry, withAdult(createGameState(registry, seed)));
    const actionA = `progression:action.wild.defeat.${enemy.slug}` as Id;
    assert.equal(e.performAction({ actionId: actionA }, e.snapshot().meta.revision, tx).ok, true);
    assert.equal(e.snapshot().adventure!.story!.fills?.comboKey, enemy.comboKey);

    const labels = e.view().actions.filter(a => a.available).map(a => a.definition.label);
    assert.ok(labels.includes(enemy.comboChoice), labels.join(' | '));
    if (enemy.hiddenChoice) {
      const hidden = e.view().actions.find(a => a.definition.label === enemy.hiddenChoice);
      assert.equal(hidden?.available, false, `hidden choice should be unavailable: ${enemy.hiddenChoice}`);
    }

    const adultPress = registry.narrativeNodes.find(
      n => n.id === `progression:node.defeat.${enemy.profileNs}.${enemy.slug}.press.adult`,
    );
    assert.ok(adultPress?.conditions.some(c => c.op === 'preference.adultOptional'));

    const advance = () => {
      const act = e.view().actions.find(a => a.available && a.definition.id.startsWith('progression:action.story.'));
      assert.ok(act);
      assert.equal(e.performAction({ actionId: act!.definition.id }, e.snapshot().meta.revision, act!.definition.label).ok, true);
    };
    advance();
    advance();
    advance();
    const resolve = e.view().actions.find(a => a.available && a.definition.label === enemy.resolveLabel);
    assert.ok(resolve, e.view().actions.map(a => a.definition.label).join(' | '));
    assert.equal(e.performAction({ actionId: resolve!.definition.id }, e.snapshot().meta.revision, enemy.resolveLabel).ok, true);
    assert.equal(e.snapshot().adventure!.story, null);
    assert.equal(e.snapshot().player.flags[enemy.flags.done], true);
    assert.equal(e.snapshot().player.flags[enemy.flags.mark], true);

    const e2 = new ActionExecutor(registry, e.snapshot());
    const corruptId = `progression:action.wild.defeat.corruption.${enemy.slug}` as Id;
    assert.ok(e2.view().actions.find(a => a.definition.id === corruptId)?.available);
    assert.equal(e2.performAction({ actionId: corruptId }, e2.snapshot().meta.revision, `${enemy.slug}-b`).ok, true);
    assert.ok(e2.snapshot().adventure!.story!.nodeId.includes('corruption.seed'));
  });
}

test('adult gate off blocks preference.adultOptional', async () => {
  const registry = await registryOf();
  const s = createGameState(registry, 5);
  s.district = { residents: [], currentResidentId: null, profile: { name: '旅人', created: true, adultOptional: false, ageYears: 20 } } as never;
  assert.equal(evaluate({ op: 'preference.adultOptional', value: true }, s, registry).pass, false);
});
