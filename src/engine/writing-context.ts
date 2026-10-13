import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { band } from './numerics.ts';
import { transformPerception } from './transform-perception.ts';

/** 倾向只注入文风 tone；永不硬锁玩法。 */
export function writingContext(s: GameState, r: Registry) {
  const event = s.eventInstances.find(x => x.instanceId === s.activeEventStack.at(-1));
  const slot = event ? r.textSlots.find(x => x.owner.eventId === event.definitionId && x.owner.nodeId === event.nodeId) : undefined;
  if (!slot) throw Error('当前节点没有开放写作槽。');
  const v = s.player.variables;
  const scene = s.district?.scene ?? null;
  const tone = {
    desire: band(v['core:desire'] ?? 0),
    submission: band(v['core:submissionTendency'] ?? 0),
    stress: band(v['core:stress'] ?? 0),
    confidence: band(v['core:confidence'] ?? 50),
    affection: band(v['core:affection'] ?? 0),
    trust: band(v['core:trust'] ?? 0),
    aftertaste: band(v['core:aftertaste'] ?? 0),
    transformPerception: band(transformPerception(s, r)),
    scene: scene
      ? {
          arousal: scene.arousal,
          restraint: scene.restraint,
          arousalBand: band(scene.arousal),
          restraintBand: band(scene.restraint),
        }
      : null,
  };
  return {
    format: 'aetheria-writing-context',
    version: '0.2.1',
    slotId: slot.id,
    owner: slot.owner,
    time: s.clock.totalMinutes,
    locationId: s.world.locationId,
    player: { profile: s.district?.profile, body: s.player.body, equipped: s.district?.equipped, tf: s.tfQueues },
    participants: slot.participants.filter(id => id !== 'player').map(id => ({ definition: r.npc(id as `${string}:${string}`), state: s.npcs.find(n => n.definitionId === id) })),
    facts: slot.requiredFacts.map(id => ({ id, value: s.player.flags[id] })),
    scene,
    tone,
    allowedReplacement: slot.allowedReplacement,
    allowedVariables: slot.allowedVariables,
    nextNodeId: slot.nextNodeId,
    forbidInventing: ['effects', 'rewards', 'body changes', 'new contact', 'new consent', 'relationship stages'],
  };
}
