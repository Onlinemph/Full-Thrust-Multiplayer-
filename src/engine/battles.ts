/**
 * Full Thrust: Project Continuum — battles, scenarios and CPV (section 18),
 * and the Introductory Scenario player fleet (section 22).
 *
 * This is the module that runs *before* the battle and *around* it. Nothing
 * here has a phase: 18.1 places the fleets on the table before turn 1, 18.2
 * decides what may be on the list at all, and 18.3 re-prices a hull so two
 * unlike fleets meet on even terms. Section 18 rolls no dice — the only
 * randomness the book puts anywhere near set-up is 4.12's roll for who places
 * first, which is a different section and a different source half.
 *
 * Three things about it are easy to get wrong, and each has a test:
 *
 * - **90 is a cruiser.** 13.4: *"Escorts have a maximum mass of 44; cruisers
 *   have a maximum mass of 90. Anything over mass 90 is a capital ship."* The
 *   class table overlaps across that cut — a CA runs 60–90 and a BC 80–110 —
 *   so a hull's *name* never settles which side of a patrol restriction it is
 *   on. Its mass does.
 * - **The CPV curve crosses at 100.** *"Ships with mass below 100 become
 *   cheaper, over 100 more expensive."* It is flat where most fleets meet — a
 *   mass-99 hull is one point cheaper and a mass-101 hull one point dearer —
 *   and only opens up at the ends of the mass range, where a mass-50 cruiser
 *   loses 25 points and a mass-200 superdreadnought gains 200.
 * - **The course limit in a converging deployment is relative.** *"Initial
 *   course limited to 11, 12, or 1"* cannot be an absolute clock reading for
 *   both fleets, because the two fleets are on opposing edges and it would
 *   send one of them off the table on turn one.
 *
 * The formula in 18.3 is *reconstructed*: it is printed as an image, and
 * images do not survive text extraction. Four printed facts pin it exactly —
 * see `cpvHullCost` and `docs/rules/battles.md`.
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, section 18
 * (with 13.4 where 18.2 needs a definition it does not give) and section 22;
 * the prose, the column reconstruction and every reading are in
 * `docs/rules/battles.md`.
 */

import type { Course, Point, ShipDesign, ShipGroup } from './types'

/** Slack for MU comparisons, so a ship exactly on a zone's edge is inside it. */
const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Ship classification (13.4, for 18.2)
// ---------------------------------------------------------------------------

/**
 * The three classes 18.2's restrictions are written in terms of. 18.2 names
 * them and defines none of them; 13.4 defines them by mass and nothing else.
 */
export type FleetClass = 'escort' | 'cruiser' | 'capital'

/** *"Escorts have a maximum mass of 44"* (13.4). */
export const ESCORT_MAX_MASS = 44

/** *"Cruisers have a maximum mass of 90. Anything over mass 90 is a capital ship"* (13.4). */
export const CRUISER_MAX_MASS = 90

/**
 * Which class a hull belongs to, by mass (13.4).
 *
 * **[reading]** Mass decides, not the group the design declares. 13.4 also
 * says *"most navies tend to classify ships by function rather than by
 * tonnage"* and asks players to state a ship's class as a courtesy — but a
 * tournament check cannot rest on a label its subject supplies, and the mass
 * sentence is unconditional. A disagreement between the two is reported as an
 * advisory rather than swallowed. The alternative, trusting the declared
 * group, lets a 120-mass hull into a patrol battle by calling itself a
 * cruiser.
 */
export function classifyByMass(mass: number): FleetClass {
  if (mass <= ESCORT_MAX_MASS) return 'escort'
  if (mass <= CRUISER_MAX_MASS) return 'cruiser'
  return 'capital'
}

/**
 * Whether a design's declared `group` agrees with 13.4's mass cuts.
 *
 * `station`, `civilian` and `monster` are groups the engine has and 18.2 has
 * no bucket for, so they never agree — which is the point: the advisory says
 * the composition check treated them by mass.
 */
export function declaredGroupAgrees(group: ShipGroup | undefined, mass: number): boolean {
  if (group === undefined) return true
  return group === classifyByMass(mass)
}

// ---------------------------------------------------------------------------
// A fleet list (18.2)
// ---------------------------------------------------------------------------

/**
 * One hull on a fleet list, carrying only what section 18 asks about.
 *
 * Deliberately not a `ShipDesign`: a campaign roster, a saved game's chosen
 * force and a fleet-book import all need checking, and none of them should
 * have to build a full design first. `fleetShipFromDesign` adapts one.
 */
export interface FleetShip {
  /** This hull in this fleet — a ship name or a roster slot. */
  id: string
  /** The design it was built from. 18.2's permitted-designs list keys on this. */
  designId: string
  /** Total hull mass (13.4), which is what fixes its class. */
  mass: number
  /** The hull's points as the roster prices it. */
  points: number
  /**
   * Points of the flights and squadrons the hull carries.
   *
   * 18.2 counts a capital's fighters against the capital — *"no more than 50%
   * of points spent on capitals, including their fighters"* — and a hull's own
   * price does **not** include them. 13.12 prices a hangar bay at *"3 per
   * mass, and … six mass each"*, so the 18 points on a bay is the bay: the
   * empty hold, its re-arming gear and nothing in it. 14.7 charges for the
   * wing separately, at 18 points for a standard six and up to 42 for a
   * graser wing. A carrier whose `embarkedPoints` is left at 0 is therefore
   * under-counted against the capital limit by up to 42 points a bay, which
   * on a six-bay fleet carrier is 252 points hiding on the wrong side of a
   * 50% line.
   */
  embarkedPoints?: number
  /** The class the fleet list declares, where it declares one (13.4). */
  declaredGroup?: ShipGroup
  /**
   * Whether the hull is a carrier, for 18.2's *"small carriers"* sentence.
   *
   * **[reading]** Fighter groups make a carrier; gunboat racks do not. 13.4's
   * carrier classes are all fighter carriers (CVE, CVL, CVH, CVA), and 9.1
   * makes a gunboat rack an 18-mass hull fitting any warship can bolt on, so a
   * destroyer with a rack is a destroyer. The alternative — counting any
   * embarked small craft — was rejected on that asymmetry.
   */
  carrier?: boolean
  /** Altered from the fleet book's printed design (18.2). */
  modified?: boolean
}

