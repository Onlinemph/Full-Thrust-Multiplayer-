import { describe, expect, it } from 'vitest'

import { Rng } from './dice'
import {
  CPV_MASS_DIVISOR,
  DEPLOYMENT_ZONE_DEPTH,
  IDEAL_FLEET_POINTS_MAX,
  IDEAL_FLEET_POINTS_MIN,
  INTRODUCTORY_FLEET_COUNTER_SHEETS,
  INTRODUCTORY_FLEET_PAGE,
  LARGEST_PRACTICAL_FLEET_POINTS,
  SMALLEST_INTERESTING_FLEET_POINTS,
  applyCpv,
  breakdownFleet,
  checkFleetComposition,
  checkTournamentList,
  classifyByMass,
  convergingApproachZones,
  convergingCourses,
  cpvAdjustment,
  cpvFleetPoints,
  cpvHullCost,
  cpvPoints,
  declaredGroupAgrees,
  fleetPoints,
  fleetShipFromDesign,
  fleetSizeBand,
  identicalForces,
  longEdges,
  meetingEngagementZones,
  offensiveDefensiveZones,
  placementOrder,
  shortEdges,
  shipPoints,
  validatePlacement,
  type BattleTable,
  type CompositionLimits,
  type FleetShip,
} from './battles'
import type { ShipDesign } from './types'

/**
 * Section 18 and section 22, checked against their own prose.
 *
 * The rules worth guarding are the ones where the printed text and the obvious
 * assumption part company: mass 90 is a cruiser and not a capital, the CPV
 * curve crosses at exactly 100, "no more than 50%" includes 50%, and the
 * converging deployment's course limit is relative to each fleet rather than
 * to the table. The two worked CPV examples are here in full, because they are
 * the only check on a formula the source prints as a picture.
 */

const TABLE: BattleTable = { width: 72, height: 48 }

function ship(over: Partial<FleetShip> & Pick<FleetShip, 'id' | 'mass' | 'points'>): FleetShip {
  return { designId: over.designId ?? `design-${over.id}`, ...over }
}

// ---------------------------------------------------------------------------
// 13.4 — which class a hull is
// ---------------------------------------------------------------------------

