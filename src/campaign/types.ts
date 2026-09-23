/**
 * Stellar Imperium — the campaign state schema.
 *
 * Rule references point at `docs/rules/campaign.md`, whose section numbers are
 * the campaign document's own: 6.1 FTL movement, 6.2.1 system generation, 6.3
 * repair and replacement, 6.4 the planetary phase, 6.5 production, 7 admirals,
 * 8 research and detection, 9 espionage. A field's comment names the rule it
 * exists for, so the schema can be read against the rulebook.
 *
 * A campaign is `(setup + move journal)` exactly as a battle is `(setup +
 * action journal)`, and the same determinism the tactical engine depends on
 * applies one level up. Two consequences show up in the shapes below:
 *
 *  - the seeded stream's *position* is state (`RandomStream.cursor`), so a
 *    campaign replays its exploration rolls, its unrest and its disasters
 *    exactly. Nothing in `src/campaign/` calls `Math.random`.
 *  - a `CampaignMove` carries ids and player choices only, never derived
 *    numbers, so a stale or hand-edited journal cannot make a replay disagree
 *    with the campaign it claims to be (docs/architecture.md).
 */

import { sampleAt } from '../engine/dice'
import type { GameSetup as DirtsideSetup } from '../dirtside/table/types'
import type { GroundUnit, GroundUnitOrder } from './army'

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** One player — or one GM-run non-player faction, which the rules treat alike. */
export type PlayerId = string

/** A star system on the strategic map (6.2.1). */
export type SystemId = string

/** A planet, moon or other planetary body inside a system (6.2.1). */
export type BodyId = string

/** A colony, which is always a colony *on* a body (6.4). */
export type ColonyId = string

/** A task force: the unit of strategic movement and of command (6.1, 7). */
export type TaskForceId = string

/** A named admiral (7). There are no captains in this campaign. */
export type AdmiralId = string

/** One hull in a task force, persisting between battles so damage does (6.3). */
export type CampaignShipId = string

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

/**
 * The campaign's seeded die, as data.
 *
 * `src/engine/dice.ts` hides its position inside an `Rng` object, which is
 * right for a battle: the journal is replayed from the first action, so the
 * generator is always wound forward from the seed. A campaign is long, is put
 * down and picked up between sessions, and rolls in half a dozen places in one
 * turn — so its position has to live in the state it randomises. A
 * `CampaignState` and its stream are saved, loaded and replayed together, and
 * drawing a die is a state mutation like any other.
 */
export interface RandomStream {
  /** Campaign seed, fixed at setup. */
  seed: number
  /** Dice drawn so far. Advancing this is the only way to draw. */
  cursor: number
}

/**
 * The fraction at one position of a stream, without moving it — the whole of
 * the campaign's randomness, in a form that depends on nothing but the two
 * numbers above. The function itself lives with the engine's dice, shared
 * with Dirtside, so the two games' streams are interchangeable.
 */
export { sampleAt }

/** Draw one fraction in [0, 1) and advance the stream. */
export function draw(stream: RandomStream): number {
  const value = sampleAt(stream.seed, stream.cursor)
  stream.cursor += 1
  return value
}

/** Roll one die of `sides` faces, 1-based. */
export function rollDie(sides: number, stream: RandomStream): number {
  return Math.floor(draw(stream) * sides) + 1
}

/** One six-sided die — planetary bodies, moons, unrest, admirals (6.2.1, 6.4, 7). */
export function rollD6(stream: RandomStream): number {
  return rollDie(6, stream)
}

/** One twenty-sided die — the hazardous-world disaster check (6.2.1 traits). */
export function rollD20(stream: RandomStream): number {
  return rollDie(20, stream)
}

/**
 * Percentile dice, read 1–100. The tables write the hundredth roll as "00"
 * (`91–00`, `99–00`), which is 100 here.
 */
export function rollD100(stream: RandomStream): number {
  return rollDie(100, stream)
}

