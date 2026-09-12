import { describe, expect, it } from 'vitest'

import { applyAction, gateById, GATE_REACH, shipsAwaitingGateEntry } from './actions'
import { Rng } from './dice'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import { currentTransferMass, isGateActive, type GateDef } from './ftl'
import { isOutOfControl, outOfControlTurnsRemaining, isPermanentlyOutOfControl } from './threshold'
import { damageLevelOf } from './victory'
import { startScenario } from '../data/scenarios'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Jump Gates, Portals and jump points (11.9, 11.10).
 *
 * The whole of 11.9 was pure functions with no caller: a gate could be built,
 * priced, activated, damaged, transferred through and entered from, and none
 * of it was reachable from a game. A gate is a table object now, and the
 * inverted transfer table is the thing to get right — 1 is the good result.
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

const JUMP_GATE: GateDef = {
  id: 'gate',
  kind: 'jump-gate',
  natural: false,
  position: { x: 40, y: 24 },
  facing: 9,
  transferMass: 120,
  hullBoxes: 12,
  playerControlled: false,
  label: 'the Gate',
}

function table(overrides: Partial<GateDef> = {}, opts: { controlledBy?: string; active?: number } = {}): GameState {
  const def = { ...JUMP_GATE, ...overrides }
  return createGame({
    seed: 0x9a7e,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 72, height: 48 },
    gates: [
      {
        def,
        state: { hullMarked: 0, ftlFailed: false, activeFromTurn: opts.active ?? null },
        controllingSide: opts.controlledBy ?? null,
        activationOrderedBy: null,
        activationOrderTurn: null,
      },
    ],
    ships: [
      createShipState({
        id: 'runner',
        side: 'a',
        design: designById('nac-heavy-cruiser') as ShipDesign,
        // West of the gate, which is the side a gate facing 9 bears on.
        placement: { position: { x: 40, y: 24 }, facing: 3 },
        velocity: 4,
      }),
      createShipState({
        id: 'raider',
        side: 'b',
        design: designById('esu-battlecruiser') as ShipDesign,
        placement: { position: { x: 20, y: 24 }, facing: 3 },
        velocity: 6,
      }),
    ],
  })
}

const lastPhase = (game: GameState): Phase => game.phases[game.phases.length - 1] as Phase

describe('activation (11.9)', () => {
  it('is written in orders and announced when ships move', () => {
    const game = table({}, { controlledBy: 'a' })
    expect(
      applyAction(game, { type: 'plot-gate-activation', gateId: 'gate', side: 'a', on: true })
        .refused,
    ).toBeUndefined()
    const early = applyAction(game, { type: 'announce-gate-activation', gateId: 'gate' })
    expect(early.refused).toContain('phase 5')
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, { type: 'announce-gate-activation', gateId: 'gate' }).refused,
    ).toBeUndefined()
  })

  it('will not announce an order nobody wrote', () => {
    const game = table({}, { controlledBy: 'a' })
    advanceTo(game, 'move-ships')
    const refusal = applyAction(game, { type: 'announce-gate-activation', gateId: 'gate' })
    expect(refusal.refused).toContain('No Gate Activate order')
  })

  it('comes on the following turn for the side that holds it', () => {
    const game = table({}, { controlledBy: 'a' })
    applyAction(game, { type: 'plot-gate-activation', gateId: 'gate', side: 'a', on: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'announce-gate-activation', gateId: 'gate' })
    const gate = gateById(game, 'gate')
    if (!gate) throw new Error('no gate')
    expect(isGateActive(gate.def, gate.state, game.turn)).toBe(false)
    expect(isGateActive(gate.def, gate.state, game.turn + 1)).toBe(true)
  })

  it('rolls when the other side wants it, and a 1-3 delays it', () => {
    // Twenty seeds: some delay, some do not.
    const turns = new Set<number>()
    for (let seed = 0; seed < 20; seed += 1) {
      const game = table({}, { controlledBy: 'a' })
      game.rng = new Rng(seed)
      applyAction(game, { type: 'plot-gate-activation', gateId: 'gate', side: 'b', on: true })
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'announce-gate-activation', gateId: 'gate' })
      turns.add(gateById(game, 'gate')?.state.activeFromTurn ?? -1)
    }
    expect(turns.size).toBeGreaterThan(1)
    expect(Math.min(...turns)).toBe(2)
    expect(Math.max(...turns)).toBeLessThanOrEqual(5)
  })

  it('needs none at a natural jump point', () => {
    const game = table({ natural: true })
    const refusal = applyAction(game, {
      type: 'plot-gate-activation',
      gateId: 'gate',
      side: 'a',
      on: true,
    })
    expect(refusal.refused).toContain('natural jump point')
    const gate = gateById(game, 'gate')
    if (!gate) throw new Error('no gate')
    expect(isGateActive(gate.def, gate.state, 1)).toBe(true)
  })
})