describe('ship classification by mass (13.4)', () => {
  it('cuts at 44 and 90, and 90 itself is a cruiser', () => {
    expect(classifyByMass(1)).toBe('escort')
    expect(classifyByMass(44)).toBe('escort')
    expect(classifyByMass(45)).toBe('cruiser')
    // The boundary a reader gets wrong: 13.4's CA runs 60-90 and its BC 80-110,
    // so the class names overlap across the cut and only the mass settles it.
    expect(classifyByMass(90)).toBe('cruiser')
    expect(classifyByMass(91)).toBe('capital')
    expect(classifyByMass(300)).toBe('capital')
  })

  it('treats the engine groups 18.2 has no bucket for as disagreeing', () => {
    expect(declaredGroupAgrees('cruiser', 60)).toBe(true)
    expect(declaredGroupAgrees('cruiser', 120)).toBe(false)
    expect(declaredGroupAgrees('station', 120)).toBe(false)
    expect(declaredGroupAgrees(undefined, 120)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 18.3 — Combat Points Value
// ---------------------------------------------------------------------------

describe('CPV (18.3)', () => {
  it('reproduces both worked examples exactly', () => {
    // "The Suffren class light cruiser ... has mass 54 and a points cost of 181
    // ... a reduction of 25 points for a new total points cost of 156."
    expect(cpvHullCost(54)).toBe(29)
    expect(cpvAdjustment(54)).toBe(-25)
    expect(cpvPoints(181, 54)).toBe(156)

    // "An Excalibur class dreadnought has a mass of 140 and points cost of 472
    // ... An increase of 56 for a new total points cost of 528."
    expect(cpvHullCost(140)).toBe(196)
    expect(cpvAdjustment(140)).toBe(56)
    expect(cpvPoints(472, 140)).toBe(528)
  })

  it('honours the mass-7 floor, and the raw formula it is a floor on', () => {
    // "If the ship has mass 7 or less the CPV calculation would give zero as
    // the hull cost, but in Full Thrust everything must cost at least 1 point."
    expect(Math.floor((7 * 7) / CPV_MASS_DIVISOR + 0.5)).toBe(0)
    expect(Math.floor((8 * 8) / CPV_MASS_DIVISOR + 0.5)).toBe(1)
    for (let mass = 1; mass <= 7; mass++) expect(cpvHullCost(mass)).toBe(1)
    expect(cpvHullCost(8)).toBe(1)
  })

  it('crosses at exactly 100, which is what fixes the divisor', () => {
    // "Ships with mass below 100 become cheaper, over 100 more expensive."
    expect(cpvHullCost(100)).toBe(100)
    expect(cpvAdjustment(100)).toBe(0)
    // Mass 1 is the one exception, and it is the 1-point floor's doing, not
    // the curve's: round(0.01) is 0, so the hull pays its minimum either way.
    expect(cpvAdjustment(1)).toBe(0)
    for (let mass = 2; mass < 100; mass++) expect(cpvAdjustment(mass)).toBeLessThan(0)
    for (let mass = 101; mass <= 300; mass++) expect(cpvAdjustment(mass)).toBeGreaterThan(0)
    // One point either side of the crossing, symmetrically, which is 18.3's
    // effect in miniature: the curve is flat where the fleets meet and only
    // opens up at the ends of the mass range.
    expect(cpvAdjustment(99)).toBe(-1)
    expect(cpvAdjustment(101)).toBe(1)
    expect(cpvAdjustment(50)).toBe(-25)
    expect(cpvAdjustment(200)).toBe(200)
  })

  it('leaves embarked flights at their printed price', () => {
    // "The simple CPV calculation changes only the basic hull cost calculation."
    const carrier = ship({ id: 'cv', mass: 140, points: 472, embarkedPoints: 90 })
    expect(cpvFleetPoints([carrier])).toBe(528 + 90)
    expect(applyCpv([carrier])[0].embarkedPoints).toBe(90)
  })

  it('does not mutate the list it re-prices', () => {
    const original = Object.freeze([
      Object.freeze(ship({ id: 'a', mass: 54, points: 181 })),
      Object.freeze(ship({ id: 'b', mass: 140, points: 472 })),
    ]) as readonly FleetShip[]
    const adjusted = applyCpv(original)
    expect(original[0].points).toBe(181)
    expect(original[1].points).toBe(472)
    expect(adjusted[0].points).toBe(156)
    expect(adjusted[1]).not.toBe(original[1])
  })
})

// ---------------------------------------------------------------------------
// 18.2 — fleet size
// ---------------------------------------------------------------------------

describe('fleet size (18.2)', () => {
  it('puts each printed number on the inclusive side, except 3000', () => {
    expect(fleetSizeBand(SMALLEST_INTERESTING_FLEET_POINTS - 1)).toBe('below-minimum')
    expect(fleetSizeBand(SMALLEST_INTERESTING_FLEET_POINTS)).toBe('small')
    expect(fleetSizeBand(IDEAL_FLEET_POINTS_MIN - 1)).toBe('small')
    expect(fleetSizeBand(IDEAL_FLEET_POINTS_MIN)).toBe('ideal')
    expect(fleetSizeBand(IDEAL_FLEET_POINTS_MAX)).toBe('ideal')
    expect(fleetSizeBand(IDEAL_FLEET_POINTS_MAX + 1)).toBe('large')
    // "Forces of OVER 3000 points" — 3000 itself is not yet too large.
    expect(fleetSizeBand(LARGEST_PRACTICAL_FLEET_POINTS)).toBe('large')
    expect(fleetSizeBand(LARGEST_PRACTICAL_FLEET_POINTS + 1)).toBe('too-large')
  })

  it('is advice: a fleet outside the ideal band is still legal', () => {
    const report = checkFleetComposition([ship({ id: 'a', mass: 30, points: 100 })], {
      format: 'open',
    })
    expect(report.sizeBand).toBe('below-minimum')
    expect(report.legal).toBe(true)
    expect(report.advisories.some((finding) => finding.detail.includes('below-minimum'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 18.2 — fleet composition
// ---------------------------------------------------------------------------

describe('fleet composition (18.2)', () => {
  const patrol: CompositionLimits = { format: 'patrol' }

  it('counts a hull with what it carries', () => {
    const carrier = ship({ id: 'cv', mass: 60, points: 200, embarkedPoints: 36 })
    expect(shipPoints(carrier)).toBe(236)
    expect(fleetPoints([carrier, ship({ id: 'ff', mass: 20, points: 64 })])).toBe(300)
  })

  it('bans capitals outright in a patrol battle', () => {
    const report = checkFleetComposition(
      [
        ship({ id: 'bb', mass: 91, points: 400 }),
        ship({ id: 'ff', mass: 20, points: 600 }),
      ],
      patrol,
    )
    expect(report.legal).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0].shipId).toBe('bb')
    expect(report.violations[0].detail).toContain('no capital ships at all')
  })

  it('lets cruisers reach exactly half the points but not a point more', () => {
    const atHalf = checkFleetComposition(
      [ship({ id: 'ca', mass: 60, points: 500 }), ship({ id: 'ff', mass: 20, points: 500 })],
      patrol,
    )
    expect(atHalf.breakdown.share.cruiser).toBe(0.5)
    expect(atHalf.legal).toBe(true)

    const overHalf = checkFleetComposition(
      [ship({ id: 'ca', mass: 60, points: 501 }), ship({ id: 'ff', mass: 20, points: 500 })],
      patrol,
    )
    expect(overHalf.legal).toBe(false)
    expect(overHalf.violations[0].detail).toContain('cruisers')
  })

  it('disallows a small carrier by default and downgrades it to advice when allowed', () => {
    const fleet = [
      ship({ id: 'cve', mass: 70, points: 300, carrier: true }),
      ship({ id: 'ff1', mass: 20, points: 400 }),
      ship({ id: 'ff2', mass: 20, points: 400 }),
    ]
    const banned = checkFleetComposition(fleet, patrol)
    expect(banned.legal).toBe(false)
    expect(banned.violations[0].shipId).toBe('cve')

    const allowed = checkFleetComposition(fleet, { format: 'patrol', allowSmallCarriers: true })
    expect(allowed.legal).toBe(true)
    expect(allowed.advisories.some((finding) => finding.shipId === 'cve')).toBe(true)
  })

  it('says nothing about carriers in a format that does not restrict classes', () => {
    const fleet = [ship({ id: 'cve', mass: 70, points: 1200, carrier: true })]
    expect(checkFleetComposition(fleet, { format: 'open' }).legal).toBe(true)
    expect(checkFleetComposition(fleet, { format: 'fleet-action' }).legal).toBe(true)
  })

  it('counts a capital’s fighters against the capital limit', () => {
    // "no more than 50% of points spent on capitals, INCLUDING THEIR FIGHTERS".
    // The hull alone is under half; the wing it carries takes it over, which is
    // the only reason the phrase is in the sentence.
    const fleet = [
      ship({ id: 'bb', mass: 120, points: 500, embarkedPoints: 120 }),
      ship({ id: 'ca', mass: 60, points: 550 }),
      ship({ id: 'ff', mass: 20, points: 50 }),
    ]
    const report = checkFleetComposition(fleet, { format: 'large-battle' })
    expect(report.breakdown.points.capital).toBe(620)
    expect(report.breakdown.total).toBe(1220)
    expect(report.legal).toBe(false)

    // The same list with the hull's points alone would have passed: 500 of 1100.
    const hullOnly = fleet.map((entry) => ({ ...entry, embarkedPoints: 0 }))
    expect(checkFleetComposition(hullOnly, { format: 'large-battle' }).legal).toBe(true)
  })

  it('requires the organiser’s number of cruisers AND escorts per capital', () => {
    const fleet = [
      ship({ id: 'bb1', mass: 120, points: 400 }),
      ship({ id: 'bb2', mass: 120, points: 400 }),
      ship({ id: 'ca1', mass: 60, points: 200 }),
      ship({ id: 'ca2', mass: 60, points: 200 }),
      ship({ id: 'ff1', mass: 20, points: 100 }),
      ship({ id: 'ff2', mass: 20, points: 100 }),
    ]
    expect(checkFleetComposition(fleet, { format: 'capital-escorted' }).legal).toBe(true)
    const two = checkFleetComposition(fleet, {
      format: 'capital-escorted',
      consortsPerCapital: 2,
    })
    expect(two.legal).toBe(false)
    // Both classes are short, so both are reported rather than the first found.
    expect(two.violations).toHaveLength(2)
  })

  it('lets a fleet action be all capitals', () => {
    const fleet = [
      ship({ id: 'bb1', mass: 140, points: 600 }),
      ship({ id: 'bb2', mass: 140, points: 600 }),
    ]
    expect(checkFleetComposition(fleet, { format: 'fleet-action' }).legal).toBe(true)
    expect(checkFleetComposition(fleet, { format: 'large-battle' }).legal).toBe(false)
  })

  it('classifies by mass even when the list says otherwise, and says so', () => {
    const report = checkFleetComposition(
      [ship({ id: 'liar', mass: 120, points: 600, declaredGroup: 'cruiser' })],
      { format: 'patrol' },
    )
    expect(report.breakdown.points.capital).toBe(600)
    expect(report.breakdown.points.cruiser).toBe(0)
    expect(report.legal).toBe(false)
    const advisory = report.advisories.find((finding) => finding.rule === '13.4')
    expect(advisory?.detail).toContain('declared cruiser')
    expect(advisory?.detail).toContain('capital')
  })

  it('does not depend on the order ships appear in the list', () => {
    const rng = new Rng(0x18a1)
    const fleet = [
      ship({ id: 'bb', mass: 120, points: 500, embarkedPoints: 60 }),
      ship({ id: 'ca1', mass: 60, points: 220 }),
      ship({ id: 'ca2', mass: 88, points: 260 }),
      ship({ id: 'dd1', mass: 30, points: 90 }),
      ship({ id: 'dd2', mass: 44, points: 110 }),
      ship({ id: 'ct', mass: 12, points: 40 }),
    ]
    const straight = checkFleetComposition(fleet, { format: 'large-battle' })
    const shuffled = checkFleetComposition(rng.shuffle([...fleet]), { format: 'large-battle' })
    expect(shuffled.breakdown).toEqual(straight.breakdown)
    expect(shuffled.legal).toBe(straight.legal)
    expect(shuffled.violations.map((v) => v.detail).sort()).toEqual(
      straight.violations.map((v) => v.detail).sort(),
    )
  })

  it('does not mutate the list it checks', () => {
    const entry = Object.freeze(ship({ id: 'a', mass: 120, points: 900 }))
    const fleet = Object.freeze([entry]) as readonly FleetShip[]
    expect(() => checkFleetComposition(fleet, { format: 'patrol' })).not.toThrow()
    expect(entry.points).toBe(900)
    expect(fleet).toHaveLength(1)
  })

  it('handles an empty list without dividing by zero', () => {
    const report = checkFleetComposition([], { format: 'patrol' })
    expect(report.breakdown.total).toBe(0)
    expect(report.breakdown.share).toEqual({ escort: 0, cruiser: 0, capital: 0 })
    expect(report.legal).toBe(true)
  })

  it('splits a fleet by class', () => {
    const breakdown = breakdownFleet([
      ship({ id: 'bb', mass: 91, points: 300 }),
      ship({ id: 'ca', mass: 90, points: 200 }),
      ship({ id: 'ff', mass: 44, points: 100 }),
    ])
    expect(breakdown.count).toEqual({ escort: 1, cruiser: 1, capital: 1 })
    expect(breakdown.points).toEqual({ escort: 100, cruiser: 200, capital: 300 })
    expect(breakdown.total).toBe(600)
  })
})

// ---------------------------------------------------------------------------
// 18.2 — tournament lists
// ---------------------------------------------------------------------------

describe('tournament fleets (18.2)', () => {
  it('rejects a design that is not on the list, and any modification', () => {
    const report = checkTournamentList(
      [
        ship({ id: 'a', designId: 'fb1-suffren', mass: 54, points: 181 }),
        ship({ id: 'b', designId: 'homebrew', mass: 54, points: 200 }),
        ship({ id: 'c', designId: 'fb1-suffren', mass: 54, points: 190, modified: true }),
      ],
      { permittedDesignIds: ['fb1-suffren'] },
    )
    expect(report.legal).toBe(false)
    expect(report.violations.map((v) => v.shipId)).toEqual(['b', 'c'])
  })

  it('restricts nothing when the tournament names no list', () => {
    expect(checkTournamentList([ship({ id: 'a', mass: 54, points: 181 })]).legal).toBe(true)
  })

  it('reads "identical force" as the same designs, not the same points', () => {
    const a = [
      ship({ id: 'a1', designId: 'ca', mass: 60, points: 200 }),
      ship({ id: 'a2', designId: 'ff', mass: 20, points: 100 }),
    ]
    const b = [
      ship({ id: 'b1', designId: 'ff', mass: 20, points: 100 }),
      ship({ id: 'b2', designId: 'ca', mass: 60, points: 200 }),
    ]
    const c = [
      ship({ id: 'c1', designId: 'cl', mass: 50, points: 200 }),
      ship({ id: 'c2', designId: 'ff', mass: 20, points: 100 }),
    ]
    expect(identicalForces([a, b])).toBe(true)
    // Same total points, different designs: not an identical force.
    expect(fleetPoints(b)).toBe(fleetPoints(c))
    expect(identicalForces([a, c])).toBe(false)
    expect(identicalForces([a])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 18.1 — deployment
// ---------------------------------------------------------------------------

describe('deployment (18.1)', () => {
  it('knows the long edges from the short ends', () => {
    expect(shortEdges(TABLE)).toEqual(['west', 'east'])
    expect(longEdges(TABLE)).toEqual(['north', 'south'])
    expect(shortEdges({ width: 48, height: 72 })).toEqual(['north', 'south'])
  })

  it('puts a meeting engagement on the short ends, 6 MU deep, on any course', () => {
    const [west, east] = meetingEngagementZones(TABLE, ['a', 'b'])
    expect(west.sideId).toBe('a')
    expect(west.edge).toBe('west')
    expect(west.area).toEqual({ minX: 0, minY: 0, maxX: DEPLOYMENT_ZONE_DEPTH, maxY: 48 })
    expect(east.area).toEqual({ minX: 72 - DEPLOYMENT_ZONE_DEPTH, minY: 0, maxX: 72, maxY: 48 })
    // "with any desired course and an initial velocity" — no restriction at all.
    expect(west.courses).toBeNull()
    expect(west.entry).toEqual(['placed'])
  })

  it('reproduces the printed 11, 12, 1 for one fleet and mirrors it for the other', () => {
    const [north, south] = convergingApproachZones(TABLE, ['a', 'b'])
    expect(south.courses).toEqual([11, 12, 1])
    expect(north.courses).toEqual([5, 6, 7])
    expect(convergingCourses(12)).toEqual([11, 12, 1])
    expect(convergingCourses(1)).toEqual([12, 1, 2])
  })

  it('runs the converging strips half the edge, 6 MU deep, in the same half', () => {
    const [north, south] = convergingApproachZones(TABLE, ['a', 'b'])
    expect(north.area).toEqual({ minX: 0, minY: 0, maxX: 36, maxY: 6 })
    expect(south.area).toEqual({ minX: 0, minY: 42, maxX: 36, maxY: 48 })

    const far = convergingApproachZones(TABLE, ['a', 'b'], { half: 'second' })
    expect(far[0].area).toEqual({ minX: 36, minY: 0, maxX: 72, maxY: 6 })
    expect(far[1].area).toEqual({ minX: 36, minY: 42, maxX: 72, maxY: 48 })
  })

  it('gives the defender a whole half and the attacker an edge to enter across', () => {
    const [defender, attacker] = offensiveDefensiveZones(TABLE, {
      defender: 'd',
      attacker: 'a',
    })
    expect(defender.area).toEqual({ minX: 0, minY: 0, maxX: 36, maxY: 48 })
    expect(defender.entry).toEqual(['placed'])
    // "enter under main drive at the opposite table edge" is an arrival, so the
    // zone is the edge line and has no depth.
    expect(attacker.edge).toBe('east')
    expect(attacker.area).toEqual({ minX: 72, minY: 0, maxX: 72, maxY: 48 })
    expect(attacker.entry).toEqual(['table-edge'])
  })

  it('adds FTL entry only when the scenario permits it', () => {
    const [, attacker] = offensiveDefensiveZones(
      TABLE,
      { defender: 'd', attacker: 'a' },
      { ftlEntryPermitted: true },
    )
    expect(attacker.entry).toEqual(['table-edge', 'ftl'])
    expect(attacker.note).toContain('FTL')
  })

  it('accepts a ship exactly on the 6 MU line and rejects one past it', () => {
    const [west] = meetingEngagementZones(TABLE, ['a', 'b'])
    expect(validatePlacement(west, { position: { x: 6, y: 24 }, facing: 3 }).legal).toBe(true)
    const out = validatePlacement(west, { position: { x: 6.5, y: 24 }, facing: 3 })
    expect(out.legal).toBe(false)
    expect(out.reasons[0]).toContain('outside')
  })

  it('rejects a course the converging deployment does not allow', () => {
    const [, south] = convergingApproachZones(TABLE, ['a', 'b'])
    expect(validatePlacement(south, { position: { x: 10, y: 45 }, facing: 1 }).legal).toBe(true)
    const wrong = validatePlacement(south, { position: { x: 10, y: 45 }, facing: 2 })
    expect(wrong.legal).toBe(false)
    expect(wrong.reasons[0]).toContain('course 2')
  })

  it('alternates placement one ship at a time', () => {
    const steps = placementOrder([
      { id: 'a', shipIds: ['a1', 'a2'] },
      { id: 'b', shipIds: ['b1', 'b2'] },
    ])
    expect(steps).toEqual([
      { sideId: 'a', shipIds: ['a1'] },
      { sideId: 'b', shipIds: ['b1'] },
      { sideId: 'a', shipIds: ['a2'] },
      { sideId: 'b', shipIds: ['b2'] },
    ])
  })

  it('places in batches for a large battle, clamped to the printed two-to-four', () => {
    const ships = ['s1', 's2', 's3', 's4', 's5']
    const four = placementOrder([{ id: 'a', shipIds: ships }], 4)
    expect(four).toEqual([
      { sideId: 'a', shipIds: ['s1', 's2', 's3', 's4'] },
      { sideId: 'a', shipIds: ['s5'] },
    ])
    // "two to four ships at a time" is the ceiling; anything larger is clamped.
    expect(placementOrder([{ id: 'a', shipIds: ships }], 9)).toEqual(four)
    expect(placementOrder([{ id: 'a', shipIds: ships }], 0)).toHaveLength(5)
  })

  it('lets the larger fleet keep placing once the smaller runs out', () => {
    const steps = placementOrder([
      { id: 'a', shipIds: ['a1', 'a2', 'a3'] },
      { id: 'b', shipIds: ['b1'] },
    ])
    expect(steps.map((step) => step.sideId)).toEqual(['a', 'b', 'a', 'a'])
  })

  it('does not mutate the ship lists it is given', () => {
    const ships = ['a1', 'a2']
    placementOrder([{ id: 'a', shipIds: ships }])
    expect(ships).toEqual(['a1', 'a2'])
  })
})

// ---------------------------------------------------------------------------
// Adapting a design, and section 22
// ---------------------------------------------------------------------------

function design(over: Partial<ShipDesign>): ShipDesign {
  return {
    id: 'test-ca',
    name: 'Test-class Heavy Cruiser',
    faction: 'Test',
    group: 'cruiser',
    mass: 80,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 24,
    drive: { thrust: 4, advanced: false },
    ftl: 'standard',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 1, generators: 1, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 0,
    marineParties: 0,
    points: 260,
    ...over,
  }
}

describe('adapting a ShipDesign', () => {
  it('carries mass, points and the declared group across', () => {
    const entry = fleetShipFromDesign(design({}))
    expect(entry).toMatchObject({ designId: 'test-ca', mass: 80, points: 260, declaredGroup: 'cruiser' })
    expect(classifyByMass(entry.mass)).toBe('cruiser')
  })

  it('makes a hull with fighter bays a carrier, and one with gunboat racks not', () => {
    const cv = fleetShipFromDesign(design({ fighterBays: [{ typeId: 'standard', label: 'Flight 1' }] }))
    expect(cv.carrier).toBe(true)
    const tender = fleetShipFromDesign(design({ gunboats: [{ typeId: 'beam', label: 'Squadron 1' }] }))
    expect(tender.carrier).toBe(false)
  })

  it('leaves a carrier’s wings for the caller to price', () => {
    // 13.12 prices a hangar bay at 3 per mass over 6 mass: 18 points for the
    // empty hold. 14.7 charges for the wing on top, 18 to 42 points. The
    // design's own points therefore do not carry it, and nothing here can
    // derive it, so a caller checking 18.2's "including their fighters" has to
    // pass it in — a capital that does not is under-counted.
    const carrier = design({
      id: 'cva',
      mass: 200,
      points: 900,
      fighterBays: [
        { typeId: 'graser', label: 'Flight 1' },
        { typeId: 'graser', label: 'Flight 2' },
      ],
    })
    const bare = fleetShipFromDesign(carrier)
    expect(bare.embarkedPoints).toBe(0)
    const priced = fleetShipFromDesign(carrier, { embarkedPoints: 42 * 2 })
    expect(shipPoints(priced)).toBe(984)

    const fleet = [priced, ship({ id: 'ca', mass: 60, points: 900 })]
    expect(checkFleetComposition(fleet, { format: 'large-battle' }).legal).toBe(false)
    expect(
      checkFleetComposition([bare, ship({ id: 'ca', mass: 60, points: 900 })], {
        format: 'large-battle',
      }).legal,
    ).toBe(true)
  })
})

describe('the Introductory Scenario player fleet (22)', () => {
  it('names the two navies section 22 prints counters for, in order', () => {
    expect(INTRODUCTORY_FLEET_PAGE).toBe(149)
    expect(INTRODUCTORY_FLEET_COUNTER_SHEETS.map((sheet) => sheet.faction)).toEqual([
      'Eurasian Solar Union',
      'New Anglian Confederation',
    ])
    expect(INTRODUCTORY_FLEET_COUNTER_SHEETS.map((sheet) => sheet.page)).toEqual([150, 151])
  })
})
