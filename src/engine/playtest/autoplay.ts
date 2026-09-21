import { aiActions } from '../ai'
import { applyAction, type GameAction } from '../actions'
import type { GameState } from '../game'
import { damageLevelOf } from '../victory'
import { buildGame, type GameSetup, type SavedGame } from '../../data/savedGame'
import { TABLE_SWEEPS } from './harness'

/**
 * A battle the computers fight among themselves, kept as a battle file.
 *
 * The playtest harness drives a battle to keep referee's books; this drives
 * one to keep the journal. Every side is flown by the computer, every phase
 * is ended once nobody has anything left to do, and what comes back is
 * `(setup + actions)` — the same file a battle fought at the console
 * produces, so whoever asked for the battle can replay it, read its log, or
 * fold its end state back into a campaign the way a played battle is.
 *
 * It stops when the scenario's turn limit is passed or one side has nothing
 * fit to fight with (4.12), whichever is first, and never later than
 * `maxTurns`.
 */
export function autoplay(setup: GameSetup, opts: { maxTurns?: number } = {}): SavedGame {
  const game = buildGame(setup)
  const actions: GameAction[] = []
  const sides = game.sides.map((side) => side.id)
  const limit = Math.min(opts.maxTurns ?? 20, setup.customScenario?.turnLimit ?? Number.POSITIVE_INFINITY)

  const apply = (action: GameAction): boolean => {
    const outcome = applyAction(game, action)
    if (outcome.refused !== undefined) return false
    actions.push(action)
    return true
  }

  let guard = (opts.maxTurns ?? 20) * 40
  while (game.turn <= limit && !decided(game) && guard-- > 0) {
    const phase = game.phase
    for (let round = 0; round < 60; round += 1) {
      let progressed = false
      for (const side of sides) {
        for (const action of aiActions(game, side)) if (apply(action)) progressed = true
      }
      if (!progressed) break
    }
    for (const action of TABLE_SWEEPS[phase] ?? []) apply(action)
    if (!apply({ type: 'advance-phase' })) {
      // A phase that still owes something: the computers get one more go,
      // and if the phase will not end after that the battle is left where
      // it is rather than looped on.
      for (const side of sides) for (const action of aiActions(game, side)) apply(action)
      if (!apply({ type: 'advance-phase' })) break
    }
  }
  return { version: 1, setup, actions }
}

/** One side has nothing left that can fight (4.12), once the first turn is done. */
function decided(game: GameState): boolean {
  if (game.turn <= 1) return false
  const standing = new Set<string>()
  for (const ship of game.ships) {
    const level = damageLevelOf(ship)
    if (level === 'unhurt' || level === 'damaged') standing.add(ship.side)
  }
  return standing.size <= 1
}
