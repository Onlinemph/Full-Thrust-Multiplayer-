import { describe, expect, it } from 'vitest'
import { BOOK_EXAMPLES } from './data/examples'
import { recordCardOf } from './recordCard'

/** The DEIMOS card printed on p. 55, line for line. */
describe('the record card (p. 55)', () => {
  it("fills the DEIMOS's card as the book does", () => {
    const deimos = BOOK_EXAMPLES.find((e) => e.design.id === 'book-deimos')!.design
    const card = recordCardOf(deimos)
    expect(card).toMatchObject({
      size: 4,
      basicSignature: 4,
      stealth: 1,
      effectiveSignature: 3,
      targetDie: 8,
      baseMove: 12,
      points: 356,
      fireControl: 'SUP',
      ecm: 'ENH',
      armourFront: 4,
      armourSide: 3,
    })
    const mdc = card.weapons[0]!
    expect(mdc.label).toBe('MDC/4')
    expect(mdc.mount).toBe('TU')
    expect(mdc.bands.map((b) => [b.upTo, b.die, b.valid])).toEqual([
      [30, 12, 'ALL'],
      [42, 10, 'R/Y'],
      [54, 8, 'RED'],
    ])
    expect(mdc.chits).toBe(4)
    expect(card.missiles[0]).toMatchObject({ label: 'GMS/H (ENH)', maxRange: 48, die: 8, valid: 'R/Y', chits: 5 })
    expect(card.pds).toEqual({ label: 'PDS (ENH)', die: 8 })
    expect(card.notes).toContain('APFC')
    expect(card.notes[0]).toMatch(/^1 APSW/)
  })

  it('gives a HEL one 60" band and a basic fire control its D8/D6/D4', () => {
    const laser = { ...BOOK_EXAMPLES[0]!.design, weapons: [{ id: 'l', type: 'hel' as const, class: 2 as const, mount: 'fixed' as const, barrels: 1 }], fireControl: 'basic' as const }
    const card = recordCardOf(laser)
    expect(card.weapons[0]!.bands).toEqual([{ band: 'close', upTo: 60, die: 8, valid: 'RED' }])
    expect(card.weapons[0]!.mount).toBe('FX')
    expect(card.weapons[0]!.againstInfantry).toBe('YELLOW')
  })
})
