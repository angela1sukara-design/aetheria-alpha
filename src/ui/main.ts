import { loadPacks } from '../content/loader.ts';
import { ActionExecutor } from '../engine/executor.ts';
import { createGameState } from '../engine/state.ts';
import { formatClock } from '../engine/clock.ts';
import { SaveCodec, MAX_SAVE_BYTES } from '../persistence/codec.ts';
import { IndexedDBSaveStore, SaveRepository } from '../persistence/store.ts';
import { asId, byId, feedback, newSeed, renderGame, setTagDebugRegistry } from './render.ts';
import type { ActionResult } from '../core/types.ts';
import { PackError } from '../core/errors.ts';
import { TextLibrary } from '../content/text-variants.ts';
import { parsePack } from '../content/schema.ts';
import { isAppendOnlyEventPack } from '../content/append-only.ts';
import { renderDistrict } from './district-panel.ts';
import type { JournalEntry } from './district-panel.ts';
import { writingContext } from '../engine/writing-context.ts';
import { mountWorldControls } from './world-panel.ts';
import { mountPages } from './pages.ts';
import { mountFolio, renderFolio } from './folio.ts';
import { loadPersistedExtensions } from '../content/extensions.ts';
async function fetchJSON(url: URL): Promise<unknown> {
  const response = await fetch(url); if (!response.ok) throw new Error(`无法读取内容包（${response.status}）。`); return response.json();
}
async function boot(): Promise<void> {
  const playtest = new URLSearchParams(location.search).get('playtest');
  const indexFile = playtest === 'tagcoexist' ? '../../content/index.playtest-tagcoexist.json' : '../../content/index.json';
  const indexUrl = new URL(indexFile, import.meta.url);
  const embedded = (globalThis as unknown as {aetheriaEmbedded?:{packs:unknown[];journal:JournalEntry[];generation:{rules:unknown;reference:unknown | unknown[];content?:unknown[];questContent?:unknown;worldProfiles?:unknown}}}).aetheriaEmbedded;
  const index = embedded ? {packs:[] as string[]} : await fetchJSON(indexUrl) as { packs: string[]; generation?: { rules?: string; reference?: string | string[]; content?: string[] } };
  if (!Array.isArray(index.packs) || index.packs.some(x => typeof x !== 'string')) throw new Error('内容包目录格式错误。');
  const basePacks=embedded?.packs??await Promise.all(index.packs.map(x => fetchJSON(new URL(x, indexUrl))));
  let rulePacks:unknown[]=[];let storedTexts:unknown[]=[];
  try {rulePacks=JSON.parse(localStorage.getItem('aetheria-alpha02-rules')??'[]');storedTexts=JSON.parse(localStorage.getItem('aetheria-alpha02-texts')??'[]');if(!Array.isArray(rulePacks)||!Array.isArray(storedTexts))throw Error();}catch{rulePacks=[];storedTexts=[];}
  const extensionLoad = await loadPersistedExtensions(basePacks, rulePacks);
  rulePacks = extensionLoad.accepted;
  let quarantinedRules = extensionLoad.quarantined;
  let registry = extensionLoad.registry;
  let fixedRegistry = registry;
  let textEnabled: Record<string, boolean> = {};
  try { const raw = JSON.parse(localStorage.getItem('aetheria-alpha02-text-enabled') ?? '{}'); if (raw && typeof raw === 'object' && !Array.isArray(raw)) textEnabled = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>; } catch { /* Safe defaults for an older preference format. */ }
  const texts=new TextLibrary();for(const p of storedTexts){try{const id=texts.install(p,registry);texts.setEnabled(id,textEnabled[id]!==false);}catch{ /* invalid prose stays disabled */ }}
  const recovery = document.createElement('section'); recovery.id = 'extension-recovery'; byId('pack-dialog').append(recovery);
  function showQuarantinedRules(): void {
    recovery.replaceChildren();
    for (const [i, item] of quarantinedRules.entries()) {
      const paragraph = document.createElement('p'); paragraph.textContent = `隔离的规则扩展：${item.reason}。原文件与存档均保留。`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除这份隔离扩展';
      remove.addEventListener('click', () => { quarantinedRules.splice(i, 1); persistRules(); showQuarantinedRules(); });
      recovery.append(paragraph, remove);
    }
  }
  function persistRules(): void { try { localStorage.setItem('aetheria-alpha02-rules', JSON.stringify([...rulePacks, ...quarantinedRules.map(x => x.raw)])); } catch { byId('pack-message').textContent = '扩展在当前会话可用；浏览器未能保存扩展设置，请保留原文件。'; } }
  showQuarantinedRules();
  const journal=embedded?.journal??await fetchJSON(new URL('../../content/journal.json',import.meta.url)) as JournalEntry[];
  let codec = new SaveCodec(registry); const store=new IndexedDBSaveStore();let saves = new SaveRepository(codec,store);
  const launch = globalThis as unknown as { aetheriaInitialSave?: string; aetheriaSaveSlot?: string };
  const baseSaveSlot = launch.aetheriaSaveSlot ?? 'manual';
  const saveSlots = [baseSaveSlot, `${baseSaveSlot}:folio-2`, `${baseSaveSlot}:folio-3`];
  let selectedSlot = 0;
  try { const remembered = Number(localStorage.getItem(`aetheria-folio-slot:${baseSaveSlot}`) ?? 0); if (Number.isInteger(remembered) && remembered >= 0 && remembered < 3) selectedSlot = remembered; } catch { /* Keep the original manual slot available. */ }
  let saveSlot = saveSlots[selectedSlot];
  let engine = new ActionExecutor(registry, createGameState(registry, newSeed()),texts);
  let result: ActionResult | undefined; let busy = false; let browsing = false;
  let savedSnapshot: string | undefined;
  function updateSaveStatus(): void {
    const saved = savedSnapshot === JSON.stringify(engine.snapshot());
    const status = byId('save-state'); status.dataset.state = saved ? 'saved' : savedSnapshot ? 'dirty' : 'new';
    status.textContent = saved ? '进度已保存' : savedSnapshot ? '有未保存进度' : '尚未保存';
  }
  function syncDefeatPlayQuick(view = engine.view()): void {
    const defeatOption = view.actions.find(x => x.definition.id === 'progression:action.defeat.play');
    for (const id of ['defeat-play-quick', 'defeat-play-world'] as const) {
      const defeat = document.getElementById(id) as HTMLButtonElement | null;
      if (!defeat) continue;
      defeat.disabled = busy || !defeatOption?.available;
      defeat.title = defeatOption?.available ? (defeatOption.definition.hint ?? '不必先战斗；直接试跑战败后 8 玩法') : (defeatOption?.reason || '当前场景不可用（战斗/故事进行中时请先结束）');
    }
  }
  function redraw(): void { const view=engine.view(); setTagDebugRegistry(registry); renderGame(view, registry, result, browsing);renderDistrict(view,registry,texts,journal); renderFolio(view,registry,result,browsing); pages.refresh(); updateSaveStatus(); byId('world-current').textContent=view.state.worldInstance?`${view.state.worldInstance.definition.name} · 种子 ${view.state.worldInstance.generation.seed} · ${view.state.worldInstance.definition.locations.length} 个地点`:'固定以太都市测试世界'; syncDefeatPlayQuick(view); }
  function adopt(loaded: { state: import('../core/types.ts').GameState; registry?: import('../content/registry.ts').Registry }): void {
    registry = loaded.registry ?? fixedRegistry; codec = new SaveCodec(registry, fixedRegistry); saves = new SaveRepository(codec, store);
    engine = new ActionExecutor(registry, loaded.state, texts);
    browsing = false;
  }
  const generation = embedded?.generation ?? await (async () => {
    const gen = index.generation;
    if (gen?.rules && gen.reference) {
      const refs = Array.isArray(gen.reference) ? gen.reference : [gen.reference];
      const contents = gen.content ?? ['./generation/neighborhood-content.json', './generation/lexicon-content.json'];
      return {
        rules: await fetchJSON(new URL(gen.rules, indexUrl)),
        reference: await Promise.all(refs.map(name => fetchJSON(new URL(name, indexUrl)))),
        content: await Promise.all(contents.map(name => fetchJSON(new URL(name, indexUrl)))),
      };
    }
    const allWorldProfiles = await fetchJSON(new URL('../../content/generation/world-profiles.json', import.meta.url)) as { format: string; schemaVersion: number; profiles: { tag: string }[] };
    // 小范围试玩：随机/题材列表只开放中世纪异世界（worlds:setting.fantasy）
    const worldProfiles = { ...allWorldProfiles, profiles: allWorldProfiles.profiles.filter(p => p.tag === 'worlds:setting.fantasy') };
    return {
      worldProfiles,
      rules: await fetchJSON(new URL('../../content/generation/rules.json', import.meta.url)),
      reference: [
        await fetchJSON(new URL('../../content/generation/lexicon-reference.json', import.meta.url)),
        await fetchJSON(new URL('../../content/generation/fantasy-reference.json', import.meta.url)),
      ],
      content: await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content'].map(name => fetchJSON(new URL(`../../content/generation/${name}.json`, import.meta.url)))),
    };
  })();
  mountWorldControls({ source: () => fixedRegistry, defaults: generation, lockDefaults: playtest === 'tagcoexist', isBusy: () => busy, setBusy: value => { busy = value; syncDefeatPlayQuick(); }, replace: generated => {
    if (generated) adopt({ state: generated.state, registry: generated.registry });
    else adopt({ state: createGameState(fixedRegistry, newSeed()), registry: fixedRegistry });
    result = undefined; redraw(); pages.game(); feedback('已进入新世界。手动存档槽仍保留上次保存的进度；保存后才会覆盖。');
  }, ensurePlayerCreated: () => {
    // 一键异世界：无公寓签到点时自动 player.create（默认名+年龄≥18），打通 adultOptional 门
    const snap = engine.snapshot();
    if (!snap.district || snap.district.profile.created) { redraw(); return; }
    const created = engine.performAction({ actionId: asId('district:action.create'), params: { name: '旅人', ageYears: 25 } }, snap.meta.revision, crypto.randomUUID());
    if (created.ok) { result = created; browsing = false; feedback('已用默认身份进入异世界（旅人 · 25 岁）。可在内容偏好开启成人可选文本。'); }
    else feedback(created.message, true);
    redraw();
  } });
  async function refreshSlot(): Promise<void> {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-slot]')) button.setAttribute('aria-pressed', String(Number(button.dataset.saveSlot) === selectedSlot));
    byId('save-quick').textContent = `保存进度 · ${['卷一','卷二','卷三'][selectedSlot]}`;
    const slot = saveSlot;
    const saved = await saves.load(slot);
    if (slot !== saveSlot) return;
    byId<HTMLButtonElement>('save-read').disabled = saved.status !== 'ready';
    byId('save-info').textContent = saved.status === 'ready' ? `${(saved.registry??registry).location(saved.state.world.locationId).name} · ${formatClock(saved.state.clock.totalMinutes)} · ${saved.state.meta.revision} 次行动` : saved.status === 'empty' ? '尚无存档' : `已隔离：${saved.reason}`;
  }
  const pages = mountPages(name => {
    byId('page-action-feedback').textContent = '';
    if (name === 'save') void refreshSlot().catch(error => { byId('save-message').textContent = `本地存档不可用：${error instanceof Error ? error.message : error}。你仍可导出 JSON。`; });
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-save-slot]')) button.addEventListener('click', () => {
    if (busy) return;
    selectedSlot = Number(button.dataset.saveSlot); saveSlot = saveSlots[selectedSlot];
    byId<HTMLButtonElement>('save-read').disabled = true;
    byId('save-message').textContent = '已选中存档槽。保存或读取后，才会写入或恢复进度。';
    void refreshSlot().catch(error => { byId('save-message').textContent = error instanceof Error ? error.message : '无法读取存档'; });
  });
  function rememberSlot(): void { try { localStorage.setItem(`aetheria-folio-slot:${baseSaveSlot}`,String(selectedSlot)); } catch { /* The save itself remains in IndexedDB. */ } }
  mountFolio({redraw,openPage:(name,from)=>pages.open(name,from)});
  byId('location-review').addEventListener('click', () => {
    const details = byId('location-details'); details.hidden = !details.hidden;
    byId('location-review').setAttribute('aria-expanded', String(!details.hidden));
  });
  byId('scene-return').addEventListener('click', () => { browsing = true; redraw(); focusScene(); });
  function focusScene(): void {
    const heading = byId('scene-title'); heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
    byId('location-details').hidden = true; byId('location-review').setAttribute('aria-expanded', 'false');
    byId('location-name').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled || busy) return;
    busy = true; button.disabled = true;
    const keepBodyPage = !!button.closest('#body-dialog,#bag-dialog');
    const revision = engine.snapshot().meta.revision;
    // 先锁按钮再提交；同一轮快速点击携带旧请求不会悄悄执行下一项行动。
    const params=button.dataset.action==='district:action.create'?{name:byId<HTMLInputElement>('character-name').value,ageYears:Number(byId<HTMLInputElement>('character-age').value)}:undefined;
    const actionResult = engine.performAction({ actionId: asId(button.dataset.action!),...(params?{params}:{}) }, revision, crypto.randomUUID());
    if (actionResult.ok) {
      result = actionResult; browsing = false; redraw(); feedback('');
      if (keepBodyPage) {
        byId('page-action-feedback').textContent = actionResult.text;
        byId('page-action-feedback').classList.remove('error');
        byId('body-content').querySelector<HTMLButtonElement>(`[data-action="${CSS.escape(button.dataset.action!)}"]`)?.focus({preventScroll:true});
      }
      else { pages.game(); focusScene(); }
    } else { feedback(actionResult.message, true); byId('page-action-feedback').textContent = actionResult.message; byId('page-action-feedback').classList.add('error'); redraw(); }
    setTimeout(() => { busy = false; syncDefeatPlayQuick(); }, 250);
  });
  const dialogNames = ['map', 'body', 'people', 'save', 'log', 'quest', 'bag', 'discovery', 'pack', 'world', 'reading'];
  async function openDialog(name: string): Promise<void> {
    pages.open(name);
  }
  for (const name of dialogNames) byId(`${name}-open`).addEventListener('click', () => { void openDialog(name); });
  document.addEventListener('click', event => {
    const opener = (event.target as Element).closest<HTMLButtonElement>('button[data-dialog-open]');
    if (opener && !opener.disabled) pages.open(opener.dataset.dialogOpen!, true);
  });
  async function storageAction(run: () => Promise<void>): Promise<void> {
    if (busy) return; busy = true;
    byId<HTMLButtonElement>('save-quick').disabled = true;
    const buttons = [...byId('save-dialog').querySelectorAll<HTMLButtonElement>('button:not([data-close])')]; buttons.forEach(x => { x.disabled = true; });
    try { await run(); } catch (error) { const message = `操作失败：${error instanceof Error ? error.message : error}`; byId('save-message').textContent = message; feedback(message, true); }
    finally { busy = false; byId<HTMLButtonElement>('save-quick').disabled = false; buttons.forEach(x => { x.disabled = false; }); updateSaveStatus(); try { await refreshSlot(); } catch { byId<HTMLButtonElement>('save-read').disabled = true; } }
  }
  const saveCurrent = () => storageAction(async () => {
    const snapshot = engine.snapshot(); await saves.save(snapshot, saveSlot); savedSnapshot = JSON.stringify(snapshot); rememberSlot();
    byId('save-message').textContent = '保存完成。'; feedback('保存完成。');
  });
  byId('save-write').addEventListener('click', saveCurrent);
  byId('save-quick').addEventListener('click', saveCurrent);
  byId('save-read').addEventListener('click', () => storageAction(async () => {
    const loaded = await saves.load(saveSlot);
    if (loaded.status !== 'ready') { byId('save-message').textContent = loaded.status === 'empty' ? '没有可读取的存档。' : `存档已隔离：${loaded.reason}`; return; }
    adopt(loaded); savedSnapshot = JSON.stringify(loaded.state); rememberSlot(); result = loaded.state.ledger.transactions.at(-1)?.result; redraw(); byId('save-message').textContent = loaded.migration ?? '已恢复保存时的进度。';
  }));
  byId('save-export').addEventListener('click', () => storageAction(async () => {
    const text = await codec.encode(engine.snapshot()); const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'aetheria-alpha-0.2-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('save-message').textContent = '已导出当前进度。';
  }));
  byId<HTMLInputElement>('save-import').addEventListener('change', event => storageAction(async () => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
    if (file.size > MAX_SAVE_BYTES) throw new Error('存档文件超过 4 MiB。');
    const decoded = await codec.decode(await file.text());
    if (decoded.status === 'quarantined') { byId('save-message').textContent = `未导入，原进度保留：${decoded.reason}`; return; }
    // 仅载入到游戏，玩家点击“保存”后才覆盖手动存档。
    adopt(decoded); result = decoded.state.ledger.transactions.at(-1)?.result; redraw(); byId('save-message').textContent = `已导入到当前游戏。${decoded.migration ?? '要写入手动存档，请点击保存。'}`;
  }));
  function persistTexts():void{for(const pack of texts.list())textEnabled[pack.id]=pack.enabled;try{localStorage.setItem('aetheria-alpha02-texts',JSON.stringify(storedTexts));localStorage.setItem('aetheria-alpha02-text-enabled',JSON.stringify(textEnabled));}catch{byId('pack-message').textContent='文本已在当前会话启用；浏览器不允许持久化扩展文件。';}}
  byId('discovery-search').addEventListener('input',redraw);
  byId('adult-preference').addEventListener('change',()=>{if(busy)return;const enabled=byId<HTMLInputElement>('adult-preference').checked;const x=engine.performAction({actionId:asId('district:action.preference.'+(enabled?'on':'off'))},engine.snapshot().meta.revision,crypto.randomUUID());if(!x.ok)byId('pack-message').textContent=x.message;else if(enabled){const p=engine.snapshot().district?.profile;const gate=!!(p?.created&&p.ageYears>=18&&p.adultOptional);byId('pack-message').textContent=gate?'成人可选文本偏好已开启。':'需要已创建的成年角色并开启成人可选文本偏好。';byId('pack-message').dataset.adultReason=gate?'0':'1';}else{byId('pack-message').textContent='已关闭成人可选文本。';delete byId('pack-message').dataset.adultReason;}redraw();});
  byId<HTMLInputElement>('pack-import').addEventListener('change',async event=>{const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>1024*1024)throw Error('文本包超过1 MiB。');const raw=JSON.parse(await file.text()),id=texts.install(raw,registry);storedTexts=storedTexts.filter((x:unknown)=>(x as {manifest:{id:string}}).manifest.id!==id);storedTexts.push(raw);persistTexts();redraw();byId('pack-message').textContent='可选文本包已启用。当前进度与效果没有改变。';}catch(error){byId('pack-message').textContent='未导入：'+(error instanceof Error?error.message:error);}});
  document.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button[data-pack]');if(!b)return;const id=b.dataset.pack!;if(b.dataset.packMove==='delete'){texts.remove(id);storedTexts=storedTexts.filter((x:unknown)=>(x as {manifest:{id:string}}).manifest.id!==id);delete textEnabled[id];}else {textEnabled[id]=!texts.list().find(x=>x.id===id)!.enabled;texts.setEnabled(id,textEnabled[id]!);}persistTexts();redraw();byId('pack-message').textContent='文本显示已更新；角色与事件状态保留。';});
  byId<HTMLInputElement>('rules-import').addEventListener('change',async event=>{
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file||busy)return;busy=true;
    try {
      if(file.size>1024*1024)throw Error('事件包超过1 MiB。');
      const raw=JSON.parse(await file.text()),pack=parsePack(raw);
      if(!isAppendOnlyEventPack(pack))throw Error('当前导入入口只接收追加动作/事件/文本/公开Hook的事件包。');
      const fixedNext=await loadPacks([...basePacks,...rulePacks,raw]);
      const state=structuredClone(engine.snapshot());
      const next=state.worldInstance?await loadPacks([...registry.contentPacks,raw]):fixedNext;
      state.meta.packs=structuredClone(next.packs);
      if(state.worldInstance)state.worldInstance.definition.packs=structuredClone(next.contentPacks);
      const nextCodec=new SaveCodec(next);await nextCodec.encode(state);
      fixedRegistry=fixedNext;adopt({state,registry:next});rulePacks.push(raw);
      persistRules();
      redraw();byId('pack-message').textContent='追加事件包校验通过并已启用。公开入口已更新，存档会记录包版本。';
    } catch(error){byId('pack-message').textContent='未导入，原进度保留：'+(error instanceof Error?error.message:error);}finally{busy=false;}
  });
  byId('brief-export').addEventListener('click',()=>{try{const context=writingContext(engine.snapshot(),registry),url=URL.createObjectURL(new Blob([JSON.stringify(context,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='runtime-context.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('pack-message').textContent='已导出当前槽的真实参与者、身体、姿态和接触上下文。';}catch(error){byId('pack-message').textContent=error instanceof Error?error.message:'当前没有写作槽。';}});
  redraw();
  try {
    const loaded = await saves.load(saveSlot);
    if (loaded.status === 'ready') { adopt(loaded); savedSnapshot = JSON.stringify(loaded.state); result = loaded.state.ledger.transactions.at(-1)?.result; redraw(); feedback(loaded.migration ?? '已恢复手动存档。之后的行动仍需手动保存。'); }
    else if (loaded.status === 'empty' && launch.aetheriaInitialSave) { const initial = await codec.decode(launch.aetheriaInitialSave); if(initial.status!=='ready')throw Error(initial.reason);adopt(initial);redraw();feedback('已进入示例随机街区。可继续探索并手动保存。'); }
    else if (loaded.status === 'quarantined') feedback(`旧存档已隔离并保留：${loaded.reason}`, true);
  } catch { feedback('本地存档暂不可用，进度可以通过 JSON 导出。', true); }
}
boot().catch(error => {
  byId('scene-title').textContent = '进入城市失败';
  byId('scene-text').textContent = error instanceof PackError ? error.issues.map(x => `${x.code} ${x.pointer}：${x.reason}`).join('\n') : error instanceof Error ? error.message : '加载失败。';
  byId('scene-text').classList.add('loading-error');
});
