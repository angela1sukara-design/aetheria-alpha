import { byId } from './render.ts';

export const pageNames = ['map', 'body', 'people', 'save', 'log', 'quest', 'bag', 'discovery', 'pack', 'world', 'reading'] as const;
export type PageName = typeof pageNames[number];
const labels: Record<PageName, string> = { map: '街区地图', body: '你的身体', people: '人物', save: '存档', log: '行动记录', quest: '任务', bag: '随身物品', discovery: '发现与互动', pack: '内容与偏好', world: '世界', reading: '阅读设置' };

/** Menu pages are normal document sections, with routes and a shared return path. */
export function mountPages(onEnter: (name: PageName) => void) {
  let current: PageName | undefined;
  let detail: string | undefined;
  let gameScroll = 0;
  let changing = false;
  const scrollPositions = new Map<string, number>();
  const route = (name?: PageName, npc?: string) => name ? `#/${name}${npc ? `/${encodeURIComponent(npc)}` : ''}` : '#/play';
  const currentRoute = () => current ? route(current, detail) : location.hash.startsWith('#/play') ? location.hash : '#/play';
  const host = byId('subpage-host');
  for (const name of pageNames) {
    const page = byId<HTMLDialogElement>(`${name}-dialog`);
    page.classList.add('page-panel');
    host.append(page);
    const close = page.querySelector<HTMLButtonElement>('[data-close]')!;
    close.classList.add('page-return');
    if (!close.hasAttribute('aria-label')) close.setAttribute('aria-label', close.textContent ?? `关闭${labels[name]}`);
    close.textContent = '← 返回';
    close.addEventListener('click', () => back());
    page.addEventListener('close', () => {
      if (!changing && current === name && !page.open) navigate();
    });
  }
  function refresh(): void {
    const people = byId('people-content');
    people.dataset.view = current === 'people' && detail ? 'detail' : 'list';
    let matching = false;
    for (const card of people.querySelectorAll<HTMLElement>('[data-npc]')) {
      card.hidden = !!detail && card.dataset.npc !== detail;
      if (detail && !card.hidden) matching = true;
    }
    let missing = people.querySelector<HTMLElement>('.profile-unavailable');
    if (detail && !matching && !missing) {
      missing = document.createElement('p'); missing.className = 'profile-unavailable';
      missing.textContent = '当前进度中没有这个人物的档案。返回人物列表可以查看已认识的人。'; people.append(missing);
    }
    if (missing) missing.hidden = !detail || matching;
    byId('people-title').textContent = detail ? '人物档案' : '你认识的人';
    byId('page-label').textContent = current ? labels[current] : '游戏';
    byId('page-breadcrumb').textContent = detail ? '人物档案' : '游戏菜单';
    for (const name of pageNames) {
      const button = document.getElementById(`${name}-open`); if(!button)continue;
      if (current === name) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    byId('story-resume').setAttribute('aria-current', current ? 'false' : 'page');
    byId('story-resume').textContent = current ? '继续故事' : '当前故事';
  }
  function apply(name?: PageName, npc?: string): void {
    if (!current && name) gameScroll = byId('game-main').scrollTop;
    changing = true;
    for (const item of pageNames) {
      const page = byId<HTMLDialogElement>(`${item}-dialog`);
      if (page.open) page.close();
    }
    current = name; detail = npc;
    byId('play-page').hidden = !!name;
    host.hidden = !name;
    if (name) byId<HTMLDialogElement>(`${name}-dialog`).show();
    refresh();
    changing = false;
    // Dialog close events are queued; handlers check whether the page is still open.
    if (name) onEnter(name);
    byId('game-main').scrollTo({ top: name ? scrollPositions.get(route(name, npc)) ?? 0 : gameScroll, behavior: 'instant' });
    const heading = name ? byId(`${name}-dialog`).querySelector<HTMLElement>('h2') : byId('scene-title');
    heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    document.title = `${name ? labels[name] : '以太都市：深渊重塑'} · 墨卷`;
    window.dispatchEvent(new Event('gameviewchange'));
  }
  function navigate(name?: PageName, npc?: string, parent = '#/play', trail?: string[]): void {
    scrollPositions.set(currentRoute(), byId('game-main').scrollTop);
    const next = route(name, npc);
    const previous: string[] = Array.isArray(history.state?.aetheriaTrail) ? history.state.aetheriaTrail : [];
    const parents = trail ?? (parent === '#/play' ? ['#/play'] : [...previous, parent]);
    if (location.hash !== next) history.pushState({ aetheriaPage: name ?? 'play', aetheriaParent: parent, aetheriaTrail: parents }, '', next);
    apply(name, npc);
  }
  function readRoute(): void {
    const [, page, encoded] = location.hash.split('/');
    // In-document links such as "前往选项" do not change the current page.
    if (location.hash && !location.hash.startsWith('#/')) return;
    const name = pageNames.find(name => name === page);
    let npc: string | undefined;
    if (name === 'people' && encoded) { try { npc = decodeURIComponent(encoded); } catch { /* Ignore malformed route. */ } }
    apply(name, npc);
  }
  function back(): void {
    const trail: string[] = Array.isArray(history.state?.aetheriaTrail) ? [...history.state.aetheriaTrail] : [];
    const parent = trail.pop() ?? (typeof history.state?.aetheriaParent === 'string' ? history.state.aetheriaParent : detail ? '#/people' : '#/play');
    const [, page, encoded] = parent.split('/');
    const name = pageNames.find(name => name === page);
    let npc: string | undefined;
    if (name === 'people' && encoded) { try { npc = decodeURIComponent(encoded); } catch { /* Fall back to the list. */ } }
    if(parent.startsWith('#/play/')){history.pushState({aetheriaPage:'play',aetheriaTrail:trail},'',parent);apply();return;}
    navigate(name, npc, trail.at(-1) ?? '#/play', trail);
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && current && !document.querySelector('dialog:modal')) { event.preventDefault(); back(); } });
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-npc-open]');
    if (button) navigate('people', button.dataset.npcOpen, currentRoute());
  });
  window.addEventListener('popstate', readRoute);
  window.addEventListener('hashchange', readRoute);
  byId('page-home').addEventListener('click', () => navigate());
  byId('story-resume').addEventListener('click', () => navigate());
  byId('story-home').addEventListener('click', event => { event.preventDefault(); navigate(); });
  // Existing file:// launchers get the same routes as the served build.
  readRoute();
  return { open: (name: string, fromPage = false) => { const page = pageNames.find(item => item === name); if (page) navigate(page, undefined, fromPage ? currentRoute() : '#/play'); }, game: () => navigate(), refresh, current: () => current };
}