/** Roll `count` dice of `sides` faces, in stream order. */
export function rollDice(count: number, sides: number, stream: RandomStream): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(rollDie(sides, stream))
  return out
}

// ---------------------------------------------------------------------------
// The strategic map (Scale, 6.1)
// ---------------------------------------------------------------------------

/**
 * A hex of the strategic map — one parsec across (Scale). Axial coordinates:
 * `q` runs east, `r` runs south-east, and the third cube axis is `-q - r`, so
 * a hex is two numbers and distance is arithmetic rather than a lookup.
 */
export interface Hex {
  q: number
  r: number
}

/** A hex flattened to `"q,r"` so it can be a record key in a save file. */
export type HexKey = string

/**
 * What the system as a whole is like (6.2.1, d100): a plain system, a gas or
 * dust cloud, a dense asteroid field, or a multiple star with extra bodies.
 */
export type SystemFeature = 'standard' | 'nebula' | 'dense-asteroid-field' | 'multiple-star'

/**
 * A planetary body's type (6.2.1, d100). Gas giants cannot be colonised and
 * carry moons; a barren world needs Controlled Environment Technology; a
 * special anomaly is whatever the GM says it is.
 */
export type PlanetType =
  | 'terran'
  | 'sub-terran'
  | 'minimal-terran'
  | 'barren'
  | 'gas-giant'
  | 'special-anomaly'

/**
 * A planetary body's trait (6.2.1, d100 at +20 in a dense asteroid field).
 * Mineral rich doubles industrial output (6.5), biologically rich and ancient
 * ruins pay a point a production phase, hazardous charges 500 RP to settle and
 * then threatens a factory every phase, unique is narrated.
 */
export type PlanetTrait =
  | 'none'
  | 'mineral-rich'
  | 'biologically-rich'
  | 'hazardous'
  | 'ancient-ruins'
  | 'unique'

/**
 * One planetary body (6.2.1). A gas giant's moons are bodies in their own
 * right — "each a new body" — and point back at the giant they orbit.
 */
export interface PlanetaryBody {
  id: BodyId
  /** Display name, e.g. "Tau Ceti II" or "Tau Ceti V-a". */
  name: string
  type: PlanetType
  /** Gas giants do not roll a trait (6.2.1: "d100 per non-gas-giant"). */
  trait: PlanetTrait
  /** The gas giant this body is a moon of, or null for a primary body. */
  parentId: BodyId | null
  /** The colony sitting on it, once there is one (6.4). */
  colonyId: ColonyId | null
}

/**
 * A star system: one hex's worth of map (6.2.1). `exploredBy` is the
 * exploration step of the turn sequence made durable — a system a player has
 * not explored is a hex with a star in it and nothing else.
 */
export interface StarSystem {
  id: SystemId
  name: string
  hex: Hex
  feature: SystemFeature
  bodies: PlanetaryBody[]
  /** Players who have explored the system and may read its bodies. */
  exploredBy: PlayerId[]
  /** Counter-espionage bought here this turn, by player: −1 a level (9). */
  counterEspionage: Record<PlayerId, number>
}

/**
 * The star map. `campaign.md` states no map-layout rule — how many stars and
 * how far apart is the GM's call — so which hexes hold systems comes from the
 * setup and lives here as a plain lookup, keyed by `hexKey`.
 */
export interface StarMap {
  /** Hexes within this distance of the origin are on the map. */
  radius: number
  systems: Record<HexKey, StarSystem>
}

// ---------------------------------------------------------------------------
// Colonies (6.4, 6.5)
// ---------------------------------------------------------------------------

/**
 * A colony's people, in millions, split by where their loyalty lies (6.4). A
 * captured colony's population becomes Subject Population, which costs its new
 * owner 75% of the colony's industrial output and risks unrest until an
 * Integration Program converts it.
 */
export interface Population {
  loyal: number
  subject: number
}

