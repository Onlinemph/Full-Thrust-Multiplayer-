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
  type FighterGroupState,
  type GameState,
  type GunboatSquadronState,
  type ShipState,
  type SideId,
} from '../engine/game'
import {
  createFighterGroup,
  FIGHTER_TYPES,
  type FighterTypeId,
} from '../engine/fighters'
import {
  createGunboatSquadron,
  GUNBOAT_SQUADRON_SIZE,
  GUNBOAT_TYPES,
  type GunboatTypeId,
} from '../engine/gunboats'
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

/**
 * A cruiser action on a disputed frontier — the fight the two fleets' own
 * designs are built for, and the first scenario worth playing once the
 * introductory battle has taught the sequence.
 */
export const BORDER_SKIRMISH: Scenario = {
  id: 'border-skirmish',
  name: 'Border Skirmish',
  briefing:
    'A survey convoy went quiet three days ago on a frontier neither government admits to ' +
    'claiming. Both navies sent a cruiser division to find out why, and both arrived at once. ' +
    'Nobody has declared anything. Somebody is about to.',
  objective: 'Break the enemy division. Points are scored on what you cripple, not what you chase off.',
  table: { width: 72, height: 48 },
  turnLimit: 10,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        { designId: 'esu-heavy-cruiser', position: { x: 30, y: 10 }, facing: 6, velocity: 6 },
        { designId: 'esu-light-cruiser', position: { x: 42, y: 10 }, facing: 6, velocity: 6 },
        { designId: 'esu-destroyer', position: { x: 22, y: 6 }, facing: 6, velocity: 8 },
        { designId: 'esu-destroyer', position: { x: 50, y: 6 }, facing: 6, velocity: 8 },
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        { designId: 'nac-heavy-cruiser', position: { x: 42, y: 38 }, facing: 12, velocity: 6 },
        { designId: 'nac-light-cruiser', position: { x: 30, y: 38 }, facing: 12, velocity: 6 },
        { designId: 'nac-destroyer', position: { x: 50, y: 42 }, facing: 12, velocity: 8 },
        { designId: 'nac-destroyer', position: { x: 22, y: 42 }, facing: 12, velocity: 8 },
      ],
    },
  ],
}

/**
 * The line of battle: both fleets in full, carriers included. Long, and the
 * scenario where the fifteen-phase sequence earns its length.
 */
export const LINE_OF_BATTLE: Scenario = {
  id: 'line-of-battle',
  name: 'Line of Battle',
  briefing:
    'No more deniability and no more frontier incidents. Two battle fleets in open space, each ' +
    'built around a battleship and a carrier, with the escorts they have spent a decade arguing ' +
    'about. Whatever is left of these ships decides the war.',
  objective: 'Destroy the enemy fleet. Every hull that disengages is worth full points to them.',
  table: { width: 96, height: 72 },
  turnLimit: 14,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        { designId: 'esu-battleship', position: { x: 40, y: 14 }, facing: 6, velocity: 4 },
        { designId: 'esu-carrier', position: { x: 56, y: 12 }, facing: 6, velocity: 4 },
        { designId: 'esu-tender', position: { x: 46, y: 4 }, facing: 6, velocity: 4 },
        { designId: 'esu-battlecruiser', position: { x: 24, y: 14 }, facing: 6, velocity: 6 },
        { designId: 'esu-heavy-cruiser', position: { x: 66, y: 16 }, facing: 6, velocity: 6 },
        { designId: 'esu-light-cruiser', position: { x: 14, y: 16 }, facing: 6, velocity: 6 },
        { designId: 'esu-destroyer', position: { x: 32, y: 8 }, facing: 6, velocity: 8 },
        { designId: 'esu-destroyer', position: { x: 48, y: 8 }, facing: 6, velocity: 8 },
        { designId: 'esu-frigate', position: { x: 20, y: 6 }, facing: 6, velocity: 8 },
        { designId: 'esu-frigate', position: { x: 60, y: 6 }, facing: 6, velocity: 8 },
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        { designId: 'nac-battleship', position: { x: 56, y: 58 }, facing: 12, velocity: 4 },
        { designId: 'nac-carrier', position: { x: 40, y: 60 }, facing: 12, velocity: 4 },
        { designId: 'nac-tender', position: { x: 50, y: 68 }, facing: 12, velocity: 4 },
        { designId: 'nac-battlecruiser', position: { x: 72, y: 58 }, facing: 12, velocity: 6 },
        { designId: 'nac-heavy-cruiser', position: { x: 30, y: 56 }, facing: 12, velocity: 6 },
        { designId: 'nac-light-cruiser', position: { x: 82, y: 56 }, facing: 12, velocity: 6 },
        { designId: 'nac-destroyer', position: { x: 64, y: 64 }, facing: 12, velocity: 8 },
        { designId: 'nac-destroyer', position: { x: 48, y: 64 }, facing: 12, velocity: 8 },
        { designId: 'nac-frigate', position: { x: 76, y: 66 }, facing: 12, velocity: 8 },
        { designId: 'nac-frigate', position: { x: 36, y: 66 }, facing: 12, velocity: 8 },
      ],
    },
  ],
}

