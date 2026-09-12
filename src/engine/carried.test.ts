import { describe, expect, it } from 'vitest'

import { applyAction, carriedHulls, type GameAction } from './actions'
import { advancePhase, type GameState, type ShipState } from './game'
import { carryingCapacity } from './ftl'
import { scoreBattle, strandedBattleriders } from './victory'
import { startScenario } from '../data/scenarios'
import type { Phase } from './types'

/**
 * Riding to the battle and letting go (11.6, 11.7).
 *
 * `attachedBattleriderDefence`, `allocateBattleriderDamage` and
 * `battleriderRecovery` were three of section 11's orphans: written, tested,
 * documented, and reachable from nothing. A rider now starts clamped to its
 * Mothership, goes where the Mothership goes, cannot be fired at, and is
 * written off at the end of the battle if nothing survives to carry it.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

function ride(): { game: GameState; mother: ShipState; riders: ShipState[]; enemy: ShipState } {
  const game = startScenario('ride-to-battle', { seed: 0x11c7 })
  const mother = game.ships.find((ship) => ship.design.id === 'durani-mothership') as ShipState
  const riders = game.ships.filter((ship) => ship.design.battlerider === true)
  const enemy = game.ships.find((ship) => ship.side === 'b') as ShipState
  return { game, mother, riders, enemy }
}

describe('starting attached', () => {
  it('clamps both riders to the Mothership', () => {
    const { game, mother, riders } = ride()
    expect(riders).toHaveLength(2)
    expect(riders.every((rider) => rider.carriedBy === mother.id)).toBe(true)
    expect(carriedHulls(game, mother.id)).toHaveLength(2)
  })

  it('puts them on its station, at its course and velocity', () => {
    const { mother, riders } = ride()
    for (const rider of riders) {
      expect(rider.placement).toEqual(mother.placement)
      expect(rider.velocity).toBe(mother.velocity)
    }
  })

  it('only packs what the Mothership can lift', () => {
    const { mother, riders } = ride()
    const carried = riders.reduce((sum, rider) => sum + rider.design.mass, 0)
    expect(carryingCapacity(mother.design)).toBeGreaterThanOrEqual(carried)
  })
})

describe('while attached', () => {
  it('cannot be fired at: only the Mothership can', () => {
    const { game, riders, enemy } = ride()
    advanceTo(game, 'ship-fire')
    const weapon = enemy.design.weapons[0]
    if (!weapon) throw new Error('no gun')
    const refusal = applyAction(game, {
      type: 'fire-weapon',
      shipId: enemy.id,
      targetId: (riders[0] as ShipState).id,
      weaponId: weapon.id,
    })
    expect(refusal.refused).toContain('only the Mothership can be fired at')
  })

  it('does not fly its own move', () => {
    const { game, riders } = ride()
    advanceTo(game, 'move-ships')
    const refusal = applyAction(game, {
      type: 'move-ship',
      shipId: (riders[0] as ShipState).id,
    })
    expect(refusal.refused).toContain('does not fly its own move')
  })

  it('goes wherever the Mothership goes', () => {
    const { game, mother, riders } = ride()
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: mother.id })
    for (const rider of riders) {
      expect(rider.placement.position).toEqual(mother.placement.position)
      expect(rider.velocity).toBe(mother.velocity)
    }
    expect(mother.placement.position).not.toEqual({ x: 14, y: 30 })
  })

  it('still fires its own guns: 11.7 restricts what is fired AT the group', () => {
    const { game, riders, enemy } = ride()
    const rider = riders[0] as ShipState
    // Put the enemy where the rider's forward battery can reach it.
    rider.placement = { position: { x: 40, y: 30 }, facing: 3 }
    enemy.placement = { position: { x: 46, y: 30 }, facing: 9 }
    advanceTo(game, 'ship-fire')
    const beam = rider.design.weapons.find((w) => w.weaponClass === 'beam')
    if (!beam) throw new Error('no beam')
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: rider.id,
      targetId: enemy.id,
      weaponId: beam.id,
    })
    expect(outcome.refused).toBeUndefined()
  })
})

describe('the defender\'s choice of where damage lands (11.7)', () => {
  const nominate = (sinkId: string | null, mother: ShipState): GameAction => ({
    type: 'nominate-damage-sink',
    shipId: mother.id,
    sinkId,
  })

  it('defaults to the Mothership', () => {
    const { mother } = ride()
    expect(mother.damageSink).toBe(null)
  })

  it('moves the damage onto a nominated rider', () => {
    const { game, mother, riders, enemy } = ride()
    const rider = riders[0] as ShipState
    expect(applyAction(game, nominate(rider.id, mother)).refused).toBeUndefined()

    mother.placement = { position: { x: 40, y: 30 }, facing: 3 }
    enemy.placement = { position: { x: 44, y: 30 }, facing: 9 }
    advanceTo(game, 'ship-fire')
    // Fire everything the enemy has until something lands.
    for (const weapon of enemy.design.weapons) {
      applyAction(game, {
        type: 'fire-weapon',
        shipId: enemy.id,
        targetId: mother.id,
        weaponId: weapon.id,
      })
    }
    expect(rider.hullMarked + rider.armourMarked.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(mother.hullMarked).toBe(0)
  })

  it('refuses a hull that is not in the group', () => {
    const { game, mother, enemy } = ride()
    const refusal = applyAction(game, nominate(enemy.id, mother))
    expect(refusal.refused).toContain('11.7')
  })

  it('takes it back', () => {
    const { game, mother, riders } = ride()
    applyAction(game, nominate((riders[0] as ShipState).id, mother))
    applyAction(game, nominate(null, mother))
    expect(mother.damageSink).toBe(null)
  })
})

describe('detaching (11.7)', () => {
  it('is written in orders and hands over course and velocity', () => {
    const { game, mother, riders } = ride()
    const rider = riders[0] as ShipState
    expect(applyAction(game, { type: 'detach-hull', shipId: rider.id }).refused).toBeUndefined()
    expect(rider.carriedBy).toBe(null)
    expect(rider.velocity).toBe(mother.velocity)
    expect(rider.placement.facing).toBe(mother.placement.facing)
  })

  it('makes the rider a target like any other', () => {
    const { game, riders, enemy } = ride()
    const rider = riders[0] as ShipState
    applyAction(game, { type: 'detach-hull', shipId: rider.id })
    rider.placement = { position: { x: 40, y: 30 }, facing: 3 }
    enemy.placement = { position: { x: 44, y: 30 }, facing: 9 }
    advanceTo(game, 'ship-fire')
    const weapon = enemy.design.weapons[0]
    if (!weapon) throw new Error('no gun')
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: enemy.id,
      targetId: rider.id,
      weaponId: weapon.id,
    })
    expect(outcome.refused).toBeUndefined()
  })

  it('lets the rider fly its own move', () => {
    const { game, riders } = ride()
    const rider = riders[0] as ShipState
    applyAction(game, { type: 'detach-hull', shipId: rider.id })
    advanceTo(game, 'move-ships')
    expect(applyAction(game, { type: 'move-ship', shipId: rider.id }).refused).toBeUndefined()
  })

  it('clears a nomination that pointed at it', () => {
    const { game, mother, riders } = ride()
    const rider = riders[0] as ShipState
    applyAction(game, { type: 'nominate-damage-sink', shipId: mother.id, sinkId: rider.id })
    applyAction(game, { type: 'detach-hull', shipId: rider.id })
    expect(mother.damageSink).toBe(null)
  })

  it('waits a turn after the Mothership drops out of hyperspace', () => {
    const { game, mother, riders } = ride()
    mother.ftlEntryTurn = game.turn
    const refusal = applyAction(game, {
      type: 'detach-hull',
      shipId: (riders[0] as ShipState).id,
    })
    expect(refusal.refused).toContain('cannot detach until the next')
    nextTurn(game)
    expect(
      applyAction(game, { type: 'detach-hull', shipId: (riders[0] as ShipState).id }).refused,
    ).toBeUndefined()
  })

  it('refuses twice', () => {
    const { game, riders } = ride()
    const rider = riders[0] as ShipState
    applyAction(game, { type: 'detach-hull', shipId: rider.id })
    expect(applyAction(game, { type: 'detach-hull', shipId: rider.id }).refused).toBeTruthy()
  })
})

describe('the end of the battle (11.7)', () => {
  it('leaves riders alone while a Mothership survives', () => {
    const { game } = ride()
    expect(strandedBattleriders(game).size).toBe(0)
  })

  it('writes them off once nothing can carry them', () => {
    const { game, mother, riders } = ride()
    mother.destroyed = true
    const stranded = strandedBattleriders(game)
    expect([...stranded].sort()).toEqual(riders.map((rider) => rider.id).sort())
  })

  it('does not count a captured Mothership as a ride home', () => {
    const { game, mother } = ride()
    mother.captured = true
    expect(strandedBattleriders(game).size).toBe(2)
  })

  it('scores them as destroyed, but only when the battle is over', () => {
    const { game, mother, riders } = ride()
    mother.destroyed = true
    const ladder = { damaged: 0.25, crippled: 0.5, destroyed: 1, disengaged: 1 }
    const running = scoreBattle(game, ladder)
    const final = scoreBattle(game, ladder, { battleOver: true })
    const levelIn = (score: typeof running, id: string) =>
      score.sides.flatMap((side) => side.ships).find((ship) => ship.id === id)?.level
    expect(levelIn(running, (riders[0] as ShipState).id)).not.toBe('destroyed')
    expect(levelIn(final, (riders[0] as ShipState).id)).toBe('destroyed')
  })
})
