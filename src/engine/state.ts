import type { GameState } from '../core/types.ts';
import { clone } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
export function createGameState(registry: Registry, seed: number): GameState {
  return {
    meta: { schemaVersion: 1, engineVersion: '0.1', revision: 0, packs: clone(registry.packs) },
    clock: { totalMinutes: registry.start.minutes, crossedDays: [] },
    world: { locationId: registry.start.locationId, knownLocationIds: [registry.start.locationId] },
    player: { variables: Object.fromEntries(registry.variables.map(x => [x.id, x.initial])), flags: Object.fromEntries(registry.flags.map(x => [x.id, x.initial])) },
    eventInstances: [], activeEventStack: [], rng: { seed: seed >>> 0, streams: {} }, ledger: { transactions: [] },
  };
}
