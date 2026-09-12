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
  type TerrainFeature,
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
import { fighterMods, gunboatMods } from './smallCraftMods'
import {
  zonesFor,
  PLACEMENT_BATCH_MAX,
  PLACEMENT_BATCH_MIN,
  type BattleType,
} from '../engine/battles'
import type { DeploymentState } from '../engine/game'
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
  /**
   * 17.8: *"A planet may have satellites or starbases in orbit."* Placed on a
   * body's track at a clock marker rather than at a position, and carried
   * round it from turn one.
   */
  orbit?: { featureId: string; marker: Course }
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
  /**
   * Rocks and clouds on the table (17). A planet or planetoid blocks fire
   * across it, which is the one thing in Full Thrust that gives a captain
   * somewhere to be that is not simply further away.
   */
  terrain?: TerrainFeature[]

  // ── Deployment (18.1) ───────────────────────────────────────────────────
  /**
   * Which of 18.1's three battles this is. Absent means the scenario writes
   * its own final positions, which is a legal outcome of any deployment — it
   * has simply already been run. All three scenarios shipped before this
   * existed leave it absent and are unchanged by it.
   */
  battleType?: BattleType
  /** Offensive/defensive: the side that deploys first and owns a table half. */
  defenderSideId?: SideId
  /** Converging approach: which half of the long edges both fleets use. */
  deploymentHalf?: 'first' | 'second'
  /** *"Or two to four ships at a time for large battles"* (18.1). */
  placementBatch?: number
  /** 18.1: the attacker *"(if permitted)"* may make an FTL entry. */
  ftlEntryPermitted?: boolean
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
  // 17.1: a planetoid blocks the line between two ships entirely, so the rock
  // in the middle of this table is cover — the only cover in the game that is
  // not just distance.
  terrain: [
    {
      id: 'rock',
      kind: 'planetoid',
      position: { x: 36, y: 24 },
      radius: 5,
      label: 'Unnamed planetoid',
    },
  ],
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

/**
 * A battle fought around a planet, which is a different kind of battle.
 *
 * 17.9 gives a planet three concentric gravity zones — *"the outer zone is
 * strength 1, the middle strength 2, and the innermost 4"* — and what they do
 * is add to a ship's velocity, take from it, or swing it round, depending on
 * which arc the planet lies in. A fleet crossing the middle of this table is
 * not on the course it wrote.
 *
 * Deliberately no deployment step and no picked forces: the point of it is
 * the well, so both sides come in from the short ends the way the introductory
 * scenario does, and everything interesting happens between them.
 */
export const GRAVITY_WELL: Scenario = {
  id: 'gravity-well',
  name: 'The Weight of Worlds',
  briefing:
    'A gas giant nobody has bothered to name, and a survey station on its far side that both ' +
    'navies now want. There is no way across this system that does not go past the planet, and ' +
    'the planet does not care what course you wrote.',
  objective:
    'Break the enemy division. The planet will help you or ruin you depending on which side of ' +
    'your bow it passes.',
  table: { width: 96, height: 48 },
  // A large planet: the zones are widened, so the well reaches 12 MU out. It
  // sits off the centre line on purpose. Dead centre, the shortest line
  // between the fleets goes through it and there is no decision left — 17.9
  // simply eats the battle, which is what the first draft of this scenario
  // did. Off to one side there is a way round, and the well becomes what it
  // should be: a shortcut with a price, or a wall to pin somebody against.
  //
  // Solid, so it blocks fire (17.1) and destroys what flies into it (17.6) —
  // unless 17.9 turned the ship, because a partial orbit goes round.
  terrain: [
    {
      id: 'giant',
      kind: 'planet',
      position: { x: 48, y: 13 },
      radius: 6,
      label: 'the gas giant',
      gravity: { zoneWidth: 2 },
    },
  ],
  turnLimit: 12,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        { designId: 'esu-heavy-cruiser', position: { x: 8, y: 28 }, facing: 3, velocity: 8 },
        { designId: 'esu-light-cruiser', position: { x: 8, y: 36 }, facing: 3, velocity: 8 },
        { designId: 'esu-destroyer', position: { x: 4, y: 22 }, facing: 3, velocity: 10 },
        { designId: 'esu-destroyer', position: { x: 4, y: 42 }, facing: 3, velocity: 10 },
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        { designId: 'nac-heavy-cruiser', position: { x: 88, y: 36 }, facing: 9, velocity: 8 },
        { designId: 'nac-light-cruiser', position: { x: 88, y: 28 }, facing: 9, velocity: 8 },
        { designId: 'nac-destroyer', position: { x: 92, y: 42 }, facing: 9, velocity: 10 },
        { designId: 'nac-destroyer', position: { x: 92, y: 22 }, facing: 9, velocity: 10 },
      ],
    },
  ],
}

