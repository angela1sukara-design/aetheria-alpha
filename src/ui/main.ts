import { loadPacks } from '../content/loader.ts';
import { ActionExecutor } from '../engine/executor.ts';
import { createGameState } from '../engine/state.ts';
import { formatClock } from '../engine/clock.ts';
import { SaveCodec, MAX_SAVE_BYTES } from '../persistence/codec.ts';
import { IndexedDBSaveStore, SaveRepository } from '../persistence/store.ts';
import { asId, byId, feedback, newSeed, renderGame } from './render.ts';
import type { ActionResult } from '../core/types.ts';
import { PackError } from '../core/errors.ts';
async function fetchJSON(url: URL): Promise<unknown> {
  const response = await fetch(url); if (!response.ok) throw new Error(`无法读取内容包（${response.status}）。`); return response.json();
}
async function boot(): Promise<void> {
  const indexUrl = new URL('../../content/index.json', import.meta.url);
  const index = await fetchJSON(indexUrl) as { packs: string[] };
  if (!Array.isArray(index.packs) || index.packs.some(x => typeof x !== 'string')) throw new Error('内容包目录格式错误。');
  const registry = await loadPacks(await Promise.all(index.packs.map(x => fetchJSON(new URL(x, indexUrl)))));
  const codec = new SaveCodec(registry); const saves = new SaveRepository(codec, new IndexedDBSaveStore());
  let engine = new ActionExecutor(registry, createGameState(registry, newSeed()));
  let result: ActionResult | undefined; let busy = false;
  function redraw(): void { renderGame(engine.view(), registry, result); }
  async function refreshSlot(): Promise<void> {
    const saved = await saves.load();
    byId<HTMLButtonElement>('save-read').disabled = saved.status !== 'ready';
    byId('save-info').textContent = saved.status === 'ready' ? `${registry.location(saved.state.world.locationId).name} · ${formatClock(saved.state.clock.totalMinutes)} · ${saved.state.meta.revision} 次行动` : saved.status === 'empty' ? '尚无存档' : `已隔离：${saved.reason}`;
  }
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled || busy) return;
    busy = true; button.disabled = true;
    const fromPeople = !!button.closest('#people-dialog');
    const revision = engine.snapshot().meta.revision;
    // 先锁按钮再提交；同一轮快速点击携带旧请求不会悄悄执行下一项行动。
    const actionResult = engine.performAction({ actionId: asId(button.dataset.action!) }, revision, crypto.randomUUID());
    if (actionResult.ok) {
      result = actionResult; redraw(); feedback('');
      if (byId<HTMLDialogElement>('map-dialog').open) byId<HTMLDialogElement>('map-dialog').close();
      if (fromPeople && byId<HTMLDialogElement>('people-dialog').open) byId<HTMLDialogElement>('people-dialog').close();
    } else { feedback(actionResult.message, true); redraw(); }
    setTimeout(() => { busy = false; }, 250);
  });
  const dialogNames = ['map', 'body', 'people', 'save', 'log'];
  async function openDialog(name: string): Promise<void> {
    if (!dialogNames.includes(name)) return;
    for (const other of dialogNames) if (other !== name && byId<HTMLDialogElement>(`${other}-dialog`).open) byId<HTMLDialogElement>(`${other}-dialog`).close();
    const dialog = byId<HTMLDialogElement>(`${name}-dialog`); if (!dialog.open) dialog.showModal();
    if (name === 'save') { try { await refreshSlot(); } catch (error) { byId('save-message').textContent = `本地存档不可用：${error instanceof Error ? error.message : error}。你仍可导出 JSON。`; } }
  }
  for (const name of dialogNames) byId(`${name}-open`).addEventListener('click', () => { void openDialog(name); });
  document.addEventListener('click', event => {
    const opener = (event.target as Element).closest<HTMLButtonElement>('button[data-dialog-open]');
    if (opener && !opener.disabled) void openDialog(opener.dataset.dialogOpen!);
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]')) button.addEventListener('click', () => byId<HTMLDialogElement>(button.dataset.close!).close());
  async function storageAction(run: () => Promise<void>): Promise<void> {
    if (busy) return; busy = true;
    const buttons = [...byId('save-dialog').querySelectorAll<HTMLButtonElement>('button:not([data-close])')]; buttons.forEach(x => { x.disabled = true; });
    try { await run(); } catch (error) { byId('save-message').textContent = `操作失败：${error instanceof Error ? error.message : error}`; }
    finally { busy = false; buttons.forEach(x => { x.disabled = false; }); try { await refreshSlot(); } catch { byId<HTMLButtonElement>('save-read').disabled = true; } }
  }
  byId('save-write').addEventListener('click', () => storageAction(async () => { await saves.save(engine.snapshot()); byId('save-message').textContent = '保存完成。'; }));
  byId('save-read').addEventListener('click', () => storageAction(async () => {
    const loaded = await saves.load();
    if (loaded.status !== 'ready') { byId('save-message').textContent = loaded.status === 'empty' ? '没有可读取的存档。' : `存档已隔离：${loaded.reason}`; return; }
    engine = new ActionExecutor(registry, loaded.state); result = loaded.state.ledger.transactions.at(-1)?.result; redraw(); byId('save-message').textContent = loaded.migration ?? '已恢复保存时的进度。';
  }));
  byId('save-export').addEventListener('click', () => storageAction(async () => {
    const text = await codec.encode(engine.snapshot()); const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'aetheria-alpha-0.1-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('save-message').textContent = '已导出当前进度。';
  }));
  byId<HTMLInputElement>('save-import').addEventListener('change', event => storageAction(async () => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
    if (file.size > MAX_SAVE_BYTES) throw new Error('存档文件超过 4 MiB。');
    const decoded = await codec.decode(await file.text());
    if (decoded.status === 'quarantined') { byId('save-message').textContent = `未导入，原进度保留：${decoded.reason}`; return; }
    // 仅载入到游戏，玩家点击“保存”后才覆盖手动存档。
    engine = new ActionExecutor(registry, decoded.state); result = decoded.state.ledger.transactions.at(-1)?.result; redraw(); byId('save-message').textContent = `已导入到当前游戏。${decoded.migration ?? '要写入手动存档，请点击保存。'}`;
  }));
  redraw();
  try {
    const loaded = await saves.load();
    if (loaded.status === 'ready') { engine = new ActionExecutor(registry, loaded.state); result = loaded.state.ledger.transactions.at(-1)?.result; redraw(); feedback(loaded.migration ?? '已恢复手动存档。之后的行动仍需手动保存。'); }
    else if (loaded.status === 'quarantined') feedback(`旧存档已隔离并保留：${loaded.reason}`, true);
  } catch { feedback('本地存档暂不可用，进度可以通过 JSON 导出。', true); }
}
boot().catch(error => {
  byId('scene-title').textContent = '进入城市失败';
  byId('scene-text').textContent = error instanceof PackError ? error.issues.map(x => `${x.code} ${x.pointer}：${x.reason}`).join('\n') : error instanceof Error ? error.message : '加载失败。';
  byId('scene-text').classList.add('loading-error');
});