/** A hull's full contribution to the fleet's points: itself plus what it carries. */
export function shipPoints(ship: FleetShip): number {
  return ship.points + (ship.embarkedPoints ?? 0)
}

/** The fleet's total points, as 18.2's bands and shares measure it. */
export function fleetPoints(ships: readonly FleetShip[]): number {
  return ships.reduce((sum, ship) => sum + shipPoints(ship), 0)
}

/**
 * A `ShipDesign` as a line on a fleet list.
 *
 * `carrier` comes from the design's fighter bays and not its gunboat racks,
 * for the reason `FleetShip.carrier` gives.
 *
 * **`embarkedPoints` is not derived and defaults to 0.** `ShipDesign` names
 * the type in each fighter bay but holds no price for the flight, and 14.7's
 * prices live in `fighters.ts`, which this module may not import. So a caller
 * checking a carrier against 18.2's *"including their fighters"* must pass the
 * wings' points in; see `docs/rules/battles.md`.
 */
export function fleetShipFromDesign(
  design: ShipDesign,
  opts: { id?: string; embarkedPoints?: number; modified?: boolean } = {},
): FleetShip {
  return {
    id: opts.id ?? design.id,
    designId: design.id,
    mass: design.mass,
    points: design.points,
    embarkedPoints: opts.embarkedPoints ?? 0,
    declaredGroup: design.group,
    carrier: design.fighterBays.length > 0,
    modified: opts.modified ?? false,
  }
}

// ---------------------------------------------------------------------------
// Fleet size (18.2)
// ---------------------------------------------------------------------------

/** *"The ideal size is probably between 1000 and 1500 points in total"* (18.2). */
export const IDEAL_FLEET_POINTS_MIN = 1000
export const IDEAL_FLEET_POINTS_MAX = 1500

/** *"Fleets as small as 500 points can still be interesting"* (18.2). */
export const SMALLEST_INTERESTING_FLEET_POINTS = 500

/** *"Forces of over 3000 points will probably be too large"* (18.2). */
export const LARGEST_PRACTICAL_FLEET_POINTS = 3000

/** Where a fleet's total falls against 18.2's four printed numbers. */
export type FleetSizeBand = 'below-minimum' | 'small' | 'ideal' | 'large' | 'too-large'

/**
 * 18.2's advice on fleet size, as a band.
 *
 * **[reading]** The endpoints are inclusive except 3000. *"As small as 500"*
 * makes 500 itself playable, *"between 1000 and 1500"* reads inclusively, and
 * *"over 3000"* is explicitly exclusive — so 3000 is `large` and 3001 is
 * `too-large`. The alternative, exclusive endpoints throughout, would put an
 * exactly-500-point fleet below the floor that sentence exists to set.
 *
 * Every band is advice. None of them makes a list illegal.
 */
export function fleetSizeBand(points: number): FleetSizeBand {
  if (points < SMALLEST_INTERESTING_FLEET_POINTS) return 'below-minimum'
  if (points < IDEAL_FLEET_POINTS_MIN) return 'small'
  if (points <= IDEAL_FLEET_POINTS_MAX) return 'ideal'
  if (points <= LARGEST_PRACTICAL_FLEET_POINTS) return 'large'
  return 'too-large'
}

// ---------------------------------------------------------------------------
// Fleet composition (18.2)
// ---------------------------------------------------------------------------

/**
 * The composition restrictions 18.2 offers, as alternatives.
 *
 * They are alternatives and not a stack: the text joins them with *"or"* and
 * closes *"Either can be argued based on historical precedent or different
 * science fiction settings, so feel free to experiment."*
 *
 * - `patrol` — *"restrict fleets to having no capital ships at all and no more
 *   than 50% of the points spent on cruisers"*
 * - `large-battle` — *"no more than 50% of points spent on capitals, including
 *   their fighters"*
 * - `capital-escorted` — *"each capital class ship must have one or two
 *   corresponding cruisers and escorts"*
 * - `fleet-action` — *"large 'fleet actions' can be fought entirely by capital
 *   class ships with no requirement to have smaller ships present"*
 * - `open` — no restriction, for a game that only cares about the point total
 */
export type CompositionFormat =
  | 'open'
  | 'patrol'
  | 'large-battle'
  | 'capital-escorted'
  | 'fleet-action'

/** *"No more than 50% of the points"* (18.2), for both the cruiser and capital limits. */
export const MAX_CLASS_SHARE = 0.5

