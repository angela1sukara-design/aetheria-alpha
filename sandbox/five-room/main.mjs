import { createGame, present, choose } from './game.mjs';

const setup = document.querySelector('#setup');
const scene = document.querySelector('#scene');
const sheetEl = document.querySelector('#sheet');
const place = document.querySelector('#place');
const text = document.querySelector('#text');
const choices = document.querySelector('#choices');
const facts = document.querySelector('#facts');
let state = null;

const PLACES = { haven: '落脚点', workshop: '工坊', mud: '暗渠', pump: '泵站', talk: '交谈', combat: '交锋', defeat: '战败', fall: '留下' };

document.querySelector('#begin').addEventListener('click', () => {
  const raw = document.querySelector('#seed').value.trim();
  const seed = raw === '' ? (Date.now() % 100000) : Number(raw);
  state = createGame(Number.isFinite(seed) ? seed : 1, { adult: document.querySelector('#adult').checked });
  setup.hidden = true;
  scene.hidden = false;
  sheetEl.hidden = false;
  render();
});

function render() {
  const view = present(state);
  place.textContent = view.place || PLACES[state.phase] || '五间房';
  text.textContent = view.text;
  choices.replaceChildren(...view.choices.map(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.dataset.choice = option.id;
    button.addEventListener('click', () => { state = choose(state, option.id); render(); });
    return button;
  }));
  const rows = [
    ['玩家', view.sheet.player],
    ['身体', view.sheet.parts],
    ['痕迹', view.sheet.coatings],
    ['状态', `第${view.sheet.day}天 · 体力 ${view.sheet.stamina} · 钱 ${view.sheet.money} · 护具 ${view.sheet.armor ? '已穿' : '无'}`],
    ['已知弱点', view.sheet.intel.length ? view.sheet.intel.join('、') : '无'],
    ['委托', { none: '无', accepted: '已接', holding: '零件在手', done: '已交付' }[view.sheet.quest]],
    ['看管人', view.sheet.keeper],
    ['店主', view.sheet.smith],
    ['暗渠', `${view.sheet.mud}${view.sheet.cleared.mud ? ' · 今天已通过' : ''}`],
    ['泵站', `${view.sheet.pump}${view.sheet.cleared.pump ? ' · 今天已通过' : ''}`],
    ['首领', view.sheet.boss],
  ];
  facts.replaceChildren(...rows.map(([key, value]) => {
    const wrap = document.createElement('div');
    wrap.className = 'fact';
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.append(dt, dd);
    return wrap;
  }));
}
