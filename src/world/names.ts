import type { NameCulture, PersonalName, SurnameRule } from '../core/name-types.ts';
import { proseProblem } from '../content/player-prose.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function shape(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  if (!record(v) || Object.keys(v).some(k => !keys.includes(k))) throw Error('姓名字段无效。');
}
function part(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !v.trim() || v !== v.trim() || v.length > 40 || /[<>\r\n]/.test(v) || proseProblem(v)) throw Error('姓名文字无效。');
}
function parts(v: unknown, min: number, max: number): asserts v is string[] {
  if (!Array.isArray(v) || v.length < min || v.length > max || new Set(v).size !== v.length) throw Error('姓氏列表无效。');
  v.forEach(part);
}
export function validateNameCulture(v: unknown): asserts v is NameCulture {
  shape(v, ['id', 'familyNames', 'order', 'separator', 'defaultInheritance']); part(v.id);
  if (!['family-given', 'given-family', 'single'].includes(String(v.order)) || !['', '·', ' '].includes(String(v.separator)) || !['parentA', 'parentB', 'compound', 'none'].includes(String(v.defaultInheritance))) throw Error('命名文化规则无效。');
  parts(v.familyNames, v.order === 'single' ? 0 : 1, 100);
  if (v.order === 'single' && (v.familyNames.length || v.defaultInheritance !== 'none' || v.separator !== '')) throw Error('单名文化不能偷偷分配姓氏。');
}
export function validatePersonalName(v: unknown): asserts v is PersonalName {
  shape(v, ['cultureId', 'givenName', 'familyNames', 'order', 'separator']); part(v.cultureId); part(v.givenName);
  if (!['family-given', 'given-family', 'single'].includes(String(v.order)) || !['', '·', ' '].includes(String(v.separator))) throw Error('姓名显示规则无效。');
  parts(v.familyNames, v.order === 'single' ? 0 : 1, 4);
  if (v.order === 'single' && (v.familyNames.length || v.separator !== '')) throw Error('单名不得有姓氏。');
  if (formatName(v as unknown as PersonalName).length > 100) throw Error('全名过长。');
}
export function formatName(n: PersonalName): string {
  return (n.order === 'single' ? [n.givenName] : n.order === 'family-given' ? [...n.familyNames, n.givenName] : [n.givenName, ...n.familyNames]).join(n.separator);
}
function hash(value: string): number { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
function input(seed: number, entityId: string, givenNames: string[], culture: NameCulture): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('姓名种子无效。');
  if(typeof entityId !== 'string' || !entityId.trim() || entityId.length > 200) throw Error('姓名实例ID无效。');
  parts(givenNames, 1, 100); validateNameCulture(culture);
}
/** 只在实例创建时调用；独立散列流不消耗游戏 RNG，不构造候选组合数组。 */
export function generatePersonalName(options: {seed: number; entityId: string; givenNames: string[]; culture: NameCulture; usedNames?: readonly string[]}): PersonalName {
  const {seed, entityId, givenNames, culture, usedNames = []} = options; input(seed, entityId, givenNames, culture);
  const givenStart = hash(`${seed}:${entityId}:given`) % givenNames.length;
  const families = culture.order === 'single' ? [''] : culture.familyNames;
  const familyStart = hash(`${seed}:${entityId}:family`) % families.length;
  const candidate = (i: number): PersonalName => ({cultureId: culture.id, givenName: givenNames[(givenStart + Math.floor(i / families.length)) % givenNames.length]!, familyNames: culture.order === 'single' ? [] : [families[(familyStart + i) % families.length]!], order: culture.order, separator: culture.separator});
  const used = new Set(usedNames);
  for (let i = 0; i < givenNames.length * families.length; i++) { const n = candidate(i); if (!used.has(formatName(n))) return n; }
  // 名库耗尽允许重名，人物仍以稳定实体 ID 区分；不在姓名后制造数字。
  return candidate(0);
}
export function createChildName(options: {seed: number; childId: string; culture: NameCulture; givenNames: string[]; parents: {id: string; personalName?: PersonalName}[]; surnameRule?: SurnameRule}): {name: string; personalName: PersonalName; parentIds: string[]; surnameRule: SurnameRule} {
  const {seed, childId, culture, givenNames, parents} = options; input(seed, childId, givenNames, culture);
  if (!Array.isArray(parents) || parents.length > 2 || new Set(parents.map(p => p.id)).size !== parents.length) throw Error('亲代身份无效。');
  for (const p of parents) { if(typeof p.id!=='string'||!p.id.trim()||p.id.length>200)throw Error('亲代ID无效。'); if (p.id === childId) throw Error('不能继承自己的姓氏。'); if (p.personalName !== undefined) validatePersonalName(p.personalName); }
  let rule = options.surnameRule;
  if (!rule) {
    if (culture.defaultInheritance === 'none') rule = {kind: 'none'};
    else if (culture.defaultInheritance === 'compound') rule = {kind: 'compound', sources: parents.map(p => ({parentId: p.id, familyIndex: 0}))};
    else { const parent = parents[culture.defaultInheritance === 'parentA' ? 0 : 1]; if (!parent) throw Error('缺少文化规则指定的亲代。'); rule = {kind: 'parent', parentId: parent.id}; }
  }
  const parentName = (id: string) => { const p = parents.find(p => p.id === id); if (!p?.personalName?.familyNames.length) throw Error('指定亲代的姓氏未知；必须明确家庭姓或单名政策。'); return p.personalName; };
  let familyNames: string[];
  if (rule.kind === 'parent') { shape(rule, ['kind', 'parentId']); familyNames = [...parentName(rule.parentId).familyNames]; }
  else if (rule.kind === 'household') { shape(rule, ['kind', 'familyNames']); parts(rule.familyNames, 1, 4); familyNames = [...rule.familyNames]; }
  else if (rule.kind === 'compound') {
    shape(rule, ['kind', 'sources']); if (!Array.isArray(rule.sources) || rule.sources.length !== 2 || new Set(rule.sources.map(s => s.parentId)).size !== 2) throw Error('双姓需要两个明确亲代。');
    familyNames = [...new Set(rule.sources.map(s => { shape(s, ['parentId', 'familyIndex']); const p = parentName(s.parentId); if (!Number.isInteger(s.familyIndex) || s.familyIndex < 0 || s.familyIndex >= p.familyNames.length) throw Error('亲代姓氏分量不存在。'); return p.familyNames[s.familyIndex]!; }))];
  } else if (rule.kind === 'none') { shape(rule, ['kind']); familyNames = []; }
  else throw Error('未知姓氏继承规则。');
  if ((culture.order === 'single') !== (familyNames.length === 0)) throw Error('继承规则与子代命名文化冲突。');
  const n = generatePersonalName({seed, entityId: childId, givenNames, culture}); n.familyNames = familyNames; validatePersonalName(n);
  return {name: formatName(n), personalName: n, parentIds: parents.map(p => p.id), surnameRule: structuredClone(rule)};
}
