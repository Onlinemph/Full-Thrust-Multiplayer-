import { useEffect } from 'react'

import type { GameState, ShipState } from '../engine/game'
import { shipsAwaitingOrders } from '../engine/actions'
import { dispatch, undo } from './store'

/**
 * Keyboard control.
 *
 * Writing orders means touching every ship on the table every turn — nine of
 * them in Line of Battle — and doing that through a mouse is the difference
 * between a game and a chore. The bindings are chosen so a whole turn can be
 * plotted without leaving the keyboard: cycle to a ship, turn it, set its
 * speed, next.
 *
 * Nothing here can do something the mouse cannot: every key ends in the same
 * `dispatch` as a click, so the journal does not care which was used.
 */
export interface KeyboardOptions {
  game: GameState
  selectedId: string | null
  onSelect: (shipId: string | null) => void
  /** Whether this console may give a ship orders. Absent means every ship. */
  canCommand?: (ship: ShipState) => boolean
  /** Whether a modal is open — shortcuts stand down while one is. */
  suspended?: boolean
  /**
   * The phase's one button — move the ships, roll the checks, end the phase —
   * with whatever asking the console does first.
   */
  onPrimary?: () => void
}

/**
 * Ships this console may give orders to, in a stable order for cycling.
 *
 * In phase 1, while any of ours still has no orders, Tab goes round those and
 * only those: the point of cycling is to get every sheet written, and a ship
 * already written for is a stop on the way to one that is not.
 */
function orderableShips(game: GameState, canCommand?: (ship: ShipState) => boolean): ShipState[] {
  const mine = game.ships.filter(
    (ship) => !ship.destroyed && !ship.offTable && (canCommand?.(ship) ?? true),
  )
  if (game.phase === 'orders') {
    const owed = shipsAwaitingOrders(game).filter((ship) => canCommand?.(ship) ?? true)
    if (owed.length > 0) return owed
  }
  return mine
}

export function useKeyboard({
  game,
  selectedId,
  onSelect,
  canCommand,
  suspended,
  onPrimary,
}: KeyboardOptions): void {
  useEffect(() => {
    if (suspended) return

    const onKey = (event: KeyboardEvent): void => {
      // Never steal a key from a text field: the seed box and the remote-play
      // code boxes are both places where "u" must mean the letter u.
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const ships = orderableShips(game, canCommand)
      const index = ships.findIndex((ship) => ship.id === selectedId)
      // The arrows write on whichever ship is selected, cycled to or not —
      // but only on one of ours.
      const chosen = game.ships.find((candidate) => candidate.id === selectedId)
      const ship = chosen !== undefined && (canCommand?.(chosen) ?? true) ? chosen : undefined

      switch (event.key) {
        // ── Selection ─────────────────────────────────────────────────────
        case 'n':
        case 'Tab': {
          if (ships.length === 0) break
          event.preventDefault()
          const step = event.shiftKey ? -1 : 1
          onSelect(ships[(index + step + ships.length) % ships.length].id)
          break
        }
        case 'Escape':
          onSelect(null)
          break

        // ── Orders (3.5) ──────────────────────────────────────────────────
        // Arrows because a course change IS a direction, and left/right is the
        // only mapping nobody has to learn.
        case 'ArrowLeft':
          if (!ship) break
          event.preventDefault()
          dispatch({
            type: 'plot-turn',
            shipId: ship.id,
            direction: 'port',
            points: (ship.order?.turn?.direction === 'port' ? ship.order.turn.points : 0) + 1,
          })
          break
        case 'ArrowRight':
          if (!ship) break
          event.preventDefault()
          dispatch({
            type: 'plot-turn',
            shipId: ship.id,
            direction: 'starboard',
            points: (ship.order?.turn?.direction === 'starboard' ? ship.order.turn.points : 0) + 1,
          })
          break
        case 'ArrowUp':
          if (!ship) break
          event.preventDefault()
          dispatch({ type: 'plot-accel', shipId: ship.id, accel: (ship.order?.accel ?? 0) + 1 })
          break
        case 'ArrowDown':
          if (!ship) break
          event.preventDefault()
          dispatch({ type: 'plot-accel', shipId: ship.id, accel: (ship.order?.accel ?? 0) - 1 })
          break
        case 'Backspace':
          if (!ship) break
          event.preventDefault()
          dispatch({ type: 'clear-order', shipId: ship.id })
          break

        // ── The turn ──────────────────────────────────────────────────────
        case ' ':
        case 'Enter':
          event.preventDefault()
          // Through the same door the button uses, so a phase with optional
          // work left is asked about from the keyboard too, and a phase with
          // a resolution to run runs it.
          if (onPrimary) onPrimary()
          else dispatch({ type: 'advance-phase' })
          break
        case 'u':
          undo()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, selectedId, onSelect, canCommand, suspended, onPrimary])
}

/** The bindings, for the help panel. Kept beside them so they cannot drift. */
export const KEY_HELP: Array<[keys: string, does: string]> = [
  ['Tab / N', 'Next ship — in phase 1, the next one still without orders'],
  ['← →', 'Turn to port or starboard, one clock point at a time'],
  ['↑ ↓', 'Accelerate or decelerate'],
  ['Backspace', 'Clear the order'],
  ['Enter / Space', 'The phase’s button: move the ships, roll the checks, end the phase'],
  ['U', 'Undo'],
  ['Esc', 'Deselect'],
]