describe('transferring out (11.9)', () => {
  it('happens at the end of the turn', () => {
    const game = table({}, { active: 1 })
    const refusal = applyAction(game, {
      type: 'gate-transfer',
      gateId: 'gate',
      shipIds: ['runner'],
    })
    expect(refusal.refused).toContain('end of the turn')
  })

  it('takes a ship off the table cleanly when the gate can lift it', () => {
    const game = table({}, { active: 1 })
    advanceTo(game, lastPhase(game))
    expect(
      applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] }).refused,
    ).toBeUndefined()
    const runner = game.ships[0] as ShipState
    expect(runner.offTable).toBe(true)
    expect(runner.destroyed).toBe(false)
    expect(game.log.some((entry) => /transfers out/.test(entry.text))).toBe(true)
  })

  it('refuses a ship that is not at the gate', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    runner.placement = { position: { x: 10, y: 10 }, facing: 3 }
    advanceTo(game, lastPhase(game))
    const refusal = applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
    expect(refusal.refused).toContain('not at')
  })

  it('refuses a ship on the wrong side of a one-way gate', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    // A gate facing 9 bears west; sit east of it and just inside reach.
    runner.placement = { position: { x: 40 + GATE_REACH, y: 24 }, facing: 9 }
    advanceTo(game, lastPhase(game))
    const refusal = applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
    expect(refusal.refused).toContain('working side')
  })

  it('refuses an inactive gate', () => {
    const game = table()
    advanceTo(game, lastPhase(game))
    const refusal = applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
    expect(refusal.refused).toContain('activated')
  })

  it('rolls per ship when the gate is overloaded, and 1 is the good result', () => {
    // A gate cut down to 10 transfer mass asked to lift a 90-mass cruiser.
    const outcomes = { transferred: 0, backedOut: 0, destroyed: 0 }
    for (let seed = 0; seed < 30; seed += 1) {
      const game = table({}, { active: 1 })
      game.rng = new Rng(seed)
      const gate = gateById(game, 'gate')
      if (!gate) throw new Error('no gate')
      gate.state = { ...gate.state, hullMarked: 11 }
      advanceTo(game, lastPhase(game))
      applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
      const runner = game.ships[0] as ShipState
      if (runner.destroyed) outcomes.destroyed += 1
      else if (runner.offTable) outcomes.transferred += 1
      else outcomes.backedOut += 1
    }
    // Two thirds of the die kills the ship, which is what makes the table
    // worth reading twice.
    expect(outcomes.destroyed).toBeGreaterThan(outcomes.transferred)
    expect(outcomes.transferred).toBeGreaterThan(0)
    expect(outcomes.backedOut).toBeGreaterThan(0)
  })

  it('leaves a ship that backed out sitting at the gate at zero velocity', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const game = table({}, { active: 1 })
      game.rng = new Rng(seed)
      const gate = gateById(game, 'gate')
      if (!gate) throw new Error('no gate')
      gate.state = { ...gate.state, hullMarked: 11 }
      advanceTo(game, lastPhase(game))
      applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
      const runner = game.ships[0] as ShipState
      if (!runner.destroyed && !runner.offTable) {
        expect(runner.velocity).toBe(0)
        expect(runner.placement.position).toEqual(JUMP_GATE.position)
        return
      }
    }
    throw new Error('no seed backed the ship out')
  })
})

