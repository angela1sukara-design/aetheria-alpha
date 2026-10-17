import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTERS, RELATIONS, TRAITS, keeperSee, rumor, smithSee } from './content.mjs';
import { createGame, present, choose, isTransformed } from './game.mjs';

function has(state, id) {
  return present(state).choices.some(choice => choice.id === id);
}

function act(state, id) {
  const before = JSON.stringify(state);
  assert.ok(has(state, id), `${id} 不在 ${present(state).choices.map(choice => choice.label).join(' / ')}`);
  const next = choose(state, id);
  assert.notEqual(JSON.stringify(next), before);
  assert.equal(JSON.stringify(state), before);
  return next;
}

function fightClean(state) {
  let guard = 0;
  while (state.phase === 'combat') {
    const ids = present(state).choices.map(choice => choice.id);
    const pick = ['c-finisher', 'c-pass', 'c-armor', 'c-burst', 'c-clash', 'c-finish', 'c-desperation'].find(id => ids.includes(id));
    assert.ok(pick, `打不下去：${ids.join(',')}`);
    state = act(state, pick);
    assert.ok(++guard < 8);
  }
  return state;
}

function recover(state) {
  if (state.phase !== 'haven') {
    if (state.phase === 'workshop') state = act(state, 'go-haven');
    else if (state.phase === 'mud') state = act(state, 'mud-back');
    else if (state.phase === 'pump') state = act(state, 'go-mud');
    if (state.phase === 'mud') state = act(state, 'mud-back');
    if (state.phase === 'workshop') state = act(state, 'go-haven');
  }
  return act(state, 'rest');
}

test('同一种子掷出同一组玩家、两名 NPC 和两只怪', () => {
  const a = createGame(7);
  const b = createGame(7);
  assert.deepEqual([a.player, a.keeper, a.smith, a.mudId, a.pumpId], [b.player, b.keeper, b.smith, b.mudId, b.pumpId]);
  const other = createGame(8);
  assert.ok(other.player.fetish !== a.player.fetish || other.mudId !== a.mudId || other.keeper.trait !== a.keeper.trait);
});

test('两局互相改不到对方身上', () => {
  const first = createGame(3, { adult: true });
  const second = createGame(9, { adult: true });
  const next = act(first, 'go-workshop');
  assert.equal(first.phase, 'haven');
  assert.equal(second.phase, 'haven');
  assert.notEqual(next.keeper.name + next.smith.name, '');
  assert.notEqual(first.keeper, second.keeper);
});

test('每种性格的问话都不点破怪物', () => {
  const hidden = [...new Set(Object.values(MONSTERS).flatMap(monster => monster.hidden))];
  const blank = { hands: 'human', arm: 'human', ears: 'human', tail: 'none', coatings: [] };
  for (const [trait] of TRAITS) {
    for (const which of ['mud', 'pump']) {
      const text = rumor(which, { name: '老闸', trait, relation: 'colleague' });
      for (const word of hidden) assert.equal(text.includes(word), false, `${trait} ${which} ${word}`);
    }
    for (const [relation] of RELATIONS) {
      const npc = { name: '老闸', trait, relation };
      assert.ok(keeperSee(npc, blank).length > 20);
      assert.ok(smithSee(npc, blank).length > 20);
    }
  }
});

test('问话不说出怪物名字和打法', () => {
  let state = act(createGame(4), 'talk-keeper');
  const mud = present(state).text;
  state = act(state, 'talk-close');
  state = act(state, 'go-workshop');
  state = act(state, 'talk-smith');
  const pump = present(state).text;
  for (const id of [state.mudId, state.pumpId, 'boss']) {
    for (const word of MONSTERS[id].hidden) assert.equal(mud.includes(word) || pump.includes(word), false, word);
  }
});

test('顺风局可以买弱点、打穿三间并在第二天重来', () => {
  let state = createGame(11);
  state = act(state, 'go-workshop');
  state = act(state, 'accept-quest');
  state = act(state, 'go-mud');
  state = act(state, has(state, 'mud-slip') ? 'mud-slip' : 'mud-struggle');
  state = fightClean(state);
  assert.equal(state.cleared.mud, true);
  assert.equal(state.player.quest, 'holding');
  state = act(state, 'mud-back');
  if (state.player.money >= 8 && has(state, 'buy-armor')) state = act(state, 'buy-armor');
  state = act(state, 'turn-in');
  assert.equal(state.player.quest, 'done');
  const intel = `intel-${state.mudId}`;
  if (!state.player.intel.includes(state.mudId) && has(state, intel)) state = act(state, intel);
  state = act(state, 'go-haven');
  state = act(state, 'go-workshop');
  state = act(state, 'go-mud');
  state = act(state, 'go-pump');
  assert.equal(state.phase, 'combat');
  assert.equal(state.combat.id, state.pumpId);
  state = fightClean(state);
  assert.equal(state.cleared.pump, true);
  state = act(state, 'go-boss');
  state = fightClean(state);
  assert.equal(state.cleared.boss, true);
  assert.equal(has(state, 'go-boss'), false);
  const day = state.day;
  state = recover(state);
  assert.equal(state.day, day + 1);
  assert.equal(state.cleared.boss, false);
  assert.equal(state.player.quest, 'none');
});

