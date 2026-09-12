import { describe, expect, it } from 'vitest'

import {
  clanOf,
  factionById,
  factionTraitCoverage,
  traitsFor,
  FACTIONS,
  PROJECTILE_CLASSES,
  SPINAL_CLASSES,
} from './factions'
import { describeFault, validateDesign } from './designPricing'
import { allDesigns, designById } from './ships'
import type { ShipDesign } from '../engine/types'

/**
 * The campaign supplement's fourteen factions.
 *
 * `docs/rules/factions.md` says outright that `src/data/factions.ts` types the
 * traits and that `designPricing.validateDesign()` enforces the ones a shipyard
 * can check. Until now neither existed: the file was named by the documentation
 * and by nothing else, and `GameSetup.factions` was declared and read by no one.
 */

function hull(over: Partial<ShipDesign> = {}): ShipDesign {
  return {
    ...(designById('esu-frigate') as ShipDesign),
    ...over,
  }
}

describe('the supplement', () => {
  it('has all fourteen, and only the Askvarians have clans', () => {
    expect(FACTIONS.length).toBe(14)
    expect(FACTIONS.filter((f) => f.clans).map((f) => f.id)).toEqual(['askvarian'])
    expect(factionById('askvarian')?.clans?.length).toBe(4)
    expect(clanOf(factionById('askvarian')!, 'krusual')?.name).toBe('Krusual')
  })

  it('gives every faction a doctrine, a summary and at least one trait', () => {
    for (const faction of FACTIONS) {
      expect(faction.doctrine, faction.id).toBeTruthy()
      expect(faction.summary, faction.id).toBeTruthy()
      expect(faction.traits.length, faction.id).toBeGreaterThan(0)
    }
  })

  it('adds a clan trait to the faction trait, rather than replacing it', () => {
    const plain = traitsFor('askvarian')
    const krusual = traitsFor('askvarian', 'krusual')
    expect(krusual.length).toBeGreaterThan(plain.length)
    expect(krusual.slice(0, plain.length)).toEqual(plain)
  })

  it('is honest about how much of itself is in force', () => {
    // The count is the point: a faction whose traits are typed and read by
    // nothing plays exactly like plain Continuum, and saying so is better than
    // implying the rules are live.
    const coverage = factionTraitCoverage()
    expect(coverage.total).toBeGreaterThan(50)
    expect(coverage.byKind.prohibition.implemented).toBe(coverage.byKind.prohibition.total)
    expect(coverage.byKind.tactical.implemented, 'not one tactical trait is wired yet').toBe(0)
  })
})

describe('the roster', () => {
  it('builds every faction ship its own faction could actually build', () => {
    // The fleets in the roster are named for factions in this file, so they
    // are the first thing the prohibitions get tried against. A design that
    // fails here is a design nobody in that navy could have ordered.
    const byName = new Map(FACTIONS.map((faction) => [faction.name, faction.id]))
    let checked = 0
    for (const design of allDesigns()) {
      const factionId = byName.get(design.faction)
      if (!factionId) continue
      checked += 1
      const faults = validateDesign(design, { factionId }).filter(
        (fault) => fault.kind === 'faction-prohibition' || fault.kind === 'faction-design',
      )
      expect(faults.map(describeFault), design.id).toEqual([])
    }
    expect(checked, 'no faction fleet in the roster to check').toBeGreaterThan(0)
  })
})

describe('what a shipyard can check', () => {
  it('bars a weapon the faction does not build', () => {
    // The Krusual mount no beams at all, and the ESU frigate is mostly beams.
    const faults = validateDesign(hull(), { factionId: 'askvarian', clanId: 'krusual' })
    expect(faults.some((f) => f.kind === 'faction-prohibition')).toBe(true)
    // …and the same hull is fine for an Askvarian of another clan.
    expect(
      validateDesign(hull(), { factionId: 'askvarian', clanId: 'sebiestor' }).some(
        (f) => f.kind === 'faction-prohibition',
      ),
    ).toBe(false)
  })

  it('bars every physical projectile for the Cygnans', () => {
    const gunned = hull({
      weapons: [
        {
          id: 'k1',
          label: 'K-Gun-2',
          weaponClass: 'k-gun',
          rating: 2,
          variant: 'standard',
          arcs: ['F'],
          mass: 4,
          points: 12,
        },
      ],
    })
    const faults = validateDesign(gunned, { factionId: 'cygnan' })
    expect(faults.some((f) => f.kind === 'faction-prohibition')).toBe(true)
    expect(PROJECTILE_CLASSES).toContain('k-gun')
  })

  it('bars a class-3 weapon for the Tyrants but not a class-2', () => {
    const heavy = hull({
      weapons: [
        {
          id: 'b3',
          label: 'Beam-3',
          weaponClass: 'beam',
          rating: 3,
          variant: 'standard',
          arcs: ['F'],
          mass: 4,
          points: 12,
        },
      ],
    })
    expect(
      validateDesign(heavy, { factionId: 'tyrant' }).some((f) => f.kind === 'faction-prohibition'),
    ).toBe(true)

    const light = hull({
      weapons: [{ ...heavy.weapons[0], rating: 2, label: 'Beam-2' }],
    })
    expect(
      validateDesign(light, { factionId: 'tyrant' }).some((f) => f.kind === 'faction-prohibition'),
    ).toBe(false)
  })

  it('bars a spinal mount for the Xxcha', () => {
    const spinal = hull({
      weapons: [
        {
          id: 's1',
          label: 'Spinal Beam',
          weaponClass: 'spinal-beam',
          rating: 1,
          variant: 'standard',
          arcs: ['F'],
          mass: 40,
          points: 120,
        },
      ],
    })
    expect(SPINAL_CLASSES).toContain('spinal-beam')
    expect(
      validateDesign(spinal, { factionId: 'xxcha' }).some((f) => f.kind === 'faction-prohibition'),
    ).toBe(true)
  })

  it('holds the Sisterhood to small, thin hulls', () => {
    const heavy = hull({ mass: 160, hullClass: 'average' })
    const faults = validateDesign(heavy, { factionId: 'sisterhood' })
    const design = faults.filter((f) => f.kind === 'faction-design')
    expect(design.length, 'over the mass limit and the wrong hull class').toBe(2)

    expect(
      validateDesign(hull({ mass: 40, hullClass: 'weak' }), { factionId: 'sisterhood' }).some(
        (f) => f.kind === 'faction-design',
      ),
    ).toBe(false)
  })

  it('makes the Chytrid build a five-row damage track', () => {
    expect(
      validateDesign(hull({ hullRows: 4 }), { factionId: 'chytrid' }).some(
        (f) => f.kind === 'faction-design',
      ),
    ).toBe(true)
    expect(
      validateDesign(hull({ hullRows: 5 }), { factionId: 'chytrid' }).some(
        (f) => f.kind === 'faction-design',
      ),
    ).toBe(false)
  })

  it('leaves a design with no faction alone', () => {
    expect(
      validateDesign(hull()).some(
        (f) => f.kind === 'faction-prohibition' || f.kind === 'faction-design',
      ),
    ).toBe(false)
  })
})
