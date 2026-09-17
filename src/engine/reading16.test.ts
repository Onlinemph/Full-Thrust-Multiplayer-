import { describe, expect, it } from 'vitest'

import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import { applyAction, endPhase, everyoneReady, sidesAwaited } from './actions'
import { advancePhase, type GameState, type ShipState } from './game'
import type { Phase } from './types'

/**
 * Reading 16: 2.6 as two players at a table actually run it.
 *
 * Phase 11 is fired in turns — the side with initiative first, one ship's
 * whole declared fire at a time — initiative is rolled once, a phase with
 * nothing in it is passed over, and under the ready gate a phase ends when
 * every console has said it may.
 */
function advanceTo(game: GameState, phase: Phase): void {
  let guard = 60
  while (game.phase !== phase && guard-- > 0) {
    // The roll is a press from this reading, and the tests press it.
    if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
  }
}

/** Line of Battle, with a shooter and a target either side dead ahead of each other. */
function battle(extra: Record<string, unknown> = {}) {
  const game = buildGame({ scenarioId: 'line-of-battle', seed: 0xac7, rulesVersion: CURRENT_RULES_VERSION, ...extra })
  const a = game.sides[0].id
  const b = game.sides[1].id
  const forward = (ship: ShipState) =>
    ship.design.weapons.filter((w) => w.weaponClass === 'beam' && w.arcs.includes('F')).length >= 2
  const [a1, a2] = game.ships.filter((s) => s.side === a && forward(s)) as [ShipState, ShipState]
  const [b1, b2] = game.ships.filter((s) => s.side === b && forward(s)) as [ShipState, ShipState]
  a1.placement = { position: { x: 20, y: 16 }, facing: 3 }
  b1.placement = { position: { x: 26, y: 16 }, facing: 9 }
  a2.placement = { position: { x: 20, y: 32 }, facing: 3 }
  b2.placement = { position: { x: 26, y: 32 }, facing: 9 }
  advanceTo(game, 'ship-fire')
  return { game, a, b, a1, a2, b1, b2 }
}

const beam = (ship: ShipState, index: number) =>
  ship.design.weapons.filter((w) => w.weaponClass === 'beam' && w.arcs.includes('F'))[index]!

const shoot = (game: GameState, ship: ShipState, target: ShipState, index = 0) =>
  applyAction(game, { type: 'fire-weapon', shipId: ship.id, targetId: target.id, weaponId: beam(ship, index).id })

describe('phase 11 is fired in turns (2.6)', () => {
  it('opens with the side that won initiative and refuses the other side a ship', () => {
    const { game, a1, a2, b1, b2 } = battle()
    const winner = game.initiative!.winner
    expect(game.fire.side).toBe(winner)
    const [mine, theirs, myTarget, theirTarget] =
      winner === a1.side ? [a1, b1, b1, a1] : [b1, a1, a1, b1]
    void a2
    void b2
    expect(shoot(game, theirs, theirTarget).refused).toMatch(/turn to fire/)
    expect(shoot(game, mine, myTarget).refused).toBeUndefined()
    // The turn has passed to the other side, and this ship may still finish.
    expect(game.fire.side).toBe(theirs.side)
    expect(shoot(game, mine, myTarget, 1).refused).toBeUndefined()
    expect(shoot(game, theirs, theirTarget).refused).toBeUndefined()
  })

  it('fires a whole declaration as one volley and closes the ship behind it', () => {
    const { game, a1, a2, b1 } = battle()
    const winner = game.initiative!.winner
    const [mine, target] = winner === a1.side ? [a1, b1] : [b1, a1]
    void a2
    const before = target.hullMarked + target.armourMarked.reduce((s, n) => s + n, 0)
    const shots = [0, 1].map((i) => ({ weaponId: beam(mine, i).id, targetId: target.id }))
    expect(applyAction(game, { type: 'fire-volley', shipId: mine.id, shots }).refused).toBeUndefined()
    expect(mine.hasFiredThisTurn).toBe(true)
    expect(mine.weaponsFired.size).toBe(2)
    expect(game.fire.side).toBe(target.side)
    // Declared, rolled, done: nothing more from this ship.
    expect(shoot(game, mine, target, 0).refused).toMatch(/had its fire/)
    void before
  })

  it('lets a ship hold its fire in turn, which passes the turn on', () => {
    const { game, a1, b1 } = battle()
    const winner = game.initiative!.winner
    const [mine, theirs] = winner === a1.side ? [a1, b1] : [b1, a1]
    expect(applyAction(game, { type: 'pass-fire', shipId: theirs.id }).refused).toMatch(/turn to fire/)
    expect(applyAction(game, { type: 'pass-fire', shipId: mine.id }).refused).toBeUndefined()
    expect(mine.hasFiredThisTurn).toBe(true)
    expect(game.fire.side).toBe(theirs.side)
  })

  it('keeps nobody waiting once the other side has nothing left to fire', () => {
    const { game, a, b, a1, a2, b1, b2 } = battle()
    // Every ship of the side without initiative holds, in its turns.
    const winner = game.initiative!.winner
    const loser = winner === a ? b : a
    const winners = game.ships.filter((s) => s.side === winner && !s.destroyed)
    const losers = game.ships.filter((s) => s.side === loser && !s.destroyed)
    void a1
    void a2
    void b1
    void b2
    for (let i = 0; i < losers.length; i += 1) {
      expect(applyAction(game, { type: 'pass-fire', shipId: winners[i].id }).refused).toBeUndefined()
      expect(applyAction(game, { type: 'pass-fire', shipId: losers[i].id }).refused).toBeUndefined()
    }
    // The losing side is spent; the winners fire the rest in a row.
    expect(game.fire.side).toBeNull()
    for (let i = losers.length; i < winners.length; i += 1) {
      expect(applyAction(game, { type: 'pass-fire', shipId: winners[i].id }).refused).toBeUndefined()
    }
  })

  it('leaves an older journal firing in any order it likes', () => {
    const { game, a1, b1 } = battle({ rulesVersion: 15 })
    const winner = game.initiative!.winner
    const theirs = winner === a1.side ? b1 : a1
    const target = theirs === a1 ? b1 : a1
    expect(shoot(game, theirs, target).refused).toBeUndefined()
  })
})

