import { describe, expect, it } from 'vitest'

import * as economy from './economy'
import * as intel from './intel'
import * as map from './map'
import * as research from './research'
import * as schema from './types'
import * as turn from './turn'

/**
 * Agreement between the campaign modules.
 *
 * The campaign layer was built by two hands at once and a few constants and
 * pure functions ended up defined twice. Where they are the same thing, they
 * must *stay* the same thing, and the compiler cannot see a disagreement
 * between two separate definitions that never meet — which is exactly how the
 * map generator came to emit `'multiple-star'` systems and `'special-anomaly'`
 * planets while the turn resolver looked for `'binary'` and `'anomaly'`, so a
 * quarter of generated systems would have been silently unrecognised.
 *
 * Those two are now single-sourced from `types.ts`. These tests hold the rest
 * honest until they are too: a duplicate that drifts fails here rather than in
 * a campaign six months from now.
 */

describe('constants defined in more than one module', () => {
  it('agree on the FTL rates (6.1)', () => {
    expect(map.BASE_FTL_RATE).toBe(research.BASE_FTL_RATE)
    expect(map.MAX_FTL_RATE).toBe(research.MAX_FTL_RATE)
    // And they are what the rules say: 2 hexes a turn, raised to at most 8.
    expect(map.BASE_FTL_RATE).toBe(2)
    expect(map.MAX_FTL_RATE).toBe(8)
  })

  it('agree on the turn sequence', () => {
    expect([...turn.CAMPAIGN_PHASE_ORDER]).toEqual([...schema.CAMPAIGN_PHASE_ORDER])
    expect(turn.CAMPAIGN_PHASE_ORDER).toHaveLength(8)
    for (const phase of schema.CAMPAIGN_PHASE_ORDER) {
      expect(turn.CAMPAIGN_PHASE_LABELS[phase], phase).toBeTruthy()
      expect(schema.CAMPAIGN_PHASE_LABELS[phase], phase).toBeTruthy()
    }
  })

  it('agree on when a production phase falls (every 4th turn)', () => {
    for (let t = 1; t <= 40; t++) {
      expect(turn.isProductionTurn(t), `turn ${t}`).toBe(schema.isProductionTurn(t))
    }
    expect(schema.isProductionTurn(4)).toBe(true)
    expect(schema.isProductionTurn(5)).toBe(false)
  })
})

describe('pure functions defined in more than one module', () => {
  it('agree on hex distance', () => {
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        const a = { q: 0, r: 0 }
        const b = { q, r }
        expect(turn.hexDistance(a, b), `${q},${r}`).toBe(map.hexDistance(a, b))
      }
    }
    // Axial distance, not Euclidean: a neighbour is 1 away in all six directions.
    expect(map.hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1)
    expect(map.hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
  })

  it('agree on how a hex is keyed in a save', () => {
    for (const hex of [
      { q: 0, r: 0 },
      { q: 3, r: -2 },
      { q: -7, r: 11 },
    ]) {
      expect(turn.hexKey(hex)).toBe(map.hexKey(hex))
    }
  })

  it('agree on the cost of integrating a subject population', () => {
    // 100 RP converts a million subjects (6.4).
    for (const millions of [0, 1, 5, 20, 137]) {
      expect(turn.integrationCost(millions), `${millions}M`).toBe(
        economy.integrationCost(millions),
      )
    }
    expect(economy.integrationCost(20)).toBe(2000)
  })

  it('agree on the seeded stream', () => {
    // Both modules draw from the campaign's own stream, and a campaign replays
    // only if a given cursor always gives the same number.
    for (let cursor = 0; cursor < 50; cursor++) {
      expect(intel.sampleAt(0xc0ffee, cursor), `cursor ${cursor}`).toBe(
        schema.sampleAt(0xc0ffee, cursor),
      )
    }
    // Counter-based, not sequential: a campaign resumed at cursor 4,000 costs
    // one multiply rather than four thousand draws.
    expect(schema.sampleAt(1, 4000)).toBe(schema.sampleAt(1, 4000))
    expect(schema.sampleAt(1, 4000)).not.toBe(schema.sampleAt(1, 4001))
  })
})

describe('the enums that had actually drifted', () => {
  it('only ever generates system features and planet types the schema names', () => {
    // This is the test that would have caught it: run the generator a few
    // hundred times and check every name it emits is one the rest of the
    // campaign knows. Two string unions that never meet cannot disagree in a
    // way the compiler sees; they can only disagree in a way a run sees.
    const features = new Set<string>()
    const types = new Set<string>()
    for (let seed = 0; seed < 300; seed++) {
      const system = map.generateSystem({ seed, cursor: 0 }, { id: `s${seed}`, name: `System ${seed}`, hex: { q: 0, r: 0 } })
      features.add(system.feature)
      for (const body of system.bodies) types.add(body.type)
    }
    const knownFeatures: schema.SystemFeature[] = [
      'standard',
      'nebula',
      'dense-asteroid-field',
      'multiple-star',
    ]
    const knownTypes: schema.PlanetType[] = [
      'terran',
      'sub-terran',
      'minimal-terran',
      'barren',
      'gas-giant',
      'special-anomaly',
    ]
    for (const feature of features) expect(knownFeatures).toContain(feature)
    for (const type of types) expect(knownTypes).toContain(type)
    // And the generator actually reaches the corners, or the test proves nothing.
    expect(features.size).toBeGreaterThan(1)
    expect(types.size).toBeGreaterThan(2)
  })
})