export interface CompositionLimits {
  format: CompositionFormat
  /**
   * *"Allowing small carriers is optional but not recommended"* (18.2).
   *
   * **[reading]** A switch, defaulted to the book's own recommendation. With
   * it false a small carrier in a patrol battle is a violation; with it true
   * the carrier raises an advisory repeating the misgiving. Treating the
   * sentence as advice alone would let a patrol list pass while ignoring the
   * one line written to discourage it; treating it as a flat ban would ignore
   * *"optional"*.
   *
   * **[reading]** A *small* carrier is a carrier that is not a capital ship —
   * mass 90 or less. The sentence sits in the patrol paragraph, where capitals
   * are banned outright, so the carriers it can be about are exactly the ones
   * the capital ban does not already exclude. Reading "small" as escort-sized
   * was rejected: 13.4's smallest carrier class, the CVE, starts at mass 60.
   */
  allowSmallCarriers?: boolean
  /**
   * *"One or two corresponding cruisers and escorts"* per capital (18.2), for
   * `capital-escorted`.
   *
   * **[reading]** n of *each* class, with n the organiser's dial — which is
   * why this is a parameter and not a constant. The clause names both classes,
   * so requiring one of each is the reading that gives both nouns work. The
   * alternative, n consorts drawn from either class, makes *"cruisers and
   * escorts"* mean *"cruisers or escorts"*.
   */
  consortsPerCapital?: 1 | 2
}

export const DEFAULT_COMPOSITION_LIMITS: Required<CompositionLimits> = {
  format: 'open',
  allowSmallCarriers: false,
  consortsPerCapital: 1,
}

/** Points and hulls by 13.4 class — what 18.2's proportions are taken of. */
export interface FleetBreakdown {
  total: number
  points: Record<FleetClass, number>
  count: Record<FleetClass, number>
  /** Each class's share of the total, 0 when the fleet is empty. */
  share: Record<FleetClass, number>
}

/**
 * Split a fleet by 13.4 class.
 *
 * **[reading]** A hull's embarked flights count with the hull in *every*
 * class's share. *"Including their fighters"* is printed only on the capital
 * limit, but the two limits are one paragraph apart in the same construction,
 * and there is no reading on which a cruiser's fighters belong to nobody.
 * Counting them only against capitals would make the patrol limit depend on
 * where a wing happens to be based.
 */
export function breakdownFleet(ships: readonly FleetShip[]): FleetBreakdown {
  const points: Record<FleetClass, number> = { escort: 0, cruiser: 0, capital: 0 }
  const count: Record<FleetClass, number> = { escort: 0, cruiser: 0, capital: 0 }

  for (const ship of ships) {
    const cls = classifyByMass(ship.mass)
    points[cls] += shipPoints(ship)
    count[cls] += 1
  }

  const total = points.escort + points.cruiser + points.capital
  const shareOf = (value: number): number => (total === 0 ? 0 : value / total)

  return {
    total,
    points,
    count,
    share: {
      escort: shareOf(points.escort),
      cruiser: shareOf(points.cruiser),
      capital: shareOf(points.capital),
    },
  }
}

export interface CompositionFinding {
  kind: 'violation' | 'advisory'
  /** The rule it comes from, spelled as the book numbers it. */
  rule: string
  /** The hull it is about, where it is about one. */
  shipId: string | null
  detail: string
}

export interface FleetCompositionReport {
  format: CompositionFormat
  breakdown: FleetBreakdown
  sizeBand: FleetSizeBand
  violations: readonly CompositionFinding[]
  advisories: readonly CompositionFinding[]
  /** No violations. Advisories never make a list illegal. */
  legal: boolean
}

/**
 * Check a fleet list against 18.2's composition restrictions.
 *
 * The 50% tests are integer arithmetic — `2 × classPoints <= total` — so a
 * fleet at exactly half is legal (*"no more than 50%"*) and a fleet one point
 * over is not, with no floating-point slack in a rule that decides whether a
 * tournament list is admissible.
 */
