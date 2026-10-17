import {
  CAPABILITIES, COAT_LABEL, FETISHES, KEEPER_NAMES, MATERIALS, MONSTERS,
  PLAYER_NAMES, RELATIONS, SMITH_NAMES, TRAITS,
  defeatOpen, fallScript, grapple, keeperSee, label, meet, monster, rumor, smithSee,
} from './content.mjs';

const STAMINA = 10;
const PRICES = { armor: 8, intel: 5, quest: 8, win: 6, boss: 12 };

function hash(seed, text) {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}

function pick(seed, key, list) {
  return list[hash(seed, key) % list.length];
}

function pair(seed, key, list) {
  return pick(seed, key, list)[0];
}

function rollNpc(seed, key, names) {
  return {
    name: pick(seed, `${key}.name`, names),
    trait: pair(seed, `${key}.trait`, TRAITS),
    relation: pair(seed, `${key}.relation`, RELATIONS),
    fetish: pair(seed, `${key}.fetish`, FETISHES),
    material: pair(seed, `${key}.material`, MATERIALS),
  };
}

export function createGame(seed, options = {}) {
  const s = seed >>> 0;
  return {
    seed: s,
    step: 0,
    day: 1,
    adult: !!options.adult,
    phase: 'haven',
    player: {
      name: options.name || pick(s, 'player.name', PLAYER_NAMES),
      material: pair(s, 'player.material', MATERIALS),
      capability: pair(s, 'player.capability', CAPABILITIES),
      fetish: pair(s, 'player.fetish', FETISHES),
      stamina: STAMINA,
      money: 4,
      armor: false,
      coatings: [],
      ears: 'human',
      hands: 'human',
      arm: 'human',
      tail: 'none',
      intel: [],
      quest: 'none',
    },
    keeper: rollNpc(s, 'keeper', KEEPER_NAMES),
    smith: rollNpc(s, 'smith', SMITH_NAMES),
    mudId: pick(s, 'mud', ['slime', 'vine']),
    pumpId: pick(s, 'pump', ['crawler', 'wolf']),
    seen: { mud: false, pump: false, boss: false },
    cleared: { mud: false, pump: false, boss: false },
    combat: null,
    fall: null,
    talk: null,
  };
}

function isTransformed(player) {
  return player.ears !== 'human' || player.hands !== 'human' || player.arm !== 'human' || player.tail !== 'none';
}

function spend(player, amount) {
  player.stamina = Math.max(0, player.stamina - amount);
}

function addCoat(player, id) {
  if (!player.coatings.includes(id)) player.coatings.push(id);
}

function clearCoats(player) {
  player.coatings = [];
}

function applySpecies(player, id) {
  if (id === 'slime') player.hands = 'slime';
  if (id === 'vine') player.arm = 'vine';
  if (id === 'crawler') player.ears = 'antenna';
  if (id === 'wolf') { player.ears = 'wolf'; player.tail = 'organic'; }
  if (id === 'boss') player.hands = 'gel';
}

function restoreHuman(player) {
  player.ears = 'human';
  player.hands = 'human';
  player.arm = 'human';
  player.tail = 'none';
}

function canSlip(player) {
  return player.hands === 'slime' || player.coatings.includes('slime');
}

function intelFree(state, id) {
  const foe = monster(id);
  return state.player.fetish === state.smith.fetish || state.player.fetish === foe.fetish;
}

function clashCost(state) {
  const heard = state.combat.id === 'wolf' && (state.player.ears === 'wolf' || state.player.capability === 'hear');
  return heard ? 0 : 1;
}

function fleeCost(state) {
  let cost = state.combat.id === 'wolf' ? 3 : 1;
  if (state.player.capability === 'walk') cost = Math.max(1, cost - 1);
  return cost;
}

function burstCost(state) {
  let cost = 2;
  const id = state.combat.id;
  if (state.player.capability === 'grasp' || state.player.capability === 'balance') cost -= 1;
  if (id === 'crawler' && state.player.ears === 'antenna') cost -= 1;
  if (id === 'wolf' && (state.player.tail === 'organic' || state.player.capability === 'tailGrip')) cost -= 1;
  return Math.max(1, cost);
}

