import { describe, expect, it } from 'vitest'

import {
  describeFault,
  hullBoxesFor,
  minimumHullBoxes,
  priceDesign,
  proportionalCost,
  protectionBoxes,
  repriceProportional,
  validateDesign,
} from './designPricing'
import type { ShipDesign } from '../engine/types'

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
