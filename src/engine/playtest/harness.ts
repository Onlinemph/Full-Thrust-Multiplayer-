import { buildGame, CURRENT_RULES_VERSION } from '../../data/savedGame'
import { aiActions } from '../ai'
import { applyAction, shipsAwaitingMovement, type GameAction } from '../actions'
import { canShipFire, type GameState } from '../game'
import { distance } from '../geometry'

/**
 * A battle played end to end with nobody at the table (2.6).
 *
 * The unit tests check a rule at a time; this plays whole battles between
 * whole fleets and keeps the books a referee would: what was fired, what it
 * did, what the computer asked for that the engine refused, and whether the
 * sequence of play ever stopped. A refusal is the interesting number — every
 * one is the computer's copy of the rules disagreeing with the engine's — and
 * a weapon class that is on the table and never fired is a gun the computer
 * has not been taught.
 */

export type SideId = 'a' | 'b'

export interface BattleSpec {
  /** Design ids for each side, laid on the Line of Battle stations. */
  a: readonly string[]
  b: readonly string[]
  seed: number
  /** Turns to play before the battle is called. */
  turns: number
  /** A side that holds course and its fire, for measuring the other. */
  passive?: SideId
  rulesVersion?: number
}

export interface Refusal {
  type: string
  side: SideId | null
  turn: number
  phase: string
  text: string
  weaponClass?: string
  action: GameAction
}

export interface BattleReport {
  spec: BattleSpec
  turns: number
  /** Where the sequence stopped, if it did. */
  stuck: string | null
  /** Weapon classes on the computer's ships at the start. */
  present: string[]
  /** Shots and launches by weapon class, from the actions taken. */
  fired: Record<string, number>
  /** Actions of a class that marked at least one box. */
  hits: Record<string, number>
  /** Boxes marked, credited to the classes the marking action fired. */
  damage: Record<string, number>
  refusals: Refusal[]
  /** Damage taken by each side, in boxes. */
  taken: Record<SideId, number>
  lost: Record<SideId, number>
  /** Points of hull destroyed on each side. */
  pointsLost: Record<SideId, number>
  /** Closest opposing hulls at the end of each turn's movement. */
  closest: number[]
  /** Turns in which nobody marked a box. */
  quietTurns: number
  log: string[]
  /**
   * The after-action ledger agrees with the damage tracks: every hull box a
   * ship shows marked is a box the ledger says was marked on it. False means
   * a damage path the ledger does not hear about.
   */
  ledgerOk: boolean
}

export const TABLE_SWEEPS: Partial<Record<string, GameAction[]>> = {
  initiative: [{ type: 'roll-initiative' }],
  threshold: [{ type: 'threshold-sweep' }],
  'damage-control': [{ type: 'resolve-damage-control' }],
  boarding: [{ type: 'resolve-boarding' }],
  'reactor-explosions': [{ type: 'resolve-reactor-explosions' }],
}

function marksOf(game: GameState, side: SideId): number {
  let total = 0
  for (const ship of game.ships) {
    if (ship.side !== side) continue
    total += ship.hullMarked + ship.armourMarked.reduce((sum, n) => sum + n, 0)
    if (ship.destroyed) total += Math.max(0, ship.design.hullBoxes - ship.hullMarked)
  }
  return total
}

function lostOf(game: GameState, side: SideId): { ships: number; points: number } {
  let ships = 0
  let points = 0
  for (const ship of game.ships) {
    if (ship.side !== side || !ship.destroyed) continue
    ships += 1
    points += ship.design.points
  }
  return { ships, points }
}

function closestOpposing(game: GameState): number {
  let best = Number.POSITIVE_INFINITY
  const live = game.ships.filter((ship) => !ship.destroyed && !ship.offTable)
  for (const one of live) {
    for (const other of live) {
      if (one.side === other.side) continue
      best = Math.min(best, distance(one.placement.position, other.placement.position))
    }
  }
  return best
}

