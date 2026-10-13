import { initialDistrict } from './district.ts';
import type { GameState } from '../core/types.ts';
import { clone } from '../core/types.ts';
import { instantiateBody } from './body.ts';
import { createNPCStates } from './npc.ts';
import type { Registry } from '../content/registry.ts';
import { initialAdventure } from './narrative.ts';
export function createGameState(registry: Registry, seed: number): GameState {
  return {
    ...(registry.narrativeNodes.length?{adventure:{...initialAdventure(),daily:{'world.day':Math.floor(registry.start.minutes/1440)}}}:{}),
    ...(registry.storylets.length ? { district: initialDistrict() } : {}),
    meta: { schemaVersion: registry.contentPacks.some(p=>p.manifest.schemaVersion===2)?4:3, engineVersion: registry.contentPacks.some(p=>p.manifest.schemaVersion===2)?'0.2-foundation':'0.1-stage3', revision: 0, packs: clone(registry.packs) },
    clock: { totalMinutes: registry.start.minutes, crossedDays: [] },
    world: { locationId: registry.start.locationId, knownLocationIds: [registry.start.locationId] },
    player: { variables: Object.fromEntries(registry.variables.map(x => [x.id, x.initial])), flags: Object.fromEntries(registry.flags.map(x => [x.id, x.initial])), body: registry.bodyTemplates.find(x => x.initial) ? instantiateBody(registry.bodyTemplates.find(x => x.initial)!) : null },
    ...(registry.contentPacks.some(p=>p.manifest.schemaVersion===2)?{environment:{}}:{}),
    npcs: createNPCStates(registry), tfQueues: [], eventInstances: [], activeEventStack: [], rng: { seed: seed >>> 0, streams: {} }, ledger: { transactions: [] },
  };
}
