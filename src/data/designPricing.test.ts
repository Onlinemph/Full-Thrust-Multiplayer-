import { describe, expect, it } from 'vitest'

import {
  breakdownDesign,
  costLines,
  cpvWorking,
  describeFault,
  driveMass,
  ftlMass,
  hullBoxesFor,
  minimumHullBoxes,
  priceDesign,
  printedWeaponCost,
  proportionalCost,
  protectionBoxes,
  repriceProportional,
  roundMassShare,
  screenMass,
  validateDesign,
} from './designPricing'
import { ARC_ORDER, type ShipDesign } from '../engine/types'
import { CATALOGUE_WEAPONS } from './buildCatalog'

/**
 * The construction rules, as sections 13 and 14 state them.
 *
 * These are the sums that decide whether a fleet is fair, and they were built
 * from a spreadsheet before the sections themselves could be read. What is
 * tested here is the handful of places where reading them changed something.
 */

function hull(over: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'h',
    name: 'Hull',
    faction: 'Test',
    group: 'cruiser',
    mass: 100,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 30,
    drive: { thrust: 2, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 0,
    marineParties: 0,
    points: 0,
    ...over,
  }
}

describe('hull integrity (13.7)', () => {
  it('lets a designer pick any number of boxes above a tenth of the mass', () => {
    // "There are no fixed percentage limits on hull integrity... subject only
    // to a lower limit of a minimum of 10% of the total ship mass. The actual
    // number of hull boxes chosen does not have to exactly equal any given
    // percentage." The five named classes are descriptions, not a menu.
    expect(minimumHullBoxes(100)).toBe(10)
    for (const boxes of [10, 17, 23, 30, 41, 50]) {
      expect(validateDesign(hull({ hullBoxes: boxes })), `${boxes} boxes`).toEqual([])
    }
  })

  it('refuses a hull below the floor, and says why', () => {
    const faults = validateDesign(hull({ hullBoxes: 9 }))
    expect(faults).toHaveLength(1)
    expect(describeFault(faults[0])).toContain('10%')
  })

  it('still names what each integrity class gives', () => {
    expect(hullBoxesFor(100, 'fragile')).toBe(10)
    expect(hullBoxesFor(100, 'weak')).toBe(20)
    expect(hullBoxesFor(100, 'average')).toBe(30)
    expect(hullBoxesFor(100, 'strong')).toBe(40)
    expect(hullBoxesFor(100, 'super')).toBe(50)
  })
})

describe('systems priced as a share of the hull (14.1, 14.2)', () => {
  it('charges a stealth hull per hull and armour box, not once', () => {
    // 14.1: "Stealth Hull -Level 1: None, 2 per Hull/Armour Box."
    const bare = hull({ hullBoxes: 30 })
    expect(protectionBoxes(bare)).toBe(30)
    expect(proportionalCost('stealth-hull', bare)).toEqual({ mass: 0, points: 60 })

    // Armour counts too, so plating the ship makes hiding it dearer.
    const plated = hull({ hullBoxes: 30, armour: { layers: [8], regenerative: false } })
    expect(protectionBoxes(plated)).toBe(38)
    expect(proportionalCost('stealth-hull', plated)).toEqual({ mass: 0, points: 76 })
  })

  it('charges a cloaking device half the hull and a field the whole of it', () => {
    // 14.2: "Cloaking Device 1 [mass] Ship's mass /2" and "Cloaking Field 1
    // [mass] Ship's mass".
    expect(proportionalCost('cloaking-device', hull({ mass: 80 }))).toEqual({ mass: 1, points: 40 })
    expect(proportionalCost('cloaking-field', hull({ mass: 80 }))).toEqual({ mass: 1, points: 80 })
  })

  it('re-prices them when the hull changes size underneath', () => {
    const small = repriceProportional(
      hull({
        mass: 40,
        systems: [{ id: 'c', kind: 'cloaking-device', label: 'Cloak', mass: 1, points: 0 }],
      }),
    )
    expect(small.systems[0].points).toBe(20)
    const large = repriceProportional({ ...small, mass: 200 })
    expect(large.systems[0].points).toBe(100)
    expect(validateDesign(large).filter((f) => f.kind === 'mispriced-proportional')).toEqual([])
  })

  it('reports a proportional system left behind by its hull', () => {
    const stale = hull({
      mass: 200,
      systems: [{ id: 'c', kind: 'cloaking-device', label: 'Cloak', mass: 1, points: 20 }],
    })
    const faults = validateDesign(stale)
    expect(faults.some((f) => f.kind === 'mispriced-proportional')).toBe(true)
  })

  it('will not put two fields on one hull', () => {
    // 7.17 and 7.20 each forbid combining, so one hull carries one.
    const both = hull({
      systems: [
        { id: 'c', kind: 'cloaking-device', label: 'Cloak', mass: 1, points: 50 },
        { id: 'h', kind: 'holofield', label: 'Holofield', mass: 10, points: 50 },
      ],
    })
    expect(both && validateDesign(both).some((f) => f.kind === 'two-cloaks')).toBe(true)
  })
})

