/**
 * Which hulls a view may draw — the same rule `MapView`'s own private
 * `visible()` applies, in one place every 3D layer can share instead of each
 * reimplementing 7.20's fog.
 *
 * A hull off the table has no counter on it (11.5's inbound ships and 11.9's
 * ships waiting behind a gate belong to their phase's panel, not the board).
 * A cloaked ship is a ghost to its own side and invisible to the enemy; on
 * the open table — hot-seat, nobody hiding anything — everything is drawn.
 *
 * Kept in sync with `MapView.tsx`'s `visible()` by hand: if that rule ever
 * changes, this one has to change with it.
 */
import type { GameState, ShipState } from '../../engine/game'

export function shipVisible(ship: ShipState, viewingSide: string | null): boolean {
  if (ship.offTable) return false
  if (viewingSide === null) return true
  if (!ship.cloaked) return true
  return ship.side === viewingSide
}

export function visibleShips(game: GameState, viewingSide: string | null): ShipState[] {
  return game.ships.filter((ship) => shipVisible(ship, viewingSide))
}
