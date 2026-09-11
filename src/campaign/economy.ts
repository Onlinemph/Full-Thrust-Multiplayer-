/**
 * Stellar Imperium — the economy: the production phase (6.5), the Subject
 * Population rules that tax it (6.4), the price schedule, and the shipyards
 * that turn RP into hulls.
 *
 * The one fact the whole price list hangs on: **one Full Thrust point costs one
 * RP**, so a ship's price *is* its Combat Points Value and `shipPrice` reads it
 * off the design rather than re-deriving it. The construction tables are the
 * single source of truth for both games, which is the point of the rule.
 *
 * Everything here is pure except for the functions that say so: the production
 * phase marks up colonies the way the tactical engine marks up an SSD, in
 * place, and every die it needs comes from the campaign's own seeded stream, so
 * a production phase replays exactly — same growth, same disasters, same riots.
 */

import type { ShipDesign } from '../engine/types'
import {
  rollD20,
  rollD6,
  type Colony,
  type PlanetaryBody,
  type PlanetType,
  type PlayerId,
  type PurchaseItem,
  type RandomStream,
  type TechnologyId,
} from './types'

// ---------------------------------------------------------------------------
// The price schedule (Price schedule, 6.4, 7, 9)
// ---------------------------------------------------------------------------

/** A price, and the technology a player must already hold to pay it. */
export interface PriceEntry {
  rp: number
  requires: TechnologyId | null
  note: string
}

/**
 * The price schedule, as printed, plus the prices the rest of the document
 * states in prose: an admiral is 100 RP (7), a hazardous world costs 500 RP to
 * stabilise before it can be settled (6.2.1), a drop pod is 50 RP and a sleeper
 * spy 100 RP, and counter-espionage is 200 RP a level (9). A command post is
 * free and may be established on any controlled colony (6.1).
 *
 * Starships and shipyards are not in here because they are not fixed prices:
 * see `shipPrice` and `shipyardPrice`.
 */
export const PRICE_SCHEDULE: Record<
  Exclude<PurchaseItem['kind'], 'starship' | 'shipyard'>,
  PriceEntry
> = {
  'colony-transport': { rp: 50, requires: null, note: 'Carries one million colonists.' },
  'scout-drone': { rp: 150, requires: null, note: 'Ignores the 8-hex command-post limit (6.1).' },
  factory: { rp: 2000, requires: 'industrial', note: '50 RP a production phase while active.' },
  pdu: { rp: 200, requires: 'pdu', note: 'Planetary Defence Unit.' },
  'advanced-pdu': { rp: 500, requires: 'advanced-pdu', note: 'Advanced Planetary Defence Unit.' },
  'planet-shield': { rp: 1500, requires: 'planet-shield', note: 'One per colony.' },
  'command-post': { rp: 0, requires: null, note: 'Free, on any controlled colony (6.1).' },
  'hazard-stabilisation': {
    rp: 500,
    requires: null,
    note: 'Stabilises a hazardous world so it can be colonised (6.2.1).',
  },
  admiral: { rp: 100, requires: null, note: 'Command level rolled on 1d6 (7).' },
  'drop-pod': { rp: 50, requires: null, note: 'Launched on 7+ on 2d6 (9).' },
  'sleeper-spy': { rp: 100, requires: null, note: '+1 on the spying roll (9).' },
  'counter-espionage': {
    rp: 200,
    requires: null,
    note: 'Per level; −1 to every discovery check in the system that turn (9).',
  },
}

/**
 * A ship's price in RP (Economy): "One Full Thrust point costs 1 RP, so the
 * tactical points model *is* the strategic price list." The Combat Points Value
 * on the design is that number — it is never recomputed here, because a
 * campaign that priced a hull differently from the battle it fights in would
 * be two games rather than one.
 */
export function shipPrice(design: ShipDesign): number {
  return design.points
}

/**
 * What a purchase costs, in RP. `design` is only consulted for a starship, and
 * a shipyard is priced off its two ratings (see `shipyardPrice`).
 */
