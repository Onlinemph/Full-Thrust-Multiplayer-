import { describe, expect, it } from 'vitest'

import { hullBoxesFor, priceDesign, validateDesign } from './designPricing'
import { GENERATED_DESIGNS } from './generatedShips'
import { SHIP_DESIGNS } from './ships'

/**
 * Data integrity for the roster.
 *
 * These are not rules tests — they check that the ship data is self-consistent
 * and obeys the construction rules, which is the thing that silently rots when
 * a design is edited by hand. A mispriced hull does not crash anything; it just
 * makes every battle it appears in unfair, and nobody notices for months.
 */

describe('the roster', () => {
  it('has unique ids', () => {
    const ids = SHIP_DESIGNS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every design a faction, a group and a positive mass', () => {
    for (const design of SHIP_DESIGNS) {
      expect(design.faction, design.id).toBeTruthy()
      expect(design.mass, design.id).toBeGreaterThan(0)
      expect(design.points, design.id).toBeGreaterThan(0)
    }
  })

  it.each(GENERATED_DESIGNS.map((d) => [d.id, d] as const))(
    '%s fits inside its own hull',
    (id, design) => {
      // 13.14: a design may not carry more mass of systems than the hull rates.
      const cost = priceDesign(design)
      expect(cost.massUsed, `${id} carries ${cost.massUsed} on ${cost.massAvailable}`)
        .toBeLessThanOrEqual(cost.massAvailable + 1e-6)
    },
  )

  it.each(GENERATED_DESIGNS.map((d) => [d.id, d] as const))(
    '%s has the hull boxes its integrity class gives it',
    (id, design) => {
      expect(design.hullBoxes, id).toBe(hullBoxesFor(design.mass, design.hullClass))
    },
  )

  it.each(GENERATED_DESIGNS.map((d) => [d.id, d] as const))(
    '%s is priced at the sum of its parts',
    (id, design) => {
      // The declared CPV must be what the tables say the parts cost. This is
      // the assertion that catches a hand-edited design, and it is why the
      // roster is generated rather than written.
      expect(priceDesign(design).points, id).toBe(design.points)
    },
  )

  it('passes the designer\'s own validation', () => {
    // The same check a player gets while building, run over the shipped fleet:
    // if the roster cannot pass it, the check is wrong or the roster is.
    for (const design of SHIP_DESIGNS) {
      expect(validateDesign(design), design.id).toEqual([])
    }
  })

  it('does not carry more armour than hull', () => {
    // Legal, but a hull plated with more ablative armour than it has structure
    // is a design nobody builds, and it is the shape a generator bug takes.
    for (const design of GENERATED_DESIGNS) {
      const armour = design.armour.layers.reduce((a, b) => a + b, 0)
      expect(armour, design.id).toBeLessThanOrEqual(design.hullBoxes)
    }
  })

  it('gives every weapon at least one arc, and no more than six', () => {
    for (const design of SHIP_DESIGNS) {
      for (const weapon of design.weapons) {
        expect(weapon.arcs.length, `${design.id}/${weapon.id}`).toBeGreaterThan(0)
        expect(weapon.arcs.length, `${design.id}/${weapon.id}`).toBeLessThanOrEqual(6)
        expect(new Set(weapon.arcs).size, `${design.id}/${weapon.id}`).toBe(weapon.arcs.length)
      }
    }
  })

  it('gives every ship a FireCon, or no offensive weapons at all', () => {
    // 4.4: without a FireCon a ship cannot engage anything, so a design with
    // guns and no FireCon is a mistake rather than a choice.
    for (const design of SHIP_DESIGNS) {
      const fireCons = design.systems.filter(
        (s) => s.kind === 'firecon' || s.kind === 'advanced-firecon',
      ).length
      if (design.weapons.length > 0) expect(fireCons, design.id).toBeGreaterThan(0)
    }
  })

  it('gives a carrier a launch tube for its hangar bays', () => {
    // 8.2: fighters leave through launch tubes, so hangar space with no tube is
    // a wing that can never fly.
    for (const design of SHIP_DESIGNS) {
      if (design.fighterBays.length === 0) continue
      const tubes = design.systems.filter((s) => s.kind === 'launch-tube').length
      expect(tubes, design.id).toBeGreaterThan(0)
    }
  })

  it('keeps the point ladder monotonic within a faction', () => {
    // An escort that costs more than a cruiser of the same fleet means the
    // generator has mispriced something.
    const rank = { escort: 0, cruiser: 1, capital: 2, station: 3, civilian: 4, monster: 5 }
    for (const faction of new Set(GENERATED_DESIGNS.map((d) => d.faction))) {
      const fleet = GENERATED_DESIGNS.filter((d) => d.faction === faction)
      const escorts = fleet.filter((d) => rank[d.group] === 0).map((d) => d.points)
      const cruisers = fleet.filter((d) => rank[d.group] === 1).map((d) => d.points)
      const capitals = fleet.filter((d) => rank[d.group] === 2).map((d) => d.points)
      expect(Math.max(...escorts), faction).toBeLessThan(Math.min(...cruisers))
      expect(Math.max(...cruisers), faction).toBeLessThan(Math.min(...capitals))
    }
  })
})
