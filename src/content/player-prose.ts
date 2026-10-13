/** Authoring instructions and unresolved fields must never become playable prose. */
export function proseProblem(text: string, allowFields = false): string | undefined {
  if (!text.trim()) return '正文为空';
  if (/占位|可填(?:中性|成人|正文)|【槽|故事侧可填|\b(?:TODO|TBD|placeholder|stub)\b/i.test(text)) return '正文仍有制作占位';
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
