import { describe, expect, it } from 'vitest'
import { COMPASS_MAX_CLEARANCE, compassMargins, fitCompass } from './compassBounds'

describe('compassMargins (R6)', () => {
  it('never grows past a fixed bound, however large the clearance handed to it gets', () => {
    const capped = compassMargins(COMPASS_MAX_CLEARANCE, 0)
    // Zoomed in far enough to balloon `clearance` past 1000px (the review's
    // own measured worst case) — the margins must not follow it up.
    const extreme = compassMargins(100000, 0)
    expect(extreme).toEqual(capped)
  })

  it('grows with clearance up to the cap, not before it', () => {
    const small = compassMargins(0, 0)
    const bigger = compassMargins(COMPASS_MAX_CLEARANCE / 2, 0)
    expect(bigger.side).toBeGreaterThan(small.side)
    expect(bigger.bottom).toBeGreaterThan(small.bottom)
  })

  it('never asks for a top margin thinner than the HUD needs, even at zero clearance', () => {
    expect(compassMargins(0, 200).top).toBeGreaterThanOrEqual(200)
  })
})

describe('fitCompass (R6)', () => {
  it('returns null — never a partial fit — when the canvas is too small for even the minimum footprint', () => {
    expect(fitCompass({ x: 50, y: 50, clearance: 10 }, 120, 120, 40)).toBeNull()
  })

  it('clamps a point near an edge fully inside the safe area rather than letting it spill off (the left-edge repro)', () => {
    const width = 1500
    const height = 1000
    const fitted = fitCompass({ x: -30, y: 500, clearance: 20 }, width, height, 40)
    expect(fitted).not.toBeNull()
    const margins = compassMargins(20, 40)
    expect(fitted!.x).toBeGreaterThanOrEqual(margins.side)
    expect(fitted!.x).toBeLessThanOrEqual(width - margins.side)
  })

  it('clamps below the HUD rather than under it (the header-overlap repro)', () => {
    const width = 1500
    const height = 1000
    const hudClearance = 173
    const fitted = fitCompass({ x: 700, y: 20, clearance: 15 }, width, height, hudClearance)
    expect(fitted).not.toBeNull()
    expect(fitted!.y).toBeGreaterThanOrEqual(hudClearance)
  })

  it('caps the clearance it hands back, even when a huge one is passed in (the extreme-zoom repro)', () => {
    const fitted = fitCompass({ x: 700, y: 500, clearance: 5000 }, 1500, 1000, 40)
    expect(fitted).not.toBeNull()
    expect(fitted!.clearance).toBe(COMPASS_MAX_CLEARANCE)
  })

  it('leaves a comfortably centred point untouched but for the clearance cap', () => {
    const fitted = fitCompass({ x: 750, y: 500, clearance: 10 }, 1500, 1000, 40)
    expect(fitted).toEqual({ x: 750, y: 500, clearance: 10 })
  })
})
