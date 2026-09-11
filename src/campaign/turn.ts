/**
 * The campaign turn — campaign.md "Turn sequence", 6.1, 6.3, 6.4, 6.5.
 *
 * A campaign is `(setup + move journal)` exactly as a battle is `(setup +
 * action journal)`, so this module is written the same way the tactical engine
 * is: pure rules over plain data, no I/O, and every die drawn from the seeded
 * `CampaignRng` whose cursor lives in the state it randomises. Replay a
 * campaign's moves over its setup and every roll — every system generated,
 * every unrest check, every battle's own seed — comes out where it did.
 *
 * The last section is the bridge to the tactical layer: a campaign engagement
 * becomes a `Scenario`, which is what `startScenario` and a battle file already
 * know how to open, so a campaign battle is fought by the real rules engine
 * rather than by an abstraction of it.
 *
 * Reconciliation note: `Hex`, `SystemFeature`, `PlanetType`, `PlanetTrait` and
 * `Colony` are declared here because `src/campaign/types.ts` and
 * `src/campaign/map.ts` are being written in parallel. They are deliberately
 * minimal and structurally compatible with what campaign.md describes, and are
 * meant to be replaced by the map layer's own on a later pass.
 */

import type {
  BattleKind,
  CampaignPhase,
  Hex,
  PlanetTrait,
  PlanetType,
  SystemFeature,
  TaskForceOrder as FleetOrder,
} from './types'
import type { SideId } from '../engine/game'
import type { Course } from '../engine/types'
import type { GameSetup } from '../data/savedGame'
import {
  INTRODUCTORY_VICTORY,
  type ForceEntry,
  type Scenario,
  type ScenarioSide,
  type TableSize,
} from '../data/scenarios'
import { designById } from '../data/ships'
import {
  detectionCheck,
  draw2d6,
  drawD6,
  drawInt,
  initiativeModifier,
  plotAheadTurns,
  totalModifier,
  type CampaignRng,
  type CommandLevel,
  type DetectionContext,
  type DetectionResult,
  type EspionageMission,
  type RollModifier,
} from './intel'
import { ftlRate, type ResearchRequest, type TechId } from './research'

// ---------------------------------------------------------------------------
// The strategic map, minimally
// ---------------------------------------------------------------------------

/** One hex of the strategic map — 1 hex = 1 parsec ("Scale"). Axial coordinates. */
export type { Hex } from './types'

/** Distance in hexes, which is what every range in the campaign is measured in. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2
}

export function sameHex(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

/** A stable key for hex lookups, so a hex list can stand in for a hex set. */
export function hexKey(hex: Hex): string {
  return `${hex.q},${hex.r}`
}

/** The system features of 6.2.1. The d100 table that rolls them lives in `map.ts`. */
export type { SystemFeature } from './types'

/** A system as the exploration phase leaves it. */
export interface ExploredSystem {
  hex: Hex
  feature: SystemFeature
}

/** The planet types of 6.2.1, as the colonisation rules need to tell them apart. */
export type { PlanetType } from './types'

/** The planet traits of 6.2.1. */
export type { PlanetTrait } from './types'

// ---------------------------------------------------------------------------
// The eight phases ("Turn sequence")
// ---------------------------------------------------------------------------

/**
 * The campaign turn, in the order campaign.md numbers it. One strategic turn is
 * about a year ("Scale").
 */
export type { CampaignPhase } from './types'

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

export const CAMPAIGN_PHASE_LABELS: Readonly<Record<CampaignPhase, string>> = {
  'ftl-movement': 'FTL movement',
  exploration: 'Exploration',
  'exploration-risk': 'Exploration risk',
  discovery: 'Discovery',
  combat: 'Combat',
  planetary: 'Planetary',
  admin: 'Admin',
  production: 'Production',
}

/** "Production | every 4th turn" ("Scale", turn sequence 8). */
export const PRODUCTION_INTERVAL = 4

export function isProductionTurn(turn: number): boolean {
  return turn > 0 && turn % PRODUCTION_INTERVAL === 0
}

/** The phases this particular turn actually plays — production only every 4th. */
export function phasesForTurn(turn: number): readonly CampaignPhase[] {
  return isProductionTurn(turn)
    ? CAMPAIGN_PHASE_ORDER
    : CAMPAIGN_PHASE_ORDER.filter((phase) => phase !== 'production')
}

/** Where the campaign has got to. The mirror of the tactical `SequencePosition`. */
export interface CampaignClock {
  turn: number
  phase: CampaignPhase
}

export function startCampaignClock(turn = 1): CampaignClock {
  return { turn, phase: phasesForTurn(turn)[0] }
}

/**
 * Step to the next phase, rolling over into the next turn at the end of the
 * sequence. Mutated in place, the way the tactical engine advances its own
 * clock: the clock is state, and the journal is what reproduces it.
 */
export function advanceCampaignPhase(clock: CampaignClock): CampaignClock {
  const phases = phasesForTurn(clock.turn)
  const index = phases.indexOf(clock.phase)
  if (index >= 0 && index < phases.length - 1) {
    clock.phase = phases[index + 1]
    return clock
  }
  clock.turn += 1
  clock.phase = phasesForTurn(clock.turn)[0]
  return clock
}

// ---------------------------------------------------------------------------
// Phase 1 — FTL movement (6.1)
// ---------------------------------------------------------------------------

/** "Ships other than scouts may not move further than 8 hexes from a friendly command post" (6.1). */
export const COMMAND_POST_RANGE = 8