export function checkFleetComposition(
  ships: readonly FleetShip[],
  limits: CompositionLimits = DEFAULT_COMPOSITION_LIMITS,
): FleetCompositionReport {
  const format = limits.format
  const allowSmallCarriers = limits.allowSmallCarriers ?? DEFAULT_COMPOSITION_LIMITS.allowSmallCarriers
  const consorts = limits.consortsPerCapital ?? DEFAULT_COMPOSITION_LIMITS.consortsPerCapital

  const breakdown = breakdownFleet(ships)
  const violations: CompositionFinding[] = []
  const advisories: CompositionFinding[] = []

  // 13.4: say so whenever the list's own label disagrees with the mass that
  // actually decided the class. Never a violation — 13.4 allows navies to
  // classify by function — but a patrol list rejected for a hull its owner
  // called a cruiser deserves to be told why.
  for (const ship of ships) {
    if (!declaredGroupAgrees(ship.declaredGroup, ship.mass)) {
      advisories.push({
        kind: 'advisory',
        rule: '13.4',
        shipId: ship.id,
        detail:
          `declared ${ship.declaredGroup}, but mass ${ship.mass} makes it a ` +
          `${classifyByMass(ship.mass)} (13.4); counted as a ${classifyByMass(ship.mass)}`,
      })
    }
  }

  if (format === 'patrol') {
    for (const ship of ships) {
      if (classifyByMass(ship.mass) === 'capital') {
        violations.push({
          kind: 'violation',
          rule: '18.2 Fleet composition',
          shipId: ship.id,
          detail: `mass ${ship.mass} is a capital ship, and a patrol battle has "no capital ships at all"`,
        })
      }
    }
    if (2 * breakdown.points.cruiser > breakdown.total) {
      violations.push({
        kind: 'violation',
        rule: '18.2 Fleet composition',
        shipId: null,
        detail:
          `${breakdown.points.cruiser} of ${breakdown.total} points on cruisers, over the ` +
          '"no more than 50% of the points spent on cruisers" a patrol battle allows',
      })
    }
    for (const ship of ships) {
      if (!ship.carrier || classifyByMass(ship.mass) === 'capital') continue
      if (allowSmallCarriers) {
        advisories.push({
          kind: 'advisory',
          rule: '18.2 Fleet composition',
          shipId: ship.id,
          detail: 'a small carrier: "allowing small carriers is optional but not recommended"',
        })
      } else {
        violations.push({
          kind: 'violation',
          rule: '18.2 Fleet composition',
          shipId: ship.id,
          detail: 'a small carrier, which this game does not allow ("optional but not recommended")',
        })
      }
    }
  }

  if (format === 'large-battle' && 2 * breakdown.points.capital > breakdown.total) {
    violations.push({
      kind: 'violation',
      rule: '18.2 Fleet composition',
      shipId: null,
      detail:
        `${breakdown.points.capital} of ${breakdown.total} points on capitals (fighters included), ` +
        'over the "no more than 50% of points spent on capitals, including their fighters" allowed',
    })
  }

  if (format === 'capital-escorted') {
    const needed = consorts * breakdown.count.capital
    if (breakdown.count.cruiser < needed) {
      violations.push({
        kind: 'violation',
        rule: '18.2 Fleet composition',
        shipId: null,
        detail:
          `${breakdown.count.capital} capital ship(s) need ${needed} cruiser(s) at ` +
          `${consorts} each, and the list has ${breakdown.count.cruiser}`,
      })
    }
    if (breakdown.count.escort < needed) {
      violations.push({
        kind: 'violation',
        rule: '18.2 Fleet composition',
        shipId: null,
        detail:
          `${breakdown.count.capital} capital ship(s) need ${needed} escort(s) at ` +
          `${consorts} each, and the list has ${breakdown.count.escort}`,
      })
    }
  }

  // `fleet-action` and `open` restrict nothing: 18.2 offers the fleet action
  // as the case with "no requirement to have smaller ships present".

  const sizeBand = fleetSizeBand(breakdown.total)
  if (sizeBand !== 'ideal') {
    advisories.push({
      kind: 'advisory',
      rule: '18.2',
      shipId: null,
      detail: `${breakdown.total} points is ${sizeBand}; 18.2 calls 1000–1500 the ideal size`,
    })
  }

  return { format, breakdown, sizeBand, violations, advisories, legal: violations.length === 0 }
}

// ---------------------------------------------------------------------------
// Tournament lists (18.2)
// ---------------------------------------------------------------------------

export interface TournamentRules {
  /**
   * Designs the tournament permits — *"only designs given in the Full Thrust
   * Fleet Books"* (18.2). Omit for a tournament that does not restrict them.
   */
  permittedDesignIds?: readonly string[]
  /** *"With no modifications, changes in weapons, etc."* (18.2). */
  allowModifications?: boolean
}

/**
 * Check a list against 18.2's two tournament controls.
 *
 * The engine cannot *detect* a modification — it has no notion of a design's
 * provenance — so `FleetShip.modified` is declared by whoever imported the
 * fleet book. The parenthesis in 18.2 about using your own models is about
 * miniatures, not statistics, and changes nothing here.
 */
export function checkTournamentList(
  ships: readonly FleetShip[],
  rules: TournamentRules = {},
): { legal: boolean; violations: readonly CompositionFinding[] } {
  const violations: CompositionFinding[] = []
  const permitted = rules.permittedDesignIds
  const allowModifications = rules.allowModifications ?? false

  for (const ship of ships) {
    if (permitted && !permitted.includes(ship.designId)) {
      violations.push({
        kind: 'violation',
        rule: '18.2 Tournament fleets',
        shipId: ship.id,
        detail: `${ship.designId} is not one of the designs this tournament permits`,
      })
    }
    if (ship.modified && !allowModifications) {
      violations.push({
        kind: 'violation',
        rule: '18.2 Tournament fleets',
        shipId: ship.id,
        detail: `${ship.designId} is modified, and the tournament allows "no modifications, changes in weapons, etc."`,
      })
    }
  }

  return { legal: violations.length === 0, violations }
}

/**
 * Whether every player has *"a fixed, identical force"* (18.2).
 *
 * Identical means the same designs in the same numbers — stronger than equal
 * points, which is the point of the sentence: it is offered as *"even more
 * limiting"* than a permitted-designs list.
 */
export function identicalForces(forces: readonly (readonly FleetShip[])[]): boolean {
  if (forces.length < 2) return true
  const designs = (force: readonly FleetShip[]): string[] =>
    force.map((ship) => ship.designId).sort()
  const first = designs(forces[0])
  return forces.every((force) => {
    const other = designs(force)
    return other.length === first.length && other.every((id, index) => id === first[index])
  })
}

// ---------------------------------------------------------------------------
// Combat Points Value (18.3)
// ---------------------------------------------------------------------------

/** The divisor in the reconstructed CPV formula, and where the curve crosses. */
export const CPV_MASS_DIVISOR = 100

/**
 * *"In Full Thrust everything must cost at least 1 point"* (18.3) — the floor
 * on the hull cost, which bites at mass 7 and below.
 */
export const CPV_MINIMUM_HULL_COST = 1

