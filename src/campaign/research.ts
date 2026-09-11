/**
 * Campaign research — the three technology trees (campaign.md "Research (8)").
 *
 * Research is "paid in full in a single production phase from pooled RP", so
 * there is no partial progress to carry between turns and therefore no research
 * state beyond the set of technologies a faction holds. That is why every
 * function here is a price lookup or a single all-or-nothing purchase.
 *
 * Nothing in this module rolls dice. A technology arrives by one of three
 * routes — researched, traded for, or salvaged — and the roll that decides
 * whether a salvage *succeeded* belongs to the battle that produced the wreck;
 * it reaches this module as an already-settled route.
 *
 * Reconciliation note: `TechId` and `TechKnowledge` are declared here because
 * `src/campaign/types.ts` is being written in parallel. They are meant to be
 * structurally compatible with it and to move there on a later pass.
 */

// ---------------------------------------------------------------------------
// The trees (8)
// ---------------------------------------------------------------------------

/** The three tables the rulebook lists research under (8). */
export type ResearchTree = 'ship-speed' | 'weapons' | 'technology'

/**
 * Every technology the campaign defines (8). Ship-speed steps are named for
 * the FTL rate they unlock, so `speed-5` is the "5 hex" row of the table.
 */
export type TechId =
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

/** One row of a research table (8). */
export interface TechDef {
  id: TechId
  tree: ResearchTree
  label: string
  /** RP cost with no predecessor held (8). */
  cost: number
  /** The technology whose possession discounts this one, where the table names one. */
  predecessor: TechId | null
  /** The discounted cost — the bracketed figure in the table. Null when there is none. */
  costWithPredecessor: number | null
  /** Ship-speed research raises the FTL rate to this many hexes a turn (6.1). */
  ftlRate?: number
}

/**
 * The three tables, verbatim (8):
 *
 *   Ship speed  3 hex 15; 4 hex 40 (30 with 3); 5 hex 55 (40 with 4);
 *               6 hex 65 (50 with 5); 7 hex 75 (60 with 6); 8 hex 80 (70 with 7)
 *   Weapons     PDU 25; Advanced PDU 55 (40 with PDU); Planet Shield 130
 *   Technology  C.E.T. 25; Industrial 25; Improved Industrial 55 (40 with
 *               Industrial); Robotic Industry 100 (85 with Industrial)
 */
export const TECHNOLOGIES: readonly TechDef[] = [
  { id: 'speed-3', tree: 'ship-speed', label: 'FTL 3 hexes', cost: 15, predecessor: null, costWithPredecessor: null, ftlRate: 3 },
  { id: 'speed-4', tree: 'ship-speed', label: 'FTL 4 hexes', cost: 40, predecessor: 'speed-3', costWithPredecessor: 30, ftlRate: 4 },
  { id: 'speed-5', tree: 'ship-speed', label: 'FTL 5 hexes', cost: 55, predecessor: 'speed-4', costWithPredecessor: 40, ftlRate: 5 },
  { id: 'speed-6', tree: 'ship-speed', label: 'FTL 6 hexes', cost: 65, predecessor: 'speed-5', costWithPredecessor: 50, ftlRate: 6 },
  { id: 'speed-7', tree: 'ship-speed', label: 'FTL 7 hexes', cost: 75, predecessor: 'speed-6', costWithPredecessor: 60, ftlRate: 7 },
  { id: 'speed-8', tree: 'ship-speed', label: 'FTL 8 hexes', cost: 80, predecessor: 'speed-7', costWithPredecessor: 70, ftlRate: 8 },

  { id: 'pdu', tree: 'weapons', label: 'Planetary Defence Unit', cost: 25, predecessor: null, costWithPredecessor: null },
  { id: 'advanced-pdu', tree: 'weapons', label: 'Advanced PDU', cost: 55, predecessor: 'pdu', costWithPredecessor: 40 },
  { id: 'planet-shield', tree: 'weapons', label: 'Planet Shield', cost: 130, predecessor: null, costWithPredecessor: null },

  { id: 'controlled-environment', tree: 'technology', label: 'Controlled Environment Technology', cost: 25, predecessor: null, costWithPredecessor: null },
  { id: 'industrial', tree: 'technology', label: 'Industrial Technology', cost: 25, predecessor: null, costWithPredecessor: null },
  { id: 'improved-industrial', tree: 'technology', label: 'Improved Industrial', cost: 55, predecessor: 'industrial', costWithPredecessor: 40 },
  { id: 'robotic-industry', tree: 'technology', label: 'Robotic Industry', cost: 100, predecessor: 'industrial', costWithPredecessor: 85 },
]

const BY_ID: ReadonlyMap<TechId, TechDef> = new Map(TECHNOLOGIES.map((tech) => [tech.id, tech]))

/** Look one technology up in the tables (8). Throws on an id the tables do not hold. */
export function techById(id: TechId): TechDef {
  const tech = BY_ID.get(id)
  if (!tech) throw new Error(`Unknown technology: ${String(id)}`)
  return tech
}

/** The rows of one research table (8), in the order the rulebook lists them. */
export function technologiesIn(tree: ResearchTree): TechDef[] {
  return TECHNOLOGIES.filter((tech) => tech.tree === tree)
}

// ---------------------------------------------------------------------------
// What a technology costs (8)
// ---------------------------------------------------------------------------

/**
 * What a faction already knows. An iterable rather than a concrete container so
 * a caller may hand over the array it stores or a set it is building mid-phase.
 */
export type TechKnowledge = Iterable<TechId>