/** The three standing orders a task force carries (6.1). */
/** 6.1. The schema module calls this TaskForceOrder; both names are the same type. */
export type { TaskForceOrder as FleetOrder } from './types'

/** What the campaign needs to know about a task force to move it (6.1, 7). */
export interface TaskForceProfile {
  id: string
  owner: string
  /** "Scouts always plot 1 turn ahead" and are exempt from the command-post leash (6.1, 7). */
  scout: boolean
  /** The commanding admiral's level after `effectiveCommandLevel`; null for none (7). */
  admiral: CommandLevel | null
  /** Hexes a turn, from ship-speed research (6.1, 8). */
  ftlRate: number
}

/** A task force's FTL rate given what its owner has researched (6.1, 8). */
export function ftlRateFor(known: readonly TechId[]): number {
  return ftlRate(known)
}

/**
 * How many turns ahead this task force must plot (6.1, 7).
 *
 * "how many turns ahead you must plot depends on the admiral's command level"
 * — Level 1 plots 1 turn ahead, Level 2 two, Level 3 three; scouts always plot
 * 1 turn ahead whoever, if anyone, is aboard; and anything without a named
 * admiral plots as Level 3.
 */
export function requiredPlotLead(force: TaskForceProfile): number {
  return force.scout ? 1 : plotAheadTurns(force.admiral)
}

/** A pre-plotted FTL move (6.1): written on one turn, executed on a later one. */
export interface FtlPlot {
  taskForceId: string
  /** The turn the plot was written on — the pre-plotting requirement is measured from here. */
  plottedOnTurn: number
  /** The turn the move is executed on. */
  executeOnTurn: number
  /** The route, hex by hex: departure hex first, destination last (6.1). */
  path: Hex[]
  /** The order the force carries into whatever it meets (6.1). */
  order: FleetOrder
}

/** The map facts a plot is checked against. Plain data, so a plot is checkable from a save. */
export interface MovementContext {
  /** Hexes holding a gas or dust cloud (6.1, 6.2.1). */
  nebulae: readonly Hex[]
  /** Friendly command posts. "Command posts are free... the home system has one" (6.1). */
  commandPosts: readonly Hex[]
}

/**
 * What one step of a plotted route costs (6.1).
 *
 * "Gas and dust clouds may only be entered from an adjacent hex and cost a full
 * turn per hex inside; exit is at normal speed." A nebula hex therefore costs
 * the force's whole turn of movement, which is also what enforces the first
 * half of the sentence: a full-turn step can only be afforded as the first step
 * of a turn, so a nebula is always entered from the hex next door and never on
 * the back of a run-up. Leaving one costs the ordinary single hex.
 */
export function ftlStepCost(enteringNebula: boolean, rate: number): number {
  return enteringNebula ? rate : 1
}

export interface PlotValidation {
  legal: boolean
  /** Movement points the route spends, in hexes-a-turn. */
  cost: number
  /** Every rule the plot breaks, in the order they are checked. */
  reasons: string[]
}

/**
 * Check a pre-plotted FTL move against 6.1: the pre-plotting lead the admiral
 * demands, a contiguous route, the FTL rate, the nebula penalty and the
 * command-post leash.
 *
 * The whole route is leashed, not just its ends: a fleet that swings out to 9
 * hexes on the way is out of support for the turn it is out there, which is
 * what the rule is for.
 */
export function validateFtlPlot(
  plot: FtlPlot,
  force: TaskForceProfile,
  context: MovementContext,
): PlotValidation {
  const reasons: string[] = []
  const nebulae = new Set(context.nebulae.map(hexKey))

  const lead = plot.executeOnTurn - plot.plottedOnTurn
  const required = requiredPlotLead(force)
  if (lead < required) {
    reasons.push(`must be plotted ${required} turn(s) ahead; plotted ${lead}`)
  }

  if (plot.path.length === 0) {
    reasons.push('plot has no departure hex')
    return { legal: false, cost: 0, reasons }
  }

  let cost = 0
  for (let i = 1; i < plot.path.length; i++) {
    const from = plot.path[i - 1]
    const to = plot.path[i]
    if (hexDistance(from, to) !== 1) {
      reasons.push(`step ${i} from ${hexKey(from)} to ${hexKey(to)} is not to an adjacent hex`)
      continue
    }
    cost += ftlStepCost(nebulae.has(hexKey(to)), force.ftlRate)
  }
  if (cost > force.ftlRate) {
    reasons.push(`route costs ${cost} against an FTL rate of ${force.ftlRate}`)
  }

  if (!force.scout) {
    for (const hex of plot.path) {
      const nearest = context.commandPosts.reduce(
        (best, post) => Math.min(best, hexDistance(hex, post)),
        Number.POSITIVE_INFINITY,
      )
      if (nearest > COMMAND_POST_RANGE) {
        reasons.push(
          Number.isFinite(nearest)
            ? `${hexKey(hex)} is ${nearest} hexes from a friendly command post; the limit is ${COMMAND_POST_RANGE}`
            : `${hexKey(hex)} is out of reach: there is no friendly command post at all`,
        )
        break
      }
    }
  }

  return { legal: reasons.length === 0, cost, reasons }
}

/** Where a plot leaves the force, if it is legal. */
export function plotDestination(plot: FtlPlot): Hex {
  return plot.path[plot.path.length - 1]
}

// ---------------------------------------------------------------------------
// The order matrix (6.1)
// ---------------------------------------------------------------------------

/** What a meeting between two hostile task forces produces (6.1). */
export type { BattleKind } from './types'