/** Ground and orbital defences a colony has bought (price schedule). */
export interface ColonyDefences {
  /** Planetary Defence Units, 200 RP each, needs PDU Tech. */
  pdu: number
  /** Advanced PDUs, 500 RP each, needs Adv. PDU Tech. */
  advancedPdu: number
  /** A planet shield, 1,500 RP, needs Planet Shield Tech. */
  planetShield: boolean
}

/**
 * A shipyard (Shipyards). Its `throughput` is the first rating — RP it can
 * process in a turn — and its `capacity` the second, the largest hull mass it
 * can build. A planetary yard may only build ships that can leave the
 * atmosphere.
 */
export interface Shipyard {
  id: string
  throughput: number
  capacity: number
  /** False for a planetary yard, which is restricted in what it can build. */
  orbital: boolean
}

/**
 * Something bought with RP. The move journal names purchases with this, so it
 * carries the player's choice — which item, which yard, how many — and never a
 * price; the price schedule in `economy.ts` is the only thing that knows costs.
 */
export type PurchaseItem =
  | { kind: 'starship'; designId: string }
  | { kind: 'colony-transport' }
  | { kind: 'scout-drone' }
  | { kind: 'factory' }
  | { kind: 'pdu' }
  | { kind: 'advanced-pdu' }
  | { kind: 'planet-shield' }
  | { kind: 'shipyard'; throughput: number; capacity: number; orbital: boolean }
  | { kind: 'command-post' }
  | { kind: 'hazard-stabilisation' }
  | { kind: 'admiral' }
  | { kind: 'drop-pod' }
  | { kind: 'sleeper-spy' }
  | { kind: 'counter-espionage' }
  /** A Dirtside platoon, raised at the colony (army.ts); the order carries the player's choice of design, never a price. */
  | { kind: 'ground-unit'; unit: GroundUnitOrder }

/**
 * Something being built at a colony. A yard processes its first rating in RP
 * per turn (Shipyards), so a hull bigger than one turn's throughput is paid
 * for across several turns and this is where the part-payment sits.
 */
export interface BuildOrder {
  id: string
  item: PurchaseItem
  /** Full price in RP, from the price schedule. */
  rpRequired: number
  rpPaid: number
  /** The yard doing the work, for a starship; null for anything else. */
  shipyardId: string | null
}

/**
 * A colony (6.4, 6.5). Population, industry, defences and stockpile — the
 * things a production phase reads and writes.
 */
export interface Colony {
  id: ColonyId
  name: string
  owner: PlayerId
  systemId: SystemId
  bodyId: BodyId
  population: Population
  /** Factories, 2,000 RP each, needs Industrial Technology. */
  factories: number
  /**
   * Factories that exist but are not *active* this phase — bought this turn,
   * or idled by the GM. Output is "50 RP per active factory" (6.5), so the
   * inactive ones have to be counted somewhere.
   */
  factoriesOffline: number
  defences: ColonyDefences
  shipyards: Shipyard[]
  /**
   * RP held at this colony. Only research may be pooled across colonies (6.5),
   * so everything else is spent where it was earned.
   */
  stockpileRp: number
  /** RP paid into the Integration Program short of the next full million (6.4). */
  integrationCredit: number
  /**
   * A command post: free, and may be established on any controlled colony
   * (6.1). Nothing but a scout may move more than 8 hexes from one.
   */
  commandPost: boolean
  /**
   * An enemy warship is in-system (6.4): no starship building, not a command
   * post, but RP still flows and defences may still be built.
   */
  underSiege: boolean
  /**
   * Production phases this colony still owes its captor nothing for — set to 1
   * on capture, because "a captured colony produces nothing for its new owner
   * for one production phase" (6.4).
   */
  capturedIdlePhases: number
  /** A hazardous world's 500 RP stabilisation has been paid (6.2.1 traits). */
  stabilised: boolean
  /** An unrest roll came up 1 last admin phase, which blocks building (6.4). */
  buildingBlocked: boolean
  buildQueue: BuildOrder[]
}

// ---------------------------------------------------------------------------
// Fleets and admirals (6.1, 6.3, 7)
// ---------------------------------------------------------------------------