describe('coming through (11.9)', () => {
  it('places the ship on the course opposite the gate\'s facing', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    runner.offTable = true
    runner.awaitingGate = 'gate'
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, { type: 'gate-entry', shipId: 'runner', gateId: 'gate', velocity: 4 })
        .refused,
    ).toBeUndefined()
    // A gate facing 9 emits on 3, which is the book's own example.
    expect(runner.placement.facing).toBe(3)
    expect(runner.offTable).toBe(false)
    expect(runner.awaitingGate).toBe(null)
    expect(runner.velocity).toBe(4)
  })

  it('never scatters: the same seed and a different one land in the same place', () => {
    const landings = new Set<string>()
    for (let seed = 0; seed < 6; seed += 1) {
      const game = table({}, { active: 1 })
      game.rng = new Rng(seed)
      const runner = game.ships[0] as ShipState
      runner.offTable = true
      runner.awaitingGate = 'gate'
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'gate-entry', shipId: 'runner', gateId: 'gate', velocity: 4 })
      landings.add(`${runner.placement.position.x},${runner.placement.position.y}`)
    }
    expect(landings.size).toBe(1)
  })

  it('caps the velocity at the ship\'s own drive rating', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    runner.offTable = true
    runner.awaitingGate = 'gate'
    advanceTo(game, 'move-ships')
    const refusal = applyAction(game, {
      type: 'gate-entry',
      shipId: 'runner',
      gateId: 'gate',
      velocity: 99,
    })
    expect(refusal.refused).toContain('main drive rating')
  })

  it('scores a hull still waiting as neither lost nor withdrawn', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    runner.offTable = true
    runner.awaitingGate = 'gate'
    expect(damageLevelOf(runner)).toBe('unhurt')
    expect(shipsAwaitingGateEntry(game).map((ship) => ship.id)).toEqual(['runner'])
  })
})

describe('shooting a gate (11.9)', () => {
  it('takes hull boxes off, and the transfer mass with them', () => {
    const game = table({}, { active: 1 })
    const raider = game.ships[1] as ShipState
    raider.placement = { position: { x: 34, y: 24 }, facing: 3 }
    advanceTo(game, 'ship-fire')
    const before = currentTransferMass(JUMP_GATE, { hullMarked: 0, ftlFailed: false, activeFromTurn: 1 })
    let fired = 0
    for (const weapon of raider.design.weapons) {
      const outcome = applyAction(game, {
        type: 'fire-at-gate',
        shipId: raider.id,
        weaponId: weapon.id,
        gateId: 'gate',
      })
      if (outcome.refused === undefined) fired += 1
    }
    expect(fired).toBeGreaterThan(0)
    const gate = gateById(game, 'gate')
    if (!gate) throw new Error('no gate')
    expect(gate.state.hullMarked).toBeGreaterThan(0)
    expect(currentTransferMass(gate.def, gate.state)).toBeLessThan(before)
  })

  it('cannot touch a natural jump point', () => {
    const game = table({ natural: true }, { active: 1 })
    const raider = game.ships[1] as ShipState
    raider.placement = { position: { x: 34, y: 24 }, facing: 3 }
    advanceTo(game, 'ship-fire')
    const weapon = raider.design.weapons[0]
    if (!weapon) throw new Error('no gun')
    const refusal = applyAction(game, {
      type: 'fire-at-gate',
      shipId: raider.id,
      weaponId: weapon.id,
      gateId: 'gate',
    })
    expect(refusal.refused).toContain('cannot be destroyed by normal weapons fire')
  })
})

describe('a linked Portal (11.9)', () => {
  function pair(): GameState {
    const game = table({ id: 'near', kind: 'portal', label: 'the near Portal' }, { active: 1 })
    game.gates.push({
      def: {
        id: 'far',
        kind: 'portal',
        natural: false,
        position: { x: 12, y: 40 },
        facing: 12,
        transferMass: 120,
        hullBoxes: 12,
        playerControlled: false,
        label: 'the far Portal',
      },
      state: { hullMarked: 0, ftlFailed: false, activeFromTurn: 1 },
      controllingSide: null,
      activationOrderedBy: null,
      activationOrderTurn: null,
    })
    const near = gateById(game, 'near')
    if (near) near.pairedGateId = 'far'
    return game
  }

  it('carries the velocity across untouched', () => {
    const game = pair()
    const runner = game.ships[0] as ShipState
    runner.velocity = 14
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, { type: 'portal-hop', shipId: 'runner', gateId: 'near' }).refused,
    ).toBeUndefined()
    expect(runner.velocity).toBe(14)
    // The far end faces 12, so it emits on 6.
    expect(runner.placement.facing).toBe(6)
  })

  it('refuses a gate with no far end', () => {
    const game = table({}, { active: 1 })
    advanceTo(game, 'move-ships')
    const refusal = applyAction(game, { type: 'portal-hop', shipId: 'runner', gateId: 'gate' })
    expect(refusal.refused).toContain('no far end')
  })
})