export interface Meeting {
  kind: BattleKind
  /** Who is doing the chasing in a pursuit battle; null when nobody is. */
  pursuer: 'intruder' | 'defender' | null
}

/**
 * The Engage / Stand Off / FTL Move matrix (6.1), verbatim:
 *
 *                        | Def: Engage | Def: Stand Off | Def: FTL Move
 *   Intruder: Engage     | Even        | Even           | Pursuit
 *   Intruder: Stand Off  | Even        | None           | None
 *   Intruder: FTL Move   | Pursuit     | None           | None
 *
 * A pursuit only happens when one side means to fight and the other means to
 * leave, so the pursuer is whichever side wrote Engage — which is the fact the
 * tactical deployment needs and the table alone does not say.
 */
export function resolveMeeting(intruder: FleetOrder, defender: FleetOrder): Meeting {
  if (intruder === 'engage') {
    if (defender === 'ftl-move') return { kind: 'pursuit', pursuer: 'intruder' }
    return { kind: 'even', pursuer: null }
  }
  if (intruder === 'stand-off') {
    return defender === 'engage' ? { kind: 'even', pursuer: null } : { kind: 'none', pursuer: null }
  }
  // The intruder is trying to pass through; only a defender that engages stops it.
  return defender === 'engage'
    ? { kind: 'pursuit', pursuer: 'defender' }
    : { kind: 'none', pursuer: null }
}

// ---------------------------------------------------------------------------
// Phase 2 — Exploration (6.2.1)
// ---------------------------------------------------------------------------

/**
 * The d100 system-generation tables of 6.2.1 live in `map.ts`; the exploration
 * phase only decides *which* hexes are rolled for, and takes the generator as
 * an argument so the two modules never have to agree on more than this shape.
 */
export type SystemGenerator = (hex: Hex, rng: CampaignRng) => ExploredSystem

/**
 * Explore every hex a task force has reached that nobody has explored yet
 * (turn sequence 2). Already-known hexes draw no dice, so re-entering a system
 * cannot shift the campaign's stream.
 */
export function explorationPhase(
  reached: readonly Hex[],
  alreadyExplored: readonly Hex[],
  generate: SystemGenerator,
  rng: CampaignRng,
): ExploredSystem[] {
  const known = new Set(alreadyExplored.map(hexKey))
  const found: ExploredSystem[] = []
  for (const hex of reached) {
    const key = hexKey(hex)
    if (known.has(key)) continue
    known.add(key)
    found.push(generate(hex, rng))
  }
  return found
}

// ---------------------------------------------------------------------------
// Phase 3 — Exploration risk (6.2.1)
// ---------------------------------------------------------------------------

export interface HazardCheck {
  dice: [number, number]
  modifiers: RollModifier[]
  modifier: number
  total: number
  /** True when a target was supplied and the roll met it. */
  safe: boolean | null
}

/**
 * The exploration hazard roll (turn sequence 3).
 *
 * campaign.md names a modifier for this check — a dense asteroid field puts
 * "exploration hazard rolls at −1" (6.2.1) — but never prints the table the
 * roll is read against, so the threshold is the caller's (in practice the GM's)
 * to state. The roll itself is made here anyway, because a GM ruling made over
 * dice from the campaign's own stream is a ruling that replays; one made over
 * dice from somewhere else is not.
 *
 * 2d6 because every other modified check the campaign prints — detection, the
 * discovery check, the drop pod launch — is 2d6, and a ±1 means nothing on the
 * d100 tables of 6.2.1.
 */
export function explorationHazardCheck(
  rng: CampaignRng,
  opts: { denseAsteroidField?: boolean; drm?: number; target?: number } = {},
): HazardCheck {
  const modifiers: RollModifier[] = []
  if (opts.denseAsteroidField) modifiers.push({ label: 'Dense asteroid field', value: -1 })
  if (opts.drm) modifiers.push({ label: 'Other', value: opts.drm })
  const modifier = totalModifier(modifiers)
  const dice = draw2d6(rng)
  const total = dice[0] + dice[1] + modifier
  return {
    dice,
    modifiers,
    modifier,
    total,
    safe: opts.target === undefined ? null : total >= opts.target,
  }
}

// ---------------------------------------------------------------------------
// Phase 4 — Discovery (8, end)
// ---------------------------------------------------------------------------

/** One declared attempt to find out what is in a hex (turn sequence 4, 8 end). */
export interface DiscoveryAttempt {
  observerId: string
  targetId: string
  context: DetectionContext
}

export interface DiscoveryFinding {
  observerId: string
  targetId: string
  result: DetectionResult
}

/**
 * The discovery phase: every declared detection check, in the order they were
 * declared (turn sequence 4). The check itself is the one in "Detection (8,
 * end)" — the nebula's own "external discovery checks at −2" in 6.2.1 is the
 * same −2 the detection table lists, which is why there is only one check here
 * and not two.
 */
export function discoveryPhase(
  attempts: readonly DiscoveryAttempt[],
  rng: CampaignRng,
): DiscoveryFinding[] {
  return attempts.map((attempt) => ({
    observerId: attempt.observerId,
    targetId: attempt.targetId,
    result: detectionCheck(attempt.context, rng),
  }))
}

// ---------------------------------------------------------------------------
// Phase 5 — Combat: from a meeting to a tactical battle
// ---------------------------------------------------------------------------

/** One ship of a fleet as the campaign carries it between battles. */
export interface CampaignBattleShip {
  /** A `ShipDesign` id the tactical layer can look up or embed. */
  designId: string
  /** The individual ship's name; the class name is the design's. */
  name?: string
  /** Entry velocity. Defaults to the design's drive rating. */
  velocity?: number
}