function bodyPass(state) {
  const id = state.combat.id;
  return (id === 'vine' && state.player.arm === 'vine') || (id === 'boss' && state.player.hands === 'gel');
}

function choice(id, label) {
  return { id, label };
}

function roomChoices(state) {
  const p = state.player;
  if (state.phase === 'haven') {
    const out = [choice('rest', '躺下把体力睡回来'), choice('talk-keeper', '问看管人前面有什么')];
    if (p.coatings.length) out.push(choice('wash', '彻底洗净身上的痕迹'), choice('keeper-wash', '让看管人把痕迹擦掉'));
    if (isTransformed(p)) out.push(choice('restore', '恢复人形'));
    out.push(choice('go-workshop', '去工坊'));
    return out;
  }
  if (state.phase === 'workshop') {
    const out = [choice('talk-smith', '问店主后面的房间'), choice('go-haven', '回落脚点'), choice('go-mud', '进入暗渠')];
    if (!p.armor && p.money >= PRICES.armor) out.splice(1, 0, choice('buy-armor', '把钱拍在柜台上，拿走护具'));
    if (p.quest === 'none') out.splice(1, 0, choice('accept-quest', '接下搜刮零件的活'));
    if (p.quest === 'holding') out.splice(1, 0, choice('turn-in', '把零件拍在柜台上结账'));
    for (const id of [state.mudId, state.pumpId, 'boss']) {
      if (p.intel.includes(id)) continue;
      const free = intelFree(state, id);
      if (!free && p.money < PRICES.intel) continue;
      const where = id === state.mudId ? '泥潭里那东西' : id === state.pumpId ? '泵站里那东西' : '门后那东西';
      out.splice(1, 0, choice(`intel-${id}`, free ? `靠对上的性癖打听${where}的弱点` : `付钱打听${where}的弱点`));
    }
    return out;
  }
  if (state.phase === 'mud') {
    if (!state.cleared.mud) {
      const out = [];
      if (canSlip(p)) out.push(choice('mud-slip', '顺着滑腻覆层滑过去'));
      if (p.stamina >= 1) out.push(choice('mud-struggle', '从泥里把腿挣出来'));
      out.push(choice('mud-back', '退回工坊'));
      return out;
    }
    return [
      choice('refight-mud', '再去招惹泥潭里的东西'),
      choice('go-pump', '穿过泥潭走向泵站'),
      choice('mud-back', '返回工坊'),
    ];
  }
  if (state.phase === 'pump') {
    const out = [choice('refight-pump', '再去惹泵站里的东西'), choice('go-mud', '退回暗渠')];
    if (!state.cleared.boss) out.splice(1, 0, choice('go-boss', '推开最里面的门'));
    return out;
  }
  return [choice('go-pump', '退回泵站')];
}

function combatChoices(state) {
  const p = state.player;
  const foe = monster(state.combat.id);
  const beat = state.combat.beat;
  if (beat === 0) {
    const out = [];
    if (p.intel.includes(foe.id)) out.push(choice('c-finisher', foe.finisher));
    if (p.fetish === foe.fetish) out.push(choice('c-lean', '顺着这股劲靠过去'));
    if (p.stamina >= clashCost(state)) out.push(choice('c-clash', '硬拼上去'));
    if (p.stamina >= fleeCost(state)) out.push(choice('c-flee', foe.id === 'wolf' ? '现在跑，它会追' : '趁现在撤出'));
    out.push(choice('c-giveup', '放弃抵抗'));
    return out;
  }
  if (beat === 1) {
    const out = [];
    if (bodyPass(state)) out.push(choice('c-pass', foe.id === 'vine' ? '从松开的藤里走出来' : '让黑胶认出这双手'));
    if (p.stamina >= burstCost(state)) out.push(choice('c-burst', '耗尽力气爆发挣开'));
    if (p.armor) out.push(choice('c-armor', '用护具格开这一下'));
    out.push(choice('c-endure', '扛住，让这一下留在身上'), choice('c-giveup', '放弃抵抗'));
    return out;
  }
  const out = [];
  if (state.combat.clean) out.push(choice('c-finish', '了结它'));
  else if (p.stamina >= Math.max(1, 3 - (p.capability === 'balance' ? 1 : 0))) out.push(choice('c-desperation', '拼命还手'));
  out.push(choice('c-giveup', '放弃抵抗'));
  return out;
}

