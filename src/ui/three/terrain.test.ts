import { describe, expect, it } from 'vitest'
import { flaredThisTurn, hashId, rockCountFor, terrainLabelText } from './terrain'

describe('hashId', () => {
  it('is deterministic for the same id', () => {
    expect(hashId('asteroid-3')).toBe(hashId('asteroid-3'))
  })

  it('tells different ids apart', () => {
    expect(hashId('asteroid-3')).not.toBe(hashId('asteroid-4'))
  })
})

describe('rockCountFor', () => {
  it('scales up with area at the same factor', () => {
    const small = rockCountFor(2, 1)
    const large = rockCountFor(6, 1)
    expect(large).toBeGreaterThan(small)
  })

  it('scales up with the density factor at the same radius', () => {
    const sparse = rockCountFor(4, 0.5)
    const dense = rockCountFor(4, 1.5)
    expect(dense).toBeGreaterThan(sparse)
  })

  it('never drops below the floor or above the cap, however small or huge the field', () => {
    expect(rockCountFor(0.1, 0.5)).toBeGreaterThanOrEqual(12)
    expect(rockCountFor(200, 2)).toBeLessThanOrEqual(220)
  })
})

describe('terrainLabelText', () => {
  it('uses the scenario-given label when there is one', () => {
    expect(terrainLabelText({ kind: 'planet', label: 'Colony world' })).toBe('Colony world')
  })

  it('falls back to a readable kind name otherwise', () => {
    expect(terrainLabelText({ kind: 'asteroid-field' })).toBe('asteroid field')
    expect(terrainLabelText({ kind: 'dust-cloud' })).toBe('dust cloud')
  })
})

describe('flaredThisTurn', () => {
  it('is true only when this turn’s log carries that star’s own flare line', () => {
    const game = { turn: 3, log: [{ turn: 3, text: 'Sol flares (17.3)' }] }
    expect(flaredThisTurn(game, { label: 'Sol' })).toBe(true)
  })

  it('is false for a different turn', () => {
    const game = { turn: 4, log: [{ turn: 3, text: 'Sol flares (17.3)' }] }
    expect(flaredThisTurn(game, { label: 'Sol' })).toBe(false)
  })

  it('is false when nothing flared', () => {
    const game = { turn: 3, log: [] }
    expect(flaredThisTurn(game, { label: 'Sol' })).toBe(false)
  })

  it('falls back to "The star" when the feature has no label, matching rollSolarFlares', () => {
    const game = { turn: 1, log: [{ turn: 1, text: 'The star flares (17.3)' }] }
    expect(flaredThisTurn(game, {})).toBe(true)
  })
})
