import type { Registry } from '../content/registry.ts';
import type { GameState, Condition, Id } from '../core/types.ts';
import type { EntityRef } from '../core/query-types.ts';
import { evaluate } from './conditions.ts';

/** 派生集为瞬时视图，不持久化；规则禁止读取派生 Tag，避免隐式循环。 */
export function derivedSemantics(s:GameState,r:Registry,subject:{entity:EntityRef}|{locationId:Id}|{world:true}):Id[]{
  return r.derivedTags.filter(rule=>{
    let c:Condition=rule.when;
    if(rule.subject==='entity'){if(!('entity'in subject))return false;c={...c,target:subject.entity} as Condition;}
    else if(rule.subject==='location'){if(!('locationId'in subject))return false;c={...c,locationId:subject.locationId} as Condition;}
    else if(!('world'in subject))return false;
    return evaluate(c,s,r).pass;
  }).map(d=>d.tagId).sort();
}

/** 确定性 FNV-1a 哈希：在同一 (seed, locationId, 时段窗口, 候选集) 下保持纯函数幂等，同时避免永远死锁 [0]。 */
function deterministicCandidateIndex(s: GameState, candidateIds: string[]): number {
  if (candidateIds.length <= 1) return 0;
  const hourBucket = Math.floor((s.clock?.totalMinutes ?? 0) / 60);
  const key = `${s.rng?.seed ?? 0}:${s.world?.locationId ?? ''}:${hourBucket}:${candidateIds.join('|')}`;
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  }
  return hash % candidateIds.length;
}

/** 素材仅提供正文；适用条件在独立规则侧。未知不入候选，确定性哈希抽样保证同状态反复读取一致且海量词条可轮换。 */
export function selectReviewedText(s:GameState,r:Registry,materials:{id:string;text:string;review:'approved'|'hold'}[],rules:{entryId:string;when:Condition[]}[]):string|undefined {
  const ids=new Set(rules.filter(rule=>rule.when.every(c=>evaluate(c,s,r).pass)).map(rule=>rule.entryId));
  const candidates = materials.filter(m=>m.review==='approved'&&ids.has(m.id)).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  if (!candidates.length) return undefined;
  const index = deterministicCandidateIndex(s, candidates.map(c => c.id));
  return candidates[index]?.text;
}

export function presentationText(s:GameState,r:Registry,channel:'body'|'environment'):string|undefined {
  return selectReviewedText(s,r,r.proseMaterials,r.proseSelections.filter(rule=>rule.channel===channel));
}

export interface ProseSelectionDebugTrace {
  channel: 'body' | 'environment';
  selectedMaterial?: { id: Id; text: string; tags: Id[]; source: string };
  selectedIndex: number;
  candidateCount: number;
  candidateIds: Id[];
  matchedRules: { id: Id; entryId: Id; conditions: Condition[] }[];
  rejectedRules: { id: Id; entryId: Id; failedReason: string }[];
}

/** Debug 专用：完整追踪某通道（environment / body）文本由哪条规则、哪些条件与哪些 Tag 选出。纯只读，不改状态。 */
export function explainPresentationText(s: GameState, r: Registry, channel: 'body' | 'environment'): ProseSelectionDebugTrace {
  const channelRules = r.proseSelections.filter(rule => rule.channel === channel);
  const matchedRules: ProseSelectionDebugTrace['matchedRules'] = [];
  const rejectedRules: ProseSelectionDebugTrace['rejectedRules'] = [];
  for (const rule of channelRules) {
    const checks = rule.when.map(c => ({ c, res: evaluate(c, s, r) }));
    const failed = checks.find(x => !x.res.pass);
    if (!failed) {
      matchedRules.push({ id: rule.id, entryId: rule.entryId, conditions: rule.when });
    } else {
      rejectedRules.push({ id: rule.id, entryId: rule.entryId, failedReason: failed.res.reason || '条件未满足' });
    }
  }
  const ids = new Set(matchedRules.map(rule => rule.entryId));
  const candidates = r.proseMaterials
    .filter(m => m.review === 'approved' && ids.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const selectedIndex = deterministicCandidateIndex(s, candidates.map(c => c.id));
  const chosen = candidates[selectedIndex];
  return {
    channel,
    ...(chosen ? { selectedMaterial: { id: chosen.id, text: chosen.text, tags: [...chosen.tags], source: chosen.source } } : {}),
    selectedIndex,
    candidateCount: candidates.length,
    candidateIds: candidates.map(c => c.id),
    matchedRules,
    rejectedRules,
  };
}
