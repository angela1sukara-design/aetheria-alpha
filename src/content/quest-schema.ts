import { shape, stableId } from './foundation-schema.ts';
import { clone } from '../core/types.ts';
import { PLAYER_RELATIONS } from '../core/quest-types.ts';
import type { QuestContent } from '../core/quest-types.ts';

/** Author prose never becomes an effect. Each executable choice has explicit reviewed data. */
export function parseQuestContent(raw: unknown): QuestContent {
  const fail = (message: string): never => { throw Error(`任务内容：${message}`); };
  const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 10000) fail('文字无效'); };
  const array = (v: unknown): any[] => { if (!Array.isArray(v) || v.length > 200) fail('数组无效'); return v as any[]; };
  const local = (v: unknown) => { if (typeof v !== 'string' || !/^[a-z][a-z0-9_.-]*$/.test(v)) fail('局部标识无效'); };
  const flag = (v: unknown, prefix: string) => { stableId(v); if (!(v as string).startsWith(prefix + ':flag.')) fail('旗标命名空间无效'); };
  const p = shape(raw, ['format', 'schemaVersion', 'id', 'version', 'sourceHash', 'source', 'execution']);
  if (p.format !== 'aetheria-quest-content' || p.schemaVersion !== 1) fail('格式版本无效');
  text(p.id); if (!/^\d+\.\d+\.\d+$/.test(p.version) || !/^[a-f0-9]{64}$/.test(p.sourceHash)) fail('版本或来源哈希无效');
  const source = shape(p.source, ['mainQuest', 'sideQuests', 'relationRules']);
  const main = shape(source.mainQuest, ['id', 'goal', 'paths', 'journal']); text(main.id); text(main.goal);
  const services = ['home', 'market', 'workshop', 'clinic', 'commons'];
  const stageIds = new Set<string>(), pathIds = new Set<string>(), mainFlags = new Set<string>(['main:flag.started']);
  const paths = array(main.paths); if (paths.length < 2 || paths.length > 3) fail('需要两到三条路径');
  for (const path of paths) {
    shape(path, ['id', 'style', 'stages']); local(path.id); text(path.style);
    if (pathIds.has(path.id)) fail('路径重复'); pathIds.add(path.id);
    const stages = array(path.stages); if (stages.length < 3 || stages.length > 4) fail('每条路径需要三到四阶段');
    stages.forEach((stage, index) => {
      shape(stage, ['id', 'name', 'locationType', 'objective', 'flag', 'actions', 'requires', 'next']);
      local(stage.id); text(stage.name); text(stage.objective); flag(stage.flag, 'main');
      if (stageIds.has(stage.id) || !services.includes(stage.locationType)) fail('阶段重复或地点无效'); stageIds.add(stage.id);
      const actions = array(stage.actions); if (actions.length < 2) fail('每阶段需要不同做法'); actions.forEach(text);
      const required = array(stage.requires); required.forEach(f => flag(f, 'main'));
      const previous = index ? stages[index - 1].flag : 'main:flag.started';
      if (required.length !== 1 || required[0] !== previous) fail('阶段前置不连续');
      const next = array(stage.next); if (index === stages.length - 1) {
        if (next.length || stage.flag !== 'main:flag.top_reached') fail('终局必须汇合');
      } else if (next.length !== 1 || next[0] !== stages[index + 1].id || mainFlags.has(stage.flag)) fail('下一阶段或旗标重复');
      mainFlags.add(stage.flag);
    });
  }
  array(main.journal).forEach(j => { shape(j, ['unlockFlag', 'text']); if (!mainFlags.has(j.unlockFlag)) fail('日志引用未知旗标'); text(j.text); });
  const sideIds = new Set<string>(), sideFlags = new Set<string>(), kinds = new Set<string>();
  for (const side of array(source.sideQuests)) {
    shape(side, ['id', 'type', 'locationType', 'requiresRelation', 'objective', 'flag', 'effectOnMain', 'journalText']);
    local(side.id); flag(side.flag, 'side'); text(side.objective);
    if (sideIds.has(side.id) || sideFlags.has(side.flag) || !services.includes(side.locationType)) fail('支线重复或地点无效');
    sideIds.add(side.id); sideFlags.add(side.flag); kinds.add(side.type);
    if (!['main-related', 'character', 'atmosphere'].includes(side.type)) fail('支线分类无效');
    if (side.requiresRelation !== null && !PLAYER_RELATIONS.includes(side.requiresRelation)) fail('关系无效');
    if (side.effectOnMain !== null) text(side.effectOnMain);
    if (side.journalText !== null) text(side.journalText);
    if (side.type === 'atmosphere' && (side.journalText !== null || side.effectOnMain !== null)) fail('环境短篇不进入日志或影响主线');
  }
  if (kinds.size !== 3) fail('支线必须覆盖三类');
  const relations = shape(source.relationRules, ['types', 'perResident', 'usage']);
  if (JSON.stringify(relations.types) !== JSON.stringify(PLAYER_RELATIONS) || relations.perResident !== '1-2') fail('关系规则无效'); text(relations.usage);
  const execution = shape(p.execution, ['stages', 'sides']);
  shape(execution.stages, [...stageIds]); shape(execution.sides, [...sideIds]);
  const checkChoices = (raw: unknown, side: boolean) => {
    const choices = array(raw), ids = new Set<string>();
    if (choices.length < 2 || !choices.some(c => c.complete && c.requires?.length === 0 && c.energy === 0)) fail('必须保留无支线前置且免费可完成的做法');
    for (const c of choices) {
      shape(c, ['id', 'label', 'result', 'requires', 'minutes', 'energy', 'complete', 'memory']);
      local(c.id); text(c.label); text(c.result);
      if (ids.has(c.id) || c.id === 'leave') fail('选择 ID 重复或占用保留的退出 ID'); ids.add(c.id);
      array(c.requires).forEach(f => { if (!sideFlags.has(f)) fail('可选条件引用未知支线旗标'); });
      if (!Number.isSafeInteger(c.minutes) || c.minutes < 0 || c.minutes > 120 || !Number.isSafeInteger(c.energy) || c.energy < 0 || c.energy > 20 || typeof c.complete !== 'boolean') fail('选择效果无效');
      if (!c.complete && (c.minutes || c.energy || c.requires.length || c.memory !== null)) fail('暂缓必须免费且不写记忆');
      if (c.memory !== null) { text(c.memory); if (!side) fail('主线不能隔空写居民记忆'); }
    }
  };
  Object.values(execution.stages).forEach(c => checkChoices(c, false));
  for (const s of Object.values(execution.sides) as any[]) { shape(s, ['title', 'prompt', 'choices']); text(s.title); text(s.prompt); checkChoices(s.choices, true); }
  return clone(raw) as QuestContent;
}

/** Select only the authored pack matching the generated environment; never fall back to cyber. */
export function selectQuestContent(raw: unknown, environmentTags: string[], canonical: (tag: string) => string): QuestContent {
  if ((raw as { format?: string } | null)?.format !== 'aetheria-quest-catalog') return parseQuestContent(raw);
  const catalog = shape(raw, ['format', 'schemaVersion', 'entries']);
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries) || !catalog.entries.length || catalog.entries.length > 20) throw Error('任务目录格式无效。');
  const seen = new Set<string>();
  const entries = catalog.entries.map((value: unknown) => {
    const entry = shape(value, ['environmentTag', 'content']);
    if (typeof entry.environmentTag !== 'string' || !entry.environmentTag.trim()) throw Error('任务环境标签无效。');
    const tag = canonical(entry.environmentTag);
    if (seen.has(tag)) throw Error('任务环境标签重复。'); seen.add(tag);
    return { tag, content: parseQuestContent(entry.content) };
  });
  const matches = entries.filter(entry => environmentTags.includes(entry.tag));
  if (matches.length !== 1) throw Error('当前环境必须恰好匹配一套任务内容。');
  return matches[0]!.content;
}