export function priceOf(
  item: PurchaseItem,
  opts: { design?: (designId: string) => ShipDesign | undefined; breathableWorld?: boolean } = {},
): number {
  if (item.kind === 'starship') {
    const design = opts.design?.(item.designId)
    if (!design) throw new Error(`Unknown ship design: ${item.designId}`)
    return shipPrice(design)
  }
  if (item.kind === 'shipyard') {
    return shipyardPrice({
      throughput: item.throughput,
      capacity: item.capacity,
      orbital: item.orbital,
      breathableWorld: opts.breathableWorld ?? false,
    }).rp
  }
  return PRICE_SCHEDULE[item.kind].rp
}

/** The technology a purchase needs, or null if anyone may buy it. */
export function requiredTechnology(item: PurchaseItem): TechnologyId | null {
  if (item.kind === 'starship' || item.kind === 'shipyard') return null
  return PRICE_SCHEDULE[item.kind].requires
}

// ---------------------------------------------------------------------------
// Shipyards (Shipyards)
// ---------------------------------------------------------------------------

/** One rating from a shipyard table: what it does, what it costs, what it masses. */
export interface ShipyardRating {
  rating: number
  rp: number
  mass: number
}

/**
 * The first rating: RP the yard can process in a turn (Shipyards). A hull that
 * costs more than this takes more than one turn to build.
 */
export const SHIPYARD_THROUGHPUT_RATINGS: readonly ShipyardRating[] = [
  { rating: 10, rp: 250, mass: 25 },
  { rating: 30, rp: 500, mass: 150 },
  { rating: 50, rp: 1000, mass: 250 },
  { rating: 70, rp: 2000, mass: 350 },
  { rating: 100, rp: 3000, mass: 400 },
  { rating: 125, rp: 3750, mass: 500 },
]

/** The second rating: the largest hull mass the yard can build (Shipyards). */
export const SHIPYARD_CAPACITY_RATINGS: readonly ShipyardRating[] = [
  { rating: 25, rp: 250, mass: 50 },
  { rating: 50, rp: 500, mass: 100 },
  { rating: 100, rp: 1000, mass: 200 },
  { rating: 200, rp: 2000, mass: 400 },
  { rating: 300, rp: 3000, mass: 500 },
  { rating: 400, rp: 4000, mass: 600 },
]

/** The throughput row for a rating, or undefined if the table has no such yard. */
export function throughputRating(rating: number): ShipyardRating | undefined {
  return SHIPYARD_THROUGHPUT_RATINGS.find((row) => row.rating === rating)
}

/** The capacity row for a rating, or undefined if the table has no such yard. */
export function capacityRating(rating: number): ShipyardRating | undefined {
  return SHIPYARD_CAPACITY_RATINGS.find((row) => row.rating === rating)
}

/**
 * What a shipyard costs and masses (Shipyards). A yard is bought as a pair of
 * ratings — how much RP it can process in a turn, and how big a hull it can
 * hold — so its price is the two rows added together.
 *
 * "A planetary base on a breathable world pays half the hull cost", so a
 * planetary yard on a Terran world is half price; an orbital yard, or a
 * planetary yard on anything you need a suit to stand on, pays in full.
 */
export function shipyardPrice(opts: {
  throughput: number
  capacity: number
  orbital: boolean
  breathableWorld?: boolean
}): { rp: number; mass: number } {
  const first = throughputRating(opts.throughput)
  const second = capacityRating(opts.capacity)
  if (!first) throw new Error(`No shipyard processes ${opts.throughput} RP a turn`)
  if (!second) throw new Error(`No shipyard builds hulls of mass ${opts.capacity}`)
  const full = first.rp + second.rp
  const halved = !opts.orbital && (opts.breathableWorld ?? false)
  return { rp: halved ? Math.floor(full / 2) : full, mass: first.mass + second.mass }
}

/**
 * Why a yard cannot build a design, or null if it can (Shipyards). A yard is
 * capped by its second rating, and a planetary yard "may only build ships that
 * can leave the atmosphere" — which on the tactical schema is a hull with some
 * streamlining (13.11).
 */
export function shipyardRefusal(
  yard: { throughput: number; capacity: number; orbital: boolean },
  design: ShipDesign,
): string | null {
  if (design.mass > yard.capacity) {
    return `${design.name} masses ${design.mass}; the yard builds up to ${yard.capacity}`
  }
  if (!yard.orbital && design.streamlining === 'none') {
    return `${design.name} cannot leave an atmosphere, so a planetary yard cannot build it`
  }
  return null
}