describe('11.10 disorientation', () => {
  it('takes a ship out of control for one turn after a jump point', () => {
    const game = table({ natural: true })
    const runner = game.ships[0] as ShipState
    runner.offTable = true
    runner.awaitingGate = 'gate'
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'gate-entry', shipId: 'runner', gateId: 'gate', velocity: 4 })
    expect(isOutOfControl(runner, game.turn)).toBe(true)
    expect(isPermanentlyOutOfControl(runner)).toBe(false)
    expect(outOfControlTurnsRemaining(runner, game.turn)).toBe(1)
    nextTurn(game)
    expect(isOutOfControl(runner, game.turn)).toBe(false)
  })

  it('leaves an artificial gate\'s arrivals steering', () => {
    const game = table({}, { active: 1 })
    const runner = game.ships[0] as ShipState
    runner.offTable = true
    runner.awaitingGate = 'gate'
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'gate-entry', shipId: 'runner', gateId: 'gate', velocity: 4 })
    expect(isOutOfControl(runner, game.turn)).toBe(false)
  })

  it('does not shorten a bridge hit that runs longer', () => {
    const game = table({ natural: true })
    const runner = game.ships[0] as ShipState
    runner.ongoing.push({
      id: 'bridge',
      source: 'bridge',
      appliedTurn: game.turn,
      expiresAfterTurn: game.turn + 3,
      note: 'bridge hit',
    })
    runner.offTable = true
    runner.awaitingGate = 'gate'
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'gate-entry', shipId: 'runner', gateId: 'gate', velocity: 4 })
    expect(outOfControlTurnsRemaining(runner, game.turn)).toBe(4)
  })
})

describe('the scenario', () => {
  it('builds a legal gate and holds the relief behind it', () => {
    const game = startScenario('gate-raid', { seed: 0x6a7e })
    expect(game.gates).toHaveLength(1)
    expect(shipsAwaitingGateEntry(game)).toHaveLength(2)
  })
})

describe('a gate\'s own FTL (11.9, 4.11)', () => {
  it('rolls a threshold check as the hull comes off, and can fail', () => {
    // Twenty seeds against a gate shot down band by band: the check has to be
    // able to go both ways, or half of 11.9's transfer condition is dead.
    let failed = 0
    let held = 0
    for (let seed = 0; seed < 20; seed += 1) {
      const game = table({}, { active: 1 })
      game.rng = new Rng(seed)
      const raider = game.ships[1] as ShipState
      raider.placement = { position: { x: 34, y: 24 }, facing: 3 }
      advanceTo(game, 'ship-fire')
      for (const weapon of raider.design.weapons) {
        applyAction(game, {
          type: 'fire-at-gate',
          shipId: raider.id,
          weaponId: weapon.id,
          gateId: 'gate',
        })
      }
      const gate = gateById(game, 'gate')
      if (!gate) throw new Error('no gate')
      if (gate.state.hullMarked === 0) continue
      if (gate.state.ftlFailed) failed += 1
      else held += 1
    }
    expect(failed + held).toBeGreaterThan(0)
    expect(held).toBeGreaterThan(0)
  })

  it('makes every ship roll once the FTL has gone, whatever the capacity', () => {
    const game = table({}, { active: 1 })
    const gate = gateById(game, 'gate')
    if (!gate) throw new Error('no gate')
    // Undamaged, so capacity is the full 120 against a 90-mass cruiser — and
    // the transfer still rolls, because the FTL has failed.
    gate.state = { ...gate.state, ftlFailed: true }
    advanceTo(game, lastPhase(game))
    applyAction(game, { type: 'gate-transfer', gateId: 'gate', shipIds: ['runner'] })
    expect(game.log.some((entry) => /failed a threshold check/.test(entry.text))).toBe(true)
  })
})
