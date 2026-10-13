import type { GameState } from '../core/types.ts';
import { clone } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { loadPacks } from '../content/loader.ts';
import { compileWorldScenes } from '../world/scenes.ts';
import { compileCombatEncounters } from '../world/combat-encounters.ts';
import { UX_PREDECESSOR } from './ux-predecessor.ts';
import { normalizePlayerFlags } from './vars-migration.ts';

/** Upgrade only the exact predecessor. Never re-roll an existing world. */
export async function upgradeUXContent(raw: GameState, installed: Registry): Promise<{state:GameState;registry:Registry}|undefined> {
  const before = raw.meta.packs.find(p=>p.id===UX_PREDECESSOR.id);
  const after = installed.packs.find(p=>p.id===UX_PREDECESSOR.id);
  if (!before||!after||before.hash!==UX_PREDECESSOR.hash||before.version!==UX_PREDECESSOR.version||after.hash===before.hash) return;
  const state = clone(raw);
  let registry = installed;
  if (state.worldInstance) {
    const packs = clone(state.worldInstance.definition.packs);
    const index = packs.findIndex(p=>p.manifest.id===UX_PREDECESSOR.id);
    packs[index] = clone(installed.contentPacks.find(p=>p.manifest.id===UX_PREDECESSOR.id)!);
    const generated = packs.find(p=>p.manifest.id==='generated/neighborhood')!;
    if (!generated.narrativeNodes?.some(n=>n.id.startsWith('worldgen:node.scene.'))) {
      compileCombatEncounters(generated,state.worldInstance.definition,installed);
      state.worldInstance.definition.eventPool=[...new Set([...state.worldInstance.definition.eventPool,...generated.events.filter(e=>e.id.startsWith('worldgen:event.danger.')).map(e=>e.id)])];
      compileWorldScenes(generated,state.worldInstance.definition,installed);
    }
    registry = await loadPacks(packs);
    state.worldInstance.definition.packs = clone(registry.contentPacks);
    state.worldInstance.generation.contentPacks = state.worldInstance.generation.contentPacks.map(p=>p.id===before.id?clone(after):p);
  } else if (!state.meta.packs.every(p=>p.id===before.id||installed.packs.some(n=>n.id===p.id&&n.hash===p.hash&&n.version===p.version)) || state.meta.packs.length!==installed.packs.length) return;
  state.meta.packs = clone(registry.packs); normalizePlayerFlags(state,registry);
  if(state.adventure?.story)state.adventure.story.opponentName=state.adventure.story.opponentName.replaceAll('人类占位','人类对手').replaceAll('野兽占位','野兽').replaceAll('怪物占位','异形生物');
  return {state,registry};
}
