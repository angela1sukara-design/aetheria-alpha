import type { Registry } from '../content/registry.ts';
import { loadPacks } from '../content/loader.ts';
import { WorldGenerator } from '../world/generator.ts';
import { parseReference, parseRules } from '../world/schema.ts';
import type { GeneratedWorld } from '../world/types.ts';
import { byId } from './render.ts';

/** 参考库导入只影响下一次创建；不能写正在游玩的世界或未保存进度。 */
export function mountWorldControls(options: { source: () => Registry; defaults: { rules: unknown; reference: unknown | unknown[]; content?: unknown[] }; lockDefaults?: boolean; isBusy: () => boolean; setBusy: (value: boolean) => void; replace: (world?: GeneratedWorld) => void }): void {
  const defaultReferences = (): unknown[] => Array.isArray(options.defaults.reference) ? [...options.defaults.reference] : [options.defaults.reference];
  let rules = options.defaults.rules, references: unknown[] = defaultReferences(), extraContent: unknown[] = [];
  const message = (text: string) => { byId('world-message').textContent = text; };
  const persist = () => { if (options.lockDefaults) return; try { localStorage.setItem('aetheria-generation-library', JSON.stringify({ rules, references, extraContent })); } catch { message('参考库已在当前会话启用；本地持久化暂不可用。'); } };
  if (!options.lockDefaults) {
    try { const saved = JSON.parse(localStorage.getItem('aetheria-generation-library') ?? 'null'); if (saved && Array.isArray(saved.references) && Array.isArray(saved.extraContent)) { rules = parseRules(saved.rules); references = saved.references; extraContent = saved.extraContent; } } catch { message('本地参考库无效，已使用默认示例。'); }
  }
  const defaultContent = () => (options.defaults.content ?? []).filter(p => !options.source().packs.some(s => s.id === (p as { manifest: { id: string } }).manifest.id));
  const library = async () => loadPacks([...options.source().contentPacks, ...defaultContent(), ...extraContent]);
  let generating = false;
  async function start(seed: number): Promise<void> {
    if (generating || options.isBusy()) return;
    for (const id of ['world-seed', 'world-size', 'world-population']) {
      const input = byId<HTMLInputElement>(id);
      if (!input.value.trim() || !input.checkValidity()) { message('请填写有效的世界种子、地点数量和居民数量。'); input.focus(); input.reportValidity(); return; }
    }
    generating = true; options.setBusy(true); byId<HTMLButtonElement>('world-generate').disabled = true;
    byId('world-generate').textContent = '正在生成…';
    try {
      message('正在生成街区并校验路线与人物…');
      const world = await new WorldGenerator().generate({ seed, registry: await library(), rules, references, parameters: { locationCount: Number(byId<HTMLInputElement>('world-size').value), npcCount: Number(byId<HTMLInputElement>('world-population').value) } });
      options.replace(world); byId<HTMLDialogElement>('world-dialog').close(); message('街区已生成。请手动保存你想保留的进度。');
    } catch (error) { message(`生成失败，当前进度保留：${error instanceof Error ? error.message : error}`); }
    finally { generating = false; options.setBusy(false); byId<HTMLButtonElement>('world-generate').disabled = false; byId('world-generate').textContent = '生成并进入街区'; }
  }
  byId('world-generate').addEventListener('click', () => { void start(Number(byId<HTMLInputElement>('world-seed').value)); });
  byId('world-random').addEventListener('click', () => { byId<HTMLInputElement>('world-seed').value = String(crypto.getRandomValues(new Uint32Array(1))[0]); });
  byId('world-fixed').addEventListener('click', () => { if (generating || options.isBusy()) return; options.replace(); byId<HTMLDialogElement>('world-dialog').close(); });
  for (const type of ['reference', 'generation-rules', 'generation-content']) byId<HTMLInputElement>(`world-${type}-import`).addEventListener('change', async event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''; if (!file || generating || options.isBusy()) return;
    generating = true; options.setBusy(true);
    try {
      if (file.size > 1024 * 1024) throw Error('参考文件超过 1 MiB。');
      const raw = JSON.parse(await file.text());
      if (type === 'reference') { const pack = parseReference(raw, await library()); references = references.filter(r => (r as { id: string }).id !== pack.id); references.push(pack); }
      else if (type === 'generation-rules') { rules = parseRules(raw); byId<HTMLInputElement>('world-size').value = String((rules as { locationCount: number }).locationCount); byId<HTMLInputElement>('world-population').value = String((rules as { npcCount: number }).npcCount); }
      else { if (extraContent.length >= 20) throw Error('首版最多安装20个生成用内容包。'); await loadPacks([...options.source().contentPacks, ...defaultContent(), ...extraContent, raw]); extraContent.push(raw); }
      persist(); message('校验通过，参考库已更新。下一次生成时使用，当前世界继续保持。');
    } catch (error) { message(`未导入：${error instanceof Error ? error.message : error}`); }
    finally { generating = false; options.setBusy(false); }
  });
  byId('world-library-reset').addEventListener('click', () => { if (generating) return; rules = options.defaults.rules; references = defaultReferences(); extraContent = []; persist(); message('已恢复默认生成库，当前世界保持。'); });
}