describe('initiative is rolled once a turn (2.6)', () => {
  it('is one press: the phase owes the roll, takes it once, and refuses a second', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 3, rulesVersion: CURRENT_RULES_VERSION })
    endPhase(game)
    expect(game.phase).toBe('initiative')
    // Nothing is thrown as the phase opens; the button throws.
    expect(game.initiative).toBeNull()
    expect(applyAction(game, { type: 'advance-phase' }).refused).toMatch(/not yet rolled/)
    expect(applyAction(game, { type: 'roll-initiative' }).refused).toBeUndefined()
    expect(game.initiative?.turn).toBe(1)
    const refused = applyAction(game, { type: 'roll-initiative' })
    expect(refused.refused).toMatch(/rolled this turn/)
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })

  it('leaves an older battle throwing the dice as the phase opens', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 3, rulesVersion: 15 })
    endPhase(game)
    expect(game.phase).toBe('initiative')
    expect(game.initiative?.turn).toBe(1)
  })
})

describe('a phase with nothing in it is passed over (2.6)', () => {
  it('runs the introductory battle as orders, initiative, movement and fire when nothing is hit', () => {
    const game = buildGame({ scenarioId: 'intro-fleet-engagement', seed: 5, rulesVersion: CURRENT_RULES_VERSION })
    expect(game.phases.length).toBe(15)
    const seen: Phase[] = [game.phase]
    for (let i = 0; i < 6; i += 1) {
      for (const ship of game.ships) if (ship.order === null) applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 0 })
      const before = game.turn
      while (game.turn === before) {
        if (game.phase === 'move-ships') {
          for (const ship of game.ships) applyAction(game, { type: 'move-ship', shipId: ship.id })
        }
        if (game.phase === 'threshold') applyAction(game, { type: 'threshold-sweep' })
        if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
        expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
        seen.push(game.phase)
      }
      break
    }
    // Nobody fired, so no ship crossed a threshold and phase 12 has nothing
    // in it either; it comes back the moment a hull is marked (next case).
    expect(seen).toEqual(['orders', 'initiative', 'move-ships', 'ship-fire', 'orders'])
  })

  it('stops at the threshold checks once a hull row has gone', () => {
    const game = buildGame({ scenarioId: 'intro-fleet-engagement', seed: 5, rulesVersion: CURRENT_RULES_VERSION })
    const ship = game.ships[0]
    ship.pendingThresholdRows = 1
    advanceTo(game, 'ship-fire')
    endPhase(game)
    expect(game.phase).toBe('threshold')
  })

  it('stops at damage control when a ship has something to repair', () => {
    const game = buildGame({ scenarioId: 'intro-fleet-engagement', seed: 5, rulesVersion: CURRENT_RULES_VERSION })
    const ship = game.ships[0]
    const weapon = ship.design.weapons[0]
    ship.destroyedSystems.add(weapon.id)
    advanceTo(game, 'ship-fire')
    endPhase(game)
    expect(game.phase).toBe('damage-control')
  })

  it('leaves an older journal walking every phase itself', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 5, rulesVersion: 15 })
    advancePhase(game)
    advancePhase(game)
    expect(game.phase).toBe('launch-missiles')
  })
})

describe('under the ready gate a phase ends when every console says so (2.6)', () => {
  function gated() {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 9, rulesVersion: CURRENT_RULES_VERSION, readyGate: true })
    for (const ship of game.ships) applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 0 })
    return game
  }

  it('refuses to end the phase outright, and ends it on the last ready', () => {
    const game = gated()
    expect(applyAction(game, { type: 'advance-phase' }).refused).toMatch(/every console/)
    expect(applyAction(game, { type: 'signal-ready', side: 'a', ready: true }).refused).toBeUndefined()
    expect(sidesAwaited(game)).toEqual(['b'])
    expect(game.phase).toBe('orders')
    expect(applyAction(game, { type: 'signal-ready', side: 'b', ready: true }).refused).toBeUndefined()
    expect(game.phase).not.toBe('orders')
    expect(game.readyToEnd).toEqual([])
  })

  it('will not take a ready while the phase\'s work is undone', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 9, rulesVersion: CURRENT_RULES_VERSION, readyGate: true })
    expect(applyAction(game, { type: 'signal-ready', side: 'a', ready: true }).refused).toMatch(/orders/)
  })

  it('does not wait on the computer', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 9, rulesVersion: CURRENT_RULES_VERSION, readyGate: true, aiSides: ['b'] })
    for (const ship of game.ships) applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 0 })
    expect(everyoneReady(game)).toBe(false)
    applyAction(game, { type: 'signal-ready', side: 'a', ready: true })
    expect(game.phase).not.toBe('orders')
  })

  it('is off unless the setup asks for it', () => {
    const game = buildGame({ scenarioId: 'border-skirmish', seed: 9, rulesVersion: CURRENT_RULES_VERSION })
    for (const ship of game.ships) applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 0 })
    expect(applyAction(game, { type: 'advance-phase' }).refused).toBeUndefined()
  })
})

describe('reading', () => {
  it('is at least 16', () => {
    expect(CURRENT_RULES_VERSION).toBeGreaterThanOrEqual(16)
  })
})