describe('crew parties (10.4, 13.13)', () => {
  it('charges only the parties bought on top of the crew', () => {
    const bare = priceDesign(hull()).points
    const withExtras = priceDesign(hull({ additionalDamageControlParties: 2 })).points
    expect(withExtras - bare).toBe(10)
  })

  it('will not let a hull carry more bought parties than crew', () => {
    // 13.13: a ship "may not mount more Damage Control Parties (and or
    // additional Marines) than the number of crew it was initially designed
    // with", and 10.4 makes that one per 20 mass.
    const legal = hull({ mass: 100, additionalDamageControlParties: 3, marineParties: 2 })
    expect(validateDesign(legal)).toEqual([])
    const greedy = hull({ mass: 100, additionalDamageControlParties: 4, marineParties: 3 })
    expect(validateDesign(greedy).some((f) => f.kind === 'too-many-parties')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The families that price by a formula (5.14, 5.16, 5.21, 6.6, 6.8)
// ---------------------------------------------------------------------------

/**
 * Section 14 prints most mountings as a plain row, and those the catalogue can
 * simply carry. Five families do not: a Pulse Torpedo, a K-Gun, a Pulser, a
 * Plasma Bolt Launcher and a multi-stage missile are priced by arc count,
 * class or range line, so the numbers were typed out by hand into the
 * generator and copied into the Shipyard's list. `printedWeaponCost` derives
 * them from the section instead, and these are the checks that stop the two
 * drifting — one of them found the SRK-1 at mass 1 when the table prints 1.5.
 */
describe('mountings priced by formula, not by row', () => {
  const gun = (over: Partial<ShipDesign['weapons'][number]>): ShipDesign['weapons'][number] => ({
    id: 'w',
    label: 'gun',
    weaponClass: 'k-gun',
    rating: 1,
    variant: 'standard',
    arcs: ['F'],
    mass: 0,
    points: 0,
    ...over,
  })

  it('reads the printed Pulse Torpedo table off 5.14', () => {
    // "Pulse Torpedo mass 4 1 arc, +1 mass per additional arc"; the SR tube is
    // 2 and buys both extra arcs for 1; LR and VPT are 8 and +2.
    expect(printedWeaponCost(gun({ weaponClass: 'pulse-torpedo', arcs: ['F'] }))).toEqual({
      mass: 4,
      points: 12,
      rule: '5.14',
    })
    expect(
      printedWeaponCost(gun({ weaponClass: 'pulse-torpedo', arcs: ['FP', 'F', 'FS'] }))?.mass,
    ).toBe(6)
    expect(
      printedWeaponCost(gun({ weaponClass: 'pulse-torpedo', variant: 'short', arcs: ['F'] }))?.mass,
    ).toBe(2)
    expect(
      printedWeaponCost(gun({ weaponClass: 'pulse-torpedo', variant: 'long', arcs: ['F'] }))?.mass,
    ).toBe(8)
  })

  it('charges a K-Gun 4 points a mass, and 2 more for Flak shells', () => {
    // "K-Guns cost 4 per mass" and "for an additional 2 points a K-Gun may be
    // equipped with Flak ammunition" — no extra mass either way.
    const k2 = gun({ rating: 2, arcs: ['F'] })
    expect(printedWeaponCost(k2)).toEqual({ mass: 3, points: 12, rule: '5.16' })
    expect(printedWeaponCost({ ...k2, flak: true })).toEqual({
      mass: 3,
      points: 14,
      rule: '5.16',
    })
  })

  it('prices the SRK-1 at the 1.5 the table prints, not the 1 the rule of thumb gives', () => {
    // "SRK-1 mass 1.5 6-arcs", and "Short range K-1's can be bought in pairs
    // for 3 mass" — which is the same number, twice.
    const srk1 = printedWeaponCost(
      gun({ rating: 1, variant: 'short', arcs: ['F', 'FS', 'AS', 'A', 'AP', 'FP'] }),
    )
    expect(srk1?.mass).toBe(1.5)
    expect(srk1?.mass !== undefined && srk1.mass * 2).toBe(3)
  })

  it('scales a Plasma Bolt Launcher by class and arc (6.8)', () => {
    // "3 mass per class + 1 mass x class per extra arc (max three arcs)"
    expect(printedWeaponCost(gun({ weaponClass: 'plasma-bolt-launcher', rating: 3, arcs: ['F'] }))).toEqual(
      { mass: 9, points: 27, rule: '6.8' },
    )
    expect(
      printedWeaponCost(
        gun({ weaponClass: 'plasma-bolt-launcher', rating: 3, arcs: ['FP', 'F', 'FS'] }),
      )?.mass,
    ).toBe(15)
  })

  it('adds 2 mass and doubles the points for an extra missile stage (6.6)', () => {
    const rack = gun({ weaponClass: 'salvo-missile-rack', arcs: ['FP', 'F', 'FS'] })
    expect(printedWeaponCost(rack)).toEqual({ mass: 4, points: 12, rule: '6.6' })
    expect(printedWeaponCost({ ...rack, variant: 'two-stage' })).toEqual({
      mass: 6,
      points: 24,
      rule: '6.6 multi-stage',
    })
  })

  it('agrees with every mounting the Shipyard offers', () => {
    // The catalogue is generated from the same tables, so the two must match
    // on every row of every family the section prices by formula.
    for (const entry of CATALOGUE_WEAPONS) {
      for (const mounting of entry.mountings) {
        const printed = printedWeaponCost({
          id: 'w',
          label: entry.label,
          weaponClass: entry.weaponClass,
          rating: entry.rating,
          variant: entry.variant,
          arcs: ARC_ORDER.slice(0, mounting.arcs),
          mass: mounting.mass,
          points: mounting.points,
        })
        if (!printed) continue
        expect(printed.mass, `${entry.label} in ${mounting.arcs} arcs`).toBe(mounting.mass)
        expect(printed.points, `${entry.label} in ${mounting.arcs} arcs`).toBe(mounting.points)
      }
    }
  })

  it('reports a hand-built mounting that is cheaper than the section', () => {
    const cheap = hull({
      weapons: [gun({ id: 'k', label: 'K-3', rating: 3, mass: 2, points: 8 })],
      systems: [{ id: 'fc', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
    })
    const fault = validateDesign(cheap).find((f) => f.kind === 'mispriced-weapon')
    expect(fault).toBeDefined()
    expect(describeFault(fault!)).toContain('5 mass')
  })

  it('caps Plasma Bolt Launchers at one per 50 mass of hull (6.8)', () => {
    const bolt = (id: string) =>
      gun({ id, label: 'PBL-1', weaponClass: 'plasma-bolt-launcher', rating: 1, mass: 3, points: 9 })
    const overmounted = hull({
      mass: 40,
      hullBoxes: 12,
      weapons: [bolt('p1'), bolt('p2')],
      systems: [{ id: 'fc', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
    })
    const fault = validateDesign(overmounted).find((f) => f.kind === 'too-many-plasma-bolts')
    expect(fault).toBeDefined()
    expect(describeFault(fault!)).toContain('50 mass')
  })
})

/**
 * 13.5: *"decimals of .49 and less should be rounded down, while those of .5
 * or higher should be rounded up"*, and *"No single system can ever be
 * rounded down to mass 0"*. The book works its own examples, which is what
 * makes this testable to the digit — and none of it was being done, which
 * priced the design example a point under the book and a mass light.
 */
describe('rounding a share of the hull (13.5)', () => {
  it('rounds to the nearest whole mass, and never to nothing', () => {
    // "the 10% required for the FTL drive will be 6.4, which will round down
    // to 6. If the same ship's main drive is thrust-4, however, this will take
    // 20% = 12.8 which will round up to 13 mass." And 13.9: "Main drive
    // rating 6 would be 30% of 64 = 19.2, rounded down to 19."
    expect(ftlMass(64)).toBe(6)
    expect(driveMass(64, 4)).toBe(13)
    expect(driveMass(64, 6)).toBe(19)
    // "A very tiny ship of (say) mass 4 will still have to pay 1 mass for an
    // FTL Drive, even though 10% for it is only 0.4."
    expect(ftlMass(4)).toBe(1)
    expect(roundMassShare(0)).toBe(0)
    // A share is rounded to six places first, so a tenth held as a binary
    // float a hair under the half still rounds the way 13.5 says.
    expect(roundMassShare(25.4999999)).toBe(26)
    expect(roundMassShare(25.49)).toBe(25)
    expect(roundMassShare(0.3 * 85)).toBe(26)
  })

  it('gives the design example its printed hull, drives and screen', () => {
    // 13.14: "26 mass (actually 25.8, rounded up)", "8.6, rounded up to 9",
    // "17.2, rounded down to 17", "5% of 86 = 4.3, rounded down to 4".
    expect(hullBoxesFor(86, 'average')).toBe(26)
    expect(ftlMass(86)).toBe(9)
    expect(driveMass(86, 4)).toBe(17)
    expect(screenMass(86, 1, false)).toBe(4)
  })

  it('rounds the drive once at its full rating, and each screen generator on its own', () => {
    // 13.9 says "add the percentages together and then determine the mass";
    // 7.2 prices a generator a level and puts one symbol on the sheet each.
    expect(driveMass(64, 6)).toBe(19)
    expect(driveMass(64, 1) * 6).toBe(18)
    expect(screenMass(86, 2, false)).toBe(8)
  })

  it('floors the hull at a tenth of the mass, rounded the same way', () => {
    expect(minimumHullBoxes(86)).toBe(9)
    expect(minimumHullBoxes(84)).toBe(8)
    expect(minimumHullBoxes(4)).toBe(1)
  })
})

/**
 * The book's own design (13.14): an 86-mass heavy cruiser, priced row by
 * row to "Totals mass 86, 294 points". This is the one design whose every
 * line is printed, so it is the one the sums are held to.
 */
describe('the design example (13.14)', () => {
  const six = ARC_ORDER.slice(0, 6)
  const beam = (id: string, rating: number, arcs: number, mass: number, points: number): ShipDesign['weapons'][number] => ({
    id,
    label: `Beam-${rating}`,
    weaponClass: 'beam',
    rating,
    variant: 'standard',
    arcs: arcs === 3 ? ['FP', 'F', 'FS'] : [...six],
    mass,
    points,
  })
  const cruiser = hull({
    mass: 86,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 26,
    drive: { thrust: 4, advanced: false },
    ftl: 'standard',
    screens: { level: 1, generators: 1, advanced: false },
    weapons: [
      beam('b3a', 3, 3, 6, 18),
      beam('b3b', 3, 3, 6, 18),
      beam('b2', 2, 6, 3, 9),
      beam('b1a', 1, 6, 1, 3),
      beam('b1b', 1, 6, 1, 3),
      {
        id: 'sml',
        label: 'SML',
        weaponClass: 'salvo-missile-launcher',
        rating: 1,
        variant: 'standard',
        arcs: ['FP', 'F', 'FS'],
        mass: 3,
        points: 9,
      },
    ],
    magazines: [
      {
        id: 'm1',
        mass: 6,
        points: 18,
        loads: [{ grade: 'standard' }, { grade: 'standard' }, { grade: 'standard' }],
        launcherIds: ['sml'],
      },
    ],
    systems: [
      { id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      { id: 'fc-2', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      { id: 'pds-1', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
      { id: 'pds-2', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
      { id: 'screen-gen-1', kind: 'screen-generator', label: 'Screen Gen', mass: 0, points: 0 },
    ],
  })

  it('comes to 86 mass exactly and 294 points', () => {
    const cost = priceDesign(cruiser)
    expect(cost.massUsed).toBe(86)
    expect(cost.spare).toBe(0)
    expect(cost.points).toBe(294)
    expect(validateDesign(cruiser)).toEqual([])
  })

  it('tabulates the book’s own sub-totals, with the arithmetic beside each row', () => {
    // "Sub-totals 52 mass 190 points" for the hull and drives, "Sub-totals 34
    // mass 104 points" for everything fitted to it.
    const sheet = breakdownDesign(cruiser)
    const hullGroup = sheet.groups.find((g) => g.id === 'hull')
    expect(hullGroup?.mass).toBe(52)
    expect(hullGroup?.points).toBe(190)
    const fitted = sheet.groups.filter((g) => g.id !== 'hull')
    expect(fitted.reduce((sum, g) => sum + g.mass, 0)).toBe(34)
    expect(fitted.reduce((sum, g) => sum + g.points, 0)).toBe(104)
    expect(sheet.subtotal).toBe(294)
    expect(sheet.cost.points).toBe(294)

    const row = (label: string) => hullGroup?.lines.find((l) => l.label === label)
    expect(row('Basic hull')).toMatchObject({ mass: 0, points: 86, working: 'mass 86 × 1' })
    expect(row('Hull integrity')).toMatchObject({
      mass: 26,
      points: 52,
      working: 'average: 30% of 86 = 25.8 → 26 boxes × 2 (4 rows)',
    })
    expect(row('FTL drive')).toMatchObject({ mass: 9, points: 18, working: '10% of 86 = 8.6 → 9 × 2' })
    expect(row('Main drive')).toMatchObject({
      mass: 17,
      points: 34,
      working: 'thrust 4: 20% of 86 = 17.2 → 17 × 2',
    })
    const screens = sheet.groups.find((g) => g.id === 'defences')?.lines.find((l) => l.label === 'Screens')
    expect(screens).toMatchObject({ mass: 4, points: 12, working: '5% of 86 = 4.3 → 4 × 3' })
    // Two FireCons are one row, and the free generator symbol is none.
    const systems = sheet.groups.find((g) => g.id === 'systems')?.lines ?? []
    expect(systems.map((l) => [l.label, l.count, l.mass, l.points])).toEqual([
      ['FireCon', 2, 2, 8],
      ['PDS', 2, 2, 6],
    ])
  })

  it('is the sum of its rows and nothing else', () => {
    const lines = costLines(cruiser)
    expect(lines.reduce((sum, l) => sum + l.mass, 0)).toBe(priceDesign(cruiser).massUsed)
    expect(lines.reduce((sum, l) => sum + l.points, 0)).toBe(priceDesign(cruiser).points)
  })

  it('writes 18.3 out on the book’s two examples', () => {
    // "the Suffren class light cruiser … has mass 54 and a points cost of
    // 181 … a reduction of 25 points for a new total points cost of 156. …
    // an Excalibur class dreadnought has a mass of 140 and points cost of
    // 472 … An increase of 56 for a new total points cost of 528."
    expect(cpvWorking(181, 54)).toMatchObject({ hullCost: 29, adjustment: -25, points: 156 })
    expect(cpvWorking(472, 140)).toMatchObject({ hullCost: 196, adjustment: 56, points: 528 })
    expect(cpvWorking(181, 54).steps).toEqual([
      'hull under CPV: 54² ÷ 100 = 29.16 → 29',
      'change: 29 − 54 = −25',
      '181 − 25 = 156 CPV',
    ])
    expect(cpvWorking(20, 4).steps[0]).toBe('hull under CPV: 4² ÷ 100 = 0.16 → 1 (never below 1)')
  })

  it('discounts a flawed design after the rows are totalled (13.13)', () => {
    const flawed = { ...cruiser, flawed: true }
    const sheet = breakdownDesign(flawed)
    expect(sheet.subtotal).toBe(294)
    expect(sheet.cost.points).toBe(235)
    expect(sheet.cost.massAvailable).toBe(94.6)
    expect(sheet.flawed?.points).toBe('20% off: 294 × 0.8 = 235.2 → 235')
  })
})