/** Turns a yard needs to build something, at its first rating in RP a turn. */
export function shipyardTurns(yard: { throughput: number }, rp: number): number {
  return Math.max(1, Math.ceil(rp / yard.throughput))
}

// ---------------------------------------------------------------------------
// Population (6.5, Economy)
// ---------------------------------------------------------------------------

/**
 * Millions of population needed per million of growth, by planet type (6.5):
 * Terran +1M per 5M, Sub-Terran +1M per 10M, and nothing else grows at all.
 */
export const POPULATION_GROWTH_DIVISOR: Record<PlanetType, number | null> = {
  terran: 5,
  'sub-terran': 10,
  'minimal-terran': null,
  barren: null,
  'gas-giant': null,
  'special-anomaly': null,
}

/** One colony transport carries one million colonists (Economy). */
export const POPULATION_PER_TRANSPORT = 1

/**
 * Growth for a population of `millions` on a world of this type (6.5). Growth
 * is whole millions — 12M on a Terran world grows by 2M, not 2.4M — so the
 * division is floored.
 */
export function populationGrowth(millions: number, type: PlanetType): number {
  const divisor = POPULATION_GROWTH_DIVISOR[type]
  if (divisor === null || millions <= 0) return 0
  return Math.floor(millions / divisor)
}

/**
 * Grow a colony's population (6.5), in place.
 *
 * The rule speaks of "the colony's population"; the campaign tracks two
 * cohorts, so each grows on its own count. That keeps the split honest — a
 * conquest does not make the conqueror's own colonists breed faster, and the
 * Integration Program's timing does not change how many people there are.
 */
export function growPopulation(colony: Colony, body: PlanetaryBody): { loyal: number; subject: number } {
  const loyal = populationGrowth(colony.population.loyal, body.type)
  const subject = populationGrowth(colony.population.subject, body.type)
  colony.population.loyal += loyal
  colony.population.subject += subject
  return { loyal, subject }
}

// ---------------------------------------------------------------------------
// Industrial output (6.5, 6.4)
// ---------------------------------------------------------------------------

/** 50 RP per million population, each production phase (6.5). */
export const RP_PER_MILLION_POPULATION = 50

/** 50 RP per active factory, each production phase (6.5). */
export const RP_PER_ACTIVE_FACTORY = 50

/** A mineral rich world doubles the colony's industrial output (6.2.1, 6.5). */
export const MINERAL_RICH_MULTIPLIER = 2

/** Subject Population costs its owner 75% of the colony's industrial output (6.4). */
export const SUBJECT_POPULATION_PENALTY = 0.75

/** A biologically rich world pays +1 research point per production phase (6.2.1). */
export const BIOLOGICALLY_RICH_RESEARCH_POINTS = 1

/** Ancient ruins pay +1 tech point per production phase (6.2.1). */
export const ANCIENT_RUINS_TECH_POINTS = 1

/** What a colony made this production phase, and where the numbers came from. */
export interface ColonyOutput {
  /** Factories counted: everything built and not idle (6.5 "active factory"). */
  activeFactories: number
  populationRp: number
  factoryRp: number
  mineralRich: boolean
  /** Population plus factories, doubled on a mineral rich world (6.5). */
  grossRp: number
  /** What the Subject Population costs the owner (6.4). */
  subjectPenaltyRp: number
  /** Gross less the penalty: what the owner actually banks. */
  netRp: number
}

/** Factories that are producing this phase (6.5). */
export function activeFactories(colony: Colony): number {
  return Math.max(0, colony.factories - colony.factoriesOffline)
}

/**
 * A colony's industrial output for one production phase (6.5): 50 RP per
 * million population plus 50 RP per active factory, doubled on a mineral rich
 * world, less the Subject Population penalty (6.4).
 *
 * The penalty is 75% of the colony's output scaled by the subject share of the
 * population. At the moment of capture every inhabitant is a subject and the
 * reading is the rule verbatim — the owner loses 75% of everything the colony
 * makes, factories included. As an Integration Program converts people the
 * penalty retreats with them, which is the whole reason to pay for one.
 *
 * Siege does not appear here: a besieged colony "still generates RP" (6.4) and
 * only loses the right to build starships and to act as a command post. A
 * colony still owing its captor a phase of silence is handled in
 * `produceAtColony`, because that is a rule about the phase, not about the
 * colony's industry.
 */