/**
 * The CPV hull cost (18.3): `round(mass² / 100)`, never below 1.
 *
 * **[reading]** The formula is *reconstructed*. 18.3 prints it as an image —
 * *"the points cost for the hull becomes ⟨formula⟩"* — and images do not
 * survive text extraction. Four printed facts pin it exactly:
 *
 * - the Suffren, mass 54, *"a reduction of 25"*, so the hull cost is 29
 * - the Excalibur, mass 140, *"an increase of 56"*, so the hull cost is 196
 * - *"ships with mass below 100 become cheaper, over 100 more expensive"*, so
 *   the curve crosses `cost = mass` at exactly 100
 * - *"if the ship has mass 7 or less the CPV calculation would give zero"*, so
 *   it rounds to 0 at 7 and to at least 1 at 8
 *
 * `mass²/100` gives 29.16 → 29, 196, 100 at 100, 0.49 → 0 at 7 and 0.64 → 1 at
 * 8. The crossing point fixes the divisor given a square; the 7/8 boundary
 * fixes the rounding as nearest rather than floor or ceiling. The alternative
 * was to leave 18.3 unimplemented because the equation is missing; four
 * printed facts agreeing to the digit is better evidence than most rules get.
 *
 * *"Round off to the nearest integer"* is `floor(x + 0.5)`, matching
 * `designPricing`. The tie-break never bites: `mass²/100` is an exact half
 * only when `mass²` ends in 50, and no integer square does.
 */
export function cpvHullCost(mass: number): number {
  return Math.max(CPV_MINIMUM_HULL_COST, Math.floor((mass * mass) / CPV_MASS_DIVISOR + 0.5))
}

/**
 * What CPV does to a hull's points (18.3): *"the change to the point value can
 * be calculated by subtracting the actual ship mass from the CPV hull value."*
 * Negative below mass 100, positive above it.
 */
export function cpvAdjustment(mass: number): number {
  return cpvHullCost(mass) - mass
}

/**
 * A hull's points under CPV (18.3).
 *
 * **[reading]** The adjustment is *added to the printed total* rather than
 * substituted for a hull cost. 18.3 replaces a hull cost that is *"equal to
 * mass"*, citing "section 11.2" — a reference inherited from *Full Thrust*
 * 2nd edition, where a hull did cost its mass. Continuum has no such quantity:
 * 13.7 charges per hull box, at 3, 2, 1.5 or 1 points a box by row count. So
 * the engine applies 18.3's own arithmetic instead of its substitution, which
 * is exactly what both worked examples do — they start from the Fleet Book's
 * printed total and add the delta.
 *
 * The alternative was to substitute `round(mass²/100)` for
 * `hullBoxes × pointsPerBox`. Rejected: it silently erases 13.7's row-count
 * pricing, and it does not reproduce the printed examples, which never mention
 * hull boxes.
 */
export function cpvPoints(printedPoints: number, mass: number): number {
  return printedPoints + cpvAdjustment(mass)
}

/**
 * A fleet list re-priced under CPV (18.3).
 *
 * *"Changes only the basic hull cost calculation"* — so the adjustment lands
 * once per hull and nothing else moves. Embarked flights have no hull cost to
 * substitute and keep their printed price.
 */
export function applyCpv(ships: readonly FleetShip[]): FleetShip[] {
  return ships.map((ship) => ({ ...ship, points: cpvPoints(ship.points, ship.mass) }))
}

/** A fleet's total under CPV, hulls adjusted and embarked flights untouched. */
export function cpvFleetPoints(ships: readonly FleetShip[]): number {
  return fleetPoints(applyCpv(ships))
}

// ---------------------------------------------------------------------------
// Deployment (18.1)
// ---------------------------------------------------------------------------

/**
 * The playing area in MU (2.1). Section 18 never defines a table; a 6′ × 4′
 * board is 72 × 48, which is what the rest of the repository writes.
 *
 * Coordinates match `geometry.ts`: x grows to the right, y grows *downward*,
 * so `north` is y = 0 and a ship on course 12 heads that way.
 */
export interface BattleTable {
  width: number
  height: number
}

export type TableEdge = 'north' | 'south' | 'east' | 'west'

/** An axis-aligned rectangle of table, in MU. */
export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** *"Within 6 MU of their table edge"* (18.1) — the only distance section 18 states. */
export const DEPLOYMENT_ZONE_DEPTH = 6

/** *"One ship at a time (or two to four ships at a time for large battles)"* (18.1). */
export const PLACEMENT_BATCH_MIN = 1
export const PLACEMENT_BATCH_MAX = 4

/** *"Initial course limited to 11, 12, or 1"* (18.1) — straight ahead, ±1 clock point. */
export const CONVERGING_COURSE_SPREAD = 1

/** How a side's ships reach the table (18.1). */
export type DeploymentEntry = 'placed' | 'table-edge' | 'ftl'

export interface DeploymentZone {
  sideId: string
  /** The edge the zone hangs off. For a defender's half, the edge it owns. */
  edge: TableEdge
  /** Where a ship of this side may be, in MU. */
  area: Rect
  /**
   * Courses the deployment permits, or null for 18.1's *"any desired course"*.
   */
  courses: readonly Course[] | null
  /** Ways a ship of this side may arrive; more than one where 18.1 offers a choice. */
  entry: readonly DeploymentEntry[]
  /** The clause of 18.1 this zone comes from. */
  note: string
}

