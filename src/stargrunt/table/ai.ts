/**
 * Stargrunt II — the computer player's file. This is TABLE's stand-in only:
 * builder AI writes the real `aiAction` (move to cover and objectives, fire
 * by `planFire`'s odds, rally and reorganise with intent) in parallel, and
 * that file replaces this one whole at the round's merge, so nothing else
 * is exported from here.
 *
 * Until then this wraps `chooseAction` from `table/autoplay.ts` (round 2's
 * random legal-shaped mover) so a computer seat always has some legal
 * action to take next, and the table and its drive can be built and run
 * against a real opponent.
 */

import { chooseAction } from './autoplay'
import type { DiceStream } from '../dice'
import type { Action, GameState, SideId } from '../types'

/** The side `chooseAction` would move for, by the same reading it uses internally. */
function actingSide(state: GameState): SideId | null {
  if (state.result) return null
  if (state.phase === 'deployment') return !state.sides.north.ready ? 'north' : !state.sides.south.ready ? 'south' : null
  if (state.phase === 'turn-start') return state.chooser
  return state.toAct
}

/** The next action for `side`, or null once the battle is over or it is not `side`'s turn to act. */
export function aiAction(state: GameState, side: SideId, rng: DiceStream): Action | null {
  if (actingSide(state) !== side) return null
  return chooseAction(state, rng)
}
