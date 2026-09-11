/**
 * Scenarios and force setup.
 *
 * A scenario is data: a table, a list of sides, the force each starts with and
 * where it deploys, and the victory conditions. `startScenario` turns one into
 * a round-one `GameState`, which is the only thing a battle's setup needs to
 * name — everything after that is the action journal.
 */

import {
  createGame,
  createShipState,
  INTRODUCTORY_PHASES,
  type GameState,
  type SideId,
} from '../engine/game'
import type { Course, Point, ShipGroup } from '../engine/types'
import { designById } from './ships'

/** The table, in Measurement Units (2.1). A standard 6' × 4' table is 72 × 48. */
export interface TableSize {
  width: number
  height: number
}

/**
 * How a ship is worth points to the enemy at the end of the battle (4.12).
 * The introductory scenario's ladder, which the rulebook states in full and
 * which most Continuum scenarios reuse.
 */
export interface VictoryLadder {
  /** At least one hull box marked, less than two rows gone. */
  damaged: number
  /**
   * Two rows gone, OR no offensive weapons left (expendables do not count), OR
   * no FireCon left, OR no thrust left.
   */
  crippled: number
  /** Destroyed, or still cloaked when the game ends. */
  destroyed: number
  /** Disengaged by FTL or by leaving the board — worth full points. */
  disengaged: number
}

export const INTRODUCTORY_VICTORY: VictoryLadder = {
  damaged: 0.25,
  crippled: 0.5,
  destroyed: 1,
  disengaged: 1,
}

export interface ForceEntry {
  designId: string
  /** Ship name. Falls back to the class name plus an index. */
  name?: string
  position: Point
  facing: Course
  /** Starting velocity (3.1). Ships usually deploy with way on. */
  velocity?: number
}

export interface ScenarioSide {
  id: SideId
  name: string
  team?: string
  force: ForceEntry[]
}

export interface Scenario {
  id: string
  name: string
  /** One paragraph: the situation, as a briefing. */
  briefing: string
  /** The mission objective as the rulebook states it. */
  objective: string
  table: TableSize
  sides: ScenarioSide[]
  victory: VictoryLadder
  /** Turn limit, if the scenario states one (4.12: "6 rounds or 90 minutes"). */
  turnLimit?: number
  /** Restrict the sequence of play, as the introductory scenario does (2.6). */
  introductoryPhases?: boolean
  /** Hull groups the scenario allows, for a scenario that limits the force. */
  allowedGroups?: ShipGroup[]
}

// ---------------------------------------------------------------------------
// The introductory scenario (4.12)
// ---------------------------------------------------------------------------

/**
 * Deployment alternates: the lower die roll sets up a cruiser, then the higher,
 * and so on, then the same with the frigates (4.12). The engine does not model
 * that back-and-forth — it is a pre-game ritual, not a rule with consequences —
 * so both fleets deploy in a line facing each other, which is what alternating
 * placement converges on anyway.
 */
function line(
  designId: string,
  count: number,
  y: number,
  facing: Course,
  spread: { from: number; to: number },
  velocity: number,
): ForceEntry[] {
  const step = count > 1 ? (spread.to - spread.from) / (count - 1) : 0
  return Array.from({ length: count }, (_, i) => ({
    designId,
    position: { x: spread.from + step * i, y },
    facing,
    velocity,
  }))
}

export const INTRODUCTORY_SCENARIO: Scenario = {
  id: 'intro-fleet-engagement',
  name: 'Fleet Engagement',
  briefing:
    'Your forces have found the enemy and they are yours. Two heavy cruisers and three frigates ' +
    'a side, evenly matched, in open space with nothing to hide behind. Man battle stations, ' +
    'clear for action.',
  objective: 'Inflict more losses on your opponent than they inflict on you.',
  table: { width: 72, height: 48 },
  turnLimit: 6,
  introductoryPhases: true,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        ...line('intro-heavy-cruiser', 2, 10, 6, { from: 26, to: 46 }, 6),
        ...line('intro-frigate', 3, 5, 6, { from: 20, to: 52 }, 8),
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        ...line('intro-heavy-cruiser', 2, 38, 12, { from: 26, to: 46 }, 6),
        ...line('intro-frigate', 3, 43, 12, { from: 20, to: 52 }, 8),
      ],
    },
  ],
}

export const SCENARIOS: Scenario[] = [INTRODUCTORY_SCENARIO]

/**
 * A scenario designed in the app, embedded whole in a battle file so the save
 * replays on a machine that has never seen the design.
 */
let embeddedScenario: Scenario | null = null

export function setEmbeddedScenario(scenario: Scenario | null): void {
  embeddedScenario = scenario
}

export function scenarioById(id: string): Scenario | undefined {
  return (
    (embeddedScenario?.id === id ? embeddedScenario : undefined) ??
    SCENARIOS.find((s) => s.id === id)
  )
}

// ---------------------------------------------------------------------------
// Starting a battle
// ---------------------------------------------------------------------------

export interface StartOptions {
  seed: number
  /** Override the scenario's forces — "choose forces" and campaign battles. */
  forces?: Partial<Record<SideId, ForceEntry[]>>
}

/** Build the round-one game a scenario describes. */
export function startScenario(scenarioId: string, opts: StartOptions): GameState {
  const scenario = scenarioById(scenarioId)
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

  const ships = scenario.sides.flatMap((side) => {
    const force = opts.forces?.[side.id] ?? side.force
    // Hulls of the same class are numbered within their side, so a log line
    // says "Heavy Cruiser 2" rather than two ships with identical names.
    const counts = new Map<string, number>()
    return force.map((entry, index) => {
      const design = designById(entry.designId)
      if (!design) throw new Error(`Unknown ship design: ${entry.designId}`)
      const n = (counts.get(design.id) ?? 0) + 1
      counts.set(design.id, n)
      return createShipState({
        id: `${side.id}-${entry.designId}-${index + 1}`,
        side: side.id,
        design,
        placement: { position: entry.position, facing: entry.facing },
        velocity: entry.velocity ?? 0,
        name: entry.name ?? `${design.name} ${n}`,
      })
    })
  })

  return createGame({
    seed: opts.seed,
    scenario: scenario.id,
    // The introductory scenario plays phases 1, 2, 5, 11 and 13 only (2.6).
    phases: scenario.introductoryPhases ? INTRODUCTORY_PHASES : undefined,
    sides: scenario.sides.map((s) => ({ id: s.id, name: s.name, team: s.team })),
    ships,
  })
}
