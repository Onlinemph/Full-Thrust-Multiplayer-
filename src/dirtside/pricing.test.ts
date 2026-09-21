/**
 * The points value system (pp. 52–53), checked against the book's own
 * arithmetic: the worked hull on p. 52 and the eight complete vehicles on
 * p. 53, then the three unit totals the same page adds up.
 */

import { describe, expect, it } from 'vitest'
import { BOOK_EXAMPLES } from './data/examples'
import { newVehicleDesign } from './design'
import { ordnanceLoadsCost, priceDesign, priceInfantry, roundPoints } from './pricing'
import { ARTILLERY_AMMO_PER_GUN, SMOKE_AMMO_PER_GUN } from './data/costs'

describe('the worked hull on p. 52', () => {
  it('costs a medium, armour 3, HMT, fast tracked hull 44 points, rounding each line', () => {
    const hull = { ...newVehicleDesign('hull'), size: 3 as const, armour: 3, power: 'hmt' as const, mobility: 'fast-tracked' as const }
    const cost = priceDesign(hull)
    expect(cost.vsp).toBe(15)
    expect(cost.lines.find((l) => l.label.startsWith('Armour'))?.points).toBe(9)
    expect(cost.bvp).toBe(24)
    // "40% of the BVP is 9.6 (rounded to 10)" for the plant, and again for the mobility.
    expect(cost.lines.find((l) => l.label.includes('HMT'))?.points).toBe(10)
    expect(cost.lines.find((l) => l.label.includes('mobility'))?.points).toBe(10)
    expect(cost.total).toBe(44)
  })

  it('rounds halves up and leaves whole numbers alone', () => {
    expect(roundPoints(9.6)).toBe(10)
    expect(roundPoints(8.4)).toBe(8)
    expect(roundPoints(13.5)).toBe(14)
    expect(roundPoints(21.6)).toBe(22)
  })
})

describe('the eight vehicles on p. 53', () => {
  for (const example of BOOK_EXAMPLES) {
    it(`prices the ${example.design.name} at ${example.points} (${example.page})`, () => {
      expect(priceDesign(example.design).total).toBe(example.points)
    })
  }

  it("shows the DEIMOS's working as p. 16 and p. 52 give it", () => {
    const deimos = BOOK_EXAMPLES.find((e) => e.design.id === 'book-deimos')!.design
    const cost = priceDesign(deimos)
    const points = Object.fromEntries(cost.lines.map((l) => [l.label, l.points]))
    expect(points['Vehicle size points, class 4']).toBe(20)
    expect(points['Armour 4']).toBe(16)
    expect(cost.bvp).toBe(36)
    expect(points['FGP power plant']).toBe(22)
    expect(points['Slow GEV mobility']).toBe(14)
    expect(points['MDC/4']).toBe(40)
    expect(points['superior fire control']).toBe(24)
    expect(points['GMS/H (ENH)']).toBe(45)
    expect(points['enhanced PDS']).toBe(45)
    expect(points['enhanced ECM']).toBe(30)
    expect(points['APFC belt']).toBe(20)
    expect(points['Stealth ×1']).toBe(80)
    expect(cost.total).toBe(356)
  })

  it('prices backup systems as 30% of fire control, ECM, stealth and guidance only', () => {
    const ads = BOOK_EXAMPLES.find((e) => e.design.id === 'book-ads')!.design
    const cost = priceDesign(ads)
    // Superior ECM 45 is the only system aboard: 30% of 45 is 13.5, rounded to 14.
    expect(cost.lines.find((l) => l.label === 'Backup systems')?.points).toBe(14)
  })
})

describe('the units on p. 53', () => {
  const design = (id: string) => BOOK_EXAMPLES.find((e) => e.design.id === id)!.design

  it('adds a heavy armour troop of four hover tanks to 1424', () => {
    expect(4 * priceDesign(design('book-deimos')).total).toBe(1424)
  })

  it('adds a mechanised infantry platoon to 480: 280 for the APCs and 200 for the troops', () => {
    const apcs = 4 * priceDesign(design('book-wheeled-apc')).total
    const rifles = 6 * priceInfantry({ troops: 'line', team: 'rifle' })
    const apsw = priceInfantry({ troops: 'line', team: 'apsw' })
    const gms = priceInfantry({ troops: 'line', team: 'anti-armour', guidance: 'enhanced' })
    expect(apcs).toBe(280)
    expect(rifles + apsw + gms).toBe(200)
    expect(apcs + rifles + apsw + gms).toBe(480)
  })

  it('adds a medium artillery battery to 1020, plus 210 for a HEF, a MAK and a smoke marker', () => {
    const guns = 3 * priceDesign(design('book-sp-artillery')).total
    const ads = priceDesign(design('book-ads')).total
    expect(guns + ads).toBe(1020)
    const ammo = 3 * ARTILLERY_AMMO_PER_GUN.medium * 2 + 3 * SMOKE_AMMO_PER_GUN
    expect(ammo).toBe(210)
  })

  it('prices infantry by troops and specialism, cavalry half again', () => {
    expect(priceInfantry({ troops: 'militia', team: 'rifle' })).toBe(15)
    expect(priceInfantry({ troops: 'powered', team: 'assault' })).toBe(40)
    expect(priceInfantry({ troops: 'line', team: 'engineer' })).toBe(70)
    expect(priceInfantry({ troops: 'line', team: 'air-defence' })).toBe(95)
    expect(priceInfantry({ troops: 'line', team: 'observer' })).toBe(70)
    expect(priceInfantry({ troops: 'line', team: 'rifle', cavalry: true })).toBe(30)
    expect(ordnanceLoadsCost(3)).toBe(90)
  })
})
