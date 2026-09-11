import type { GameAction } from '../engine/actions'
import type { GameState } from '../engine/game'
import type { Point } from '../engine/types'

/**
 * Ephemeral battle effects: the flash of a volley, the burst where it landed.
 *
 * Decoration, and deliberately kept that way — the log is the record, and a
 * player who has switched animation off (see the reduced-motion rule in
 * tokens.css) loses nothing but the flash. What it buys is the thing a tabletop
 * gives you for free: seeing *which* ship shot *which*, in a phase where a
 * dozen ships fire one after another and the log scrolls past faster than
 * anyone can read it.
 *
 * Effects are computed from an action and the state around it, never stored, so
 * they never ride in a save and never affect replay.
 */

export type FxKind = 'beam' | 'kinetic' | 'ordnance' | 'hit' | 'destroyed'

export interface BattleFx {
  id: string
  kind: FxKind
  from?: Point
  to: Point
  /** Milliseconds to wait before playing, so a barrage reads as sequential. */
  delay: number
}

let counter = 0

function id(): string {
  counter += 1
  return `fx-${counter}`
}

/**
 * Which effects an action is about to produce, sampled *before* it is applied.
 *
 * Firing needs the shooter's position from before the shot because a ship that
 * dies to return fire in the same phase would otherwise have nowhere to shoot
 * from.
 */
export function fxBefore(game: GameState, action: GameAction): BattleFx[] {
  switch (action.type) {
    case 'fire-weapon': {
      const shooter = game.ships.find((s) => s.id === action.shipId)
      const target = game.ships.find((s) => s.id === action.targetId)
      if (!shooter || !target) return []
      const weapon = shooter.design.weapons.find((w) => w.id === action.weaponId)
      return [
        {
          id: id(),
          kind: kindOf(weapon?.weaponClass),
          from: shooter.placement.position,
          to: target.placement.position,
          delay: 0,
        },
      ]
    }
    case 'fire-at-flight': {
      const shooter = game.ships.find((s) => s.id === action.shipId)
      const flight = game.fighterGroups.find((f) => f.id === action.flightId)
      if (!shooter || !flight) return []
      return [
        { id: id(), kind: 'beam', from: shooter.placement.position, to: flight.position, delay: 0 },
      ]
    }
    default:
      return []
  }
}

/**
 * Effects for what the action actually did, sampled after it is applied — a
 * burst on anything newly damaged, and a bigger one on anything newly dead.
 *
 * Takes the set of ships that were alive beforehand rather than diffing whole
 * states: the engine mutates in place, so there is no "before" object to diff
 * against.
 */
export function fxAfter(
  game: GameState,
  action: GameAction,
  aliveBefore: ReadonlySet<string>,
): BattleFx[] {
  const out: BattleFx[] = []
  for (const ship of game.ships) {
    if (ship.destroyed && aliveBefore.has(ship.id)) {
      out.push({ id: id(), kind: 'destroyed', to: ship.placement.position, delay: 260 })
    }
  }
  if (action.type === 'fire-weapon') {
    const target = game.ships.find((s) => s.id === action.targetId)
    if (target && !target.destroyed) {
      out.push({ id: id(), kind: 'hit', to: target.placement.position, delay: 220 })
    }
  }
  return out
}

/** Ships alive right now, for `fxAfter` to compare against. */
export function aliveShipIds(game: GameState): Set<string> {
  return new Set(game.ships.filter((ship) => !ship.destroyed).map((ship) => ship.id))
}

function kindOf(weaponClass: string | undefined): FxKind {
  switch (weaponClass) {
    case undefined:
      return 'beam'
    case 'k-gun':
    case 'mkp':
    case 'pulse-torpedo':
    case 'submunition-pack':
      return 'kinetic'
    case 'heavy-missile':
    case 'salvo-missile-rack':
    case 'salvo-missile-launcher':
    case 'antimatter-missile':
    case 'rocket-pod':
    case 'plasma-bolt-launcher':
      return 'ordnance'
    default:
      return 'beam'
  }
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

let queue: BattleFx[] = []
let base = 0
let baseReset = false
let prune: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function activeFx(): BattleFx[] {
  return queue
}

export function subscribeFx(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * Queue a burst of effects.
 *
 * When several volleys land in one synchronous sweep — a whole fleet firing in
 * initiative order — each is pushed behind the one before it, so a barrage
 * reads as sequential fire rather than as everything happening at once. The
 * stagger resets on the next microtask, which is the end of the sweep.
 */
export function queueFx(...groups: BattleFx[][]): void {
  const batch = groups.flat()
  if (batch.length === 0) return

  queue = [...queue, ...batch.map((fx) => ({ ...fx, delay: fx.delay + base }))]
  notify()

  const span = Math.max(...batch.map((fx) => fx.delay)) + 700
  // Stagger later volleys of the same burst, but never queue a minute of it.
  base = Math.min(base + span, 3600)
  if (!baseReset) {
    baseReset = true
    queueMicrotask(() => {
      base = 0
      baseReset = false
    })
  }

  if (prune) clearTimeout(prune)
  prune = setTimeout(() => {
    queue = []
    notify()
  }, base + 2500)
}

/** Drop everything queued — used when the battle is replaced or rewound. */
export function clearFx(): void {
  queue = []
  base = 0
  notify()
}