/** One side of a campaign engagement. */
export interface CampaignBattleForce {
  id: SideId
  name: string
  /** The force that moved in is the intruder; the one already there defends (6.1). */
  role: 'intruder' | 'defender'
  order: FleetOrder
  /** The commanding admiral's level, after `effectiveCommandLevel` (7). */
  admiral: CommandLevel | null
  ships: readonly CampaignBattleShip[]
}

/**
 * A battle the campaign has decided to fight (turn sequence 5). It carries its
 * own seed, drawn from the campaign's stream, so the tactical battle's dice
 * descend from the campaign's — and a campaign replays down to the last beam
 * die.
 */
export interface CampaignEngagement {
  id: string
  hex: Hex
  kind: 'even' | 'pursuit'
  pursuer: 'intruder' | 'defender' | null
  feature: SystemFeature
  seed: number
  forces: readonly [CampaignBattleForce, CampaignBattleForce]
}

/**
 * Decide whether two task forces meeting in a hex fight, and if so how (6.1).
 * Returns null when the order matrix says there is no battle — and draws no
 * dice in that case, so a turn full of stand-offs does not move the stream.
 */
export function planEngagement(
  hex: Hex,
  feature: SystemFeature,
  intruder: Omit<CampaignBattleForce, 'role'>,
  defender: Omit<CampaignBattleForce, 'role'>,
  rng: CampaignRng,
): CampaignEngagement | null {
  const meeting = resolveMeeting(intruder.order, defender.order)
  if (meeting.kind === 'none') return null
  // Drawn here rather than handed in, so the battle's seed is a function of the
  // campaign's seed and its move journal — nothing outside the campaign.
  const seed = drawInt(rng, 0x7fffffff)
  return {
    id: `engagement-${hexKey(hex)}-${seed}`,
    hex,
    kind: meeting.kind,
    pursuer: meeting.pursuer,
    feature,
    seed,
    forces: [
      { ...intruder, role: 'intruder' },
      { ...defender, role: 'defender' },
    ],
  }
}

/** "+1 fleet initiative" / "−1" for the admiral commanding this force (7). */
export function fleetInitiativeModifier(force: CampaignBattleForce): number {
  return initiativeModifier(force.admiral)
}

// ---------------------------------------------------------------------------
// The bridge to the tactical layer
// ---------------------------------------------------------------------------

/** A standard 6' × 4' table (2.1), which is what a campaign battle is fought on. */
export const CAMPAIGN_TABLE: TableSize = { width: 72, height: 48 }

/**
 * "The campaign bars three systems from ship design outright: Reflex Shield,
 * Cloaking Field and Wave Gun" ("Banned systems"). The ids are the tactical
 * layer's own — `SystemKind` for the first two, `WeaponClass` for the third.
 */
export const CAMPAIGN_BANNED_SYSTEMS: readonly string[] = [
  'reflex-field',
  'cloaking-field',
  'wave-gun',
]

/** A ship with no known design enters with way on, rather than dead in space. */
const DEFAULT_ENTRY_VELOCITY = 6

function entryVelocity(ship: CampaignBattleShip): number {
  if (ship.velocity !== undefined) return ship.velocity
  // A fleet caught in transit is already moving, and a drive rating is the one
  // honest guess at how fast: a thrust-6 cruiser closes at 6.
  return designById(ship.designId)?.drive.thrust ?? DEFAULT_ENTRY_VELOCITY
}

function deployLine(
  ships: readonly CampaignBattleShip[],
  y: number,
  facing: Course,
  spread: { from: number; to: number },
): ForceEntry[] {
  const step = ships.length > 1 ? (spread.to - spread.from) / (ships.length - 1) : 0
  return ships.map((ship, index) => {
    const entry: ForceEntry = {
      designId: ship.designId,
      position: { x: spread.from + step * index, y },
      facing,
      velocity: entryVelocity(ship),
    }
    if (ship.name !== undefined) entry.name = ship.name
    return entry
  })
}

/** How a system feature reads in a battle briefing (6.2.1). */
const CAMPAIGN_SYSTEM_FEATURE_LABELS: Readonly<Record<SystemFeature, string>> = {
  standard: 'standard system',
  nebula: 'gas and dust cloud',
  'dense-asteroid-field': 'dense asteroid field',
  'multiple-star': 'binary or trinary star',
}

export interface EngagementScenarioOptions {
  /** Override the table a campaign battle is fought on. */
  table?: TableSize
  /** Cap the battle's length, as a scenario may (4.12). */
  turnLimit?: number
}

/**
 * Turn a campaign engagement into the tactical layer's `Scenario` (turn
 * sequence 5). This is the join between the two games: what comes back is the
 * same shape `startScenario` builds a `GameState` from, so a campaign battle is
 * fought with the real rules engine and saved as an ordinary battle file.
 *
 * Deployment follows from the order matrix rather than being chosen:
 *
 *  - an **even battle** is two fleets that both meant to be there, so they
 *    deploy facing one another across the table, as the introductory scenario
 *    does (4.12);
 *  - a **pursuit battle** is a stern chase — one side wrote FTL Move and is
 *    leaving — so both fleets face the same way with the quarry ahead and the
 *    pursuer astern, and the quarry wins by running off the table edge it is
 *    pointed at (3.9 disengagement).
 */
