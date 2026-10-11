import { initialDistrict } from './district.ts';
import type { GameState } from '../core/types.ts';
import { clone } from '../core/types.ts';
import { instantiateBody } from './body.ts';
import { createNPCStates } from './npc.ts';
import type { Registry } from '../content/registry.ts';
export function createGameState(registry: Registry, seed: number): GameState {
  return {
    ...(registry.storylets.length ? { district: initialDistrict() } : {}),
    meta: { schemaVersion: 3, engineVersion: '0.1-stage3', revision: 0, packs: clone(registry.packs) },
    clock: { totalMinutes: registry.start.minutes, crossedDays: [] },
    world: { locationId: registry.start.locationId, knownLocationIds: [registry.start.locationId] },
    player: { variables: Object.fromEntries(registry.variables.map(x => [x.id, x.initial])), flags: Object.fromEntries(registry.flags.map(x => [x.id, x.initial])), body: registry.bodyTemplates.find(x => x.initial) ? instantiateBody(registry.bodyTemplates.find(x => x.initial)!) : null },
    npcs: createNPCStates(registry), tfQueues: [], eventInstances: [], activeEventStack: [], rng: { seed: seed >>> 0, streams: {} }, ledger: { transactions: [] },
  };
}