/**
 * The two long edges, then the two short ends.
 *
 * **[reading]** `width >= height` puts the long edges north and south; a
 * square table falls into the same branch. Section 18 does not define a table
 * at all, so this is a convention — the one implied by writing a 6′ × 4′ board
 * as 72 × 48.
 */
export function longEdges(table: BattleTable): readonly [TableEdge, TableEdge] {
  return table.width >= table.height ? ['north', 'south'] : ['west', 'east']
}

export function shortEdges(table: BattleTable): readonly [TableEdge, TableEdge] {
  return table.width >= table.height ? ['west', 'east'] : ['north', 'south']
}

/** The edge across the table from this one. */
export function oppositeEdge(edge: TableEdge): TableEdge {
  switch (edge) {
    case 'north':
      return 'south'
    case 'south':
      return 'north'
    case 'east':
      return 'west'
    case 'west':
      return 'east'
  }
}

/**
 * The course that points from an edge straight across the table — the axis the
 * converging deployment's 11/12/1 is measured about.
 */
export function courseAcrossFrom(edge: TableEdge): Course {
  switch (edge) {
    case 'north':
      return 6
    case 'south':
      return 12
    case 'west':
      return 3
    case 'east':
      return 9
  }
}

/** Normalise any integer onto the 1–12 clock face (3.1). */
function normaliseCourse(value: number): Course {
  return ((((value - 1) % 12) + 12) % 12 + 1) as Course
}

/**
 * *"Initial course limited to 11, 12, or 1"* (18.1), about a nominated axis.
 *
 * **[reading]** The printed numbers are relative to each fleet's own line of
 * advance, not to the table's absolute clock. Read absolutely they are
 * incoherent: the two fleets are on *opposing* long edges, so course 12
 * carries one of them toward the enemy and the other straight off the table on
 * turn one, and the book gives no per-side variation. Read as "straight ahead,
 * ±1 point" they come out unchanged for the fleet whose axis is 12 and
 * mirrored for the fleet opposite, which is what "opposing" has to mean.
 */
export function convergingCourses(axis: Course): readonly Course[] {
  const spread: Course[] = []
  for (let offset = -CONVERGING_COURSE_SPREAD; offset <= CONVERGING_COURSE_SPREAD; offset++) {
    spread.push(normaliseCourse(axis + offset))
  }
  return spread
}

/** The strip of table within `depth` MU of an edge (18.1). */
export function edgeStrip(table: BattleTable, edge: TableEdge, depth: number): Rect {
  switch (edge) {
    case 'north':
      return { minX: 0, minY: 0, maxX: table.width, maxY: Math.min(depth, table.height) }
    case 'south':
      return {
        minX: 0,
        minY: Math.max(0, table.height - depth),
        maxX: table.width,
        maxY: table.height,
      }
    case 'west':
      return { minX: 0, minY: 0, maxX: Math.min(depth, table.width), maxY: table.height }
    case 'east':
      return {
        minX: Math.max(0, table.width - depth),
        minY: 0,
        maxX: table.width,
        maxY: table.height,
      }
  }
}

/** The half of the table an edge owns (18.1, the defensive deployment). */
export function tableHalf(table: BattleTable, edge: TableEdge): Rect {
  switch (edge) {
    case 'north':
      return { minX: 0, minY: 0, maxX: table.width, maxY: table.height / 2 }
    case 'south':
      return { minX: 0, minY: table.height / 2, maxX: table.width, maxY: table.height }
    case 'west':
      return { minX: 0, minY: 0, maxX: table.width / 2, maxY: table.height }
    case 'east':
      return { minX: table.width / 2, minY: 0, maxX: table.width, maxY: table.height }
  }
}

/** Cut a strip down to one half of its length, along the edge it runs beside. */
function halfLength(strip: Rect, edge: TableEdge, half: 'first' | 'second'): Rect {
  const horizontal = edge === 'north' || edge === 'south'
  if (horizontal) {
    const mid = (strip.minX + strip.maxX) / 2
    return half === 'first' ? { ...strip, maxX: mid } : { ...strip, minX: mid }
  }
  const mid = (strip.minY + strip.maxY) / 2
  return half === 'first' ? { ...strip, maxY: mid } : { ...strip, minY: mid }
}

/**
 * The meeting engagement (18.1): *"fleets at opposite short ends of the table"*,
 * *"within 6 MU of their table edge … with any desired course and an initial
 * velocity."*
 *
 * `sides[0]` takes the first of `shortEdges`, `sides[1]` the other. Section
 * 18.1 says nothing about which player gets which end, so the caller's order
 * decides.
 */
export function meetingEngagementZones(
  table: BattleTable,
  sides: readonly [string, string],
): readonly DeploymentZone[] {
  const [first, second] = shortEdges(table)
  return [first, second].map((edge, index) => ({
    sideId: sides[index],
    edge,
    area: edgeStrip(table, edge, DEPLOYMENT_ZONE_DEPTH),
    // "any desired course and an initial velocity" — no limit on either.
    courses: null,
    entry: ['placed'] as const,
    note: '18.1 meeting engagement: opposite short ends, within 6 MU of the edge',
  }))
}

/**
 * The converging approach (18.1): *"Players deploy their ships along the
 * opposing long edges of the table up to the half way mark, within 6 MU of the
 * edge and initial course limited to 11, 12, or 1."*
 *
 * **[reading]** *"Up to the half way mark"* measures along the **edge**, not
 * into the table: the same sentence already fixes the depth at 6 MU. The strip
 * therefore runs half the edge's length. The alternative — a strip half the
 * table deep — contradicts the 6 MU in the same clause.
 *
 * Both fleets take the *same* half, which is why `half` is one option and not
 * one per side: on courses within a point of straight across, strips in
 * opposite halves let the fleets pass behind one another instead of
 * converging, and 18.1 introduces this deployment as *"two fleets heading for
 * the same objective on converging courses."*
 */
