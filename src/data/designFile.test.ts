import { beforeEach, describe, expect, it } from 'vitest'

import { designFileText, importDesign, isCounterArtUrl, parseDesignFile } from './designFile'
import { reloadShipyard, savedDesigns } from './shipyard'
import { SHIP_DESIGNS } from './ships'
import { priceDesign } from './designPricing'

/**
 * A design from outside is checked at the door: its shape, its price, and
 * whether it is legal at all. What passes is a hull this table can trust.
 */
const frigate = SHIP_DESIGNS.find((d) => d.id === 'esu-frigate')!

/** Vitest's node environment has no localStorage; the yard needs get/set only. */
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
  reloadShipyard()
})

describe('a design file', () => {

  it('round-trips a roster hull, repricing it from the tables', () => {
    const parsed = parseDesignFile(designFileText(frigate))
    expect(typeof parsed).not.toBe('string')
    if (typeof parsed === 'string') return
    expect(parsed.id).toBe(frigate.id)
    expect(parsed.points).toBe(priceDesign(frigate).points)
  })

  it('does not believe the price the file states', () => {
    const parsed = parseDesignFile(designFileText({ ...frigate, points: 1 }))
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(parsed.points).toBe(priceDesign(frigate).points)
  })

  it('refuses what is not a design, and says why', () => {
    expect(parseDesignFile('{')).toMatch(/invalid JSON/)
    expect(parseDesignFile('{"id":"x"}')).toMatch(/Not a ship design/)
  })

  it('refuses an illegal hull with the fault named', () => {
    const heavy = { ...frigate, mass: 10 }
    expect(parseDesignFile(designFileText(heavy))).toMatch(/Not a legal design/)
  })

  it('drops counter art the map must not load', () => {
    const bad = parseDesignFile(designFileText({ ...frigate, art: 'javascript:alert(1)' }))
    if (typeof bad === 'string') throw new Error(bad)
    expect(bad.art).toBeUndefined()
    const good = parseDesignFile(designFileText({ ...frigate, art: 'https://example.org/f.png' }))
    if (typeof good === 'string') throw new Error(good)
    expect(good.art).toBe('https://example.org/f.png')
  })

  it('keeps only the layout entries the sheet can draw', () => {
    const parsed = parseDesignFile(
      designFileText({
        ...frigate,
        layout: {
          ok: { x: 12, y: -30 },
          far: { x: 1e308, y: 0 },
          words: { x: 'a', y: 0 } as unknown as { x: number; y: number },
          half: { x: 3 } as unknown as { x: number; y: number },
        },
      }),
    )
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(parsed.layout).toEqual({ ok: { x: 12, y: -30 } })
    const none = parseDesignFile(designFileText({ ...frigate, layout: { far: { x: 1e308, y: 0 } } }))
    if (typeof none === 'string') throw new Error(none)
    expect(none.layout).toBeUndefined()
  })

  it('imports under a fresh id when the id is taken, and once only', () => {
    const first = importDesign({ ...frigate, name: 'Someone’s Frigate' })
    expect(first).toBe('esu-frigate-2')
    const again = importDesign({ ...frigate, name: 'Someone’s Frigate' })
    expect(again).toBe('esu-frigate-2')
    expect(savedDesigns()).toHaveLength(1)
    const other = importDesign({ ...frigate, name: 'Another Frigate' })
    expect(other).toBe('esu-frigate-3')
  })
})

describe('counter art', () => {
  it('is an https picture or a pasted image, nothing else', () => {
    expect(isCounterArtUrl('https://example.org/ship.png')).toBe(true)
    expect(isCounterArtUrl('data:image/png;base64,AAAA')).toBe(true)
    expect(isCounterArtUrl('http://example.org/ship.png')).toBe(false)
    expect(isCounterArtUrl('javascript:alert(1)')).toBe(false)
    expect(isCounterArtUrl('data:text/html;base64,AAAA')).toBe(false)
  })
})
