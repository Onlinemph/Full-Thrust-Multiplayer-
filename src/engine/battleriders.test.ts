import { describe, expect, it } from 'vitest'

import { validateBattleriderDesign, validateFleetFtl } from './ftl'
import { describeFault, validateDesign } from '../data/designPricing'
import { designById } from '../data/ships'
import { buildGame, type GameSetup } from '../data/savedGame'
import type { ShipDesign } from './types'

/**
 * Battleriders and the fleets they may be in (11.7, 11.8).
 *
 * `validateBattlerider` and `validateFleetFtl` were written and tested with no
 * caller: no design could say it was a rider, and no fleet was ever checked
 * against 11.8. The rider clause a shipyard can settle is now split out from
 * the one only a fleet can, which is the shape of the two rules.
 */

const rider = designById('durani-rider-lance') as ShipDesign
const mothership = designById('durani-mothership') as ShipDesign

function noteFor(setup: GameSetup, sideId: string): string {
  const game = buildGame(setup)
  return game.log
    .filter((entry) => entry.kind === 'note' && entry.side === sideId)
    .map((entry) => entry.text)
    .join(' | ')
}

describe('11.7 as a shipyard can check it', () => {
  it('passes the roster rider', () => {
    expect(validateBattleriderDesign(rider)).toEqual([])
    expect(validateDesign(rider).filter((f) => f.kind === 'bad-battlerider')).toEqual([])
  })

  it('refuses a rider over 60 mass', () => {
    const faults = validateDesign({ ...rider, mass: 80, battlerider: true })
    const problem = faults.find((fault) => fault.kind === 'bad-battlerider')
    expect(problem && describeFault(problem)).toContain('60 mass at most')
  })

  it('refuses a rider that bought a drive', () => {
    const faults = validateDesign({ ...rider, ftl: 'standard' })
    const problem = faults.find((fault) => fault.kind === 'bad-battlerider')
    expect(problem && describeFault(problem)).toContain('do not pay mass or points cost')
  })

  it('leaves the Mothership clause alone: that is not a fact about the hull', () => {
    // A rider on the drawing board has no fleet to be missing from.
    expect(validateBattleriderDesign({ id: rider.id, mass: rider.mass, ftl: 'none' })).toEqual([])
  })

  it('does not charge the rider for a drive it may not have', () => {
    // 11.7's whole trade: 10% of the hull that a cruiser spends on FTL is
    // spent on guns instead.
    expect(rider.ftl).toBe('none')
    const cruiser = designById('durani-corsair') as ShipDesign
    expect(cruiser.ftl).toBe('standard')
  })
})

describe('11.6 the Mothership pays as a tug', () => {
  it('carries an oversized drive rather than bays', () => {
    expect(mothership.ftl).toBe('tug')
    expect(mothership.ftlTransferMass).toBe(100)
  })

  it('has room for both riders', () => {
    expect(mothership.ftlTransferMass).toBeGreaterThanOrEqual(rider.mass * 2)
  })

  it('is priced for it', () => {
    expect(validateDesign(mothership).map(describeFault)).toEqual([])
  })
})

describe('11.8 as a fleet check', () => {
  it('passes a fleet of FTL hulls', () => {
    expect(validateFleetFtl([{ id: 'a', ftl: 'standard' }])).toEqual([])
  })

  it('keeps a non-FTL hull out of a one-off battle', () => {
    const problems = validateFleetFtl([{ id: 'monitor', ftl: 'none' }])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('unless the scenario permits it')
  })

  it('lets a rider in with its Mothership', () => {
    expect(
      validateFleetFtl([
        { id: 'ordu', ftl: 'tug' },
        { id: 'nokhor', ftl: 'none', battlerider: true, mothershipId: 'ordu' },
      ]),
    ).toEqual([])
  })

  it('keeps a rider out without one', () => {
    const problems = validateFleetFtl([
      { id: 'nokhor', ftl: 'none', battlerider: true, mothershipId: null },
    ])
    expect(problems[0]).toContain('FTL-capable Mothership')
  })

  it('takes the scenario\'s permission', () => {
    expect(validateFleetFtl([{ id: 'monitor', ftl: 'none' }], { allowNonFtl: true })).toEqual([])
  })
})

describe('11.8 when a battle starts', () => {
  const base: GameSetup = { scenarioId: 'line-of-battle', seed: 7 }

  it('says nothing about an all-FTL fleet', () => {
    const note = noteFor(
      { ...base, forces: { a: ['esu-battleship', 'esu-heavy-cruiser'] } },
      'a',
    )
    expect(note).not.toContain('11.8')
  })

  it('names the hulls 11.8 would exclude', () => {
    const note = noteFor(
      { ...base, forces: { a: ['esu-battleship', 'esu-corvette', 'esu-corvette'] } },
      'a',
    )
    expect(note).toContain('11.8')
    expect(note).toContain('2 hulls')
  })

  it('says nothing once the scenario permits them', () => {
    const note = noteFor(
      {
        ...base,
        allowNonFtl: true,
        forces: { a: ['esu-battleship', 'esu-corvette', 'esu-corvette'] },
      },
      'a',
    )
    expect(note).not.toContain('11.8')
  })

  it('passes riders that brought their Mothership', () => {
    const note = noteFor(
      { ...base, forces: { a: ['durani-mothership', 'durani-rider-lance', 'durani-rider-bow'] } },
      'a',
    )
    expect(note).not.toContain('11.8')
  })

  it('stops riders that did not', () => {
    const note = noteFor(
      { ...base, forces: { a: ['durani-flagship', 'durani-rider-lance'] } },
      'a',
    )
    expect(note).toContain('Mothership')
  })

  it('does not count a starbase: 11.8 is about what a fleet brings', () => {
    const note = noteFor(
      { ...base, forces: { a: ['esu-battleship', 'orbital-starbase'] } },
      'a',
    )
    expect(note).not.toContain('11.8')
  })
})