function fallChoices(state) {
  const id = state.fall.id;
  const step = state.fall.step;
  if (id === 'boss' && step === 0) return [choice('fall-next', '把嘴唇合上'), choice('fall-leave', '咬破这层膜')];
  if (id === 'boss' && step === 1) {
    if (state.player.armor) return [choice('fall-drop', '把护具摘下来放到它脚边'), choice('fall-next', '留着护具，让黑胶从缝里挤入')];
    return [choice('fall-next', '把空手按进脚边的积水'), choice('fall-press', '把手按在自己胸口')];
  }
  if (step === 0) return [choice('fall-next', '继续'), choice('fall-leave', '挣开，回落脚点')];
  const nod = {
    slime: '任由手指并成史莱姆手',
    vine: '让这条藤肢留下来',
    crawler: '让触角长住',
    wolf: '把脖子侧得更开',
    boss: '点头',
  }[id];
  const leave = id === 'wolf' ? '推开它的嘴' : '现在挣回落脚点';
  return [choice('fall-nod', nod), choice('fall-leave', leave)];
}

export function present(state) {
  const p = state.player;
  if (state.phase === 'talk') {
    return view(state, rumor(state.talk.topic), [choice('talk-close', '听完，回到眼前')]);
  }
  if (state.phase === 'combat') {
    const foe = monster(state.combat.id);
    const text = state.combat.beat === 0 ? meet(foe.id, p) : state.combat.beat === 1 ? grapple(foe.id, p) : (state.combat.clean ? '你挣开了这一下。它还挡在路中间。' : '这一下已经留在身上。它还没退。');
    return view(state, text, combatChoices(state), foe.name);
  }
  if (state.phase === 'defeat') {
    const foe = monster(state.combat.id);
    const extra = state.adult ? '你可以挣回落脚点，也可以留下。' : '你还能挣回落脚点。';
    return view(state, `${defeatOpen(foe.id, state.combat.leaned)}${extra}`, [
      choice('def-return', '挣回落脚点'),
      ...(state.adult ? [choice('def-stay', '留下')] : []),
    ], foe.name);
  }
  if (state.phase === 'fall') {
    return view(state, fallScript(state.fall.id, state.fall.step, p), fallChoices(state), monster(state.fall.id).name);
  }
  if (state.phase === 'haven') return view(state, `${keeperSee(state.keeper, p)}灯下有床，也有水。`, roomChoices(state), '落脚点');
  if (state.phase === 'workshop') return view(state, `${smithSee(state.smith, p)}柜台上摆着护具和还没人认领的零件。`, roomChoices(state), '工坊');
  if (state.phase === 'mud') {
    const text = state.cleared.mud ? '泥潭还在原处。你已经从这里走出去过一次。' : '暗渠的泥没过脚踝，还在往下吸。过去之后才会撞上守在里面的东西。';
    return view(state, text, roomChoices(state), '暗渠');
  }
  const door = state.cleared.boss ? '最里面的门今天已经空了。' : '泵站的铁架还在滴水。最里面有一扇门。';
  return view(state, door, roomChoices(state), '泵站');
}

function view(state, text, choices, place = '') {
  const shown = state.arrival ? `${state.arrival}\n\n${text}` : text;
  return { place, text: shown, choices, sheet: sheet(state) };
}

