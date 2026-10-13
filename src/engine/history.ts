import type { GameState, Transaction } from '../core/types.ts';
import { entityKey } from './query.ts';

export const HISTORY_WINDOW = 256;
export const REQUEST_FILTER_BYTES = 131072;
let cachedFilter: string | undefined, cachedBytes: Uint8Array | undefined;
function decode(text: string): Uint8Array { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
function encode(bytes: Uint8Array): string { let raw = ''; for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(raw); }
function positions(id: string): number[] {
  let a = 2166136261, b = 0x9e3779b9;
  for (const c of id) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b ^ c.charCodeAt(0), 2246822519); }
  return Array.from({ length: 4 }, (_, i) => ((a + Math.imul(i + 1, b | 1)) >>> 0) % (REQUEST_FILTER_BYTES * 8));
}
export function historyTransaction(s: GameState, requestId: string): Transaction | undefined { return s.ledger.transactions.find(t => t.requestId === requestId) ?? s.ledger.checkpoint?.evidence.find(t => t.requestId === requestId); }
/** Archived requests can be refused, never re-executed. A filter collision is a safe refusal. */
export function requestArchived(s: GameState, id: string): boolean {
  if (!s.ledger.checkpoint) return false;
  if(cachedFilter!==s.ledger.checkpoint.requests){cachedFilter=s.ledger.checkpoint.requests;cachedBytes=decode(cachedFilter);}
  const bytes = cachedBytes!;
  return positions(id).every(p => ((bytes[p >>> 3] ?? 0) & (1 << (p & 7))) !== 0);
}
export function validRequestFilter(text: unknown): boolean {
  try { return typeof text === 'string' && text.length <= 180000 && decode(text).length === REQUEST_FILTER_BYTES && encode(decode(text)) === text; } catch { return false; }
}
/** Keep recent exact results and the receipts that still prove NPC/TF origins. */
export function compactHistory(s: GameState): void {
  if (s.ledger.transactions.length <= HISTORY_WINDOW * 2) return;
  const receipts = [...(s.ledger.checkpoint?.evidence ?? []), ...s.ledger.transactions];
  const keepTF = new Set<string>();
  for (const body of [s.player.body, ...s.npcs.map(n => n.body), ...(s.district?.residents ?? []).map(n => n.body)]) for (const part of body?.parts ?? []) if (part.provenance) keepTF.add(part.provenance.tfInstanceId);
  const latest = new Set<string>();
  s.tfQueues = [...s.tfQueues].reverse().filter(job => {
    const key = `${entityKey(job.target)}/${job.definitionId}/${job.status}`;
    const keep = ['active', 'paused', 'blocked'].includes(job.status) || keepTF.has(job.instanceId) || !latest.has(key);
    latest.add(key); return keep;
  }).reverse();
  const needed = new Set(s.npcs.flatMap(n => n.memories.map(m => m.sourceRequestId)));
  for (const job of s.tfQueues) {
    const suffix = !job.target || job.target.kind === 'player' ? `/${job.definitionId}` : `/${entityKey(job.target)}/${job.definitionId}`;
    needed.add(job.idempotencyKey.slice(0, -suffix.length));
  }
  const retired = s.ledger.transactions.splice(0, s.ledger.transactions.length - HISTORY_WINDOW);
  const filter = s.ledger.checkpoint ? decode(s.ledger.checkpoint.requests) : new Uint8Array(REQUEST_FILTER_BYTES);
  for (const tx of retired) for (const p of positions(tx.requestId)) filter[p >>> 3] = filter[p >>> 3]! | (1 << (p & 7));
  const completed = new Set(s.ledger.checkpoint?.completedEvents ?? []);
  s.eventInstances = s.eventInstances.filter(e => { if (e.status !== 'completed') return true; completed.add(e.definitionId); delete s.rng.streams[`event:${e.instanceId}`]; return false; });
  const recent = new Set(s.ledger.transactions.map(t => t.requestId));
  s.ledger.checkpoint = { revision: retired.at(-1)!.result.revision, requests: encode(filter), evidence: receipts.filter(t => needed.has(t.requestId) && !recent.has(t.requestId)), completedEvents: [...completed].sort() };
  if (s.district) {
    const cutoff = Math.max(0, s.clock.totalMinutes - 10080), last = new Map<string, number>();
    s.district.storyletHistory = [...s.district.storyletHistory].reverse().filter(h => { if (last.has(h.id)) return false; last.set(h.id, h.at); return true; }).reverse();
    for (const resident of s.district.residents) resident.memories = resident.memories.filter(m => !/^(talk|help):\d+$/.test(m) || Number(m.split(':')[1]) * 1440 >= cutoff);
  }
}