export const SCENARIOS: Scenario[] = [INTRODUCTORY_SCENARIO, BORDER_SKIRMISH, LINE_OF_BATTLE]

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

/**
 * The flights a carrier starts with, sitting in its bays (8.1).
 *
 * A group is six fighters at full strength, and it begins aboard: launching is
 * a decision made in play, not at deployment, because a wing on the table on
 * turn one is a wing that has already spent the carrier's launch capacity.
 */
function embarkedFlights(ship: ShipState): FighterGroupState[] {
  return ship.design.fighterBays.map((bay, index) => ({
    // The catalogue's fighter types and their strengths, moves and endurance
    // are `fighters.ts`'s (8.15), so the group is built by its constructor
    // rather than by a literal here that would have to know a Light group is
    // eight craft with four CEF.
    ...createFighterGroup({
      id: `${ship.id}-flight-${index + 1}`,
      side: ship.side,
      typeId: fighterTypeOf(bay.typeId),
      carrierId: ship.id,
      position: ship.placement.position,
      facing: ship.placement.facing,
    }),
    side: ship.side,
    label: `${ship.name} ${bay.label}`,
    recoveredTurn: null,
    targetId: null,
  }))
}

/**
 * The gunboat squadrons a ship starts with, in their racks (9.1).
 *
 * A rack holds one squadron of six and the rack's cost is inside the
 * squadron's, so a hull that carries racks carries full squadrons: there is no
 * partial fit to model.
 */
function embarkedSquadrons(ship: ShipState): GunboatSquadronState[] {
  return ship.design.gunboats.map((rack, index) => ({
    ...createGunboatSquadron({
      id: `${ship.id}-squadron-${index + 1}`,
      side: ship.side,
      label: `${ship.name} ${rack.label}`,
      boats: Array(GUNBOAT_SQUADRON_SIZE).fill(gunboatTypeOf(rack.typeId)),
      carrierId: ship.id,
      position: ship.placement.position,
      facing: ship.placement.facing,
    }),
    side: ship.side,
  }))
}

/** As with fighter bays: the SSD names a type, and an unknown one flies beams. */
function gunboatTypeOf(id: string): GunboatTypeId {
  return id in GUNBOAT_TYPES ? (id as GunboatTypeId) : 'beam'
}

/**
 * An SSD names its bay's fighter type as a string, because `types.ts` is the
 * schema every module reads and may not depend on any of them. An unknown name
 * flies as a standard group rather than crashing the deployment: a carrier
 * with an empty bay is a worse bug than a carrier with the wrong fighters.
 */
function fighterTypeOf(id: string): FighterTypeId {
  return id in FIGHTER_TYPES ? (id as FighterTypeId) : 'standard'
}

export interface StartOptions {
  seed: number
  /** Override the scenario's forces outright — campaign battles. */
  forces?: Partial<Record<SideId, ForceEntry[]>>
  /**
   * A force picked by design id (18.2). Ships deploy on the scenario's own
   * stations in order, so a picked fleet arrives where the scenario says a
   * fleet arrives. A force longer than the scenario's stations continues the
   * line outward from the last one.
   */
  forceIds?: Partial<Record<SideId, string[]>>
}

/**
 * Lay a list of design ids out on a side's deployment stations.
 *
 * Beyond the last printed station the line continues on the same row, spaced
 * as the last gap was — so bringing a bigger fleet than the scenario assumed
 * widens the formation rather than stacking hulls on one point.
 */
function deploy(stations: readonly ForceEntry[], designIds: readonly string[]): ForceEntry[] {
  if (stations.length === 0) return []
  const gap =
    stations.length > 1
      ? stations[stations.length - 1].position.x - stations[stations.length - 2].position.x
      : 8
  return designIds.map((designId, index) => {
    const station = stations[Math.min(index, stations.length - 1)]
    const overflow = Math.max(0, index - (stations.length - 1))
    return {
      ...station,
      designId,
      position: { x: station.position.x + gap * overflow, y: station.position.y },
    }
  })
}

/** Build the round-one game a scenario describes. */
export function startScenario(scenarioId: string, opts: StartOptions): GameState {
  const scenario = scenarioById(scenarioId)
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

  const ships = scenario.sides.flatMap((side) => {
    const picked = opts.forceIds?.[side.id]
    const force =
      opts.forces?.[side.id] ?? (picked ? deploy(side.force, picked) : side.force)
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
    fighterGroups: ships.flatMap(embarkedFlights),
    gunboatSquadrons: ships.flatMap(embarkedSquadrons),
    scenario: scenario.id,
    // The introductory scenario plays phases 1, 2, 5, 11 and 13 only (2.6).
    phases: scenario.introductoryPhases ? INTRODUCTORY_PHASES : undefined,
    sides: scenario.sides.map((s) => ({ id: s.id, name: s.name, team: s.team })),
    ships,
  })
}