/**
 * A hull as the campaign carries it between battles (6.3). The tactical
 * `ShipDesign` is the printed SSD and never changes; what changes is the
 * damage, and 6.3 splits damage into what heals itself and what needs a yard.
 */
export interface CampaignShip {
  id: CampaignShipId
  /** The individual ship's name; the class name is the design's. */
  name: string
  /** `ShipDesign.id` in `src/data/ships.ts`, or an embedded design. */
  designId: string
  /**
   * Hull boxes still marked. Hull, armour and core damage need the ship to end
   * its move at a friendly colony with a shipyard (6.3), so they persist here.
   */
  hullDamage: number
  /** Armour boxes still marked, inner layer first. */
  armourDamage: number[]
  /** Core systems still wrecked: 'bridge', 'life-support', 'power-core' (6.3). */
  coreDamage: string[]
  /**
   * System and weapon ids knocked out. These repair themselves between
   * strategic turns if the ship fights no other battle (6.3), which is why
   * they are kept apart from hull damage rather than in one list.
   */
  systemsDamaged: string[]
  /** True once the ship has fought this turn, which blocks the free repair (6.3). */
  foughtThisTurn: boolean
  /**
   * Expendables remaining, by weapon or bay id — missiles, salvoes, fighters
   * (6.3). They are not replaced free; they are bought again in a production
   * phase.
   */
  expendables: Record<string, number>
  /**
   * Marine teams of the ship's contingent lost on the ground or to damage in
   * transit (More Thrust pp. 17–18), made good when the ship is repaired at a
   * friendly yard. Absent means none.
   */
  marinesLost?: number
  /**
   * The hull damage the last transit-loss roll was made at: damage already
   * rolled for is not rolled for again (More Thrust p. 18, "only once").
   */
  marineLossRolledAt?: number
}

/** An admiral's command level (7): 1 excellent, 2 average, 3 inept. */
export type CommandLevel = 1 | 2 | 3

/**
 * An admiral (7). Recruited for 100 RP with a level rolled on 1d6 — a 1 gives
 * Level 3, 2–5 Level 2, a 6 Level 1. A flagship lost or bridge-hit puts the
 * admiral at risk: 1 dead, 2–3 injured for 1d6 turns, 4–6 unharmed.
 */
export interface Admiral {
  id: AdmiralId
  name: string
  owner: PlayerId
  level: CommandLevel
  dead: boolean
  /** Campaign turn the injury lifts, or null if fit (7). */
  injuredUntilTurn: number | null
}

/**
 * A task force's standing order (6.1). The pair of orders — intruder's and
 * defender's — decides whether a meeting is an even battle, a pursuit battle
 * or no battle at all.
 */
export type TaskForceOrder = 'engage' | 'stand-off' | 'ftl-move'

/**
 * One turn of plotted FTL movement (6.1). Movement is plotted from a departure
 * hex to a destination hex, and how many turns ahead must be plotted depends on
 * the admiral's command level: Level 1 plots 1 turn ahead, Level 2 two, Level 3
 * three; a scout always plots 1, and a force with no named admiral plots as
 * Level 3 (7).
 */
export interface PlottedMove {
  /** The campaign turn this leg is to be executed on. */
  turn: number
  from: Hex
  to: Hex
}

/**
 * A task force (6.1, 7): ships, an order, an admiral, and a plot. The unit
 * everything strategic happens to.
 */
export interface TaskForce {
  id: TaskForceId
  name: string
  owner: PlayerId
  hex: Hex
  ships: CampaignShip[]
  order: TaskForceOrder
  /** Null means no named admiral, which plots as Level 3 (7). */
  admiralId: AdmiralId | null
  /**
   * Scouts plot 1 turn ahead (7) and are the one exception to the 8-hex
   * command-post limit (6.1).
   */
  scout: boolean
  /** Plotted legs, earliest turn first (6.1). */
  plot: PlottedMove[]
  /** Base 2 hexes a turn, raised by research to a maximum of 8 (6.1). */
  ftlRate: number
  /**
   * Colony transports travelling with the force, each carrying a million
   * colonists (Economy). They are landed by `found-colony`, and a force that
   * is nothing but transports is a convoy.
   */
  transports: number
  /**
   * The campaign turn this force last arrived somewhere by FTL, or null. The
   * force that moved into a hex this turn is the intruder there, and the one
   * that was already in it defends (6.1).
   */
  movedTurn: number | null
}