export function convergingApproachZones(
  table: BattleTable,
  sides: readonly [string, string],
  opts: { half?: 'first' | 'second' } = {},
): readonly DeploymentZone[] {
  const half = opts.half ?? 'first'
  const [first, second] = longEdges(table)
  return [first, second].map((edge, index) => ({
    sideId: sides[index],
    edge,
    area: halfLength(edgeStrip(table, edge, DEPLOYMENT_ZONE_DEPTH), edge, half),
    courses: convergingCourses(courseAcrossFrom(edge)),
    entry: ['placed'] as const,
    note: '18.1 converging courses: opposing long edges, half the edge, within 6 MU, course ±1 point',
  }))
}

/**
 * The offensive/defensive battle (18.1): *"the defending fleet deploys all its
 * ships first anywhere within their own half of the table. The defender can
 * also place a planet or similar terrain feature anywhere they desire. The
 * attacking ships can either enter under main drive at the opposite table
 * edge, or (if permitted) some or all may make an FTL entry."*
 *
 * **[reading]** The attacker's zone is the edge *line*, not a strip: entering
 * under main drive is an arrival during phase 5, not a placement, so the zone
 * has zero depth and is marked `table-edge`. FTL entry is *"(if permitted)"* —
 * an explicit permission, so it is a switch, off by default, and 11.5 owns
 * what the entry then does.
 *
 * The zone returned for the defender is the whole half, which is where the
 * planet may go as well; this module does not place terrain (see
 * `docs/rules/battles.md`).
 */
export function offensiveDefensiveZones(
  table: BattleTable,
  sides: { defender: string; attacker: string },
  opts: { defenderEdge?: TableEdge; ftlEntryPermitted?: boolean } = {},
): readonly DeploymentZone[] {
  const defenderEdge = opts.defenderEdge ?? shortEdges(table)[0]
  const attackerEdge = oppositeEdge(defenderEdge)
  const entry: DeploymentEntry[] = ['table-edge']
  if (opts.ftlEntryPermitted) entry.push('ftl')

  return [
    {
      sideId: sides.defender,
      edge: defenderEdge,
      area: tableHalf(table, defenderEdge),
      courses: null,
      entry: ['placed'],
      note: '18.1 defensive fleet: deploys first, anywhere within its own half',
    },
    {
      sideId: sides.attacker,
      edge: attackerEdge,
      area: edgeStrip(table, attackerEdge, 0),
      courses: null,
      entry,
      note: opts.ftlEntryPermitted
        ? '18.1 attacking fleet: enters under main drive at the opposite table edge, or by FTL (11.5)'
        : '18.1 attacking fleet: enters under main drive at the opposite table edge',
    },
  ]
}

/**
 * Which of 18.1's three battles this is.
 *
 * The three zone builders above take different shapes — two of them a pair of
 * side ids, the third a named defender and attacker — because that is what
 * each deployment is about. A caller that has to switch on a battle type needs
 * one signature, and this is it.
 */
export type BattleType = 'meeting-engagement' | 'converging-approach' | 'offensive-defensive'

export const BATTLE_TYPE_LABELS: Record<BattleType, string> = {
  'meeting-engagement': 'Meeting engagement',
  'converging-approach': 'Converging approach',
  'offensive-defensive': 'Offensive / defensive',
}

export interface ZonesOptions {
  /** Converging approach: which half of the long edges both fleets use. */
  half?: 'first' | 'second'
  /** Offensive/defensive: the side that deploys first and owns a half. */
  defenderSideId?: string
  defenderEdge?: TableEdge
  ftlEntryPermitted?: boolean
}

/**
 * The deployment zones for one battle (18.1), whichever battle it is.
 *
 * Two sides only. `meetingEngagementZones` and `convergingApproachZones` are
 * typed for a pair and 18.1 is written for two fleets; a three-cornered
 * scenario has no deployment in the section, and silently truncating to the
 * first two sides would deploy somebody nowhere.
 */
export function zonesFor(
  table: BattleTable,
  battleType: BattleType,
  sides: readonly string[],
  opts: ZonesOptions = {},
): readonly DeploymentZone[] {
  if (sides.length !== 2) return []
  const pair: readonly [string, string] = [sides[0], sides[1]]
  switch (battleType) {
    case 'meeting-engagement':
      return meetingEngagementZones(table, pair)
    case 'converging-approach':
      return convergingApproachZones(table, pair, { half: opts.half })
    case 'offensive-defensive': {
      const defender = opts.defenderSideId ?? pair[0]
      const attacker = pair.find((id) => id !== defender) ?? pair[1]
      return offensiveDefensiveZones(
        table,
        { defender, attacker },
        { defenderEdge: opts.defenderEdge, ftlEntryPermitted: opts.ftlEntryPermitted },
      )
    }
  }
}

/** One ship's proposed deployment, as 18.1 lets a player write it. */
export interface Placement {
  position: Point
  facing: Course
  /** *"An initial velocity"* (18.1). No limit is stated. */
  velocity?: number
}

/**
 * Whether a placement satisfies its zone (18.1).
 *
 * Advisory: it reports, it does not refuse. A scenario that writes final
 * positions directly has simply already run the deployment.
 */
