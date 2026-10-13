import type { ActionOption, ActionResult, GameView } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { activeEvent } from '../engine/events.ts';
import { bodyTraits } from '../engine/body.ts';
import { byId, element } from './render.ts';
import { scenePresentation } from './scene-presentation.ts';
import { actionPreview } from './action-preview.ts';

export const folioCategories: Record<string, [string,string]> = {
  explore: ['探索此处','观察四周，寻找线索和新的经历。'],
  people: ['身边的人','认识在场的人，继续你们的交谈。'],
  daily: ['可做的事','休息、工作，或继续你的成长。'],
  travel: ['前往别处','沿着可通行的路，去下一个地方。'],
};
export function folioCategory(option: ActionOption, registry: Registry): string {
  if (option.definition.group === 'travel') return 'travel';
  if (option.definition.effects.some(e => e.op === 'resident.talk' || e.op === 'resident.help' || e.op === 'npc.remember'
    || (e.op === 'world.encounter' && e.events === false)
    || (e.op === 'event.start' && ((registry.event(e.id).participantIds?.length ?? 0) > 0 || (registry.event(e.id).residentIds?.length ?? 0) > 0)))) return 'people';
  return option.definition.group === 'explore' ? 'explore' : 'daily';
}
type Settings = {font:'sm'|'md'|'lg';reveal:'instant'|'type';motion:boolean;debug:boolean};
let settings: Settings = {font:'md',reveal:'instant',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,debug:false};
let current: {view:GameView;registry:Registry;result?:ActionResult;browsing:boolean}|undefined;
let callbacks: {redraw:()=>void;openPage:(name:string,from?:boolean)=>void};
let lastChange = '', lastReading = '', timer: ReturnType<typeof setTimeout>|undefined;
let finishReading = () => {};
let returnedPanel: {panel:HTMLElement;parent:Node;next:Node|null}|undefined;
const listPages = new Map<string,number>();
const visible = (node:HTMLElement) => node.getClientRects().length > 0;