test('战败只留覆层，留下才改身体，洗净去不掉种族', () => {
  let state = createGame(5, { adult: true });
  state = act(state, 'go-workshop');
  state = act(state, 'go-mud');
  state = act(state, has(state, 'mud-slip') ? 'mud-slip' : 'mud-struggle');
  state = act(state, 'c-giveup');
  assert.equal(state.phase, 'defeat');
  assert.ok(state.player.coatings.length > 0);
  const coat = [...state.player.coatings];
  state = act(state, 'def-return');
  assert.equal(isTransformed(state.player), false);
  assert.match(present(state).text, new RegExp(coat.map(id => ({ slime: '黏液', bind: '束痕', cocoon: '结茧', saliva: '牙印', seal: '膜' }[id])).join('|')));
  state = act(state, 'wash');
  assert.deepEqual(state.player.coatings, []);
  state = act(state, 'go-workshop');
  state = act(state, 'go-mud');
  state = act(state, has(state, 'mud-struggle') ? 'mud-struggle' : 'mud-slip');
  state = act(state, 'c-giveup');
  state = act(state, 'def-stay');
  if (has(state, 'fall-next')) state = act(state, 'fall-next');
  state = act(state, 'fall-nod');
  assert.equal(isTransformed(state.player), true);
  const parts = { ...state.player };
  state = act(state, 'wash');
  assert.equal(state.player.ears, parts.ears);
  assert.equal(state.player.hands, parts.hands);
  assert.equal(state.player.arm, parts.arm);
  assert.equal(state.player.tail, parts.tail);
  state = act(state, 'restore');
  assert.equal(isTransformed(state.player), false);
});

test('史莱姆手可以不耗体力过泥，狼的撤退更贵', () => {
  let state = createGame(1, { adult: true });
  state.player.hands = 'slime';
  state.mudId = 'vine';
  state = act(state, 'go-workshop');
  state = act(state, 'go-mud');
  const before = state.player.stamina;
  assert.equal(has(state, 'mud-slip'), true);
  state = act(state, 'mud-slip');
  assert.equal(state.player.stamina, before);
  state.pumpId = 'wolf';
  state.phase = 'combat';
  state.combat = { id: 'wolf', beat: 0, clean: true, leaned: false };
  state.player.capability = 'grasp';
  state.player.stamina = 6;
  const flee = present(state).choices.find(choice => choice.id === 'c-flee');
  assert.equal(flee.label, '现在跑，它会追');
  const chased = act(state, 'c-flee');
  assert.equal(chased.player.stamina, 3);
});

test('性癖对上店主才免情报钱，对上看管人不够', () => {
  const matched = createGame(0);
  matched.player.fetish = 'humiliation';
  matched.smith.fetish = 'humiliation';
  matched.keeper.fetish = 'restraint';
  matched.player.money = 0;
  matched.phase = 'workshop';
  assert.equal(has(matched, `intel-${matched.mudId}`), true);
  const paid = choose(matched, `intel-${matched.mudId}`);
  assert.equal(paid.player.money, 0);
  const keeperOnly = createGame(0);
  keeperOnly.player.fetish = 'humiliation';
  keeperOnly.keeper.fetish = 'humiliation';
  keeperOnly.smith.fetish = 'restraint';
  keeperOnly.mudId = 'slime';
  keeperOnly.pumpId = 'crawler';
  keeperOnly.player.money = 0;
  keeperOnly.phase = 'workshop';
  assert.equal(has(keeperOnly, 'intel-slime'), false);
  keeperOnly.player.money = 5;
  const bought = choose(keeperOnly, 'intel-slime');
  assert.equal(bought.player.money, 0);
});

test('首领留下会写成封口，并换成黑胶手', () => {
  let state = createGame(2, { adult: true });
  state.player.armor = true;
  state.phase = 'combat';
  state.combat = { id: 'boss', beat: 0, clean: true, leaned: false };
  state = act(state, 'c-giveup');
  assert.match(present(state).text, /嘴唇/);
  state = act(state, 'def-stay');
  assert.match(present(state).text, /嘴唇/);
  state = act(state, 'fall-next');
  state = act(state, 'fall-drop');
  assert.equal(state.player.armor, false);
  state = act(state, 'fall-nod');
  assert.equal(state.player.hands, 'gel');
  assert.ok(state.player.coatings.includes('seal'));
  assert.match(present(state).text, /黑胶手|口令|收紧/);
});

test('没开成人内容时战败不能留下', () => {
  let state = createGame(6, { adult: false });
  state.phase = 'combat';
  state.combat = { id: 'wolf', beat: 0, clean: true, leaned: false };
  state = act(state, 'c-giveup');
  assert.equal(has(state, 'def-stay'), false);
  state = act(state, 'def-return');
  assert.equal(state.player.ears, 'human');
  assert.ok(state.player.coatings.includes('saliva'));
});

test('界面上没有观察和说明式空按钮', () => {
  let state = createGame(12, { adult: true });
  for (let i = 0; i < 12; i += 1) {
    for (const choice of present(state).choices) {
      assert.equal(/观察|确认细节|饮水机|查看周围/.test(choice.label), false);
      assert.equal(choice.label.endsWith('。'), false);
    }
    state = act(state, present(state).choices[0].id);
  }
});