// ---------------------------------------------------------------------------
// Players: technology, RP and intelligence (8, 9)
// ---------------------------------------------------------------------------

/**
 * Every technology the campaign can research (8). Ship speeds 3 through 8 are
 * the FTL rate they unlock; the rest gate items on the price schedule.
 */
export type TechnologyId =
  | 'speed-3'
  | 'speed-4'
  | 'speed-5'
  | 'speed-6'
  | 'speed-7'
  | 'speed-8'
  | 'pdu'
  | 'advanced-pdu'
  | 'planet-shield'
  | 'controlled-environment'
  | 'industrial'
  | 'improved-industrial'
  | 'robotic-industry'

/**
 * What a spying roll bought (9, the 2d6 spying table): 7 or less nothing, 8
 * ship counts, 9 hull categories and station classes, 10 hull masses and
 * station damage, 11 class designations, 12+ ship ids and damage status.
 */
export type SpyingDetail =
  | 'nothing'
  | 'ship-count'
  | 'hull-categories'
  | 'hull-masses'
  | 'class-designations'
  | 'ship-ids'

/**
 * One thing a player knows about somebody else's forces (8 detection, 9
 * espionage). Intelligence is a dated snapshot, not a live feed — it records
 * the turn it was taken so a stale report can be shown as stale.
 */
export interface IntelReport {
  /** Campaign turn the intelligence was gathered. */
  turn: number
  /** Task force or system the report is about. */
  subjectId: string
  /** Who the report is about. */
  subjectOwner: PlayerId
  detail: SpyingDetail
  /** Ship ids the report actually names, at detail 'ship-ids' (9). */
  shipIds: CampaignShipId[]
  /** Ships counted, at detail 'ship-count' and above (9). */
  shipCount: number | null
  note: string
}

/**
 * One player's strategic position: what they know, what they have researched
 * and what they have left to spend (8, 9).
 */
export interface PlayerState {
  id: PlayerId
  name: string
  /** Faction id, which the tactical engine uses for faction traits. */
  faction: string
  /**
   * Pooled RP. Research is the only expenditure that may be pooled across
   * colonies (6.5), so this is the research chest; everything else is spent
   * from a colony's own `stockpileRp`.
   */
  rp: number
  /** Research points from biologically rich worlds, 1 a production phase. */
  researchPoints: number
  /** Tech points from ancient ruins, 1 a production phase. */
  techPoints: number
  technologies: TechnologyId[]
  homeSystemId: SystemId
  /** Systems this player has explored, for the fog the map itself does not keep. */
  knownSystems: SystemId[]
  intel: IntelReport[]
  /**
   * A saboteur who blew up a ship takes −3 on every roll thereafter (9), so
   * the penalty rides with the player who ordered it.
   */
  espionagePenalty: number
}

// ---------------------------------------------------------------------------
// The turn (Turn sequence)
// ---------------------------------------------------------------------------

/**
 * The eight steps of a campaign turn (Turn sequence). Production only happens
 * on every fourth turn (Scale), which is a property of the turn number rather
 * than of the list.
 */
export type CampaignPhase =
  | 'ftl-movement' // 1
  | 'exploration' // 2
  | 'exploration-risk' // 3
  | 'discovery' // 4
  | 'combat' // 5
  | 'planetary' // 6
  | 'admin' // 7
  | 'production' // 8

