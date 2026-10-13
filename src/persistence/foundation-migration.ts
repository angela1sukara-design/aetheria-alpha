import type { GameState, Id } from '../core/types.ts';
import { clone } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { initialNPCBody } from '../engine/npc.ts';
import { normalizeSceneTemps } from './vars-migration.ts';
/** 确定性添加 v4 字段。历史场景图只作旧版验收证据，绝不提升为 NPC 永久身体。 */
export function upgradeFoundation(raw:GameState,r:Registry):GameState {
  const s=clone(raw);s.meta.schemaVersion=4;s.meta.engineVersion='0.2-foundation';s.environment??={};
  for(const n of s.npcs)if(!Object.hasOwn(n,'body'))n.body=initialNPCBody(r,n.definitionId);
  const scene=s.district?.scene;
  if(scene){for(const a of scene.actors){a.entity=a.id==='player'?{kind:'player'}:{kind:'npc',id:a.id as Id};delete a.body;}if(!s.npcs.find(n=>n.definitionId===scene.actors[1]?.id)?.body){scene.phase='paused';scene.contacts=[];}}normalizeSceneTemps(s);
  return s;
}
/** 增量包只能新增声明，不可换掉旧包。原版本和哈希逐个核对，明确添加新哈希。 */
export function foundationAddition(raw:GameState,r:Registry):boolean {
  return raw.meta.packs.every(ref=>r.packs.some(p=>p.id===ref.id&&p.version===ref.version&&p.hash===ref.hash))
    &&r.packs.filter(p=>!raw.meta.packs.some(ref=>ref.id===p.id)).every(ref=>r.contentPacks.find(p=>p.manifest.id===ref.id)?.manifest.id==='aetheria/foundation');
}