export function engagementScenario(
  engagement: CampaignEngagement,
  opts: EngagementScenarioOptions = {},
): Scenario {
  const table = opts.table ?? CAMPAIGN_TABLE
  const [intruder, defender] = engagement.forces
  const wide = { from: table.width * 0.28, to: table.width * 0.72 }

  let sides: ScenarioSide[]
  let briefing: string
  let objective: string

  if (engagement.kind === 'pursuit') {
    const quarry = engagement.pursuer === 'intruder' ? defender : intruder
    const chaser = engagement.pursuer === 'intruder' ? intruder : defender
    // Facing 12 runs up the table towards y = 0 (3.1), so the quarry is placed
    // nearer that edge and the pursuer astern of it on the same heading.
    sides = [
      { id: quarry.id, name: quarry.name, force: deployLine(quarry.ships, table.height * 0.3, 12, wide) },
      { id: chaser.id, name: chaser.name, force: deployLine(chaser.ships, table.height * 0.72, 12, wide) },
    ]
    briefing =
      `${chaser.name} caught ${quarry.name} breaking for FTL in ${hexKey(engagement.hex)} and ran them down. ` +
      'The chase is already at speed and the range is closing from astern.'
    objective =
      `${quarry.name} escapes by leaving the table under way or by FTL; ${chaser.name} must break them before they do.`
  } else {
    sides = [
      { id: intruder.id, name: intruder.name, force: deployLine(intruder.ships, table.height * 0.2, 6, wide) },
      { id: defender.id, name: defender.name, force: deployLine(defender.ships, table.height * 0.8, 12, wide) },
    ]
    briefing =
      `${intruder.name} came out of FTL in ${hexKey(engagement.hex)} and found ${defender.name} waiting. ` +
      'Both fleets mean to be here. Clear for action.'
    objective = 'Inflict more losses on your opponent than they inflict on you.'
  }

  const feature = engagement.feature
  if (feature !== 'standard') {
    briefing += ` The system is a ${CAMPAIGN_SYSTEM_FEATURE_LABELS[feature]}.`
  }

  // The tactical engine's initiative roll (2.6 phase 2) takes no DRM, so an
  // admiral's ±1 fleet initiative cannot be applied inside it; it is stated in
  // the briefing so the table can apply it, and carried on the engagement for
  // the campaign layer.
  const admiralNotes = engagement.forces
    .map((force) => ({ force, modifier: fleetInitiativeModifier(force) }))
    .filter((entry) => entry.modifier !== 0)
    .map((entry) => `${entry.force.name}: ${entry.modifier > 0 ? '+' : ''}${entry.modifier} fleet initiative`)
  if (admiralNotes.length > 0) briefing += ` Admirals: ${admiralNotes.join('; ')}.`

  const scenario: Scenario = {
    id: engagement.id,
    name: engagement.kind === 'pursuit' ? 'Campaign pursuit' : 'Campaign engagement',
    briefing,
    objective,
    table,
    sides,
    victory: INTRODUCTORY_VICTORY,
  }
  if (opts.turnLimit !== undefined) scenario.turnLimit = opts.turnLimit
  return scenario
}

/**
 * The whole battle setup a campaign engagement produces: the scenario embedded
 * whole, the engagement's own seed, and the three systems the campaign bans
 * from ship design ("Banned systems"). Hand this to `buildGame` and the battle
 * opens.
 */
export function engagementSetup(
  engagement: CampaignEngagement,
  opts: EngagementScenarioOptions = {},
): GameSetup {
  const scenario = engagementScenario(engagement, opts)
  return {
    scenarioId: scenario.id,
    seed: engagement.seed,
    customScenario: scenario,
    bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
  }
}

// ---------------------------------------------------------------------------
// Phase 6 — Planetary (6.4)
// ---------------------------------------------------------------------------

/** "Ortillery in orbit removes 1 million population per battery per turn" (6.4). */
export const ORTILLERY_KILL_PER_BATTERY = 1

/** "costs the owner 75% of the colony's industrial output" (6.4). */
export const SUBJECT_POPULATION_OUTPUT_PENALTY = 0.75

/** "Converting them runs 100 RP per million through an Integration Program" (6.4). */
export const INTEGRATION_COST_PER_MILLION = 100

/** A hazardous world costs "500 RP stabilisation to colonise" (6.2.1). */
export const HAZARDOUS_STABILISATION_RP = 500

/** One colony, as the planetary and admin phases need it (6.4, 6.5). */
export interface Colony {
  id: string
  hex: Hex
  owner: string
  planetType: PlanetType
  planetTrait: PlanetTrait
  /** Population in millions — "1 million population = 20 RP" ("Economy"). */
  population: number
  /** Of that, how many million are Subject Population (6.4). */
  subjectPopulation: number
  factories: number
  /** Planetary Defence Units and Advanced PDUs in place ("Price schedule"). */
  pdu: number
  advancedPdu: number
  planetShield: boolean
  /** A yard makes the colony a repair port for hull, armour and core damage (6.3). */
  shipyard: boolean
  /** "Command posts... may be established on any controlled colony" (6.1). */
  commandPost: boolean
  /** Set while an enemy warship is in-system (6.4). */
  underSiege: boolean
  /** "produces nothing for its new owner for one production phase" (6.4). */
  productionBlockedPhases: number
  /** Set by an unrest disturbance; "blocks building next phase" (6.4). */
  buildingBlocked: boolean
}

/** What a siege takes away and what it leaves (6.4). */
export interface SiegeStatus {
  underSiege: boolean
  canBuildStarships: boolean
  canBuildDefences: boolean
  generatesRp: boolean
  actsAsCommandPost: boolean
}

/**
 * "A colony with an enemy warship in-system is under siege: it cannot build
 * starships or act as a command post, but still generates RP and can build
 * defences" (6.4).
 */
