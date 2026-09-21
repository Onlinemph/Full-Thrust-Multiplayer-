import { describe, expect, it } from 'vitest'

import { SSD_SPRITE } from './sprite.generated'

/**
 * The sheet's numbers, and how they are hidden.
 *
 * A symbol drawn with <use> is cloned into a shadow tree the document's
 * selectors cannot reach, so a digit inside one can only be hidden by
 * something that inherits: a custom property the glyph sets when it draws
 * the ship's own number over the sheet's. Without it a Beam-5 wore the
 * sheet's 4 under its 5.
 */
describe('the symbol sheet', () => {
  it('hides a classed weapon\'s printed digit through an inherited variable', () => {
    const digits = SSD_SPRITE.match(/<text[^>]*class="ssd-digit"[^>]*>/g) ?? []
    expect(digits.length).toBeGreaterThan(20)
    for (const digit of digits) expect(digit).toContain('display:var(--ssd-digit,inline)')
  })

  it('never shows a variable symbol\'s sample number', () => {
    const samples = SSD_SPRITE.match(/<text[^>]*class="ssd-sample"[^>]*>/g) ?? []
    expect(samples.length).toBeGreaterThan(0)
    for (const sample of samples) expect(sample).toContain('display:none')
  })
})