function closeSheets(): void {
  for (const id of ['folio-menu','folio-sheet']) { const dialog=byId<HTMLDialogElement>(id);if(dialog.open)dialog.close(); }
}
function restorePanel(): void {
  if (!returnedPanel) return;
  const {panel,parent,next}=returnedPanel;parent.insertBefore(panel,next);returnedPanel=undefined;
}
function openSheet(kind:'status'|'party'): void {
  closeSheets();restorePanel();
  const panel=byId(kind==='status'?'status-rail':'party-rail');
  returnedPanel={panel,parent:panel.parentNode!,next:panel.nextSibling};
  byId('sheet-content').append(panel);byId('sheet-title').textContent=kind==='status'?'属性与能力':'眼前的人';
  byId<HTMLDialogElement>('folio-sheet').showModal();
}
function showCover(show:boolean):void {
  closeSheets();finishReading();
  byId('folio-cover').hidden=!show;byId('folio-app').hidden=show;
  if(show)byId('cover-enter').focus();
}
function route(path:string):void {
  finishReading();
  if(location.hash!==path)history.pushState({aetheriaPage:'play',aetheriaParent:'#/play'},'',path);
  presentFlow();byId('game-main').scrollTo({top:0,behavior:'instant'});
  const heading=byId('folio-card-detail').hidden?byId('folio-cards-heading').hidden?byId('scene-title'):byId('cards-title'):byId('card-title');
  heading.tabIndex=-1;heading.focus({preventScroll:true});
}
function saveSettings():void {
  document.body.dataset.font=settings.font;document.body.dataset.reveal=settings.reveal;document.body.dataset.motion=settings.motion?'full':'reduce';document.body.dataset.debug=String(settings.debug);
  for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-font]'))button.setAttribute('aria-pressed',String(button.dataset.font===settings.font));
  for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-reveal]'))button.setAttribute('aria-pressed',String(button.dataset.reveal===settings.reveal));
  byId<HTMLInputElement>('reading-motion').checked=!settings.motion;byId<HTMLInputElement>('reading-debug').checked=settings.debug;
  try{localStorage.setItem('aetheria-folio-reading',JSON.stringify(settings));}catch{/* Reading preferences still apply to this session. */}
}
export function mountFolio(options:typeof callbacks):void {
  callbacks=options;
  try{const saved=JSON.parse(localStorage.getItem('aetheria-folio-reading')??'null');if(saved){if(['sm','md','lg'].includes(saved.font))settings.font=saved.font;if(['instant','type'].includes(saved.reveal))settings.reveal=saved.reveal;if(typeof saved.motion==='boolean')settings.motion=saved.motion;if(typeof saved.debug==='boolean')settings.debug=saved.debug;}}catch{/* Use accessible defaults. */}
  saveSettings();
  byId('menu-open').addEventListener('click',()=>byId<HTMLDialogElement>('folio-menu').showModal());
  byId('folio-sheet').addEventListener('close',restorePanel);
  for(const id of ['folio-menu','folio-sheet'])byId(id).addEventListener('click',e=>{if(e.target===byId(id))byId<HTMLDialogElement>(id).close();});
  document.addEventListener('click',e=>{
    const button=(e.target as Element).closest<HTMLElement>('button');if(!button)return;
    if(button.hasAttribute('data-sheet-close'))closeSheets();
    if(button.dataset.sheetOpen)openSheet(button.dataset.sheetOpen as 'status'|'party');
    if(button.closest('#folio-menu')&&(button.dataset.dialogOpen||button.id.endsWith('-open')))closeSheets();
    if(button.closest('#folio-sheet')&&(button.dataset.npcOpen||button.dataset.dialogOpen))closeSheets();
  },true);
  byId('cover-enter').addEventListener('click',()=>{showCover(false);lastReading='';reading();});
  byId('cover-open').addEventListener('click',()=>showCover(true));
  byId('cover-world').addEventListener('click',()=>{showCover(false);callbacks.openPage('world');});
  byId('cards-back').addEventListener('click',()=>route('#/play'));
  byId('card-back').addEventListener('click',()=>route(`#/play/cards/${byId('folio-card-detail').dataset.category??'daily'}`));
  byId('reader-skip').addEventListener('click',()=>finishReading());
  document.addEventListener('click',e=>{if((e.target as Element).closest('#scene-text,#result-text'))finishReading();});
  for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-font]'))button.addEventListener('click',()=>{settings.font=button.dataset.font as Settings['font'];saveSettings();});
  for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-reveal]'))button.addEventListener('click',()=>{finishReading();settings.reveal=button.dataset.reveal as Settings['reveal'];saveSettings();});
  byId('reading-motion').addEventListener('change',()=>{finishReading();settings.motion=!byId<HTMLInputElement>('reading-motion').checked;saveSettings();});
  byId('reading-debug').addEventListener('change',()=>{settings.debug=byId<HTMLInputElement>('reading-debug').checked;saveSettings();callbacks.redraw();});
  for(const event of ['popstate','hashchange','gameviewchange'])window.addEventListener(event,()=>presentFlow());
  document.addEventListener('keydown',e=>{
    if(e.repeat||document.querySelector('dialog:modal')||!byId('folio-cover').hidden||!byId('subpage-host').hidden)return;
    if((e.target as Element).closest('input,textarea,select,button,a,summary'))return;
    if(e.key===' '&&!byId('reader-skip').hidden){e.preventDefault();finishReading();return;}
    if(e.key==='Escape'&&location.hash.startsWith('#/play/')){e.preventDefault();route(byId('folio-card-detail').hidden?'#/play':`#/play/cards/${byId('folio-card-detail').dataset.category??'daily'}`);return;}
    if(/^[1-9]$/.test(e.key)){
      const candidates=[...document.querySelectorAll<HTMLButtonElement>('#folio-entries button,#actions button[data-action],#folio-card-detail button[data-action]')].filter(button=>visible(button)&&!button.disabled);
      candidates[Number(e.key)-1]?.click();
    }
  });
  if(!location.hash||location.hash==='#/cover')showCover(true);
}
function showCard(option:ActionOption,registry:Registry):void {
  const category=folioCategory(option,registry),card=byId('folio-card-detail');card.dataset.category=category;
  byId('card-kind').textContent=folioCategories[category][0];byId('card-title').textContent=option.definition.label;
  byId('card-hint').textContent=option.definition.hint==='选择会推进经历 · 查看行动反馈'?'先确认眼前的事，再决定是否行动。':option.definition.hint||'准备好了，就继续。';
  byId('card-costs').replaceChildren(...actionPreview(option.definition,registry,current!.view.state).map(text=>element('span','change',text)));
  byId('card-condition').textContent=option.available?'行动后会显示经过与变化。':option.reason;
  const confirm=element('button','button-solid',option.definition.label);confirm.type='button';confirm.dataset.action=option.definition.id;confirm.disabled=!option.available;
  const back=element('button','button-text','先不选，返回故事卡');back.type='button';back.addEventListener('click',()=>route(`#/play/cards/${category}`));
  byId('card-controls').replaceChildren(confirm,back);
}
function presentFlow():void {
  if(!current)return;
  const {view,registry,result,browsing}=current,scene=scenePresentation(view,registry,result,browsing);
  const parts=location.hash.split('/');let category=parts[1]==='play'&&parts[2]==='cards'?parts[3]:undefined;
  let cardId:string|undefined;
  if(parts[1]==='play'&&parts[2]==='card')try{cardId=decodeURIComponent(parts[3]??'');}catch{/* Invalid deep links return to the book. */}
  const option=cardId?view.actions.find(option=>option.definition.id===cardId&&option.definition.surface!=='body'):undefined;
  if(scene.active||(scene.mode==='conversation'&&!scene.active)){category=undefined;cardId=undefined;}
  if(!folioCategories[category??''])category=undefined;
  const card=!!option&&!!cardId,listing=!!category&&!card;
  byId('play-page').dataset.stage=card?'card':listing?'cards':scene.mode==='conversation'||scene.mode==='interaction'?'talk':scene.mode==='combat'?'combat':'page';
  byId('scene-panel').hidden=card||listing;byId('folio-cards-heading').hidden=!listing;byId('folio-card-detail').hidden=!card;
  byId('folio-entries').hidden=card||listing||scene.active||scene.mode==='conversation';
  byId('actions-title').hidden=card||listing;
  byId('action-context').hidden=true;
  byId('actions').hidden=card;
  if(listing){byId('cards-title').textContent=folioCategories[category!][0];byId('cards-description').textContent=folioCategories[category!][1];}
  if(card)showCard(option!,registry);
  for(const group of byId('actions').querySelectorAll<HTMLElement>('.action-group'))group.hidden=!scene.active&&scene.mode!=='conversation'&&group.dataset.group!==category;
  byId('view-label').textContent=card?'故事卡 · 确认':listing?'故事卡':scene.mode==='combat'?'交锋':scene.mode==='conversation'||scene.mode==='interaction'?'对白':'书页';
  byId('folio-hint').textContent=card?'确认后执行行动':listing?'点一张卡，先读再选':scene.active?'1–9 选择 · 菜单可随时查阅':'从书页里的选项往下走';
}
function cardsPagination():void {
  if(!current)return;
  const key=current.view.location.id;
  for(const group of byId('actions').querySelectorAll<HTMLElement>('.action-group')){
    const grid=group.querySelector<HTMLElement>(':scope > .action-grid');if(!grid)continue;
    const cards=[...grid.children] as HTMLElement[];
    if(cards.length<=6)continue;
    const pageKey=`${key}:${group.dataset.group}`,pages=Math.ceil(cards.length/6);
    let page=Math.min(listPages.get(pageKey)??0,pages-1);
    const pager=element('div','action-pager'),prev=element('button','button-text','← 上一页'),next=element('button','button-text','下一页 →'),count=element('span');prev.type=next.type='button';count.setAttribute('role','status');
    const update=()=>{cards.forEach((card,i)=>{card.hidden=Math.floor(i/6)!==page;});count.textContent=`${page+1} / ${pages}`;prev.disabled=page===0;next.disabled=page===pages-1;listPages.set(pageKey,page);};
    prev.addEventListener('click',()=>{page--;update();});next.addEventListener('click',()=>{page++;update();});pager.append(prev,count,next);grid.after(pager);update();
  }
}
function renderParty(view:GameView,registry:Registry):void {
  const host=byId('party-context');host.replaceChildren();
  const combat=view.state.district?.combat;
  if(combat){const enemy=registry.enemies.find(e=>e.id===combat.enemyId),name=combat.enemyName??enemy?.name??'对手';host.append(element('p','eyebrow','对面 / 敌人'),element('div','party-portrait',name.slice(0,1)),element('h2','',name));
    host.append(element('p','muted',`体况 ${combat.hp} / ${combat.enemy.hpMax}`));const meter=element('div','meter'),fill=element('div','meter-fill');fill.style.width=`${Math.max(0,Math.min(100,combat.hp/combat.enemy.hpMax*100))}%`;meter.append(fill);host.append(meter,element('p','party-intent',`意图 · ${enemy?.intents[combat.turn%(enemy?.intents.length??1)]?.label??'留意对方的动作'}`),element('p','muted',`第 ${combat.turn+1} 回合 · 剩余行动点 ${combat.playerAp}`));return;}
  const event=activeEvent(view.state),participants=event?registry.event(event.definitionId).participantIds??[]:[];
  const interaction=view.state.district?.scene;const interactionNpc=interaction?registry.interactions.find(i=>i.id===interaction.definitionId)?.npcId:undefined;
  const participant=participants[0]??interactionNpc;
  const known=participant?registry.npcs.find(n=>n.id===participant):undefined;
  const resident=view.state.district?.residents.find(r=>r.id===view.state.district?.currentResidentId&&r.locationId===view.location.id);
  const name=known?.name??resident?.name;
  host.append(element('p','eyebrow',name?'对面 / 人物':'此刻 / 周围'));
  if(name){host.append(element('div','party-portrait',name.slice(0,1)),element('h2','',name),element('p','muted',known?.role??resident?.profession??''));
    const state=known?view.state.npcs.find(n=>n.definitionId===known.id):undefined;
    if(state)host.append(element('p','party-relation',`熟悉 ${state.relationship.familiarity} · 信任 ${state.relationship.trust}`));
    else if(resident)host.append(element('p','party-relation',`信任 ${resident.trust} · 交谈 ${resident.visits} 天`));
  }else{host.append(element('div','party-portrait landscape-mark','◇'),element('h2','',view.location.name),element('p','muted',view.location.subtitle),element('p','party-empty','尚未选定交谈对象。留意身边的人，或继续向前。'));}
}
function reading():void {
  if(timer)clearTimeout(timer);finishReading=()=>{};byId('reader-skip').hidden=true;
  if(!current)return;
  const scene=scenePresentation(current.view,current.registry,current.result,current.browsing);
  const target=byId(scene.primaryResult?'result-text':'scene-text'),text=target.textContent??'';
  const key=`${current.view.state.meta.revision}:${current.result?.requestId??''}:${text}`;
  if(key===lastReading||settings.reveal==='instant'||!settings.motion||!target.textContent||target.hidden||!byId('folio-cover').hidden){lastReading=key;return;}
  lastReading=key;
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT),nodes:{node:Node;text:string}[]=[];let node:Node|null;
  while((node=walker.nextNode()))nodes.push({node,text:node.textContent??''});
  for(const item of nodes)item.node.textContent='';
  let index=0,offset=0;byId('reader-skip').hidden=false;
  finishReading=()=>{if(timer)clearTimeout(timer);for(const item of nodes)item.node.textContent=item.text;byId('reader-skip').hidden=true;};
  const tick=()=>{if(index>=nodes.length){finishReading();return;}const item=nodes[index];offset+=2;item.node.textContent=item.text.slice(0,offset);if(offset>=item.text.length){index++;offset=0;}timer=setTimeout(tick,18);};tick();
}
export function renderFolio(view:GameView,registry:Registry,result?:ActionResult,browsing=false):void {
  current={view,registry,result,browsing};
  byId('result-changes').hidden=!scenePresentation(view,registry,result,browsing).primaryResult;
  const scene=scenePresentation(view,registry,result,browsing),entries=byId('folio-entries');entries.replaceChildren();
  if(!scene.active&&scene.mode!=='conversation'){
    for(const [category,[label,description]]of Object.entries(folioCategories)){
      const group=byId('actions').querySelector<HTMLElement>(`.action-group[data-group="${category}"]`);if(!group?.querySelector('button'))continue;
      const button=element('button','folio-entry');button.type='button';button.dataset.folioCategory=category;
      button.append(element('span','entry-number',String(entries.childElementCount+1)),element('span','entry-text',label),element('span','entry-arrow','↗'));button.title=description;
      button.addEventListener('click',()=>route(`#/play/cards/${category}`));entries.append(button);
    }
    for(const card of byId('actions').querySelectorAll<HTMLButtonElement>('button[data-action]')){
      card.dataset.cardAction=card.dataset.action;delete card.dataset.action;card.classList.add('story-card');card.disabled=false;
      const option=view.actions.find(o=>o.definition.id===card.dataset.cardAction);if(option&&!option.available)card.classList.add('card-locked');
      card.addEventListener('click',()=>route(`#/play/card/${encodeURIComponent(card.dataset.cardAction!)}`));
    }
    cardsPagination();
  }
  byId('scene-clock').textContent=byId('clock').textContent;
  let inline=byId('scene-panel').querySelector<HTMLElement>('#folio-inline-status');
  if(!inline){inline=element('p','folio-inline-status');inline.id='folio-inline-status';byId('scene-subtitle').after(inline);}
  const inlineIds=scene.mode==='combat'?['core:health','core:stamina','core:skillResource']:['core:health','core:energy','core:money'];
  inline.textContent=inlineIds.map(id=>{const variable=registry.variables.find(v=>v.id===id);return variable?`${variable.label} ${view.state.player.variables[variable.id]}${variable.unit}`:'';}).filter(Boolean).join(' · ');
  byId('cover-progress').textContent=`${view.location.name} · ${byId('clock').textContent}`;
  byId('cover-enter').textContent=view.state.meta.revision?'继续旅程 →':'翻开书页 →';
  const traits=view.state.player.body?bodyTraits(view.state.player.body,registry):undefined;
  byId('body-rail').replaceChildren(element('h3','','身体与能力'),element('p','muted',traits?Object.entries(traits).filter(([,n])=>n>0).map(([name,n])=>`${({grasp:'抓握',walk:'行走',hear:'听觉',balance:'平衡',tailGrip:'尾部抓握'} as Record<string,string>)[name]??name} ${n}`).join(' · '):'暂时没有身体记录'));
  if(result?.ok&&result.requestId!==lastChange){lastChange=result.requestId;const changes=byId('status-changes');changes.replaceChildren();for(const change of result.changes.filter(change=>registry.variables.some(v=>v.label===change.label)).slice(0,5))changes.append(element('p','stat-change',`${change.label} ${change.before} → ${change.after}`));}
  renderParty(view,registry);presentFlow();reading();
}
