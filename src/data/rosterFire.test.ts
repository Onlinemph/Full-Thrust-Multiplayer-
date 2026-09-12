import { describe, expect, it } from 'vitest'

import { applyAction } from '../engine/actions'
import { advancePhase, createGame, createShipState, type GameState } from '../engine/game'
import { SHIP_DESIGNS } from './ships'
import type { Phase } from '../engine/types'

/**
 * Every gun in the roster, fired once.
 *
 * `coverage.test.ts` says which weapon classes the engine can resolve;
 * `ships.test.ts` says the roster prices correctly. Neither says a ship in the
 * roster can actually shoot what it is carrying — and for most of this
 * catalogue's life nothing could, because no buyable design mounted a spinal
 * mount, a mine rack, a Nova Cannon or a Gatling battery at all. A weapon that
 * prices cleanly and throws when fired is the failure this file exists for.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

/** The shooter's own faction on one side, a target six MU up the table. */
function duel(designIndex: number): GameState {
  const design = SHIP_DESIGNS[designIndex]
  return createGame({
    seed: 0x5eed,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'shooter',
        side: 'a',
        design,
        placement: { position: { x: 24, y: 24 }, facing: 6 },
      }),
      createShipState({
        id: 'target',
        side: 'b',
        // Something big enough to survive a Nova Cannon and be shot at again.
        design: SHIP_DESIGNS.find((d) => d.mass >= 150) ?? design,
        placement: { position: { x: 24, y: 30 }, facing: 12 },
      }),
    ],
  })
}

describe('the roster in anger', () => {
  it('fires every weapon on every design, and the engine takes the shot', () => {
    // Ordnance is written in the orders phase and flies later (6), so a mine
    // rack or a missile launcher will not answer a direct-fire order — that is
    // the rule, not a fault. Everything else must actually shoot.
    const ordnance = new Set([
      'heavy-missile',
      'salvo-missile-rack',
      'salvo-missile-launcher',
      'antimatter-missile',
      'mine-rack',
      'rocket-pod',
      'plasma-bolt-launcher',
      'submunition-pack',
      'boarding-torpedo',
    ])
    let fired = 0
    const refused: string[] = []
    for (let i = 0; i < SHIP_DESIGNS.length; i++) {
      const design = SHIP_DESIGNS[i]
      for (const weapon of design.weapons) {
        if (!weapon.arcs.includes('F')) continue
        // A fresh battle per shot: a one-shot magazine or a spent mine rack
        // would otherwise make the second weapon's refusal look like the
        // first weapon's fault.
        const game = duel(i)
        advanceTo(game, 'ship-fire')
        const before = game.log.length
        const outcome = applyAction(game, {
          type: 'fire-weapon',
          shipId: 'shooter',
          weaponId: weapon.id,
          targetId: 'target',
        })
        if (ordnance.has(weapon.weaponClass)) continue
        fired += 1
        if (outcome.refused || game.log.length === before) {
          refused.push(`${design.id} ${weapon.label}: ${outcome.refused ?? 'no log entry'}`)
        }
      }
    }
    expect(refused).toEqual([])
    // The roster is 83 designs; if this collapses to a handful, the loop is
    // broken rather than the roster.
    expect(fired).toBeGreaterThan(150)
  })

  // Section 6 has three launch paths and each mount belongs to exactly one: a
  // missile is aimed at a point, a rocket pod picks a ship and rolls at
  // launch (6.7), and a plasma bolt is a marker placed on the table (6.8).
  it('launches every ordnance mount the roster carries', () => {
    const missiles = new Set([
      'heavy-missile',
      'salvo-missile-rack',
      'salvo-missile-launcher',
      'antimatter-missile',
    ])
    let launched = 0
    const refused: string[] = []
    for (let i = 0; i < SHIP_DESIGNS.length; i++) {
      const design = SHIP_DESIGNS[i]
      for (const weapon of design.weapons) {
        if (!weapon.arcs.includes('F')) continue
        const aimed = missiles.has(weapon.weaponClass)
        const rocket = weapon.weaponClass === 'rocket-pod'
        const bolt = weapon.weaponClass === 'plasma-bolt-launcher'
        if (!aimed && !rocket && !bolt) continue
        const game = duel(i)
        advanceTo(game, 'launch-missiles')
        const outcome = aimed
          ? applyAction(game, {
              type: 'launch-ordnance',
              shipId: 'shooter',
              weaponId: weapon.id,
              aimPoint: { x: 24, y: 30 },
            })
          : rocket
            ? applyAction(game, {
                type: 'fire-rocket-pod',
                shipId: 'shooter',
                weaponId: weapon.id,
                targetId: 'target',
              })
            : applyAction(game, {
                type: 'launch-plasma-bolt',
                shipId: 'shooter',
                weaponId: weapon.id,
                aimPoint: { x: 24, y: 30 },
              })
        launched += 1
        if (outcome.refused) refused.push(`${design.id} ${weapon.label}: ${outcome.refused}`)
      }
    }
    expect(refused).toEqual([])
    expect(launched).toBeGreaterThan(20)
  })

  // 6.9: mines go over the side in the movement phase, not at a target, so
  // the rack is ordered rather than fired.
  it('lays mines from the racks that carry them', () => {
    const layer = SHIP_DESIGNS.findIndex((d) =>
      d.weapons.some((w) => w.weaponClass === 'mine-rack'),
    )
    expect(layer, 'no design in the roster carries a mine rack').toBeGreaterThanOrEqual(0)
    const game = duel(layer)
    const outcome = applyAction(game, { type: 'plot-mines', shipId: 'shooter', on: true })
    expect(outcome.refused).toBeUndefined()
    expect(game.ships.find((s) => s.id === 'shooter')?.layingMines).toBe(true)
  })

  it('leaves no design armed with a weapon no FireCon can aim', () => {
    for (const design of SHIP_DESIGNS) {
      if (design.weapons.length === 0) continue
      const fireCons = design.systems.filter(
        (s) => s.kind === 'firecon' || s.kind === 'advanced-firecon',
      )
      expect(fireCons.length, design.id).toBeGreaterThan(0)
    }
  })
})
