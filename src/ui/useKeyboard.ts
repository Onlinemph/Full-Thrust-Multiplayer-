import { useEffect } from 'react'

import type { GameState, ShipState } from '../engine/game'
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
  /** Whether a modal is open — shortcuts stand down while one is. */
  suspended?: boolean
}

/** Ships this console may give orders to, in a stable order for cycling. */
function orderableShips(game: GameState): ShipState[] {
  return game.ships.filter((ship) => !ship.destroyed && !ship.offTable)
}

export function useKeyboard({ game, selectedId, onSelect, suspended }: KeyboardOptions): void {
  useEffect(() => {
    if (suspended) return

    const onKey = (event: KeyboardEvent): void => {
      // Never steal a key from a text field: the seed box and the remote-play
      // code boxes are both places where "u" must mean the letter u.
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const ships = orderableShips(game)
      const index = ships.findIndex((ship) => ship.id === selectedId)
      const ship = index >= 0 ? ships[index] : undefined

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
          dispatch({ type: 'advance-phase' })
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
  }, [game, selectedId, onSelect, suspended])
}

/** The bindings, for the help panel. Kept beside them so they cannot drift. */
export const KEY_HELP: Array<[keys: string, does: string]> = [
  ['Tab / N', 'Next ship (Shift for the previous one)'],
  ['← →', 'Turn to port or starboard, one clock point at a time'],
  ['↑ ↓', 'Accelerate or decelerate'],
  ['Backspace', 'Clear the order'],
  ['Space', 'End the phase'],
  ['U', 'Undo'],
  ['Esc', 'Deselect'],
]
