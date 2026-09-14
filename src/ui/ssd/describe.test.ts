import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import { CORE_SYSTEM_IDS } from '../../engine/threshold'
import type { ShipDesign } from '../../engine/types'
import { describeCoreCell, describeGlyph } from './describe'
import { planShip } from './layout'

/**
 * Every symbol on every sheet has to explain itself: a hover that says nothing
 * is worse than no hover, because the player has just been told the sheet
 * does not know what it drew.
 */
const heavyCruiser = SHIP_DESIGNS.find((d) => d.name === 'Heavy Cruiser') as ShipDesign

describe('what a symbol says when it is hovered', () => {
  it('explains every symbol on every roster sheet, with a rule and a section', () => {
    const unexplained: string[] = []
    for (const design of SHIP_DESIGNS) {
      for (const glyph of planShip(design).glyphs) {
        const info = describeGlyph(design, glyph)
        if (info === null) {
          unexplained.push(`${design.name}: ${glyph.label}`)
          continue
        }
        if (!/^\d+\.\d+$/.test(info.section)) unexplained.push(`${design.name}: ${glyph.label} §${info.section}`)
        if (info.rule.length < 20) unexplained.push(`${design.name}: ${glyph.label} has no rule`)
      }
    }
    expect(unexplained).toEqual([])
  })

  it('reads a beam battery’s dice off the beam table (4.5, 5.3)', () => {
    const beam = { ...heavyCruiser.weapons[0], id: 'b3', weaponClass: 'beam' as const, rating: 3 }
    const design = { ...heavyCruiser, weapons: [beam] }
    const glyph = planShip(design).glyphs.find((g) => g.key === 'b3')
    const info = describeGlyph(design, glyph!)
    expect(info?.section).toBe('5.3')
    expect(info?.facts).toContain('Range 36 MU')
    expect(info?.facts).toContain('Dice 3 to 12, 2 to 24, 1 to 36 MU')
    expect(info?.facts.some((fact) => fact.startsWith('Arcs '))).toBe(true)
  })

  it('says what has happened to a mount this battle', () => {
    const plan = planShip(heavyCruiser, {
      destroyed: new Set([heavyCruiser.weapons[0].id]),
      fired: new Set([heavyCruiser.weapons[1]?.id ?? '']),
    })
    const dead = plan.glyphs.find((g) => g.key === heavyCruiser.weapons[0].id)
    expect(describeGlyph(heavyCruiser, dead!)?.state).toBe('Knocked out')
  })

  it('names each of the three core systems on its own (10.3)', () => {
    expect(describeCoreCell(CORE_SYSTEM_IDS.bridge)?.title).toBe('Bridge')
    expect(describeCoreCell(CORE_SYSTEM_IDS.lifeSupport)?.rule).toMatch(/crew/)
    expect(describeCoreCell(CORE_SYSTEM_IDS.powerCore)?.rule).toMatch(/5 or 6/)
  })
})