function weaponClassOf(game: GameState, shipId: string, weaponId: string): string | undefined {
  const ship = game.ships.find((candidate) => candidate.id === shipId)
  const weapon = ship?.design.weapons.find((candidate) => candidate.id === weaponId)
  if (weapon) return weapon.weaponClass
  const system = ship?.design.systems.find((candidate) => candidate.id === weaponId)
  return system?.kind
}

/** The weapon classes an action reaches for, for the tally. */
function classesFired(game: GameState, action: GameAction): string[] {
  switch (action.type) {
    case 'fire-volley':
      return action.shots
        .map((shot) => weaponClassOf(game, action.shipId, shot.weaponId))
        .filter((cls): cls is string => cls !== undefined)
    case 'fire-weapon':
    case 'fire-spinal-mount':
    case 'fire-wave-gun':
    case 'fire-nova-cannon':
    case 'launch-ordnance':
    case 'fire-rocket-pod':
    case 'launch-plasma-bolt':
    case 'fire-flak-barrage':
    case 'fire-shaped-charge':
    case 'commando-raid':
    case 'fire-at-flight':
    case 'fire-at-gunboats':
    case 'fire-at-terrain':
    case 'fire-at-gate': {
      const cls = weaponClassOf(game, action.shipId, action.weaponId)
      return cls ? [cls] : []
    }
    case 'fire-point-defence': {
      const cls = weaponClassOf(game, action.shipId, action.systemId)
      return cls ? [cls] : []
    }
    case 'plot-mines':
      return ['mine-rack']
    case 'flight-strike':
    case 'flight-launch-payload':
    case 'flight-boarding-run':
    case 'flight-press-attack':
    case 'flight-ace-needle':
    case 'launch-flight-missiles':
      return ['fighters']
    case 'gunboat-attack':
      return ['gunboats']
    default:
      return []
  }
}

/** What a side that is not playing does: hold course, hold fire. */
function passiveActions(game: GameState, side: SideId): GameAction[] {
  const mine = game.ships.filter((ship) => ship.side === side && !ship.destroyed && !ship.offTable)
  switch (game.phase) {
    case 'orders':
      return mine.filter((ship) => ship.order === null).map((ship) => ({ type: 'plot-accel', shipId: ship.id, accel: 0 }))
    case 'move-ships':
      return shipsAwaitingMovement(game)
        .filter((ship) => ship.side === side)
        .map((ship) => ({ type: 'move-ship', shipId: ship.id }))
    case 'ship-fire': {
      if (game.fire.side !== null && game.fire.side !== side) return []
      const ship = mine.find((candidate) => canShipFire(candidate) && !candidate.captured)
      return ship ? [{ type: 'pass-fire', shipId: ship.id }] : []
    }
    default:
      return []
  }
}

export function presentClasses(game: GameState, sides: readonly SideId[]): string[] {
  const classes = new Set<string>()
  for (const ship of game.ships) {
    if (!sides.includes(ship.side as SideId)) continue
    for (const weapon of ship.design.weapons) classes.add(weapon.weaponClass)
    if (game.fighterGroups.some((group) => group.carrierId === ship.id)) classes.add('fighters')
    if (game.gunboatSquadrons.some((squadron) => squadron.carrierId === ship.id)) classes.add('gunboats')
  }
  return [...classes].sort()
}