export function sheet(state) {
  const p = state.player;
  const part = `耳${earName(p.ears)} · 手${handName(p.hands)} · 臂${p.arm === 'vine' ? '藤肢' : '人类'} · 尾${p.tail === 'organic' ? '长尾' : '无'}`;
  return {
    day: state.day,
    adult: state.adult,
    place: state.phase,
    player: `${p.name} · ${label(p.material)} · ${label(p.capability)} · ${label(p.fetish)}`,
    parts: part,
    coatings: p.coatings.length ? p.coatings.map(id => COAT_LABEL[id]).join('、') : '无',
    stamina: `${p.stamina}/${STAMINA}`,
    money: p.money,
    armor: p.armor,
    intel: p.intel.map(id => monster(id).name),
    quest: p.quest,
    keeper: npcLine(state.keeper),
    smith: npcLine(state.smith),
    mud: state.seen.mud ? monster(state.mudId).name : '还没遇见',
    pump: state.seen.pump ? monster(state.pumpId).name : '还没遇见',
    boss: state.cleared.boss ? '今天已击败' : state.seen.boss ? '黑胶守卫' : '还没遇见',
    cleared: { ...state.cleared },
  };
}

function earName(id) {
  if (id === 'wolf') return '狼耳';
  if (id === 'antenna') return '触角';
  return '人类';
}

function handName(id) {
  if (id === 'slime') return '史莱姆手';
  if (id === 'gel') return '黑胶手';
  return '人类';
}

function npcLine(npc) {
  return `${npc.name} · ${label(npc.trait)} · ${label(npc.relation)} · ${label(npc.fetish)} · ${label(npc.material)}`;
}

function enterHaven(state) {
  state.phase = 'haven';
  state.combat = null;
  state.fall = null;
  state.talk = null;
}

function startFight(state, id) {
  state.phase = 'combat';
  state.combat = { id, beat: 0, clean: true, leaned: false };
  state.fall = null;
  if (id === 'slime' || id === 'vine') state.seen.mud = true;
  if (id === 'crawler' || id === 'wolf') state.seen.pump = true;
  if (id === 'boss') state.seen.boss = true;
}

function winFight(state) {
  const id = state.combat.id;
  const foe = monster(id);
  if (id !== 'boss' && state.player.quest === 'accepted') state.player.quest = 'holding';
  state.player.money += id === 'boss' ? PRICES.boss : PRICES.win;
  if (id === 'slime' || id === 'vine') state.cleared.mud = true;
  if (id === 'crawler' || id === 'wolf') state.cleared.pump = true;
  if (id === 'boss') state.cleared.boss = true;
  state.combat = null;
  if (id === 'boss') {
    state.phase = 'pump';
    state.arrival = `你把${foe.name}留在门后。今天这扇门不会再打开。`;
  } else if (id === 'slime' || id === 'vine') {
    state.phase = 'mud';
    state.arrival = `你赢了。${state.player.quest === 'holding' ? '搜刮到的零件掂在手里。' : ''}路通向泵站，也可以退回工坊。`;
  } else {
    state.phase = 'pump';
    state.arrival = `泵站安静下来。${state.player.quest === 'holding' ? '零件还在你手里。' : ''}最里面的门还关着。`;
  }
}

function loseFight(state) {
  addCoat(state.player, monster(state.combat.id).coat);
  state.phase = 'defeat';
}

export function choose(state, id) {
  const options = present(state).choices;
  if (!options.some(choice => choice.id === id)) throw new Error(`没有这个行动：${id}`);
  const next = structuredClone(state);
  next.arrival = '';
  apply(next, id);
  next.step += 1;
  return next;
}

