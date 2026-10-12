import type { Registry } from './registry.ts';
import type { Id } from '../core/types.ts';
import type { TagDef } from '../core/query-types.ts';
/** 别名仅在指定旧域精确解析；主题语义从不作为角色状态。 */
export function resolveTag(r: Registry, value: string, scope: TagDef['aliases'][number]['scope']): Id {
  const matches = r.tags.filter(t => t.id === value || t.aliases.some(a => a.scope === scope && a.value === value));
  if (matches.length !== 1) throw Error(`${matches.length ? '歧义' : '未定义'} Tag：${scope}/${value}`);
  return matches[0]!.id;
}
export function tagLabel(r: Registry, value: string, scope: TagDef['aliases'][number]['scope']): string {
  if(value === '隐藏' && scope === 'story.v1') return '';
  // 无字典的历史内容仍按旧域显示；已安装字典后未知值明确呈现，不能冒充规范 ID。
  try { return r.tag(resolveTag(r,value,scope)).label; } catch { return r.tags.length ? `未登记：${value}` : value; }
}
export function serviceTag(service: string): Id { return `foundation:service.${service}`; }
