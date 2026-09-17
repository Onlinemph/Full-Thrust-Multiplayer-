import { describe, expect, it } from 'vitest'

import { describeReady, fireArcs, shortWeaponName } from './fireArcs'
import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import { advancePhase } from '../engine/game'

/**
 * The rose round a firing ship: what bears where, and who is standing in it.
 */
describe('the fire-arc rose', () => {
  it('shortens a mount’s name to what fits in a wedge', () => {
    expect(shortWeaponName('Beam-3')).toBe('B3')
    expect(shortWeaponName('Pulse Torpedo')).toBe('PT')
    expect(shortWeaponName('PDS')).toBe('PDS')
    expect(shortWeaponName('SML')).toBe('SML')
    expect(shortWeaponName('Needle Beam')).toBe('NB')
    expect(shortWeaponName('K-Gun-2')).toBe('KG2')
  })

  it('puts every mount in the arcs it bears into, and every enemy in the arc it sits in', () => {
    const game = buildGame({ scenarioId: 'line-of-battle', seed: 1, rulesVersion: CURRENT_RULES_VERSION })
    let guard = 40
    while (game.phase !== 'ship-fire' && guard-- > 0) advancePhase(game)
    const ship = game.ships.find((s) => s.side === game.sides[0]!.id && s.design.weapons.length > 2)!
    const arcs = fireArcs(game, ship)
    expect(arcs.map((a) => a.arc)).toEqual(['F', 'FS', 'AS', 'A', 'AP', 'FP'])
    const mounts = arcs.reduce((n, a) => n + a.ready.length + a.spent, 0)
    const expected = ship.design.weapons.reduce((n, w) => n + w.arcs.length, 0)
    expect(mounts).toBe(expected)
    const enemies = game.ships.filter((s) => s.side !== ship.side && !s.destroyed && !s.offTable).length
    expect(arcs.reduce((n, a) => n + a.targets.length, 0)).toBe(enemies)
    for (const a of arcs) {
      for (let i = 1; i < a.targets.length; i += 1) expect(a.targets[i]!.range).toBeGreaterThanOrEqual(a.targets[i - 1]!.range)
      if (a.ready.length > 0) expect(a.reach).toBeGreaterThan(0)
    }
  })

  it('counts a knocked-out mount as spent, and names alike mounts together', () => {
    const game = buildGame({ scenarioId: 'line-of-battle', seed: 1, rulesVersion: CURRENT_RULES_VERSION })
    const ship = game.ships.find((s) => s.design.weapons.filter((w) => w.arcs.includes('F')).length >= 2)!
    const forward = ship.design.weapons.filter((w) => w.arcs.includes('F'))
    ship.destroyedSystems.add(forward[0]!.id)
    const front = fireArcs(game, ship).find((a) => a.arc === 'F')!
    expect(front.spent).toBe(1)
    expect(front.ready).toHaveLength(forward.length - 1)
    expect(describeReady([{ id: 'a', short: 'B3', range: 36 }, { id: 'b', short: 'B3', range: 36 }, { id: 'c', short: 'B1', range: 12 }])).toBe('B3 ×2, B1')
  })
})