/**
 * 17.3, close in to a bad-tempered star.
 *
 * The flare covers the whole table, which is the rule's own first suggestion —
 * *"They may be assumed to affect the entire table, or just a specific area as
 * the player's desire"* — and it goes off on a 5 or a 6 rather than the default
 * six, because a scenario built around flares should produce more than two of
 * them in a twelve-turn battle.
 *
 * Both divisions are screened, which is the point: 17.3's modifier is +1 per
 * active screen level, so a screen-1 hull keeps its FireCons on a 3 and a
 * screen-2 hull on a 2. The side that loses its screens loses its eyes next.
 */
export const FLARE_STAR: Scenario = {
  id: 'flare-star',
  name: 'Close Orbit, Bad Star',
  briefing:
    'A flare star, and a convoy lane that runs too near it because the alternative adds nine days ' +
    'to every crossing. Both navies have been waiting for the other to be caught with its ' +
    'FireCons down.',
  objective: 'Break the enemy division. The star will take a turret off somebody every few turns.',
  table: { width: 72, height: 48 },
  terrain: [
    {
      id: 'flare',
      kind: 'solar-flare',
      position: { x: 36, y: 24 },
      // Larger than the table's own diagonal, so nothing is out of it: 17.3's
      // "the entire table".
      radius: 120,
      label: 'the star',
      flare: { onRoll: 5 },
    },
  ],
  turnLimit: 12,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        { designId: 'esu-battlecruiser', position: { x: 12, y: 18 }, facing: 3, velocity: 6 },
        { designId: 'esu-heavy-cruiser', position: { x: 8, y: 26 }, facing: 3, velocity: 6 },
        { designId: 'esu-destroyer', position: { x: 6, y: 34 }, facing: 3, velocity: 8 },
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        { designId: 'nac-battlecruiser', position: { x: 60, y: 30 }, facing: 9, velocity: 6 },
        { designId: 'nac-heavy-cruiser', position: { x: 64, y: 22 }, facing: 9, velocity: 6 },
        { designId: 'nac-destroyer', position: { x: 66, y: 14 }, facing: 9, velocity: 8 },
      ],
    },
  ],
}

/**
 * 17.8's medium scale: a world with an orbit track, and both fleets wanting it.
 *
 * The track is the planet's own edge (radius 10) and holds at velocity 6, one
 * clock point a turn anticlockwise. Arrive at 6 and you are in orbit; arrive
 * slower and the orbit decays into 17.11; arrive faster and you go straight
 * into the atmosphere, which is nearly always fatal. The world is landable and
 * a light one at 0.6G, so a partially streamlined hull can put down on it —
 * which is what the ESU marines are for.
 */