export function validatePlacement(
  zone: DeploymentZone,
  placement: Placement,
): { legal: boolean; reasons: readonly string[] } {
  const reasons: string[] = []
  const { position, facing } = placement
  const { area } = zone

  const inside =
    position.x >= area.minX - EPSILON &&
    position.x <= area.maxX + EPSILON &&
    position.y >= area.minY - EPSILON &&
    position.y <= area.maxY + EPSILON
  if (!inside) {
    reasons.push(
      `(${position.x}, ${position.y}) is outside the ${zone.edge} deployment zone ` +
        `x ${area.minX}–${area.maxX}, y ${area.minY}–${area.maxY} (18.1)`,
    )
  }

  if (zone.courses && !zone.courses.includes(facing)) {
    reasons.push(
      `course ${facing} is not one of ${zone.courses.join(', ')} (18.1: "initial course limited to 11, 12, or 1")`,
    )
  }

  return { legal: reasons.length === 0, reasons }
}

/**
 * Somewhere legal to put `count` ships in a zone, spread along it (18.1).
 *
 * The module otherwise only ever reports, but a deployment needs somebody to
 * propose: a computer fleet has nothing to click, and a human wants a sensible
 * line to drag out of rather than an empty rectangle. Spread evenly along the
 * zone's longer axis, set back a little from the very edge so the counters are
 * not half off the table, on the first course the zone permits.
 *
 * The velocity is the caller's: 18.1 states no limit and the engine should not
 * invent one, so this proposes a walking pace and lets the player change it.
 */
export function defaultPlacements(
  zone: DeploymentZone,
  count: number,
  opts: { velocity?: number } = {},
): readonly Placement[] {
  if (count <= 0) return []
  const { area } = zone
  const horizontal = area.maxX - area.minX >= area.maxY - area.minY
  const along = horizontal
    ? { min: area.minX, max: area.maxX }
    : { min: area.minY, max: area.maxY }
  // A margin so the outermost ship is inside the zone rather than on its
  // corner, and so a one-ship fleet lands in the middle rather than at an end.
  const span = along.max - along.min
  const step = span / (count + 1)
  const across = horizontal
    ? (area.minY + area.maxY) / 2
    : (area.minX + area.maxX) / 2
  const facing = zone.courses?.[0] ?? courseAcrossFrom(zone.edge)

  return Array.from({ length: count }, (_, i) => {
    const offset = along.min + step * (i + 1)
    return {
      position: horizontal ? { x: offset, y: across } : { x: across, y: offset },
      facing,
      velocity: opts.velocity ?? 6,
    }
  })
}

/** One step of the alternating deployment: a side, and the ships it places now. */
export interface PlacementStep {
  sideId: string
  shipIds: readonly string[]
}

/**
 * The order ships are placed in (18.1): *"Players alternate in placing one ship
 * at a time … (or two to four ships at a time for large battles)."*
 *
 * 18.1 does not say who places first, so the sides are taken in the order
 * given — a scenario or an initiative roll settles that outside this module,
 * and section 18 rolls no dice. A side that runs out drops out of the rotation
 * and the others keep placing, because alternation is a procedure for taking
 * turns, not a requirement that the fleets be the same size.
 */
export function placementOrder(
  sides: readonly { id: string; shipIds: readonly string[] }[],
  batch = PLACEMENT_BATCH_MIN,
): readonly PlacementStep[] {
  const size = Math.max(PLACEMENT_BATCH_MIN, Math.min(PLACEMENT_BATCH_MAX, Math.floor(batch)))
  const queues = sides.map((side) => ({ id: side.id, remaining: [...side.shipIds] }))
  const steps: PlacementStep[] = []

  while (queues.some((queue) => queue.remaining.length > 0)) {
    for (const queue of queues) {
      if (queue.remaining.length === 0) continue
      steps.push({ sideId: queue.id, shipIds: queue.remaining.splice(0, size) })
    }
  }

  return steps
}

// ---------------------------------------------------------------------------
// The Introductory Scenario player fleet (22)
// ---------------------------------------------------------------------------

/** One of section 22's counter sheets. */
export interface IntroductoryCounterSheet {
  /** The navy the sheet is printed for, spelled as section 22 spells it. */
  faction: string
  /** The page it is printed on. */
  page: number
}

/**
 * Section 22, in full (pages 149–151).
 *
 * The section is three pages of *images*: a fleet page and one counter sheet
 * per side. What it states in text is which two navies the Introductory
 * Scenario is fought between, and in what order they are printed — and that is
 * all that is encoded here, because inventing a ship list to fill the gap
 * would be inventing a ship list.
 *
 * The force itself — two heavy cruisers and three frigates a side, alternating
 * set-up, and the victory ladder — is stated in **4.12**, on page 33, which is
 * in the other half of the source text, and is already encoded from there as
 * `INTRODUCTORY_SCENARIO` in `src/data/scenarios.ts`. The one thing 18.1 adds
 * is that 4.12's alternating set-up is the procedure 18.1 generalises, so
 * `placementOrder` serves both.
 */
export const INTRODUCTORY_FLEET_COUNTER_SHEETS: readonly IntroductoryCounterSheet[] = [
  { faction: 'Eurasian Solar Union', page: 150 },
  { faction: 'New Anglian Confederation', page: 151 },
]

/** The page section 22's own heading, *"Introductory Scenario player fleet"*, sits on. */
export const INTRODUCTORY_FLEET_PAGE = 149