function apply(state, id) {
  const p = state.player;
  if (id === 'rest') {
    p.stamina = STAMINA;
    state.day += 1;
    state.cleared = { mud: false, pump: false, boss: false };
    if (p.quest === 'done') p.quest = 'none';
    state.arrival = '你把气喘匀。门外的东西回到了明天还会在的位置。';
    return;
  }
  if (id === 'wash' || id === 'keeper-wash') {
    clearCoats(p);
    state.arrival = id === 'wash' ? '你自己把痕迹从皮肤上搓掉。长出来的部位还在。' : `${state.keeper.name}用热水和布把痕迹擦掉，看了你一眼，没再追问。长出来的部位还在。`;
    return;
  }
  if (id === 'restore') {
    restoreHuman(p);
    state.arrival = '你把多出来的部分收回去。耳朵、手、手臂和尾巴回到出发时的样子。';
    return;
  }
  if (id === 'go-workshop') { state.phase = 'workshop'; return; }
  if (id === 'go-haven') { state.phase = 'haven'; return; }
  if (id === 'go-mud') { state.phase = 'mud'; return; }
  if (id === 'go-pump') {
    if (state.cleared.pump) state.phase = 'pump';
    else startFight(state, state.pumpId);
    return;
  }
  if (id === 'go-boss') { startFight(state, 'boss'); return; }
  if (id === 'talk-keeper') { state.phase = 'talk'; state.talk = { topic: 'mud' }; return; }
  if (id === 'talk-smith') { state.phase = 'talk'; state.talk = { topic: 'pump' }; return; }
  if (id === 'talk-close') { state.phase = state.talk.topic === 'mud' ? 'haven' : 'workshop'; state.talk = null; return; }
  if (id === 'buy-armor') { p.money -= PRICES.armor; p.armor = true; state.arrival = '护具扣上身。柜台空出一块。'; return; }
  if (id === 'accept-quest') { p.quest = 'accepted'; state.arrival = '店主要你从高危区带回一件还能用的零件。对方没说里面守着的是什么。'; return; }
  if (id === 'turn-in') { p.quest = 'done'; p.money += PRICES.quest; state.arrival = '零件落在柜台上。钱推回到你这边。'; return; }
  if (id.startsWith('intel-')) {
    const foe = id.slice(6);
    if (!intelFree(state, foe)) p.money -= PRICES.intel;
    p.intel.push(foe);
    state.arrival = `你记住了：${monster(foe).finisher}。`;
    return;
  }
  if (id === 'mud-slip') { startFight(state, state.mudId); return; }
  if (id === 'mud-struggle') { spend(p, 1); startFight(state, state.mudId); return; }
  if (id === 'mud-back') { state.phase = 'workshop'; return; }
  if (id === 'refight-mud') { startFight(state, state.mudId); return; }
  if (id === 'refight-pump') { startFight(state, state.pumpId); return; }
  if (id === 'c-finisher') { state.combat.clean = true; winFight(state); return; }
  if (id === 'c-lean') { state.combat.leaned = true; state.combat.beat = 1; return; }
  if (id === 'c-clash') { spend(p, clashCost(state)); state.combat.beat = 1; return; }
  if (id === 'c-flee') {
    const foe = state.combat.id;
    spend(p, fleeCost(state));
    state.combat = null;
    if (foe === 'boss') state.phase = 'pump';
    else if (foe === 'crawler' || foe === 'wolf') state.phase = state.cleared.pump ? 'pump' : 'mud';
    else state.phase = 'mud';
    state.arrival = foe === 'wolf' ? '你跑出泵站。身后的爪子追到门槛才停。' : '你从交锋里撤出来。';
    return;
  }
  if (id === 'c-giveup') { loseFight(state); return; }
  if (id === 'c-pass' || id === 'c-burst' || id === 'c-armor') {
    if (id === 'c-burst') spend(p, burstCost(state));
    state.combat.clean = true;
    state.combat.beat = 2;
    return;
  }
  if (id === 'c-endure') {
    addCoat(p, monster(state.combat.id).coat);
    state.combat.clean = false;
    state.combat.beat = 2;
    return;
  }
  if (id === 'c-finish' || id === 'c-desperation') {
    if (id === 'c-desperation') spend(p, Math.max(1, 3 - (p.capability === 'balance' ? 1 : 0)));
    winFight(state);
    return;
  }
  if (id === 'def-return') { enterHaven(state); return; }
  if (id === 'def-stay') {
    state.phase = 'fall';
    state.fall = { id: state.combat.id, step: 0 };
    return;
  }
  if (id === 'fall-next' || id === 'fall-press') { state.fall.step += 1; return; }
  if (id === 'fall-drop') { p.armor = false; state.fall.step += 1; return; }
  if (id === 'fall-nod') { applySpecies(p, state.fall.id); enterHaven(state); return; }
  if (id === 'fall-leave') { enterHaven(state); return; }
  throw new Error(`行动没有结算：${id}`);
}

export { isTransformed, intelFree, PRICES, STAMINA };
