import { describe, expect, it } from 'vitest'

import { designCost, embarkedPointsOf, fleetFromDesigns, summariseFleet } from './fleetList'
import { designById } from './ships'
import { cpvPoints } from '../engine/battles'

/**
 * 18.2's fleet list, built from designs.
 *
 * The thing this is really about is one sentence: *"no more than 50% of points
 * spent on capitals, including their fighters"*. A hull's printed price does
 * not include its wings — 13.12 prices the bay, 14.7 prices what goes in it —
 * so a carrier counted at its printed figure hides its air group on the wrong
 * side of the line.
 */

const carrier = () => designById('esu-carrier')!
const tender = () => designById('esu-tender')!
const frigate = () => designById('esu-frigate')!

describe('what a hull carries', () => {
  it('is counted with the hull, not left at zero', () => {
    expect(carrier().fighterBays.length).toBeGreaterThan(0)
    expect(embarkedPointsOf(carrier()), 'four bays of standard fighters at 18 a wing').toBe(
      carrier().fighterBays.length * 18,
    )
    expect(embarkedPointsOf(frigate()), 'a frigate carries nothing').toBe(0)
  })

  it('counts gunboat squadrons too', () => {
    expect(tender().gunboats.length).toBeGreaterThan(0)
    expect(embarkedPointsOf(tender())).toBeGreaterThan(0)
  })

  it('makes a fleet total bigger than the sum of its printed prices', () => {
    const designs = [carrier(), frigate(), frigate()]
    const printed = designs.reduce((sum, d) => sum + d.points, 0)
    expect(summariseFleet(designs).total).toBe(printed + embarkedPointsOf(carrier()))
  })
})

describe('a fleet list', () => {
  it('gives each copy of a design its own id', () => {
    const list = fleetFromDesigns([frigate(), frigate(), carrier()])
    expect(new Set(list.map((s) => s.id)).size).toBe(3)
    expect(list.filter((s) => s.designId === frigate().id).length).toBe(2)
  })

  it('classes hulls by mass rather than by what they are called', () => {
    // 13.4 lets a navy classify by function; 18.2's proportions do not.
    const summary = summariseFleet([carrier(), frigate()])
    expect(summary.breakdown.points.capital).toBeGreaterThan(0)
    expect(summary.breakdown.points.escort).toBeGreaterThan(0)
  })

  it('refuses a capital in a patrol battle', () => {
    const patrol = summariseFleet([carrier(), frigate()], { format: 'patrol' })
    expect(patrol.report.legal).toBe(false)
    expect(patrol.report.violations.some((v) => v.detail.includes('patrol'))).toBe(true)

    const escorts = summariseFleet([frigate(), frigate()], { format: 'patrol' })
    expect(escorts.report.legal).toBe(true)
  })
})

describe('CPV (18.3)', () => {
  it('is a different currency, not a discount', () => {
    // The formula is mass²/100, so it makes small hulls dearer relative to
    // their printed price and big ones cheaper. Whichever way a given hull
    // moves, the two totals should not agree.
    const designs = [carrier(), frigate(), frigate()]
    const printed = summariseFleet(designs).total
    const cpv = summariseFleet(designs, { cpv: true }).total
    expect(cpv).not.toBe(printed)
  })

  it('prices one design the same way the fleet does', () => {
    const design = frigate()
    expect(designCost(design, false)).toBe(design.points + embarkedPointsOf(design))
    expect(designCost(design, true)).toBe(
      cpvPoints(design.points, design.mass) + embarkedPointsOf(design),
    )
  })
})