/** The turn sequence in order, so a phase can be advanced by index. */
export const CAMPAIGN_PHASE_ORDER: readonly CampaignPhase[] = [
  'ftl-movement',
  'exploration',
  'exploration-risk',
  'discovery',
  'combat',
  'planetary',
  'admin',
  'production',
]

/** Human-readable phase names, for the log and the UI. */
export const CAMPAIGN_PHASE_LABELS: Record<CampaignPhase, string> = {
  'ftl-movement': 'FTL movement',
  exploration: 'Exploration',
  'exploration-risk': 'Exploration risk',
  discovery: 'Discovery',
  combat: 'Combat',
  planetary: 'Planetary',
  admin: 'Admin',
  production: 'Production',
}

/** Production happens every 4th turn (Scale). */
export const TURNS_PER_PRODUCTION_PHASE = 4

/** Whether a given campaign turn runs its production phase (Scale). */
export function isProductionTurn(turn: number): boolean {
  return turn > 0 && turn % TURNS_PER_PRODUCTION_PHASE === 0
}

/**
 * What a meeting between two task forces turns into (6.1, the order matrix).
 * An even battle is fought on a standard table; a pursuit battle is the
 * runner's fight; no battle means the forces pass.
 */
export type BattleKind = 'none' | 'even' | 'pursuit'

/**
 * A battle the campaign has generated and the tactical engine has still to
 * fight (Turn sequence, combat). `seed` is drawn from the campaign's stream so
 * the battle's own journal is reproducible from the campaign's seed alone.
 */
export interface PendingBattle {
  id: string
  hex: Hex
  /** The system fought over, or null for a meeting in an empty hex. */
  systemId: SystemId | null
  kind: BattleKind
  /** The side that arrived, first, then the side that was there (6.1). */
  sides: Array<{ playerId: PlayerId; taskForceIds: TaskForceId[]; role: 'intruder' | 'defender' }>
  /** In a pursuit, who is chasing (6.1). */
  pursuer: 'intruder' | 'defender' | null
  seed: number
  /** Set once the battle has been fought and its result folded back in. */
  resolved: boolean
  /** How it went, once resolved: the winner's player id, or null for a draw. */
  winner?: PlayerId | null
}

/**
 * A landing (More Thrust pp. 15–18): under campaign rules reading 2 an
 * assault is fought on the Dirtside table. The order of battle is fixed when
 * the landing is made — which Marine team came down from which ship, which of
 * the colony's platoons is a PDU — so the battle file comes back to the same
 * table whatever else happens in the phase.
 */
export interface PendingLanding {
  id: string
  colonyId: ColonyId
  systemId: SystemId
  attacker: PlayerId
  defender: PlayerId
  taskForceId: TaskForceId
  seed: number
  /** The Dirtside battle as it opens: the landing force is north and attacks. */
  setup: DirtsideSetup
  /** Marine teams by element id, and the ship each came down from. */
  landed: Record<string, CampaignShipId>
  /** The colony's platoons by unit id, and what each stands for. */
  garrison: Record<string, 'militia' | 'pdu' | 'advanced-pdu'>
  /** Ground units' elements on the table, by element id: the unit and its place in the establishment. */
  ground?: Record<string, { unit: string; index: number }>
  resolved: boolean
  /** Once fought: the winner's player id, or null when neither side had the better of it. */
  winner?: PlayerId | null
}

/** One line of the campaign log, stamped with where in the turn it happened. */
export interface CampaignLogEntry {
  seq: number
  turn: number
  phase: CampaignPhase
  /** 'move', 'roll', 'battle', 'production', 'note'. */
  kind: string
  text: string
}

// ---------------------------------------------------------------------------
// The campaign state
// ---------------------------------------------------------------------------

/**
 * Everything a campaign is, at one moment: the map, the players, their
 * colonies and fleets, the position of the die, and the log. Rebuilt exactly
 * by replaying the move journal over the setup.
 */
