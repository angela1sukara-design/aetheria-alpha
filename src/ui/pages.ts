import { byId } from './render.ts';

export const pageNames = ['map', 'body', 'people', 'save', 'log', 'quest', 'bag', 'discovery', 'pack', 'world'] as const;
export type PageName = typeof pageNames[number];
const labels: Record<PageName, string> = { map: '街区地图', body: '你的身体', people: '人物', save: '存档', log: '行动记录', quest: '任务', bag: '随身物品', discovery: '发现与互动', pack: '内容与偏好', world: '世界' };

/** Menu pages are normal document sections, with routes and a shared return path. */
export function mountPages(onEnter: (name: PageName) => void) {
  let current: PageName | undefined;
  let detail: string | undefined;
  let gameScroll = 0;
  let changing = false;
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
    for (const card of people.querySelectorAll<HTMLElement>('[data-npc]')) card.hidden = !!detail && card.dataset.npc !== detail;
    byId('page-label').textContent = current ? labels[current] : '游戏';
    byId('page-breadcrumb').textContent = detail ? '人物档案' : '游戏菜单';
    for (const name of pageNames) {
      const button = byId(`${name}-open`);
      if (current === name) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
  }
  function apply(name?: PageName, npc?: string): void {
    if (!current && name) gameScroll = window.scrollY;
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
    window.scrollTo({ top: name ? 0 : gameScroll, behavior: 'instant' });
    const heading = name ? byId(`${name}-dialog`).querySelector<HTMLElement>('h2') : byId('scene-title');
    heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    document.title = `${name ? labels[name] : '以太都市：深渊重塑'} · 世界生成器 v0.2.1`;
  }
  function navigate(name?: PageName, npc?: string): void {
    const route = name ? `#/${name}${npc ? `/${encodeURIComponent(npc)}` : ''}` : '#/play';
    if (location.hash !== route) history.pushState({ aetheriaPage: name ?? 'play' }, '', route);
    apply(name, npc);
  }
  function readRoute(): void {
    const [, page, encoded] = location.hash.split('/');
    const name = pageNames.find(name => name === page);
    let npc: string | undefined;
    if (name === 'people' && encoded) { try { npc = decodeURIComponent(encoded); } catch { /* Ignore malformed route. */ } }
    apply(name, npc);
  }
  function back(): void { navigate(detail && current === 'people' ? 'people' : undefined); }
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && current) { event.preventDefault(); back(); } });
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-npc-open]');
    if (button) navigate('people', button.dataset.npcOpen);
  });
  window.addEventListener('popstate', readRoute);
  byId('page-home').addEventListener('click', () => navigate());
  // Existing file:// launchers get the same routes as the served build.
  readRoute();
  return { open: (name: string) => { const page = pageNames.find(item => item === name); if (page) navigate(page); }, game: () => navigate(), refresh, current: () => current };
}
