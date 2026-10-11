import { digest, exact } from './library.mjs';

/** 编辑适配层：只把已审文本编译到现有字段，绝不从词条读取权重、身体部件或效果。 */
export function compileNeighborhood({ reference, content, entries, reviews, selection }) {
  exact(selection, ['format','schemaVersion','id','version','names','personalities','outfits','openings','places','details','approvedEntryHashes']);
  if (selection.format !== 'aetheria-lexicon-adaptation' || selection.schemaVersion !== 1) throw Error('词条适配清单格式错误。');
  for (const field of ['places','details']) exact(selection[field],['home','market','workshop','clinic','commons']);
  const byId = new Map(entries.map(e => [e.id, e])), bindings = [], selected = new Set();
  const approved = (id, categories) => {
    const e = byId.get(id);
    if (!e || !categories.includes(e.category) || reviews[id]?.status !== 'approved') throw Error(`词条未审定或分类不符：${id}`);
    if (selection.approvedEntryHashes[id] !== digest(e)) throw Error(`词条已修改，需要重新审稿：${id}`);
    selected.add(id); return e;
  };
  const pool = (ids, categories) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length) throw Error('适配候选列表为空、重复或过长。');
    return ids.map(id => approved(id, categories));
  };
  const bind = (e, file, pointer) => bindings.push({ entryId:e.id, targetFile:`content/generation/${file}.json`, targetPointer:pointer, verifiedBy:`lexicon-neighborhood-adapter/${selection.version}` });
  const names = pool(selection.names, ['npc-name']);
  // 姓氏不是完整姓名；不通过拼接未审文字制造新的身份。
  if (names.some(e => !['短名','全名'].includes(e.subcategory))) throw Error('本适配只接入短名和全名。');
  const personalities = pool(selection.personalities, ['npc-trait']), outfits = pool(selection.outfits, ['body-clothing']);
  const openings = pool(selection.openings, ['text-opening']);
  const outContent = structuredClone(content), outReference = structuredClone(reference);
  outContent.manifest = { ...outContent.manifest, id:'aetheria/neighborhood-lexicon', namespace:'lexicon', version:selection.version, author:'Reviewed lexicon adaptation', dependencies:[...outContent.manifest.dependencies, {id:content.manifest.id,version:content.manifest.version,optional:false}] };
  const residentIds = new Map();
  outContent.residentTemplates.forEach((t, i) => {
    // 这批服装仅审过人形适配；未来非人形服装必须另立适配清单。
    if (t.bodyTemplateId !== 'aetheria-tf:body.human') throw Error('本轮服装仅适配现有人形身体。');
    const original = t.id; t.id = `lexicon:${original.split(':')[1]}`; residentIds.set(original, t.id);
    t.names = names.map((e,j) => { bind(e,'lexicon-content',`/residentTemplates/${i}/names/${j}`); return e.name; });
    t.personality = personalities.map((e,j) => { bind(e,'lexicon-content',`/residentTemplates/${i}/personality/${j}`); return e.description; });
    t.attire = outfits.map((e,j) => { bind(e,'lexicon-content',`/residentTemplates/${i}/attire/${j}`); return `${e.name}：${e.description}`; });
    const opening = openings[i % openings.length];
    t.dialogue.intro += ` ${opening.text}`; bind(opening,'lexicon-content',`/residentTemplates/${i}/dialogue/intro`);
  });
  outReference.id = 'aetheria/neighborhood-lexicon-reference'; outReference.version = selection.version;
  // 保留原始参考库供回归与手动导入；本包的原型全部走相同的 Registry 与居民系统。
  outReference.templates = outReference.templates.filter(t => !['base.npc.vendor','base.npc.electrician'].includes(t.id));
  const templateIds = new Map(outReference.templates.map(t => [t.id, t.id.replace(/^base\./,'lexicon.')]));
  const counters = {};
  outReference.templates.forEach((t,i) => {
    t.id = templateIds.get(t.id);
    t.combination.requiresTemplates = t.combination.requiresTemplates.map(id => templateIds.get(id) ?? id);
    t.combination.excludesTemplates = t.combination.excludesTemplates.map(id => templateIds.get(id) ?? id);
    if (t.kind === 'npc') {
      const target = residentIds.get(t.data.residentTemplateId); if (!target) throw Error('原型没有已审词条适配。');
      t.data.residentTemplateId = target;
      t.requiresPacks = t.requiresPacks.map(id => id === content.manifest.id ? outContent.manifest.id : id);
    }
    if (t.kind !== 'place') return;
    const service = t.data.service;
    const candidates = pool(selection.places[service], ['world-building','world-room','world-workplace']);
    const details = pool(selection.details[service], ['world-detail']);
    const n = counters[service] ?? 0; counters[service] = n + 1;
    const place = candidates[n % candidates.length], detail = details[n % details.length];
    // 用途继续由 service、经济活动和行动定义表达，避免把“天井小院”拼成“小院合住院”。
    t.data.names = [place.name];
    t.data.description += `\n\n${place.description}\n${detail.text}`;
    bind(place,'lexicon-reference',`/templates/${i}/data/names/0`);
    bind(place,'lexicon-reference',`/templates/${i}/data/description`);
    bind(detail,'lexicon-reference',`/templates/${i}/data/description`);
  });
  if (Object.keys(selection.approvedEntryHashes).sort().join('|') !== [...selected].sort().join('|')) throw Error('审定哈希含未使用条目或遗漏条目。');
  return {content:outContent, reference:outReference, usage:{format:'aetheria-lexicon-usage',schemaVersion:1,bindings}};
}