export function colonyOutput(colony: Colony, body: PlanetaryBody): ColonyOutput {
  const totalPopulation = colony.population.loyal + colony.population.subject
  const factories = activeFactories(colony)
  const mineralRich = body.trait === 'mineral-rich'
  const multiplier = mineralRich ? MINERAL_RICH_MULTIPLIER : 1

  const populationRp = totalPopulation * RP_PER_MILLION_POPULATION * multiplier
  const factoryRp = factories * RP_PER_ACTIVE_FACTORY * multiplier
  const grossRp = populationRp + factoryRp

  const subjectShare = totalPopulation > 0 ? colony.population.subject / totalPopulation : 0
  const subjectPenaltyRp = Math.floor(grossRp * SUBJECT_POPULATION_PENALTY * subjectShare)

  return {
    activeFactories: factories,
    populationRp,
    factoryRp,
    mineralRich,
    grossRp,
    subjectPenaltyRp,
    netRp: grossRp - subjectPenaltyRp,
  }
}

// ---------------------------------------------------------------------------
// Subject Population: unrest and integration (6.4)
// ---------------------------------------------------------------------------

/** One unrest die per 5 million Subject Population, each admin phase (6.4). */
export const UNREST_MILLIONS_PER_DIE = 5

/** A riot costs 1d6 × 100 RP (6.4). */
export const UNREST_RP_PER_POINT = 100

/** An Integration Program converts Subject Population at 100 RP per million (6.4). */
export const INTEGRATION_RP_PER_MILLION = 100

/** What an admin phase's unrest roll did to a colony (6.4). */
export interface UnrestResult {
  /** The dice, in stream order — one per full 5M of Subject Population. */
  dice: number[]
  /** Dice that came up 1. */
  riots: number
  /** RP the riots cost the owner: 1d6 × 100 each. */
  rpLost: number
  /** Building here is blocked next phase (6.4). */
  buildingBlocked: boolean
}

/**
 * Roll a colony's unrest for the admin phase (6.4): "1d6 per 5M subject
 * population each admin phase; a 1 costs 1d6 × 100 RP and blocks building next
 * phase."
 *
 * One die per *full* 5M, matching the way population growth reads its own
 * threshold, so a colony with fewer than five million subjects does not riot.
 * Each 1 rolls its own 1d6 × 100 RP, and any 1 at all blocks building.
 *
 * Mutates `colony.buildingBlocked`; the RP is returned rather than deducted,
 * because where a riot's bill is paid from is a spending rule and belongs to
 * the move that answers for it.
 */
export function rollUnrest(colony: Colony, stream: RandomStream): UnrestResult {
  const dice: number[] = []
  const count = Math.floor(colony.population.subject / UNREST_MILLIONS_PER_DIE)
  for (let i = 0; i < count; i++) dice.push(rollD6(stream))

  let riots = 0
  let rpLost = 0
  for (const die of dice) {
    if (die !== 1) continue
    riots += 1
    rpLost += rollD6(stream) * UNREST_RP_PER_POINT
  }

  if (riots > 0) colony.buildingBlocked = true
  return { dice, riots, rpLost, buildingBlocked: riots > 0 }
}

/** What an Integration Program purchased (6.4). */
export interface IntegrationResult {
  /** Millions of Subject Population converted to Loyal. */
  millionsConverted: number
  /** RP actually taken. */
  rpAccepted: number
  /** RP handed back because there was nobody left to convert. */
  rpRefunded: number
  /** RP left on account toward the next million (6.4). */
  credit: number
}

/** What converting `millions` of Subject Population costs, at 100 RP each (6.4). */
export function integrationCost(millions: number): number {
  return Math.max(0, Math.ceil(millions)) * INTEGRATION_RP_PER_MILLION
}

/**
 * Run an Integration Program at a colony (6.4): "Converting them runs 100 RP
 * per million through an Integration Program."
 *
 * RP short of a full million stays on the colony's account rather than
 * evaporating, so a program can be funded across several phases; RP that can
 * never buy anything — because every subject has already been converted — is
 * handed straight back.
 */