export function playBattle(spec: BattleSpec): BattleReport {
  const game = buildGame({
    scenarioId: 'line-of-battle',
    seed: spec.seed,
    rulesVersion: spec.rulesVersion ?? CURRENT_RULES_VERSION,
    forces: { a: [...spec.a], b: [...spec.b] },
    battleType: 'none',
    tableScale: 1,
  })
  const sides: SideId[] = ['a', 'b']
  const players = sides.filter((side) => side !== spec.passive)
  const report: BattleReport = {
    spec,
    turns: 0,
    stuck: null,
    present: presentClasses(game, players),
    fired: {},
    hits: {},
    damage: {},
    refusals: [],
    taken: { a: 0, b: 0 },
    lost: { a: 0, b: 0 },
    pointsLost: { a: 0, b: 0 },
    closest: [],
    quietTurns: 0,
    log: [],
    ledgerOk: true,
  }
  const marks: Record<SideId, number> = { a: marksOf(game, 'a'), b: marksOf(game, 'b') }
  let turnDamage = 0

  /** Book the marks moved since the last call, crediting `classes` with them. */
  const settle = (classes: readonly string[] | null): void => {
    let moved = 0
    for (const side of sides) {
      const now = marksOf(game, side)
      const delta = now - marks[side]
      if (delta > 0) {
        report.taken[side] += delta
        turnDamage += delta
        moved += delta
      }
      marks[side] = now
    }
    if (moved > 0 && classes !== null && classes.length > 0) {
      const each = moved / classes.length
      for (const cls of new Set(classes)) {
        report.hits[cls] = (report.hits[cls] ?? 0) + 1
        report.damage[cls] = (report.damage[cls] ?? 0) + each * classes.filter((c) => c === cls).length
      }
    }
  }

  const apply = (action: GameAction, side: SideId | null): boolean => {
    const classes = classesFired(game, action)
    const outcome = applyAction(game, action)
    if (outcome.refused !== undefined) {
      report.refusals.push({
        type: action.type,
        side,
        turn: game.turn,
        phase: game.phase,
        text: outcome.refused,
        weaponClass: classes[0],
        action,
      })
      return false
    }
    for (const cls of classes) report.fired[cls] = (report.fired[cls] ?? 0) + 1
    settle(classes.length > 0 ? classes : action.type === 'resolve-ordnance-attacks' ? ['missiles'] : null)
    return true
  }

  let guard = spec.turns * 40
  let turn = game.turn
  while (game.turn <= spec.turns && guard-- > 0) {
    if (game.turn !== turn) {
      if (turnDamage === 0) report.quietTurns += 1
      turnDamage = 0
      turn = game.turn
    }
    const phase = game.phase
    // Each side is asked again while its last answer got something taken,
    // which is how the console driving the computer works: phase 11 hands
    // out one ship an ask, and a planner is expected to have nothing more to
    // say once its work is done.
    for (let round = 0; round < 60; round += 1) {
      let progressed = false
      for (const side of sides) {
        const actions = players.includes(side) ? aiActions(game, side) : passiveActions(game, side)
        for (const action of actions) if (apply(action, side)) progressed = true
      }
      if (!progressed) break
    }
    for (const action of TABLE_SWEEPS[phase] ?? []) apply(action, null)
    if (phase === 'move-ships') report.closest.push(Math.round(closestOpposing(game) * 10) / 10)
    let advanced = applyAction(game, { type: 'advance-phase' })
    if (advanced.refused !== undefined) {
      for (const side of sides) {
        const actions = players.includes(side) ? aiActions(game, side) : passiveActions(game, side)
        for (const action of actions) apply(action, side)
      }
      for (const action of TABLE_SWEEPS[phase] ?? []) apply(action, null)
      advanced = applyAction(game, { type: 'advance-phase' })
    }
    if (advanced.refused !== undefined) {
      report.stuck = `turn ${game.turn}, ${phase}: ${advanced.refused}`
      break
    }
    settle(null)
  }
  report.turns = Math.min(game.turn, spec.turns)
  for (const side of sides) {
    const lost = lostOf(game, side)
    report.lost[side] = lost.ships
    report.pointsLost[side] = lost.points
  }
  report.log = game.log.map((entry) => `T${entry.turn} ${entry.phase}: ${entry.text}`)
  report.ledgerOk = game.ships.every((ship) => {
    const hull = game.ledger.damage
      .filter((record) => record.targetId === ship.id)
      .reduce((sum, record) => sum + record.hull, 0)
    return hull === ship.hullMarked
  })
  return report
}

/** Everything the roster fields for a faction, once each. */
export function factionFleet(designs: readonly { id: string; faction: string; group?: string }[], faction: string): string[] {
  return designs.filter((design) => design.faction === faction).map((design) => design.id)
}
