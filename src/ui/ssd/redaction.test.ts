import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import type { ShipDesign } from '../../engine/types'
import { Ssd } from '../Ssd'
import { hasSpinalMount } from './geometry'

/**
 * 12.1's sensor rules close an enemy's sheet: the hull, the tracks and the
 * numbers on the hull are known, the fit-out is not. Rendered to markup
 * rather than reasoned about, because two of the leaks the first review
 * found were in exactly the part of the component nobody had rendered.
 */
describe('a redacted sheet', () => {
  const spinal = SHIP_DESIGNS.find((d) => hasSpinalMount(d) && d.marineParties > 0)
  const design = (spinal ?? SHIP_DESIGNS[0]) as ShipDesign

  const open = renderToStaticMarkup(createElement(Ssd, { design }))
  const closed = renderToStaticMarkup(createElement(Ssd, { design, redacted: true }))

  it('draws the hull and nothing bolted to it', () => {
    expect(open).toContain('ssd-mount')
    expect(closed).not.toContain('ssd-mount')
    expect(closed).toContain('ssd-hull')
  })

  it('does not give away a spinal mount', () => {
    expect(spinal).toBeDefined()
    expect(open).toContain('ssd-spinal')
    expect(closed).not.toContain('ssd-spinal')
  })

  it('does not print the complement', () => {
    expect(open).toMatch(/MARINES ×/)
    expect(open).toMatch(/DCP ×/)
    expect(closed).not.toMatch(/MARINES ×/)
    expect(closed).not.toMatch(/DCP ×/)
    expect(closed).toContain('Fit-out not known')
  })

  it('still shows the damage track, which anyone can see', () => {
    expect(closed).toContain('ssd-tracks')
  })
})

describe('the open sheet', () => {
  it('names every mounting for assistive technology', () => {
    const design = SHIP_DESIGNS.find((d) => d.name === 'Heavy Cruiser') as ShipDesign
    const markup = renderToStaticMarkup(createElement(Ssd, { design }))
    for (const weapon of design.weapons) {
      expect(markup).toContain(`aria-label="${weapon.label}`)
    }
    expect(markup).toContain('role="group"')
  })

  it('counts damage control parties down as the crew dots are crossed off (10.5)', () => {
    const design = SHIP_DESIGNS.find((d) => d.name === 'Heavy Cruiser') as ShipDesign
    const fresh = renderToStaticMarkup(createElement(Ssd, { design }))
    const battered = renderToStaticMarkup(
      createElement(Ssd, {
        design,
        damage: { hullMarked: design.hullBoxes - 1, armourMarked: [], destroyed: new Set<string>() },
      }),
    )
    const dcp = (markup: string) => Number(/DCP ×(\d+)/.exec(markup)?.[1] ?? -1)
    expect(dcp(fresh)).toBeGreaterThan(dcp(battered))
    expect(dcp(battered)).toBeGreaterThanOrEqual(design.additionalDamageControlParties)
  })
})