export interface CampaignState {
  /**
   * The campaign rules reading this game is being played under. Same reason as
   * the battle file's stamp: the journal records refused moves too, so a later
   * fix that turns yesterday's refusal into today's success must not rewrite an
   * old campaign.
   */
  rulesVersion: number
  seed: number
  /** Campaign turn, from 1. One turn is about a year (Scale). */
  turn: number
  phase: CampaignPhase
  /** The seeded die, position included. */
  rng: RandomStream
  map: StarMap
  players: PlayerState[]
  colonies: Colony[]
  taskForces: TaskForce[]
  admirals: Admiral[]
  battles: PendingBattle[]
  /** Landings made under rules reading 2 (More Thrust pp. 15–18). */
  landings: PendingLanding[]
  /** Ground units raised by the players: garrisons and troops aboard ships. */
  groundUnits: GroundUnit[]
  log: CampaignLogEntry[]
}

// ---------------------------------------------------------------------------
// The move journal
// ---------------------------------------------------------------------------

/**
 * One move in a campaign: the strategic counterpart of a `GameAction`.
 *
 * The rule the tactical engine lives by holds here too — a payload carries ids
 * and player choices only, never derived state — so every handler re-derives
 * prices, distances and legality from the campaign itself and a replay cannot
 * be talked into a different answer by an edited file (docs/architecture.md).
 * Rolls a move needs come from the state's own stream, so they replay with it.
 */
export type CampaignMove =
  // --- FTL movement (6.1) -------------------------------------------------
  | { kind: 'plot-move'; player: PlayerId; taskForce: TaskForceId; legs: PlottedMove[] }
  | { kind: 'set-order'; player: PlayerId; taskForce: TaskForceId; order: TaskForceOrder }
  | {
      kind: 'form-task-force'
      player: PlayerId
      taskForce: TaskForceId
      name: string
      hex: Hex
      /** Ships taken from other task forces at the same hex. */
      ships: CampaignShipId[]
      scout: boolean
    }
  | {
      kind: 'transfer-ships'
      player: PlayerId
      from: TaskForceId
      to: TaskForceId
      ships: CampaignShipId[]
    }
  | { kind: 'assign-admiral'; player: PlayerId; taskForce: TaskForceId; admiral: AdmiralId | null }
  // --- Exploration and discovery (Turn sequence, 6.2.1) -------------------
  | { kind: 'explore-system'; player: PlayerId; system: SystemId; taskForce: TaskForceId }
  | { kind: 'detection-check'; player: PlayerId; taskForce: TaskForceId; target: TaskForceId }
  // --- Planetary (6.4) ----------------------------------------------------
  | {
      kind: 'found-colony'
      player: PlayerId
      colony: ColonyId
      system: SystemId
      body: BodyId
      /** Colony transports unloaded, one million colonists each (Economy). */
      transports: number
    }
  | { kind: 'establish-command-post'; player: PlayerId; colony: ColonyId }
  | {
      kind: 'emigrate'
      player: PlayerId
      colony: ColonyId
      /** Millions of colonists lifted off, one per colony transport (Economy). */
      millions: number
      /** Where they are bound; null loads them aboard without a destination. */
      destination: ColonyId | null
    }
  | { kind: 'integration-program'; player: PlayerId; colony: ColonyId; rp: number }
  /** Ortillery in orbit removes a million population a battery a turn (6.4). */
  | { kind: 'bombard'; player: PlayerId; colony: ColonyId; taskForce: TaskForceId }
  /** A landing by the Marines aboard a task force holding the orbit (6.4). */
  | { kind: 'assault'; player: PlayerId; colony: ColonyId; taskForce: TaskForceId }
  /** A ground unit at a colony goes aboard a ship in orbit, if its holds have the space (More Thrust p. 15). */
  | { kind: 'embark'; player: PlayerId; unit: string; ship: CampaignShipId }
  /** A ground unit aboard a ship goes down to a friendly colony in the system. */
  | { kind: 'disembark'; player: PlayerId; unit: string; colony: ColonyId }
  /** A depleted ground unit at a friendly colony is brought back to strength (Stargrunt p. 60). */
  | { kind: 'reinforce'; player: PlayerId; unit: string }
  // --- Purchasing and building (Price schedule, Shipyards) ----------------
  | { kind: 'purchase'; player: PlayerId; colony: ColonyId; item: PurchaseItem; quantity: number }
  | { kind: 'cancel-build'; player: PlayerId; colony: ColonyId; order: string }
  | {
      kind: 'allocate-shipyard'
      player: PlayerId
      colony: ColonyId
      shipyard: string
      order: string
      /** RP put through the yard this turn, capped by its first rating. */
      rp: number
    }
  // --- Research and admirals (7, 8) --------------------------------------
  | { kind: 'research'; player: PlayerId; technology: TechnologyId }
  | { kind: 'trade-technology'; player: PlayerId; to: PlayerId; technology: TechnologyId }
  | { kind: 'recruit-admiral'; player: PlayerId; colony: ColonyId; admiral: AdmiralId; name: string }
  // --- Espionage (9) ------------------------------------------------------
  | {
      kind: 'espionage'
      player: PlayerId
      method: 'drop-pod' | 'cloaked-ship' | 'observation-pass' | 'sleeper-spy'
      target: PlayerId
      system: SystemId
      /** Taking risks: each 1 on the discovery check adds +1 to the roll (9). */
      takeRisks: boolean
    }
  | { kind: 'counter-espionage'; player: PlayerId; system: SystemId; levels: number }
  | { kind: 'sabotage'; player: PlayerId; target: CampaignShipId; system: SystemId }
  // --- Combat and the turn (Turn sequence) --------------------------------
  | {
      kind: 'resolve-battle'
      battle: string
      /**
       * The battle file the tactical engine produced, as `(setup + actions)`
       * JSON. The campaign folds its end state back into the task forces; it
       * never stores the outcome, because the outcome is replayable from this.
       */
      savedGame: string
    }
  | {
      kind: 'resolve-landing'
      landing: string
      /**
       * The Dirtside battle file, as `(setup + journal)` JSON. The campaign
       * replays its journal over the landing's own setup and folds the end
       * state back: the colony taken or held, Marines and PDUs lost.
       */
      savedBattle: string
    }
  | { kind: 'end-phase'; player: PlayerId | null }
  /** The GM's ruling, for the places the rules hand the GM the pen (6.2.1). */
  | { kind: 'gm-ruling'; note: string; effects: Record<string, number> }

