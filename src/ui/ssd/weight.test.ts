import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import type { Arc, ShipDesign, WeaponDef } from '../../engine/types'
import { counterSilhouette, planShip } from './layout'
import { weaponWeight } from './weight'

/**
 * A Beam-4 is bigger than a Beam-1, on the sheet and on the counter, and a
 * mixed battery is laid out big gun in the middle. Size is not a rule, but a
 * sheet on which every gun is the same size makes the player read the digit
 * in every one of them, which is the thing the drawing was meant to spare.
 */
const heavyCruiser = SHIP_DESIGNS.find((d) => d.name === 'Heavy Cruiser') as ShipDesign

function beam(id: string, rating: number, arcs: Arc[] = ['F', 'FP', 'FS']): WeaponDef {
  return { ...heavyCruiser.weapons[0], id, weaponClass: 'beam', rating, arcs, label: `Beam-${rating}` }
}

describe('a gun draws as big as it is', () => {
  it('sizes a classed mount by its class, a spinal mount above all of them', () => {
    expect(weaponWeight(beam('a', 1))).toBeLessThan(weaponWeight(beam('b', 2)))
    expect(weaponWeight(beam('b', 2))).toBeLessThan(weaponWeight(beam('c', 3)))
    expect(weaponWeight(beam('c', 3))).toBeLessThan(weaponWeight(beam('d', 4)))
    expect(weaponWeight(beam('c', 3))).toBe(1)
    const spinal = { ...beam('s', 2), weaponClass: 'spinal-beam' as const, mass: 16 }
    expect(weaponWeight(spinal)).toBeGreaterThan(weaponWeight(beam('e', 6)))
  })

  it('draws the sheet symbol at that size', () => {
    const design = { ...heavyCruiser, weapons: [beam('one', 1), beam('four', 4)] }
    const plan = planShip(design)
    const one = plan.glyphs.find((g) => g.key === 'one')
    const four = plan.glyphs.find((g) => g.key === 'four')
    expect(four?.width).toBeGreaterThan(one?.width ?? 0)
    // Level with each other, and their rosettes on one line.
    expect(one?.y).toBe(four?.y)
    expect(one?.rose?.y).toBe(four?.rose?.y)
  })

  it('puts the big gun in the middle of a triple and pairs the small ones either side', () => {
    const design = { ...heavyCruiser, weapons: [beam('s1', 1), beam('big', 4), beam('s2', 1)] }
    const plan = planShip(design)
    const at = (id: string) => plan.glyphs.find((g) => g.key === id)!
    expect(at('big').x).toBe(0)
    expect(at('s1').x).toBe(-at('s2').x)
  })

  it('mirrors a broadside pair whichever order the guns were listed in', () => {
    const port = beam('p', 2, ['A', 'AP', 'FP'])
    const stbd = beam('s', 2, ['A', 'AS', 'FS'])
    const portBig = beam('pb', 4, ['A', 'AP', 'FP'])
    const stbdBig = beam('sb', 4, ['A', 'AS', 'FS'])
    const plan = planShip({ ...heavyCruiser, weapons: [port, stbdBig, portBig, stbd] })
    const at = (id: string) => plan.glyphs.find((g) => g.key === id)!
    expect(at('pb').y).toBe(at('sb').y)
    expect(at('p').y).toBe(at('s').y)
    expect(at('pb').y).toBeLessThan(at('p').y)
    expect(at('pb').x).toBe(-at('sb').x)
  })

  it('carries the weight to the counter', () => {
    const design = { ...heavyCruiser, weapons: [beam('one', 1), beam('four', 4)] }
    const { guns, bars } = counterSilhouette(design)
    const weights = guns.map((g) => g.weight)
    expect(Math.max(...weights)).toBeGreaterThan(Math.min(...weights))
    expect(bars.every((bar) => bar.weight > 0)).toBe(true)
  })
})