export function siegeStatus(colony: Colony, enemyWarshipsInSystem: number): SiegeStatus {
  const underSiege = enemyWarshipsInSystem > 0
  return {
    underSiege,
    canBuildStarships: !underSiege,
    canBuildDefences: true,
    generatesRp: true,
    actsAsCommandPost: colony.commandPost && !underSiege,
  }
}

/**
 * Conquest (6.4): the colony changes hands, "produces nothing for its new owner
 * for one production phase", and "its people become Subject Population". The
 * siege ends with the capture — the besiegers now own the place.
 */
export function captureColony(colony: Colony, newOwner: string): Colony {
  colony.owner = newOwner
  colony.subjectPopulation = colony.population
  colony.productionBlockedPhases = 1
  colony.underSiege = false
  return colony
}

/** What a subject population costs its new owner each production phase (6.4). */
export function subjectPopulationCost(industrialOutput: number): number {
  return industrialOutput * SUBJECT_POPULATION_OUTPUT_PENALTY
}

/** "100 RP per million through an Integration Program" (6.4). */
export function integrationCost(millions: number): number {
  return Math.max(0, millions) * INTEGRATION_COST_PER_MILLION
}

/**
 * Run an Integration Program against a budget (6.4). Whole millions only: the
 * programme converts people, and a colony cannot part-convert one.
 */
export function integrate(colony: Colony, millions: number, budget: number): { converted: number; spent: number } {
  const affordable = Math.floor(budget / INTEGRATION_COST_PER_MILLION)
  const converted = Math.max(0, Math.min(Math.floor(millions), colony.subjectPopulation, affordable))
  colony.subjectPopulation -= converted
  return { converted, spent: integrationCost(converted) }
}

export interface BombardmentResult {
  /** Millions of population removed. */
  killed: number
  /** Set when a planet shield stopped the bombardment. */
  refusedReason?: string
}

/**
 * Orbital bombardment (6.4): "Ortillery in orbit removes 1 million population
 * per battery per turn."
 *
 * campaign.md prices a planet shield but never states what it does, and the one
 * thing a shield over a planet can only be for is stopping fire from orbit — so
 * an intact shield refuses the bombardment here. That is an inference, and it
 * is the only one in this function.
 */
export function orbitalBombardment(colony: Colony, batteries: number): BombardmentResult {
  if (colony.planetShield) {
    return { killed: 0, refusedReason: 'planet shield intact' }
  }
  const killed = Math.max(0, Math.min(colony.population, Math.floor(batteries) * ORTILLERY_KILL_PER_BATTERY))
  colony.population -= killed
  // The dead are not sorted by allegiance; a subject population cannot outlive
  // the population it is part of.
  colony.subjectPopulation = Math.min(colony.subjectPopulation, colony.population)
  return { killed }
}

export interface ColonisationCheck {
  allowed: boolean
  /** RP that must be paid before anyone lands (6.2.1 hazardous trait). */
  stabilisation: number
  reason?: string
}

/**
 * Whether a world can be colonised at all (6.2.1): a gas giant cannot, a barren
 * world "needs C.E.T. to colonise", a hazardous world needs 500 RP of
 * stabilisation first, and a special anomaly is the GM's to narrate.
 */
export function canColonise(
  planetType: PlanetType,
  planetTrait: PlanetTrait,
  known: readonly TechId[],
): ColonisationCheck {
  const stabilisation = planetTrait === 'hazardous' ? HAZARDOUS_STABILISATION_RP : 0
  if (planetType === 'gas-giant') {
    return { allowed: false, stabilisation, reason: 'gas giants cannot be colonised' }
  }
  if (planetType === 'special-anomaly') {
    return { allowed: false, stabilisation, reason: 'special anomaly — the GM narrates' }
  }
  if (planetType === 'barren' && !known.includes('controlled-environment')) {
    return { allowed: false, stabilisation, reason: 'a barren world needs Controlled Environment Technology' }
  }
  return { allowed: true, stabilisation }
}

export interface ColonisationOrder {
  colonyId: string
  hex: Hex
  owner: string
  planetType: PlanetType
  planetTrait: PlanetTrait
  /** Colony transports landed; each carries a million colonists ("Economy"). */
  transports: number
}

export interface ColonisationResult {
  colony: Colony | null
  spent: number
  refusedReason?: string
}

/**
 * Found a colony (turn sequence 6, "landings"). Each colony transport carries
 * "a million colonists each" ("Economy"), so the transports landed are the new
 * colony's population in millions.
 */
export function colonise(
  order: ColonisationOrder,
  known: readonly TechId[],
  budget: number,
): ColonisationResult {
  const check = canColonise(order.planetType, order.planetTrait, known)
  if (!check.allowed) return { colony: null, spent: 0, refusedReason: check.reason }
  if (check.stabilisation > budget) {
    return { colony: null, spent: 0, refusedReason: `stabilisation costs ${check.stabilisation} RP` }
  }
  if (order.transports <= 0) return { colony: null, spent: 0, refusedReason: 'no colonists landed' }

  return {
    colony: {
      id: order.colonyId,
      hex: order.hex,
      owner: order.owner,
      planetType: order.planetType,
      planetTrait: order.planetTrait,
      population: Math.floor(order.transports),
      subjectPopulation: 0,
      factories: 0,
      pdu: 0,
      advancedPdu: 0,
      planetShield: false,
      shipyard: false,
      commandPost: false,
      underSiege: false,
      productionBlockedPhases: 0,
      buildingBlocked: false,
    },
    spent: check.stabilisation,
  }
}