export function runIntegrationProgram(colony: Colony, rp: number): IntegrationResult {
  const budget = colony.integrationCredit + Math.max(0, rp)
  const affordable = Math.floor(budget / INTEGRATION_RP_PER_MILLION)
  const converted = Math.min(colony.population.subject, affordable)

  colony.population.subject -= converted
  colony.population.loyal += converted

  let credit = budget - converted * INTEGRATION_RP_PER_MILLION
  let rpRefunded = 0
  if (colony.population.subject === 0) {
    rpRefunded = Math.min(credit, Math.max(0, rp))
    credit -= rpRefunded
  }
  colony.integrationCredit = credit

  return { millionsConverted: converted, rpAccepted: Math.max(0, rp) - rpRefunded, rpRefunded, credit }
}

// ---------------------------------------------------------------------------
// Emigration (Economy)
// ---------------------------------------------------------------------------

/** Colonists lifted off a colony, and what carrying them takes (Economy). */
export interface EmigrationResult {
  /** Millions that actually left — the colony may not have had that many. */
  millions: number
  /** Colony transports needed, one per million. */
  transports: number
  /** What those transports cost new, at 50 RP each. */
  transportRp: number
}

/**
 * Move population off a colony (Economy).
 *
 * The campaign document states no separate emigration rule: what it states is
 * that a colony transport carries a million colonists and costs 50 RP, and that
 * a player starts with twenty of them. So emigration is exactly that and
 * nothing more — a million people per transport, taken off the colony's books
 * and put on a ship. Only Loyal population emigrates by default; lifting
 * Subject Population is a GM call, and `subjects` is how the GM makes it.
 */
export function emigrate(
  colony: Colony,
  millions: number,
  opts: { subjects?: boolean } = {},
): EmigrationResult {
  const fromSubjects = opts.subjects ?? false
  const available = fromSubjects ? colony.population.subject : colony.population.loyal
  const lifted = Math.max(0, Math.min(Math.floor(millions), available))

  if (fromSubjects) colony.population.subject -= lifted
  else colony.population.loyal -= lifted

  return {
    millions: lifted,
    transports: lifted / POPULATION_PER_TRANSPORT,
    transportRp: (lifted / POPULATION_PER_TRANSPORT) * PRICE_SCHEDULE['colony-transport'].rp,
  }
}

/** Land colonists on a colony — the far end of an emigration (Economy). */
export function landColonists(colony: Colony, millions: number): number {
  const landed = Math.max(0, Math.floor(millions))
  colony.population.loyal += landed
  return landed
}

// ---------------------------------------------------------------------------
// The production phase (6.5)
// ---------------------------------------------------------------------------

/** A hazardous world rolls 1d20 each production phase; a 1 destroys a factory (6.2.1). */
export const HAZARD_DISASTER_DIE = 20

/** What one colony did in a production phase (6.5). */
export interface ColonyProduction {
  colonyId: string
  owner: PlayerId
  populationGrowth: { loyal: number; subject: number }
  /** The hazardous world's 1d20, or null if the world is not hazardous. */
  hazardRoll: number | null
  factoriesDestroyed: number
  output: ColonyOutput
  /** RP banked at the colony — zero while a captured colony is still silent. */
  rpBanked: number
  /** Research points to the owner's pool, from a biologically rich world. */
  researchPoints: number
  /** Tech points to the owner's pool, from ancient ruins. */
  techPoints: number
  /** True when 6.4's one silent phase after a capture swallowed the output. */
  silencedByCapture: boolean
}

/** A production phase, colony by colony and then by player (6.5). */
export interface ProductionReport {
  colonies: ColonyProduction[]
  byPlayer: Record<PlayerId, { rp: number; researchPoints: number; techPoints: number }>
}

/**
 * Run one colony's production phase (6.5), in place.
 *
 * The order is the rule's own: population grows first, then output is taken on
 * the grown population. Around it sit the two trait rules that fall due in a
 * production phase — the hazardous world's 1d20, rolled before output so a
 * factory lost to a disaster does not also pay out this phase, and the
 * biologically rich and ancient ruins points, which go to the owner rather than
 * to the colony because research is the one thing that pools (6.5).
 *
 * A colony captured since the last production phase "produces nothing for its
 * new owner for one production phase" (6.4): its people still grow and its
 * world still shakes, but nothing is banked and the phase is struck off.
 */