/** A move as journalled: the move, and where in the turn it was made. */
export interface CampaignJournalEntry {
  seq: number
  turn: number
  phase: CampaignPhase
  move: CampaignMove
}

/**
 * A campaign's setup — everything needed to build turn 1, and the only half of
 * a campaign file that is not the journal.
 */
export interface CampaignSetup {
  seed: number
  /** Campaign rules reading; absent means 1. */
  rulesVersion?: number
  /** Hexes that hold a star, generated at setup by `generateStarMap`. */
  starHexes: Hex[]
  radius: number
  players: Array<{
    id: PlayerId
    name: string
    faction: string
    /** Home system hex; the home system starts with a command post (6.1). */
    home: Hex
    /** 2,000 RP of naval ships and 20 colony transports to start (Economy). */
    startingShips: Array<{ designId: string; name: string }>
    startingTransports: number
    /** The computer fights this player's battles on the table. */
    computer?: boolean
  }>
  /** Systems banned from ship design: Reflex Shield, Cloaking Field, Wave Gun. */
  bannedSystems: string[]
  /**
   * The home colony every player starts with, which the rules leave to the
   * GM: millions of people, factories, and one orbital yard. Absent means the
   * defaults in `campaign.ts`.
   */
  home?: { population?: number; factories?: number; shipyard?: { throughput: number; capacity: number } }
}

/** A campaign file: setup plus the move journal, and nothing else. */
export interface SavedCampaign {
  /** Bumped only when a change breaks replay of older campaign files. */
  version: 1
  setup: CampaignSetup
  moves: CampaignJournalEntry[]
}