export type AssaultOutcome = 'conquered' | 'repulsed'

export interface AssaultResult {
  outcome: AssaultOutcome
  reason: string
}

/**
 * A planetary assault (turn sequence 6).
 *
 * campaign.md prints no ground-combat table — the only planetary defences it
 * gives numbers for are PDUs, Advanced PDUs and the planet shield — so the
 * assault is resolved on the conditions the document does state, with no dice
 * invented to fill the gap: troops must be landed, the orbit must be clear of
 * the defender's warships, and the works over the colony must be down. When all
 * three hold the colony falls and `captureColony` applies conquest; otherwise
 * the assault is repulsed and the GM arbitrates anything finer.
 */
export function resolveAssault(
  colony: Colony,
  attack: { attacker: string; marineParties: number; defendingWarshipsInSystem: number },
): AssaultResult {
  if (attack.marineParties <= 0) return { outcome: 'repulsed', reason: 'no troops landed' }
  if (attack.defendingWarshipsInSystem > 0) {
    return { outcome: 'repulsed', reason: 'the defender still holds the orbit' }
  }
  if (colony.planetShield) return { outcome: 'repulsed', reason: 'the planet shield is intact' }
  if (colony.pdu > 0 || colony.advancedPdu > 0) {
    return { outcome: 'repulsed', reason: 'planetary defence units are still firing' }
  }
  captureColony(colony, attack.attacker)
  return { outcome: 'conquered', reason: 'the colony is taken' }
}

/** Everything a player asks the planetary phase to do this turn (turn sequence 6). */
export interface PlanetaryOrders {
  /** Enemy warships in each colony's system, by colony id — what sets a siege (6.4). */
  enemyWarships?: Readonly<Record<string, number>>
  bombard?: ReadonlyArray<{ colonyId: string; batteries: number }>
  assault?: ReadonlyArray<{ colonyId: string; attacker: string; marineParties: number; defendingWarshipsInSystem: number }>
}

export interface PlanetaryPhaseResult {
  sieges: Array<{ colonyId: string; status: SiegeStatus }>
  bombardments: Array<{ colonyId: string; result: BombardmentResult }>
  assaults: Array<{ colonyId: string; result: AssaultResult }>
}

/**
 * The planetary phase in the order the rules put it (6.4): sieges are marked
 * first because a siege is a state the rest of the phase reads, then the guns
 * in orbit fire, then the troops go in — an assault is only possible once the
 * bombardment has had its turn.
 */
export function planetaryPhase(colonies: Colony[], orders: PlanetaryOrders): PlanetaryPhaseResult {
  const byId = new Map(colonies.map((colony) => [colony.id, colony]))
  const result: PlanetaryPhaseResult = { sieges: [], bombardments: [], assaults: [] }

  for (const colony of colonies) {
    const status = siegeStatus(colony, orders.enemyWarships?.[colony.id] ?? 0)
    colony.underSiege = status.underSiege
    result.sieges.push({ colonyId: colony.id, status })
  }

  for (const order of orders.bombard ?? []) {
    const colony = byId.get(order.colonyId)
    if (!colony) continue
    result.bombardments.push({ colonyId: colony.id, result: orbitalBombardment(colony, order.batteries) })
  }

  for (const order of orders.assault ?? []) {
    const colony = byId.get(order.colonyId)
    if (!colony) continue
    result.assaults.push({ colonyId: colony.id, result: resolveAssault(colony, order) })
  }

  return result
}

// ---------------------------------------------------------------------------
// Phase 7 — Admin (6.3, 6.4)
// ---------------------------------------------------------------------------

export interface UnrestResult {
  colonyId: string
  dice: number[]
  /** How many dice came up 1 (6.4). */
  disturbances: number
  /** The 1d6 × 100 RP each disturbance costs. */
  costDice: number[]
  cost: number
  buildingBlocked: boolean
}

/**
 * The subject-population unrest check (6.4): "1d6 per 5M subject population
 * each admin phase; a 1 costs 1d6 × 100 RP and blocks building next phase".
 *
 * The dice are per *full* five million — a colony with four million subjects
 * has nobody enough to muster a disturbance — and each 1 is costed separately,
 * because the rule prices the disturbance and not the check.
 */
export function unrestCheck(colony: Colony, rng: CampaignRng): UnrestResult {
  const count = Math.floor(colony.subjectPopulation / 5)
  const dice: number[] = []
  const costDice: number[] = []
  let cost = 0
  for (let i = 0; i < count; i++) {
    const die = drawD6(rng)
    dice.push(die)
    if (die === 1) {
      const costDie = drawD6(rng)
      costDice.push(costDie)
      cost += costDie * 100
    }
  }
  const buildingBlocked = costDice.length > 0
  if (buildingBlocked) colony.buildingBlocked = true
  return { colonyId: colony.id, dice, disturbances: costDice.length, costDice, cost, buildingBlocked }
}

/** A ship between strategic turns, for the repair rules of 6.3. */
export interface ShipRepairRecord {
  id: string
  /** Did this ship fight a battle this turn? */
  foughtThisTurn: boolean
  /** Weapons, drives and the like knocked out by threshold checks (4.11). */
  systemDamage: number
  hullDamage: number
  armourDamage: number
  coreDamage: number
  /** Ended its move at a friendly colony with a shipyard (6.3). */
  atShipyard: boolean
}

export interface RepairResult {
  shipId: string
  systemsRepaired: number
  hullRepaired: number
  armourRepaired: number
  coreRepaired: number
}

