import { describe, expect, it } from 'vitest'

import {
  describeLoads,
  feedLauncher,
  magazineFor,
  magazineIcon,
  newMagazine,
  unfeedLauncher,
  withLoadAdded,
  withLoadDropped,
} from './magazines'
import { checkMagazine, MAGAZINE_POINTS_PER_MASS } from '../engine/ordnance'
import { validateDesign } from './designPricing'
import { SHIP_DESIGNS } from './ships'
import type { ShipDesign } from '../engine/types'

/**
 * Feeding is a move (6.6): one launcher, one magazine. And a magazine is its
 * loads, priced at three a mass.
 */
const corsair = SHIP_DESIGNS.find((d) => d.id === 'durani-corsair')!

function twoTubes(): ShipDesign {
  const tube = corsair.weapons.find((w) => w.weaponClass === 'salvo-missile-launcher')!
  return {
    ...corsair,
    weapons: [
      ...corsair.weapons.filter((w) => w.weaponClass !== 'salvo-missile-launcher'),
      { ...tube, id: 'sml-a' },
      { ...tube, id: 'sml-b' },
    ],
    magazines: [],
  }
}

describe('feeding launchers (6.6)', () => {
  it('a new magazine feeds every launcher nothing feeds yet, and no more than that', () => {
    const design = twoTubes()
    const first = newMagazine(design)
    expect(first.id).toBe('m1')
    expect(first.launcherIds).toEqual(['sml-a', 'sml-b'])
    const withFirst = { ...design, magazines: [first] }
    const second = newMagazine(withFirst)
    expect(second.id).toBe('m2')
    expect(second.launcherIds).toEqual([])
  })

  it('moves a launcher between magazines rather than sharing it', () => {
    const design = twoTubes()
    const m1 = newMagazine(design)
    const withM1 = { ...design, magazines: [m1] }
    const m2 = newMagazine(withM1)
    let current: ShipDesign = { ...withM1, magazines: [m1, m2] }
    current = { ...current, ...feedLauncher(current, 'm2', 'sml-b') }
    expect(magazineFor(current, 'sml-b')?.id).toBe('m2')
    expect(magazineFor(current, 'sml-a')?.id).toBe('m1')
    expect(current.magazines?.every((m) => m.launcherIds.filter((id) => id === 'sml-b').length <= 1)).toBe(true)
    current = { ...current, ...unfeedLauncher(current, 'sml-a') }
    expect(magazineFor(current, 'sml-a')).toBeUndefined()
    expect(validateDesign(current).some((f) => f.kind === 'launcher-unfed')).toBe(true)
  })

  it('prices the magazine as its loads, and drops the last one first', () => {
    const design = { ...twoTubes(), magazines: [newMagazine(twoTubes())] }
    let current: ShipDesign = design
    current = { ...current, ...withLoadAdded(current, 'm1', { grade: 'standard' }) }
    current = { ...current, ...withLoadAdded(current, 'm1', { grade: 'extended' }) }
    current = { ...current, ...withLoadAdded(current, 'm1', { grade: 'standard', multiStage: true }) }
    const m = current.magazines![0]!
    expect(m.mass).toBe(2 + 3 + 4)
    expect(m.points).toBe(m.mass * MAGAZINE_POINTS_PER_MASS)
    expect(checkMagazine(m.mass, m.loads).faults).toEqual(['mixed-stages'])
    expect(describeLoads(m.loads)).toBe('1 standard, 1 ER, 1 multi-stage')
    expect(magazineIcon(m.loads)).toBe('salvo-missile-magazine-multistage')
    current = { ...current, ...withLoadDropped(current, 'm1') }
    expect(current.magazines![0]!.loads).toHaveLength(2)
    expect(magazineIcon(current.magazines![0]!.loads)).toBe('salvo-missile-magazine')
    expect(magazineIcon([{ grade: 'extended' }])).toBe('salvo-missile-magazine-long-range')
  })
})
