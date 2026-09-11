import { describe, expect, it } from 'vitest'

import { HULL_FRACTION, HULL_POINTS_PER_BOX, type ShipDesign } from '../engine/types'
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

/** Mass of every system fitted, which must fit inside the hull (13.14). */
function fittedMass(design: ShipDesign): number {
  const hull = design.hullBoxes
  const drive = 0.05 * design.drive.thrust * design.mass
  const ftl = design.ftl === 'none' ? 0 : 0.1 * design.mass
  const stream =
    design.streamlining === 'none' ? 0 : (design.streamlining === 'partial' ? 0.05 : 0.1) * design.mass
  const armour = design.armour.layers.reduce((a, b) => a + b, 0)
  const screens =
    (design.screens.advanced ? 0.075 : 0.05) * design.mass * design.screens.level
  const weapons = design.weapons.reduce((sum, w) => sum + w.mass, 0)
  const turrets = design.turrets.reduce((sum, t) => sum + t.mass, 0)
  const systems = design.systems.reduce((sum, s) => sum + s.mass, 0)
  return hull + drive + ftl + stream + armour + screens + weapons + turrets + systems
}

/** Combat Points Value from the parts (14, 18.3). */
function pricedPoints(design: ShipDesign): number {
  const hull = design.hullBoxes * HULL_POINTS_PER_BOX[design.hullRows]
  const drive = 0.05 * design.drive.thrust * design.mass * (design.drive.advanced ? 3 : 2)
  const ftl = design.ftl === 'none' ? 0 : 0.1 * design.mass * (design.ftl === 'advanced' ? 3 : 2)
  // Armour: 2 points a box on the inner layer, then 4, 6, 8, 10 per shell (7.7).
  const shellPoints = [2, 4, 6, 8, 10]
  const armour = design.armour.layers.reduce((sum, boxes, i) => sum + boxes * shellPoints[i], 0)
  const screens =
    (design.screens.advanced ? 0.075 : 0.05) *
    design.mass *
    design.screens.level *
    (design.screens.advanced ? 4 : 3)
  const weapons = design.weapons.reduce((sum, w) => sum + w.points, 0)
  const turrets = design.turrets.reduce((sum, t) => sum + t.points, 0)
  const systems = design.systems.reduce((sum, s) => sum + s.points, 0)
  // A damage control party and a marine boarding party cost 5 points and no
  // mass apiece (13.13).
  const crew = (design.damageControlParties + design.marineParties) * 5
  return hull + drive + ftl + armour + screens + weapons + turrets + systems + crew
}

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
      expect(fittedMass(design), `${id} carries ${fittedMass(design)} on ${design.mass}`).toBeLessThanOrEqual(
        design.mass + 1e-6,
      )
    },
  )

  it.each(GENERATED_DESIGNS.map((d) => [d.id, d] as const))(
    '%s has the hull boxes its integrity class gives it',
    (id, design) => {
      expect(design.hullBoxes, id).toBe(Math.floor(design.mass * HULL_FRACTION[design.hullClass]))
    },
  )

  it.each(GENERATED_DESIGNS.map((d) => [d.id, d] as const))(
    '%s is priced at the sum of its parts',
    (id, design) => {
      // Rounded, because several components are priced per fractional mass —
      // a thrust-3 drive on a 170-mass hull is 25.5 mass of drive.
      expect(Math.round(pricedPoints(design)), id).toBe(design.points)
    },
  )

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
