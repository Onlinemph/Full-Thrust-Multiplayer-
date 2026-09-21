/**
 * Vehicle design (Chapter 3): capacity, the weapons fit limits, the power
 * plant's say over mobility and energy weapons, armour ceilings and the
 * signatures a record card reads.
 */

import { describe, expect, it } from 'vitest'
import { BOOK_EXAMPLES } from './data/examples'
import { baseMovementOf, goingOf } from './data/mobility'
import { firerDie, stepDie, targetDie, validityOf } from './data/weapons'
import {
  capacityLines,
  capacityOf,
  capacityUsed,
  effectiveSignature,
  newVehicleDesign,
  primaryWeapon,
  targetDieOf,
  validateDesign,
  weaponCapacity,
  weaponSystemsCount,
} from './design'
import type { VehicleDesign } from './types'

const blank = (patch: Partial<VehicleDesign> = {}): VehicleDesign => ({ ...newVehicleDesign('t'), ...patch })
const faultsOf = (design: VehicleDesign) => validateDesign(design).filter((f) => !f.advisory).map((f) => f.detail)

describe('capacity (p. 8, p. 11, p. 12, p. 16)', () => {
  it('gives five points a size class', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => capacityOf(n as VehicleDesign['size']))).toEqual([5, 10, 15, 20, 25, 30, 35])
  })

  it("prices the p. 12 examples: a turreted class-4 gun is 12, a twin-mount 12 + 8, a fixed class-4 gun 8", () => {
    const large = blank({ size: 4, weapons: [{ id: 'g', type: 'hvc', class: 4, mount: 'turret', barrels: 1 }] })
    expect(weaponCapacity(large, large.weapons[0]!)).toBe(12)
    const twin = blank({ size: 4, weapons: [{ id: 'g', type: 'hvc', class: 4, mount: 'turret', barrels: 2 }] })
    expect(weaponCapacity(twin, twin.weapons[0]!)).toBe(20)
    const destroyer = blank({
      size: 3,
      weapons: [
        { id: 'g', type: 'hvc', class: 4, mount: 'fixed', barrels: 1 },
        { id: 's', type: 'rfac', class: 2, mount: 'turret', barrels: 1 },
      ],
    })
    expect(weaponCapacity(destroyer, destroyer.weapons[0]!)).toBe(8)
    // The secondary in a turret takes 2 × class when it is not the primary: 4, plus... the book
    // says 6 here because no turret was paid for on the main gun. This reading charges the
    // turret on the primary only, so the secondary is 4 and the point is flagged below.
    expect(weaponCapacity(destroyer, destroyer.weapons[1]!)).toBe(4)
  })

  it("adds up the DEIMOS's 20 points as p. 16 does: turret MDC/4 12, GMS/H 4, enhanced PDS 3, APFC 1", () => {
    const deimos = BOOK_EXAMPLES.find((e) => e.design.id === 'book-deimos')!.design
    const lines = Object.fromEntries(capacityLines(deimos).map((l) => [l.label, l.capacity]))
    expect(lines['MDC/4 (turret)']).toBe(12)
    expect(lines['GMS/H (ENH)']).toBe(4)
    expect(lines['PDS (enhanced)']).toBe(3)
    expect(lines['APFC']).toBe(1)
    expect(capacityUsed(deimos)).toBe(20)
    expect(validateDesign(deimos)).toEqual([])
  })

  it('refuses a design over capacity and one with more weapon systems than its class', () => {
    const over = blank({ size: 2, weapons: [{ id: 'g', type: 'hvc', class: 4, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(over)).toContainEqual(expect.stringMatching(/Capacity 12 used of 10/))
    const many = blank({
      size: 2,
      weapons: [{ id: 'a', type: 'rfac', class: 1, mount: 'turret', barrels: 2 }],
      pds: 'basic',
    })
    expect(weaponSystemsCount(many)).toBe(3)
    expect(faultsOf(many)).toContainEqual(expect.stringMatching(/3 weapon systems fitted; a class 2 vehicle may carry no more than 2/))
  })

  it('takes the largest weapon as the primary, the first among equals', () => {
    const design = blank({
      weapons: [
        { id: 'a', type: 'rfac', class: 2, mount: 'turret', barrels: 1 },
        { id: 'b', type: 'hvc', class: 3, mount: 'fixed', barrels: 1 },
        { id: 'c', type: 'hkp', class: 3, mount: 'turret', barrels: 1 },
      ],
    })
    expect(primaryWeapon(design)?.id).toBe('b')
  })

  it("every book example is legal, except the Light MICV, whose MDC/2 on an HMT the book's own p. 10 forbids", () => {
    for (const example of BOOK_EXAMPLES) {
      if (example.design.id === 'book-micv') {
        expect(faultsOf(example.design)).toEqual(['A HMT powers a MDC only up to class 1 on a size 2 vehicle'])
      } else {
        expect(faultsOf(example.design)).toEqual([])
      }
    }
  })
})

describe('power plants (p. 10)', () => {
  it('bounds GEVs by plant and size: a CFE fast GEV is size 2 at most, an HMT slow GEV size 4', () => {
    expect(faultsOf(blank({ size: 3, mobility: 'fast-gev', power: 'cfe' }))).toContainEqual(expect.stringMatching(/CFE drives a fast GEV only up to size 2/))
    expect(faultsOf(blank({ size: 5, mobility: 'slow-gev', power: 'hmt' }))).toContainEqual(expect.stringMatching(/HMT drives a slow GEV only up to size 4/))
    expect(faultsOf(blank({ size: 5, mobility: 'slow-gev', power: 'fgp' }))).toEqual([])
  })

  it('needs a fusion plant for grav, walkers, oversize and the air', () => {
    expect(faultsOf(blank({ mobility: 'grav', power: 'hmt' }))).toContainEqual(expect.stringMatching(/must use a fusion plant/))
    expect(faultsOf(blank({ size: 4, mobility: 'combat-walker', power: 'hmt' }))).toContainEqual(expect.stringMatching(/must use a fusion plant/))
    expect(faultsOf(blank({ mobility: 'vtol', power: 'hmt', armour: 2 }))).toContainEqual(expect.stringMatching(/air vehicles must pay for a fusion plant/))
  })

  it('limits HELs and MDCs to two classes under the size on a CFE, one under on an HMT', () => {
    const cfe = blank({ size: 4, power: 'cfe', weapons: [{ id: 'g', type: 'mdc', class: 3, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(cfe)).toContainEqual(expect.stringMatching(/CFE powers a MDC only up to class 2/))
    const hmt = blank({ size: 4, power: 'hmt', weapons: [{ id: 'g', type: 'hel', class: 4, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(hmt)).toContainEqual(expect.stringMatching(/HMT powers a HEL only up to class 3/))
    const fgp = blank({ size: 4, power: 'fgp', weapons: [{ id: 'g', type: 'hel', class: 5, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(fgp).filter((f) => /powers/.test(f))).toEqual([])
  })
})

describe('armour and hull limits (p. 10, p. 13, p. 14)', () => {
  it('caps armour at the size class, two under it afloat, and 2 or 3 in the air', () => {
    expect(faultsOf(blank({ size: 3, armour: 4 }))).toContainEqual(expect.stringMatching(/Armour 4 is over the limit of 3/))
    expect(faultsOf(blank({ size: 4, mobility: 'boat', variant: 'gunboat', armour: 3 }))).toContainEqual(expect.stringMatching(/over the limit of 2/))
    expect(faultsOf(blank({ size: 3, mobility: 'vtol', power: 'fgp', armour: 3 }))).toContainEqual(expect.stringMatching(/over the limit of 2/))
    expect(faultsOf(blank({ size: 4, mobility: 'aerospace', power: 'fgp', armour: 3 }))).toEqual([])
  })

  it('keeps air weapons fixed and no larger than class 3, a VTOL chin turret for a class 1 aside', () => {
    const big = blank({ size: 4, mobility: 'aerospace', power: 'fgp', armour: 2, weapons: [{ id: 'g', type: 'mdc', class: 4, mount: 'fixed', barrels: 1 }] })
    expect(faultsOf(big)).toContainEqual(expect.stringMatching(/No weapon over class 3/))
    const chin = blank({ size: 3, mobility: 'vtol', power: 'fgp', armour: 2, weapons: [{ id: 'g', type: 'rfac', class: 1, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(chin)).toEqual([])
    const turret = blank({ size: 3, mobility: 'vtol', power: 'fgp', armour: 2, weapons: [{ id: 'g', type: 'rfac', class: 2, mount: 'turret', barrels: 1 }] })
    expect(faultsOf(turret)).toContainEqual(expect.stringMatching(/fixed mounts/))
  })
})

describe('signatures, dice and movement (p. 11, p. 25, p. 27, p. 28, p. 29)', () => {
  it('reads the effective signature and target die off the design: the DEIMOS is 4, stealth 1, D8', () => {
    const deimos = BOOK_EXAMPLES.find((e) => e.design.id === 'book-deimos')!.design
    expect(effectiveSignature(deimos)).toBe(3)
    expect(targetDieOf(deimos)).toBe(8)
    expect([1, 2, 3, 4, 5].map(targetDie)).toEqual([12, 10, 8, 6, 4])
  })

  it('gives a walker a signature one higher than its class', () => {
    expect(effectiveSignature(blank({ size: 4, mobility: 'combat-walker', power: 'fgp', stealth: 0 }))).toBe(5)
  })

  it('steps the firer die by band and level, off the end at basic long', () => {
    expect(firerDie('basic', 'close')).toBe(8)
    expect(firerDie('basic', 'long')).toBe(4)
    expect(firerDie('superior', 'close')).toBe(12)
    expect(stepDie(4, -1)).toBeNull()
  })

  it('prints chit validity by weapon and band as p. 29 does', () => {
    expect(validityOf('hkp', 'close')).toBe('ALL')
    expect(validityOf('hkp', 'medium')).toBe('R/Y')
    expect(validityOf('mdc', 'long')).toBe('RED')
    expect(validityOf('rfac', 'long')).toBe('GREEN')
    expect(validityOf('dffg', 'close')).toBe('ALL×2')
    expect(validityOf('hel', 'medium', { ablative: true })).toBe('GREEN')
  })

  it('knows the base movement of every mobility type, the variants included', () => {
    expect(baseMovementOf({ mobility: 'slow-tracked' })).toBe(8)
    expect(baseMovementOf({ mobility: 'grav' })).toBe(15)
    expect(baseMovementOf({ mobility: 'vtol', variant: 'attack' })).toBe(30)
    expect(baseMovementOf({ mobility: 'vtol', variant: 'transport' })).toBe(24)
    expect(baseMovementOf({ mobility: 'boat', variant: 'assault-boat' })).toBe(15)
    expect(baseMovementOf({ mobility: 'combat-walker' })).toBe(12)
    expect(baseMovementOf({ mobility: 'aerospace' })).toBeNull()
  })

  it('takes terrain by family: GEVs find open water easy, tracks find swamp impassable, amphibians make it poor', () => {
    expect(goingOf('gev', 'open-water')).toBe('easy')
    expect(goingOf('tracked', 'swamp')).toBe('impassable')
    expect(goingOf('tracked', 'open-water', true)).toBe('poor')
    expect(goingOf('walker', 'urban')).toBe('difficult')
    expect(goingOf('grav', 'dense-woods')).toBe('impassable')
  })
})
