import { residentMemoryText } from '../engine/resident-quests.ts';
import { renderRelationshipTree } from './relationship-tree.ts';
import { RELATION_LABELS } from '../core/quest-types.ts';
import { residentAppearance, environment } from '../engine/query.ts';
import { tagLabel } from '../content/tags.ts';
import type{GameView}from'../core/types.ts';import type{Registry}from'../content/registry.ts';import type{TextLibrary}from'../content/text-variants.ts';import{byId,element}from'./render.ts';import{evaluate}from'../engine/conditions.ts';
import { worldActivityAt } from '../world/simulation.ts';
import { npcCodexDiscoveryRows } from './npc-codex.ts';
export type { JournalEntry } from '../core/quest-types.ts';
import type { JournalEntry } from '../core/quest-types.ts';
export function renderDistrict(v:GameView,r:Registry,texts:TextLibrary,journal:JournalEntry[]=[]):void {
 const d=v.state.district;if(!d)return;
 const sentence=(text:string)=>/[。！？]$/.test(text)?text:text+'。';
 const startId=v.state.worldInstance?.definition.startLocationId;
 const atBirthplace=v.location.id==='aetheria:location.apartment'||(!!startId&&v.location.id===startId);
 const intro=byId('character-intro');
 intro.hidden=d.profile.created||!atBirthplace||!!v.eventTitle||!!d.combat||!!d.scene;
 // 异世界无公寓文案：出生点同样走签到，不硬绑租约措辞
 if(!intro.hidden){
  const title=intro.querySelector('h2'); const blurb=intro.querySelector('p');
  if(title)title.textContent=v.location.id==='aetheria:location.apartment'?'在这座城市开始生活':'在此地确认身份';
  if(blurb)blurb.textContent=v.location.id==='aetheria:location.apartment'
    ?'你租下一间公寓。写下姓名，再到身体面板选择自由塑形。'
    :'写下姓名，确认身份后继续探索。可到身体面板选择自由塑形。';
 }
 byId('player-name').textContent=d.profile.created?d.profile.name:'新来的住户';
 // 创建聚焦：未创建且签到可见时收起「下一步」，避免与签到抢注意力
 const actionsPanel=document.querySelector<HTMLElement>('.actions-panel');
 if(actionsPanel){
  const focus=!!(!d.profile.created&&!intro.hidden);
  actionsPanel.hidden=focus;
  actionsPanel.dataset.createFocus=focus?'1':'0';
  let note=document.getElementById('create-focus-note') as HTMLElement | null;
  if(focus){
   if(!note){note=element('p','muted create-focus-note');note.id='create-focus-note';actionsPanel.parentElement?.insertBefore(note,actionsPanel);}
   note.hidden=false;note.textContent='先签下租约（或确认身份），再选择下一步行动。';
  }else if(note)note.hidden=true;
 }
 const resident=byId('resident-nearby');resident.replaceChildren();const current=d.residents.find(x=>x.id===d.currentResidentId&&x.locationId===v.location.id);
 const active=!!v.eventTitle||!!d.combat||!!d.scene;
 if(current&&!active){resident.append(element('p','resident-name',`${current.name} · ${current.profession}`),element('p','muted',`${sentence(residentAppearance(v.state,r,current.id))}性情：${sentence(current.personality)}${current.persistent?'你们已互留联络。':''}`));const buttons=element('div','resident-buttons');const profile=element('button','profile-open','查看档案 →');profile.dataset.npcOpen=`resident:${current.id}`;buttons.append(profile);if(byId('scene-panel').dataset.mode!=='conversation'){const talk=v.actions.find(a=>a.available&&a.definition.effects.some(e=>e.op==='resident.talk'));if(talk){const b=element('button','','开始交谈 →');b.dataset.action=talk.definition.id;buttons.prepend(b);}}resident.append(buttons);}
 const activity=worldActivityAt(v.state,v.location.id);if(activity&&!active){resident.append(element('p','muted',activity.present?`这里有${activity.present}位居民停留。选择“看看在场居民”可依次打招呼。`:'此刻没有居民在这里停留。'));if(activity.nextArrival)resident.append(element('p','muted',`按公共日程，约${activity.nextArrival.minutes}分钟后有${activity.nextArrival.count}位居民到来。`));}
 const people=byId('people-content');for(const n of d.residents.filter(n=>n.persistent||n.visits>0||n.id===d.currentResidentId)){const card=element('article','npc-card');card.dataset.npc=`resident:${n.id}`;card.append(element('h3','',`${n.name} · ${n.profession}`),element('p','muted',`${sentence(residentAppearance(v.state,r,n.id))}性情：${sentence(n.personality)}`),element('p','npc-location',`当前在${r.location(n.locationId).name}；关系信任${n.trust}，已交谈${n.visits}个游戏日。`),element('p','muted',n.memories.map(m=>residentMemoryText(m,r)).join('；')||'你们还没有留下共同经历。'));const profile=element('button','profile-open','查看人物档案 →');profile.dataset.npcOpen=card.dataset.npc;card.append(profile);if(n.id===d.currentResidentId&&!active){const talk=v.actions.find(a=>a.available&&a.definition.effects.some(e=>e.op==='resident.talk'));if(talk){const button=element('button','npc-topic-actions','开始交谈 →');button.dataset.action=talk.definition.id;card.append(button);}}const agent=v.state.worldInstance?.agents.find(a=>a.residentId===n.id);if(agent?.playerRelations)card.append(element('p','npc-relationship','共同背景：'+agent.playerRelations.map(tag=>RELATION_LABELS[tag]).join('、')));if(agent){card.append(element('p','npc-schedule',agent.schedule.map(s=>`${String(Math.floor(s.start/60)).padStart(2,'0')}:${String(s.start%60).padStart(2,'0')}–${s.end===1440?'24:00':`${String(Math.floor(s.end/60)).padStart(2,'0')}:${String(s.end%60).padStart(2,'0')}`} ${r.location(s.locationId).name}`).join('；')));}people.append(card);}
 renderRelationshipTree(v,r,people);
 if(people.querySelector('[data-npc]'))for(const empty of people.querySelectorAll(':scope > .muted'))empty.remove();
 for(const n of v.state.npcs.filter(n=>n.discovered)){const stage=[...n.memories].reverse().map(m=>r.npcMemory(m.definitionId).relationshipStage).find(Boolean);if(stage){const card=people.querySelector<HTMLElement>(`[data-npc="${n.definitionId}"]`);card?.append(element('p','',`共同经历阶段：${{introduced:'初识',familiar:'熟悉',trusted:'信任',private:'彼此愿意私人往来',closed:'私人路线关闭，公开往来保留'}[stage]}`));}}
 const tasks=byId('quest-content');tasks.replaceChildren();for(const q of [...journal,...(v.state.worldInstance?.definition.quests?.journal??[])].filter(q=>q.unlock.every(c=>evaluate(c,v.state,r).pass))){const step=[...q.steps].reverse().find(step=>step.conditions.every(c=>evaluate(c,v.state,r).pass));const card=element('article','npc-card');card.append(element('h3','',q.title),element('p','',step?.text??'继续留意街区。'));tasks.append(card);}if(!tasks.childElementCount)tasks.append(element('p','muted','留意街区、与人物正式认识，或到档案室查看公开工单。接受的事情会记在这里。'));
 if(v.state.adventure){const a=v.state.adventure,card=element('article','npc-card');card.append(element('h3','','成长与街区进展'),element('p','',`经营份额${a.assets}；订单${a.orders}；契约${a.contracts}；组织影响${a.influence}；街区安全${a.safety}；声望${a.reputation}；有效胜利${Object.values(a.victories).reduce((n,v)=>n+v,0)}`),element('p','muted','经营终局需要经营份额6、订单3、契约2。权力终局需要组织影响5、安全5、有效胜利2。市场与工坊可接订单、购买装备；公共区与工坊可训练和挑战。'));tasks.prepend(card);for(const row of [...a.journal].reverse().slice(0,12)){const item=element('article','log-item');item.append(element('h3','',row.title),element('p','',row.text));tasks.append(item);}}
 const bag=byId('bag-content');const slotLabel:Record<string,string>={held:'持握',head:'头',body:'身',hands:'手',legs:'腿',accessory:'饰品',weapon:'持握',armor:'身',cosmetic:'时装',wings:'翼',tail:'尾',other:'其他'};const equippedEntries=Object.entries(v.state.adventure?.equipment??{});const equippedIds=[...new Set([d.equipped,...equippedEntries.map(([,id])=>id)].filter(Boolean))] as string[];bag.replaceChildren(element('p','',equippedEntries.length?'正在穿戴：'+equippedEntries.map(([slot,id])=>`${slotLabel[slot]??slot}·${r.equipment.find(e=>e.id===id)?.name??id}`).join('、'):'当前没有试用装备。'));for(const item of d.inventory){const def=r.equipment.find(e=>e.id===item)!;const slot=def.slot??'cosmetic';bag.append(element('h3','',`${def.name}（${slotLabel[slot]??slot}）`),element('p','muted',def.description));const option=v.actions.find(a=>a.definition.effects.some(e=>e.op==='equipment.wear'&&e.id===item));if(option){const worn=equippedIds.includes(item);const button=element('button','',worn?'已装备':'装备');button.dataset.action=option.definition.id;button.disabled=!option.available||worn;bag.append(button);}}const stacks=Object.entries(v.state.adventure?.items??{});if(stacks.length){bag.append(element('h3','','消耗品'));for(const [id,qty] of stacks){const def=r.items.find(i=>i.id===id);if(!def)continue;bag.append(element('p','',`${def.name} ×${qty}`),element('p','muted',def.description));const use=v.actions.find(a=>a.definition.effects.some(e=>e.op==='item.use'&&e.id===id));if(use){const button=element('button','','使用');button.dataset.action=use.definition.id;button.disabled=!use.available;bag.append(button);}}}bag.append(element('p','muted',v.state.adventure?'头/身/手/腿/饰品/持握各保留一件（翼/尾为扩展槽）。同槽新装备替换旧件，物品仍留在背包；消耗品按数量堆叠，使用后扣减。':'市场提供免费试穿和收起入口。身体变化使装备不兼容时，会自动卸下并保留。'));
 const service=environment(v.state,r).service;
 const shop=v.actions.filter(o=>o.definition.effects.some(e=>e.op==='progression.act'&&e.move==='buy'));
 if(service.known&&['market','workshop','clinic','commons'].includes(service.value)&&shop.length){
  bag.append(element('h3','','当地补给与装备'));
  for(const option of shop){const card=element('article','save-slot');card.append(element('p','',option.definition.label),element('p','muted',option.available?option.definition.hint:option.reason));const button=element('button','','购买');button.dataset.action=option.definition.id;button.disabled=!option.available;card.append(button);bag.append(card);}
 }
 const search=byId<HTMLInputElement>('discovery-search').value.trim().toLowerCase(),index=byId('discovery-content');index.replaceChildren();
 const rows:{title:string;detail:string;kind?:string}[]=[];
 for(const row of npcCodexDiscoveryRows(v,r))rows.push(row);
 for(const sid of d.discovered){const st=r.storylets.find(x=>x.id===sid);if(st){const e=r.event(st.eventId);rows.push({title:r.text(e.nodes[0]!.textVariants[0]!).split('\n')[0]!,detail:`${r.location(st.locationId).name} · ${st.tags.map(tag=>tagLabel(r,tag,'story.v1')).filter(Boolean).join(' / ')} · ${st.repeat==='once'?'已记下经历':'可按生活节奏再次遇见'}`});}const i=r.interactions.find(x=>x.id===sid);if(i)rows.push({title:r.npc(i.npcId).name+'的安静相处',detail:'私人交谈 / 姿态 / 手部接触；必须重新确认当下意愿。'});}
 const matched=rows.filter(x=>(x.title+x.detail).toLowerCase().includes(search));
 const codex=matched.filter(x=>x.kind==='npc-codex');
 const other=matched.filter(x=>x.kind!=='npc-codex');
 if(codex.length){index.append(element('h3','discovery-section','NPC 图鉴'));for(const row of codex){const card=element('article','log-item npc-codex-card');card.append(element('h3','',row.title),element('p','muted',row.detail));index.append(card);}}
 if(other.length){index.append(element('h3','discovery-section','经历与互动'));for(const row of other){const card=element('article','log-item');card.append(element('h3','',row.title),element('p','muted',row.detail));index.append(card);}}
 if(!index.childElementCount)index.append(element('p','muted','尚未发现匹配内容。NPC 图鉴与索引只显示亲自知道的人物、主题和互动。'));
 const packs=byId('pack-content');packs.replaceChildren();for(const p of texts.list()){const card=element('div','save-slot');card.append(element('p','',`${p.id} · ${p.version} · ${p.enabled?'已启用':'已禁用'}`));for(const [move,label]of [['toggle',p.enabled?'禁用':'启用'],['delete','删除']]){const b=element('button','',label);b.dataset.pack=p.id;b.dataset.packMove=move;card.append(b);}packs.append(card);}if(!packs.childElementCount)packs.append(element('p','muted','当前使用完整基础正文。可以导入经过审核的可选文本包。'));
 byId<HTMLInputElement>('adult-preference').checked=d.profile.adultOptional;
 // 成人偏好已开但仍被门挡住时，复用条件文案说明原因（不误放行）
 const packMsg=byId('pack-message');
 const adultGate=!!(d.profile.created&&d.profile.adultOptional);
 const adultReason='偏好已开启；创建成年角色后即可显示相关文本。';
 if(d.profile.adultOptional&&!adultGate){
  if(!packMsg.textContent||packMsg.dataset.adultReason==='1'||/成人|成年|adult/i.test(packMsg.textContent)){
   packMsg.textContent=adultReason;packMsg.dataset.adultReason='1';
  }
 }else if(packMsg.dataset.adultReason==='1'){packMsg.textContent='';delete packMsg.dataset.adultReason;}
 const statusNote=document.querySelector<HTMLElement>('.status-note');
 if(statusNote){
  if(d.profile.adultOptional&&!adultGate)statusNote.innerHTML=`成人可选文本暂不可用。<br>${adultReason}`;
  else if(statusNote.dataset.adultHint==='1'||statusNote.textContent?.includes('成人可选文本暂不可用')){
   statusNote.innerHTML='生活仍在继续。<br>决定下一步的人是你。';delete statusNote.dataset.adultHint;
  }
  if(d.profile.adultOptional&&!adultGate)statusNote.dataset.adultHint='1';
 }
}