export function produceAtColony(
  colony: Colony,
  body: PlanetaryBody,
  stream: RandomStream,
): ColonyProduction {
  const growth = growPopulation(colony, body)

  let hazardRoll: number | null = null
  let factoriesDestroyed = 0
  if (body.trait === 'hazardous') {
    hazardRoll = rollD20(stream)
    if (hazardRoll === 1 && colony.factories > 0) {
      colony.factories -= 1
      colony.factoriesOffline = Math.min(colony.factoriesOffline, colony.factories)
      factoriesDestroyed = 1
    }
  }

  const output = colonyOutput(colony, body)

  const silenced = colony.capturedIdlePhases > 0
  if (silenced) colony.capturedIdlePhases -= 1

  const rpBanked = silenced ? 0 : output.netRp
  colony.stockpileRp += rpBanked

  return {
    colonyId: colony.id,
    owner: colony.owner,
    populationGrowth: growth,
    hazardRoll,
    factoriesDestroyed,
    output,
    rpBanked,
    researchPoints:
      !silenced && body.trait === 'biologically-rich' ? BIOLOGICALLY_RICH_RESEARCH_POINTS : 0,
    techPoints: !silenced && body.trait === 'ancient-ruins' ? ANCIENT_RUINS_TECH_POINTS : 0,
    silencedByCapture: silenced,
  }
}

/**
 * Run the whole production phase (6.5), colony by colony in the order given —
 * which fixes the order dice are drawn in, and so the phase a seed produces.
 * Callers hold that order steady (it is the colony list's own order) for the
 * same reason the tactical engine resolves fire in initiative order.
 */
export function runProductionPhase(
  colonies: ReadonlyArray<{ colony: Colony; body: PlanetaryBody }>,
  stream: RandomStream,
): ProductionReport {
  const report: ProductionReport = { colonies: [], byPlayer: {} }
  for (const entry of colonies) {
    const result = produceAtColony(entry.colony, entry.body, stream)
    report.colonies.push(result)
    const player = (report.byPlayer[result.owner] ??= { rp: 0, researchPoints: 0, techPoints: 0 })
    player.rp += result.rpBanked
    player.researchPoints += result.researchPoints
    player.techPoints += result.techPoints
  }
  return report
}

// ---------------------------------------------------------------------------
// What may be bought, and where (6.2.1, 6.4)
// ---------------------------------------------------------------------------

/**
 * Why a colony may not buy something, or null if it may (6.4, price schedule).
 *
 * Three things can refuse a purchase: the technology the price schedule names,
 * the siege rule — a besieged colony "cannot build starships or act as a
 * command post, but still generates RP and can build defences" — and an unrest
 * roll that came up 1 last admin phase and blocks building this one.
 */
export function purchaseRefusal(
  colony: Colony,
  item: PurchaseItem,
  technologies: readonly TechnologyId[],
): string | null {
  const required = requiredTechnology(item)
  if (required && !technologies.includes(required)) {
    return `${item.kind} needs ${required} technology`
  }
  if (colony.underSiege && (item.kind === 'starship' || item.kind === 'command-post')) {
    return `${colony.name} is under siege and may not build ${item.kind}s`
  }
  if (colony.buildingBlocked && item.kind !== 'counter-espionage') {
    return `unrest at ${colony.name} blocks building this phase`
  }
  return null
}

/**
 * Why a body may not be colonised, or null if it may (6.2.1).
 *
 * Gas giants cannot be colonised at all and a special anomaly is the GM's to
 * rule on; a barren world needs Controlled Environment Technology; a hazardous
 * world needs its 500 RP of stabilisation paid first.
 */
export function colonisationRefusal(
  body: PlanetaryBody,
  technologies: readonly TechnologyId[],
  stabilised: boolean,
): string | null {
  if (body.type === 'gas-giant') return 'a gas giant cannot be colonised'
  if (body.type === 'special-anomaly') return 'a special anomaly is the GM’s to rule on'
  if (body.type === 'barren' && !technologies.includes('controlled-environment')) {
    return 'a barren world needs Controlled Environment Technology'
  }
  if (body.trait === 'hazardous' && !stabilised) {
    return `a hazardous world needs ${PRICE_SCHEDULE['hazard-stabilisation'].rp} RP of stabilisation first`
  }
  return null
}
