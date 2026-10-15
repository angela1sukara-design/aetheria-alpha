/** Authoring instructions and unresolved fields must never become playable prose. */
export function proseProblem(text: string, allowFields = false): string | undefined {
  if (!text.trim()) return '正文为空';
  // “占位的目的”等普通叙述不等于制作标记；仍拒绝显式标记和独立占位句。
  if (/占位(?:的)?(?:符|文本|正文|内容|说明|文字|描述|标记|样例|示例|段落|节点|槽|待填|待补)|(?:临时|制作|测试|示例|待补|待填)占位|占位(?=$|[。！？\s】\]])|可填(?:中性|成人|正文)|【槽|故事侧可填|\b(?:TODO|TBD|placeholder|stub)\b/i.test(text)) return '正文仍有制作占位';
  const fields=[...text.matchAll(/\{([a-zA-Z][\w.]*)\}/g)].map(m=>m[1]!);
  const supported=new Set(['opponent','place','player','material','part','tf','opponentKind','materialBase','dingci','comboSample','period','nearby','routeNames','bodyState','tfState','localWork']);
  if(fields.some(field=>!allowFields||!supported.has(field)))return '正文有未填入或不支持的字段';
}

export function uniqueParagraphs(text: string): string {
  const seen = new Set<string>();
  return text.split(/\n\s*\n/).filter(paragraph => {
    const key = paragraph.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).join('\n\n');
}
