import { describe, expect, it } from 'vitest'

import {
  describeFault,
  hullBoxesFor,
  minimumHullBoxes,
  priceDesign,
  printedWeaponCost,
  proportionalCost,
  protectionBoxes,
  repriceProportional,
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