export const ORBITAL_APPROACH: Scenario = {
  id: 'orbital-approach',
  name: 'The Track Above Meridian',
  briefing:
    'Meridian has one deep-water port and both navies have promised it protection. Whoever holds ' +
    'the orbit track holds the argument, and the track only takes so many hulls.',
  objective:
    'Take and hold the orbit track. Coming in at the wrong speed does not put you in orbit, it ' +
    'puts you in the atmosphere, and the Confederation already has a starbase up there.',
  table: { width: 96, height: 72 },
  terrain: [
    {
      id: 'meridian',
      kind: 'planet',
      position: { x: 48, y: 36 },
      radius: 10,
      label: 'Meridian',
      orbit: { velocity: 6, speed: -1, gravityG: 0.6, landable: true },
    },
  ],
  turnLimit: 14,
  victory: INTRODUCTORY_VICTORY,
  sides: [
    {
      id: 'a',
      name: 'Eurasian Solar Union',
      force: [
        { designId: 'esu-heavy-cruiser', position: { x: 10, y: 30 }, facing: 3, velocity: 6 },
        { designId: 'esu-light-cruiser', position: { x: 10, y: 42 }, facing: 3, velocity: 6 },
        { designId: 'esu-destroyer', position: { x: 6, y: 24 }, facing: 3, velocity: 8 },
      ],
    },
    {
      id: 'b',
      name: 'New Anglian Confederation',
      force: [
        { designId: 'nac-heavy-cruiser', position: { x: 86, y: 42 }, facing: 9, velocity: 6 },
        { designId: 'nac-light-cruiser', position: { x: 86, y: 30 }, facing: 9, velocity: 6 },
        { designId: 'nac-destroyer', position: { x: 90, y: 48 }, facing: 9, velocity: 8 },
        // 17.8's starbase, already on the track and facing outward. It rides
        // round at the orbit speed like everything else up there, so the two
        // markers it can shoot into change every turn.
        {
          designId: 'orbital-starbase',
          name: 'Meridian Station',
          position: { x: 48, y: 26 },
          facing: 12,
          orbit: { featureId: 'meridian', marker: 12 },
        },
      ],
    },
  ],
}

export const SCENARIOS: Scenario[] = [
  INTRODUCTORY_SCENARIO,
  BORDER_SKIRMISH,
  LINE_OF_BATTLE,
  GRAVITY_WELL,
  FLARE_STAR,
  ORBITAL_APPROACH,
]

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
      modifiers: fighterMods(bay.modifiers),
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
      modifiers: gunboatMods(rack.modifiers),
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

/**
 * The deployment this battle runs, or null (18.1).
 *
 * A setup's choice beats the scenario's, so a player can put a stock scenario
 * through a deployment without editing the scenario. Two sides only: 18.1 is
 * written for two fleets and `zonesFor` returns nothing for anything else,
 * which would otherwise leave a side with no zone to deploy into.
 */
function deploymentFor(scenario: Scenario, opts: StartOptions): DeploymentState | null {
  const battleType =
    opts.battleType === 'none'
      ? undefined
      : (opts.battleType ?? scenario.battleType)
  if (!battleType) return null
  if (scenario.sides.length !== 2) return null

  const sides = scenario.sides.map((side) => side.id)
  const zones = zonesFor(scenario.table, battleType, sides, {
    half: scenario.deploymentHalf,
    defenderSideId: scenario.defenderSideId,
    ftlEntryPermitted: scenario.ftlEntryPermitted,
  })
  if (zones.length !== sides.length) return null

  return {
    battleType,
    zones: Object.fromEntries(zones.map((zone) => [zone.sideId, zone])),
    batch: Math.max(
      PLACEMENT_BATCH_MIN,
      Math.min(PLACEMENT_BATCH_MAX, Math.floor(scenario.placementBatch ?? PLACEMENT_BATCH_MIN)),
    ),
    order: [],
    placed: [],
    terrainPlaced: false,
  }
}

export interface StartOptions {
  seed: number
  /** Override the scenario's deployment (18.1). `'none'` turns one off. */
  battleType?: BattleType | 'none'
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
      const ship = createShipState({
        id: `${side.id}-${entry.designId}-${index + 1}`,
        side: side.id,
        design,
        placement: { position: entry.position, facing: entry.facing },
        velocity: entry.velocity ?? 0,
        name: entry.name ?? `${design.name} ${n}`,
      })
      // 17.8's satellites and starbases start on the track rather than flying
      // onto it, so they are put there before the first turn opens.
      if (entry.orbit) ship.orbit = { ...entry.orbit }
      return ship
    })
  })

  return createGame({
    seed: opts.seed,
    table: { ...scenario.table },
    deployment: deploymentFor(scenario, opts),
    terrain: scenario.terrain ? scenario.terrain.map((f) => ({ ...f })) : undefined,
    fighterGroups: ships.flatMap(embarkedFlights),
    gunboatSquadrons: ships.flatMap(embarkedSquadrons),
    scenario: scenario.id,
    // The introductory scenario plays phases 1, 2, 5, 11 and 13 only (2.6).
    phases: scenario.introductoryPhases ? INTRODUCTORY_PHASES : undefined,
    sides: scenario.sides.map((s) => ({ id: s.id, name: s.name, team: s.team })),
    ships,
  })
}
