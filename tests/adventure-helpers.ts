import type { GameState } from '../src/core/types.ts';
import { initialAdventure } from '../src/engine/narrative.ts';
/** Quest graph fixtures isolate branch/restore checks from progression, which has its own real-action tests. */
export function prepareMilestones(state:GameState):void {
  state.adventure??=initialAdventure();
  Object.assign(state.adventure,{assets:6,orders:3,contracts:2,influence:5,safety:5});
  state.adventure.victories['progression:enemy.raider']=2;
}
