import { presentationText } from '../engine/semantic-query.ts';
import { effectivePart } from '../engine/query.ts';
import type { GameView } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { bodyTraits } from '../engine/body.ts';
// DOM 只读取 selector 输出；面板预览与正文操作走同一个 data-action 入口。
export function renderBodyPanel(view: GameView, registry: Registry, target: HTMLElement, buttonFor: (option: GameView['actions'][number]) => HTMLButtonElement): void {
  const el = (tag: string, text: string, className = '') => { const n = document.createElement(tag); n.textContent = text; n.className = className; return n; };
  target.replaceChildren();
  const body = view.state.player.body;
  if (!body) { target.append(el('p', '当前没有可用的身体模板。', 'muted')); return; }
  const traits = bodyTraits(body, registry);
  const parts = body.parts.map(x => registry.bodyPart(x.definitionId));
  const ears = [...new Set(parts.filter(x => x.kind === 'ear').map(x => x.label))].join('、');
  const tail = parts.filter(x => x.kind === 'tail').map(x => x.label).join('、') || '没有尾部';
  target.append(el('p', `${ears || '没有耳部'} · ${tail}`, 'body-summary'));
  const prose=presentationText(view.state,registry,'body');if(prose)target.append(el('p',prose,'muted'));
  const abilities = el('div', '', 'body-abilities');
  for (const [label, n] of [['可抓握部位', traits.grasp], ['行走部位', traits.walk], ['尾部抓握', traits.tailGrip]] as const) abilities.append(el('span', `${label} ${n}`));
  target.append(abilities);
  const jobs = view.state.tfQueues.filter(x => (!x.target||x.target.kind==='player')&& registry.transformation(x.definitionId).source === 'story');
  for (const job of jobs.filter(x => ['active', 'paused', 'blocked'].includes(x.status)).concat(jobs.filter(x => ['completed', 'cancelled'].includes(x.status)).slice(-1))) {
    const def = registry.transformation(job.definitionId), duration = def.stages.at(-1)!.atMinutes;
    const card = el('section', '', 'tf-card');
    const status = { active: '进行中', paused: '已暂停', blocked: '等待处理', completed: '已完成', cancelled: '已取消' }[job.status];
    card.append(el('h3', `${def.label} · ${status}`));
    const bar = el('div', '', 'meter'); const fill = el('div', '', 'meter-fill'); fill.style.width = `${job.elapsedMinutes / duration * 100}%`; bar.append(fill); card.append(bar);
    const next = def.stages.find(x => !job.completedStageIds.includes(x.id));
    card.append(el('p', `${job.elapsedMinutes} / ${duration} 分钟${next && !['cancelled', 'completed'].includes(job.status) ? ` · 下一步：${next.label}` : ''}`, 'muted'));
    if (job.status === 'paused') card.append(el('p', '进度已停止。尾部预约保留，其他部位仍可塑形。', 'muted'));
    if (job.blocker) card.append(el('p', job.blocker, 'muted'));
    if (job.status === 'cancelled') card.append(el('p', '余下步骤已取消。已经安装的结构保留，可单独移除。', 'muted'));
    target.append(card);
  }
  const options = view.actions.filter(x => x.definition.surface === 'body');
  const free = options.filter(x => x.definition.effects.some(e => e.op === 'tf.apply'));
  target.append(el('h3', '自由塑形', 'body-section-title'), el('p', '本版提供耳型与尾部试用。每项选择会即时改变身体；已有结构或改造预约冲突时，会显示原因。', 'muted'));
  const grid = el('div', '', 'action-grid body-actions'); grid.append(...free.map(buttonFor)); target.append(grid);
  const controls = options.filter(x => x.definition.effects.some(e => ['tf.pause', 'tf.resume', 'tf.cancel'].includes(e.op)));
  if (jobs.some(x => ['active', 'paused', 'blocked'].includes(x.status))) {
    target.append(el('h3', '处理当前改造', 'body-section-title'));
    const controlGrid = el('div', '', 'action-grid body-actions'); controlGrid.append(...controls.map(buttonFor)); target.append(controlGrid);
  }
  const details = el('details', '', 'body-details'); details.append(el('summary', '查看身体结构'));
  const groups = new Map<string, number>(); for (const part of parts) groups.set(part.label, (groups.get(part.label) ?? 0) + 1);
  for(const p of body.parts){const a=effectivePart(p,registry);const extra=[a.materialId?registry.material(a.materialId).label:'',a.morphologyId?registry.morphology(a.morphologyId).label:'',a.lengthMm!==undefined?`${a.lengthMm} 毫米`:''].filter(Boolean);if(extra.length)details.append(el('p',`${registry.bodyPart(p.definitionId).label}：${extra.join('、')}`,'muted'));}
  const list = el('div', '', 'body-parts'); for (const [label, n] of groups) list.append(el('span', n > 1 ? `${label} ×${n}` : label)); details.append(list); target.append(details);
}
