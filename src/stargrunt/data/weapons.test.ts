/**
 * The generic weapons table, armour, mobility and the two quality-driven
 * derivations (range bands and the firepower-value die), each against the
 * book's own printed numbers and worked examples.
 */

import { describe, expect, it } from 'vitest'
import {
  ARMOUR_DIE,
  MOBILITY,
  RANGE_BAND_INCHES,
  SMALL_ARMS,
  SUPPORT_WEAPONS,
  encumberedBase,
  fireValueToDie,
  squadFirepowerDie,
} from './weapons'

describe('the generic weapons table (p. 34)', () => {
  it('gives every small arm its printed firepower and impact', () => {
    expect(SMALL_ARMS.improvised).toMatchObject({ firepower: 0.5, impact: 4, closeOnly: true })
    expect(SMALL_ARMS['heavy-autopistol']).toMatchObject({ firepower: 1, impact: 10, closeOnly: true })
    expect(SMALL_ARMS.smg).toMatchObject({ firepower: 3, impact: 8, closeOnly: true })
    expect(SMALL_ARMS['hunting-rifle']).toMatchObject({ firepower: 1, impact: 10, closeOnly: false })
    expect(SMALL_ARMS['advanced-rifle']).toMatchObject({ firepower: 2, impact: 10, closeOnly: false })
    expect(SMALL_ARMS['advanced-rifle-gl']).toMatchObject({ firepower: 3, impact: 10, closeOnly: false })
    expect(SMALL_ARMS['gauss-rifle']).toMatchObject({ firepower: 2, impact: 12, closeOnly: false })
    expect(SMALL_ARMS['gauss-rifle-gl']).toMatchObject({ firepower: 3, impact: 12, closeOnly: false })
  })

  it('gives every support weapon its printed firepower die and impact, starred ones doubled on a major point-target hit', () => {
    expect(SUPPORT_WEAPONS.saw).toMatchObject({ firepowerDie: 8, impact: 10, doubleVsPoint: false })
    expect(SUPPORT_WEAPONS['rotary-saw']).toMatchObject({ firepowerDie: 10, impact: 10, doubleVsPoint: false })
    expect(SUPPORT_WEAPONS['gauss-saw']).toMatchObject({ firepowerDie: 10, impact: 12, doubleVsPoint: false })
    expect(SUPPORT_WEAPONS['plasma-gun']).toMatchObject({ firepowerDie: 6, impact: 12, doubleVsPoint: true })
    expect(SUPPORT_WEAPONS.agl).toMatchObject({ firepowerDie: 12, impact: 8, doubleVsPoint: true })
    expect(SUPPORT_WEAPONS.mlp).toMatchObject({ firepowerDie: 8, impact: 8, doubleVsPoint: true })
    expect(SUPPORT_WEAPONS.iavr).toMatchObject({ firepowerDie: 10, impact: 12, doubleVsPoint: true })
  })
})

describe('personal armour (p. 28)', () => {
  it('runs battledress D4 up to heavy power armour D12', () => {
    expect(ARMOUR_DIE.battledress).toBe(4)
    expect(ARMOUR_DIE['partial-light']).toBe(6)
    expect(ARMOUR_DIE['full-light']).toBe(8)
    expect(ARMOUR_DIE['light-power']).toBe(10)
    expect(ARMOUR_DIE['heavy-power']).toBe(12)
  })
})

describe('mobility (p. 22)', () => {
  it('gives each kind its base mobility, which is also its combat-move die', () => {
    expect(MOBILITY.foot.baseInches).toBe(6)
    expect(MOBILITY['very-light'].baseInches).toBe(8)
    expect(MOBILITY['slow-power'].baseInches).toBe(6)
    expect(MOBILITY['fast-power'].baseInches).toBe(12)
  })

  it('shifts one step down when encumbered (p. 22): normal troops move 4" instead of 6"', () => {
    expect(encumberedBase(MOBILITY.foot.baseInches)).toBe(4)
    expect(encumberedBase(MOBILITY['very-light'].baseInches)).toBe(6)
    expect(encumberedBase(MOBILITY['fast-power'].baseInches)).toBe(10)
  })

  it('floors at D4 rather than stacking two encumbrance triggers into a lower die [reading, spec 02 §2.6]', () => {
    expect(encumberedBase(encumberedBase(MOBILITY.foot.baseInches))).toBe(4)
  })
})

describe('range bands (p. 33)', () => {
  it('gives each quality its range band, the same number as its die', () => {
    expect(RANGE_BAND_INCHES.untrained).toBe(4)
    expect(RANGE_BAND_INCHES.green).toBe(6)
    expect(RANGE_BAND_INCHES.regular).toBe(8)
    expect(RANGE_BAND_INCHES.veteran).toBe(10)
    expect(RANGE_BAND_INCHES.elite).toBe(12)
  })
})

describe('firepower-value → firepower die (p. 34, book’s own worked examples)', () => {
  it('rounds a fire value up to the nearest die type', () => {
    expect(fireValueToDie(7)).toBe(8) // 7 men x FP1 = 7 -> D8
    expect(fireValueToDie(10)).toBe(10) // 5 men x FP2 = 10 -> D10, an exact match
    expect(fireValueToDie(4)).toBe(4) // 4 or less -> D4
    expect(fireValueToDie(3)).toBe(4)
    expect(fireValueToDie(13)).toBe(12) // over 12 -> D12, no further bonus
    expect(fireValueToDie(30)).toBe(12)
  })

  it('multiplies per-trooper firepower by the number actually firing this action', () => {
    expect(squadFirepowerDie(1, 7)).toBe(8)
    expect(squadFirepowerDie(2, 5)).toBe(10)
    expect(squadFirepowerDie(3, 0)).toBe(4) // nobody firing this action: zero fire value floors at D4
  })
})