/**
 * The price on the table for this buyer: "Technologies with a predecessor are
 * cheaper if you have it" (8).
 */
export function effectiveCost(id: TechId, known: TechKnowledge): number {
  const tech = techById(id)
  const held = new Set<TechId>(known)
  if (tech.predecessor !== null && tech.costWithPredecessor !== null && held.has(tech.predecessor)) {
    return tech.costWithPredecessor
  }
  return tech.cost
}

/** "Trading a technology costs the receiver 25% of its normal cost" (8). */
export const TRADED_TECH_FRACTION = 0.25

/** "Successful salvage halves it" (8). */
export const SALVAGE_FRACTION = 0.5

/** How a technology reached a faction. The three routes section 8 recognises. */
export type AcquisitionRoute = 'research' | 'trade' | 'salvage'

/**
 * What this faction actually pays to take the technology on (8).
 *
 * The predecessor discount is applied first, because "its normal cost" is the
 * cost this buyer would otherwise face — a player holding PDU does not pay a
 * quarter of 55 for a traded Advanced PDU when researching it outright would
 * have cost them 40. The two reductions do not stack: a technology arrives by
 * exactly one route.
 */
export function acquisitionCost(
  id: TechId,
  known: TechKnowledge,
  route: AcquisitionRoute = 'research',
): number {
  const base = effectiveCost(id, known)
  const fraction = route === 'trade' ? TRADED_TECH_FRACTION : route === 'salvage' ? SALVAGE_FRACTION : 1
  // RP are whole points and a quarter of an odd cost is not, so the fraction is
  // rounded up: a discount must never be worth more than the table says.
  return Math.ceil(base * fraction)
}

// ---------------------------------------------------------------------------
// What research unlocks
// ---------------------------------------------------------------------------

/** "Base FTL rate is 2 hexes a turn" (6.1). */
export const BASE_FTL_RATE = 2

/** "...raised by research to a maximum of 8" (6.1). */
export const MAX_FTL_RATE = 8

/**
 * A faction's FTL rate in hexes a turn (6.1, 8). Speed research is a ladder and
 * the steps are not cumulative, so the rate is simply the best step held — a
 * player who buys `speed-5` outright moves 5, whether or not they ever held 4.
 */
export function ftlRate(known: TechKnowledge): number {
  const held = new Set<TechId>(known)
  let rate = BASE_FTL_RATE
  for (const tech of TECHNOLOGIES) {
    if (tech.ftlRate !== undefined && held.has(tech.id) && tech.ftlRate > rate) rate = tech.ftlRate
  }
  return Math.min(rate, MAX_FTL_RATE)
}

/**
 * The price-schedule entries that name a technology in their "Requires" column
 * (campaign.md "Price schedule"). Keyed by item id so the economy layer can ask
 * this module whether a purchase is legal without duplicating the tables.
 */
export const ITEM_TECH_REQUIREMENT: Readonly<Record<string, TechId>> = {
  factory: 'industrial',
  pdu: 'pdu',
  'advanced-pdu': 'advanced-pdu',
  'planet-shield': 'planet-shield',
}

/** Whether a faction may buy a price-schedule item at all (price schedule). */
export function meetsItemRequirement(item: string, known: TechKnowledge): boolean {
  const required = ITEM_TECH_REQUIREMENT[item]
  if (required === undefined) return true
  return new Set<TechId>(known).has(required)
}

// ---------------------------------------------------------------------------
// Spending a production phase's research budget (8)
// ---------------------------------------------------------------------------

/** One technology a faction wants this production phase (8). */
export interface ResearchRequest {
  techId: TechId
  /** Defaults to plain research; `trade` and `salvage` carry their discounts. */
  via?: AcquisitionRoute
}

export interface ResearchAcquisition {
  techId: TechId
  via: AcquisitionRoute
  cost: number
}

export interface ResearchRefusal {
  techId: TechId
  reason: string
}

export interface ResearchResolution {
  /** The faction's technologies after the phase, in acquisition order. */
  known: TechId[]
  spent: number
  remaining: number
  acquired: ResearchAcquisition[]
  /** Requests that could not be met, and why. A refusal costs nothing. */
  refused: ResearchRefusal[]
}

/**
 * Spend a production phase's pooled RP on research (8).
 *
 * Requests are settled in the order given, and a technology bought earlier in
 * the phase counts as held for the rest of it — so buying `speed-3` and then
 * `speed-4` in one phase costs 15 + 30, which is the only reading under which
 * the discount column is reachable at all in a fresh campaign.
 *
 * A purchase that cannot be "paid in full in a single production phase" is
 * refused outright rather than part-paid: there is no research in progress in
 * this campaign, so an unaffordable technology simply does not happen.
 */
export function resolveResearch(
  known: TechKnowledge,
  requests: readonly ResearchRequest[],
  budget: number,
): ResearchResolution {
  const held = new Set<TechId>(known)
  const acquired: ResearchAcquisition[] = []
  const refused: ResearchRefusal[] = []
  let spent = 0

  for (const request of requests) {
    if (held.has(request.techId)) {
      refused.push({ techId: request.techId, reason: 'already known' })
      continue
    }
    const via = request.via ?? 'research'
    const cost = acquisitionCost(request.techId, held, via)
    if (cost > budget - spent) {
      refused.push({ techId: request.techId, reason: `costs ${cost} RP; ${budget - spent} RP pooled` })
      continue
    }
    held.add(request.techId)
    spent += cost
    acquired.push({ techId: request.techId, via, cost })
  }

  return { known: [...held], spent, remaining: budget - spent, acquired, refused }
}