/**
 * Repair between strategic turns (6.3): "System damage (weapons, drives)
 * repairs itself between strategic turns if the ship fights no other battle.
 * Hull, armour and core damage needs the ship to end its move at a friendly
 * colony with a shipyard."
 *
 * Expendables are deliberately untouched — "missiles, fighters are not replaced
 * free; buy them again in a production phase" (6.3), which is an economy
 * purchase and not a repair.
 */
export function repairBetweenTurns(ship: ShipRepairRecord): RepairResult {
  const result: RepairResult = { shipId: ship.id, systemsRepaired: 0, hullRepaired: 0, armourRepaired: 0, coreRepaired: 0 }
  if (!ship.foughtThisTurn) {
    result.systemsRepaired = ship.systemDamage
    ship.systemDamage = 0
  }
  if (ship.atShipyard) {
    result.hullRepaired = ship.hullDamage
    result.armourRepaired = ship.armourDamage
    result.coreRepaired = ship.coreDamage
    ship.hullDamage = 0
    ship.armourDamage = 0
    ship.coreDamage = 0
  }
  return result
}

export interface AdminPhaseResult {
  unrest: UnrestResult[]
  repairs: RepairResult[]
}

/**
 * The admin phase (turn sequence 7): record the turn. Unrest is checked here
 * because 6.4 says it is checked "each admin phase", and repair resolves here
 * because 6.3 puts it "between strategic turns".
 */
export function adminPhase(
  colonies: Colony[],
  ships: ShipRepairRecord[],
  rng: CampaignRng,
): AdminPhaseResult {
  const unrest: UnrestResult[] = []
  for (const colony of colonies) {
    if (colony.subjectPopulation >= 5) unrest.push(unrestCheck(colony, rng))
  }
  return { unrest, repairs: ships.map(repairBetweenTurns) }
}

// ---------------------------------------------------------------------------
// Phase 8 — Production, every 4th turn (6.5)
// ---------------------------------------------------------------------------

export interface ProductionEligibility {
  colonyId: string
  /** False for a colony still inside the production phase it was captured in (6.4). */
  produces: boolean
  /** False when unrest blocked building (6.4), or a siege blocked starships (6.4). */
  canBuildStarships: boolean
  canBuildDefences: boolean
}

/**
 * What each colony may do this production phase (6.4, 6.5). The arithmetic of
 * growth, output and research — "Population grows... output is 50 RP per
 * million population plus 50 RP per active factory, doubled on a mineral-rich
 * world" — belongs to `economy.ts` and `research.ts`; this function is the turn
 * sequence's part of it: who is allowed to take part, and clearing the one-off
 * blocks as they are spent.
 */
export function productionPhase(colonies: Colony[]): ProductionEligibility[] {
  return colonies.map((colony) => {
    const blockedByCapture = colony.productionBlockedPhases > 0
    const blockedByUnrest = colony.buildingBlocked
    const eligibility: ProductionEligibility = {
      colonyId: colony.id,
      produces: !blockedByCapture,
      canBuildStarships: !blockedByCapture && !blockedByUnrest && !colony.underSiege,
      canBuildDefences: !blockedByCapture && !blockedByUnrest,
    }
    // Both blocks are for one phase only, and this is that phase.
    if (blockedByCapture) colony.productionBlockedPhases -= 1
    colony.buildingBlocked = false
    return eligibility
  })
}

// ---------------------------------------------------------------------------
// The move journal
// ---------------------------------------------------------------------------

/**
 * The alphabet of the campaign's move journal. A campaign is `(setup + these)`,
 * and each one names ids and player choices only — never a derived result — for
 * the same reason the tactical journal does (docs/architecture.md): a handler
 * re-derives its context from the campaign state, so a stale or hand-edited
 * move cannot make a replay disagree with the campaign it is replaying.
 */
export type CampaignMove =
  | { kind: 'plot-ftl'; plot: FtlPlot }
  | { kind: 'explore'; taskForceId: string; hex: Hex }
  | { kind: 'exploration-risk'; taskForceId: string; hex: Hex; denseAsteroidField?: boolean }
  | { kind: 'detect'; observerId: string; targetId: string; context: DetectionContext }
  | { kind: 'espionage'; spyId: string; targetId: string; mission: EspionageMission }
  | { kind: 'counter-espionage'; faction: string; hex: Hex; levels: number }
  | { kind: 'bombard'; colonyId: string; batteries: number }
  | { kind: 'assault'; colonyId: string; attacker: string; marineParties: number }
  | { kind: 'colonise'; order: ColonisationOrder }
  | { kind: 'integrate'; colonyId: string; millions: number }
  | { kind: 'recruit-admiral'; admiralId: string; name: string; faction: string }
  | { kind: 'research'; faction: string; requests: ResearchRequest[] }

/** Which phase each move belongs in — the journal's ordering rule. */
export const MOVE_PHASE: Readonly<Record<CampaignMove['kind'], CampaignPhase>> = {
  'plot-ftl': 'ftl-movement',
  explore: 'exploration',
  'exploration-risk': 'exploration-risk',
  detect: 'discovery',
  espionage: 'discovery',
  'counter-espionage': 'discovery',
  bombard: 'planetary',
  assault: 'planetary',
  colonise: 'planetary',
  integrate: 'planetary',
  'recruit-admiral': 'production',
  research: 'production',
}

/** True when a move is legal in the phase the campaign has reached. */
export function moveIsInPhase(move: CampaignMove, clock: CampaignClock): boolean {
  return MOVE_PHASE[move.kind] === clock.phase
}
