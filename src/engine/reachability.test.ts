import { describe, expect, it } from 'vitest'

import { applyAction, setRulesReading } from './actions'
import { aiActions } from './ai'
import { createGame, createShipState, type GameState, type ShipState } from './game'
import { arrangeTouchingShips, parseOrder } from './movement'
import { checkTournamentList, identicalForces } from './battles'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * The last of the unreachable rules: 3.5's written order, 3.7's squadron and
 * 16.3's tow as the computer would use them, 3.8's arrangement of touching
 * models, and 18.2's tournament controls.
 *
 * Every one of them was implemented and tested against the rulebook and could
 * not be reached from a game — the same failure the rest of this pass has been
 * about, and the last of it outside the campaign layer.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

function ship(
  id: string,
  side: string,
  designId: string,
  at: { x: number; y: number },
  over: Partial<Parameters<typeof createShipState>[0]> = {},
): ShipState {
  return createShipState({
    id,
    side,
    design: designById(designId) as ShipDesign,
    placement: { position: at, facing: 3 },
    velocity: 4,
    ...over,
  })
}

function battle(ships: ShipState[], seed = 0x321): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 200, height: 160 },
    ships,
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

// ---------------------------------------------------------------------------
// 3.5 The written order
// ---------------------------------------------------------------------------

describe('an order typed the way it is written on paper (3.5)', () => {
  it('reads the notation the panel prints', () => {
    // "8P2+4: 12" — velocity 8, two points to port, four thrust, ending at 12.
    const parsed = parseOrder('8P2+4: 12')
    expect(parsed).not.toBeNull()
    expect(parsed?.startVelocity).toBe(8)
    expect(parsed?.finalVelocity).toBe(12)
    expect(parsed?.order.turn).toEqual({ direction: 'port', points: 2 })
    expect(parsed?.order.accel).toBe(4)
  })

  it('reaches the ship through the same actions a click does', () => {
    const game = battle([ship('mine', 'a', 'esu-heavy-cruiser', { x: 40, y: 40 })])
    const parsed = parseOrder('4S1+2: 6')
    expect(parsed).not.toBeNull()
    applyAction(game, {
      type: 'plot-turn',
      shipId: 'mine',
      direction: parsed!.order.turn!.direction,
      points: parsed!.order.turn!.points,
    })
    applyAction(game, { type: 'plot-accel', shipId: 'mine', accel: parsed!.order.accel })
    const order = shipOf(game, 'mine').order
    expect(order).not.toBeNull()
    expect(order?.turn).toEqual({ direction: 'starboard', points: 1 })
    expect(order?.accel).toBe(2)
  })

  it('turns down anything that is not an order', () => {
    expect(parseOrder('full speed ahead')).toBeNull()
    // 3.5 allows at most a double course change.
    expect(parseOrder('8P1S1P1: 8')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 3.8 Models that finished on top of each other
// ---------------------------------------------------------------------------

describe('arranging touching models (3.8)', () => {
  it('pushes two counters on the same point apart, and leaves the rest alone', () => {
    const placed = arrangeTouchingShips(
      [
        { id: 'a', placement: { position: { x: 10, y: 10 }, facing: 3 } },
        { id: 'b', placement: { position: { x: 10, y: 10 }, facing: 3 } },
        { id: 'c', placement: { position: { x: 40, y: 40 }, facing: 3 } },
      ],
      1.6,
    )
    const [a, b, c] = placed
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeGreaterThan(1)
    expect(c.position).toEqual({ x: 40, y: 40 })
  })

  it('is deterministic — the same input gives the same arrangement', () => {
    const input = [
      { id: 'a', placement: { position: { x: 5, y: 5 }, facing: 6 as const } },
      { id: 'b', placement: { position: { x: 5, y: 5 }, facing: 6 as const } },
    ]
    expect(arrangeTouchingShips(input, 2)).toEqual(arrangeTouchingShips(input, 2))
  })
})

// ---------------------------------------------------------------------------
// 18.2 Tournament controls
// ---------------------------------------------------------------------------

describe('a tournament list (18.2)', () => {
  const entry = (designId: string, modified = false) => ({
    id: designId,
    designId,
    mass: 100,
    points: 200,
    modified,
  })

  it('refuses a hull that is not off the shelf', () => {
    // "with no modifications, changes in weapons, etc."
    const report = checkTournamentList([entry('esu-heavy-cruiser'), entry('home-brew', true)])
    expect(report.legal).toBe(false)
    expect(report.violations[0].detail).toMatch(/modified/)
  })

  it('passes a list of unmodified hulls', () => {
    expect(checkTournamentList([entry('esu-heavy-cruiser')]).legal).toBe(true)
  })

  it('says whether both fleets are the same force', () => {
    // "Even more limiting is a fixed, identical force."
    expect(identicalForces([[entry('a')], [entry('a')]])).toBe(true)
    expect(identicalForces([[entry('a')], [entry('b')]])).toBe(false)
    // Order does not matter; numbers do.
    expect(identicalForces([[entry('a'), entry('b')], [entry('b'), entry('a')]])).toBe(true)
    expect(identicalForces([[entry('a'), entry('a')], [entry('a')]])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The computer's own squadrons and tows
// ---------------------------------------------------------------------------

describe('the computer forms squadrons and takes hulls under tow', () => {
  it('flies a line of cruisers as one squadron (3.7)', () => {
    // Three hulls of the same drive type, close enough that a single order
    // suits them all.
    const game = battle([
      ship('one', 'a', 'esu-heavy-cruiser', { x: 40, y: 40 }),
      ship('two', 'a', 'esu-heavy-cruiser', { x: 44, y: 40 }),
      ship('three', 'a', 'esu-heavy-cruiser', { x: 48, y: 40 }),
      ship('enemy', 'b', 'esu-heavy-cruiser', { x: 120, y: 40 }),
    ])
    const actions = aiActions(game, 'a')
    const formed = actions.find((action) => action.type === 'form-squadron')
    expect(formed).toBeDefined()
    expect(formed && 'shipIds' in formed ? formed.shipIds.length : 0).toBeGreaterThanOrEqual(2)
  })

  it('does not form one out of ships scattered across the table', () => {
    const game = battle([
      ship('one', 'a', 'esu-heavy-cruiser', { x: 10, y: 10 }),
      ship('two', 'a', 'esu-heavy-cruiser', { x: 150, y: 140 }),
      ship('enemy', 'b', 'esu-heavy-cruiser', { x: 80, y: 80 }),
    ])
    expect(aiActions(game, 'a').some((action) => action.type === 'form-squadron')).toBe(false)
  })

  it('takes a drifting hull under tow when it can match courses (16.3)', () => {
    const game = battle([
      ship('tug', 'a', 'esu-heavy-cruiser', { x: 40, y: 40 }, { velocity: 0 }),
      ship('wreck', 'a', 'esu-heavy-cruiser', { x: 41, y: 40 }, { velocity: 0 }),
      ship('enemy', 'b', 'esu-heavy-cruiser', { x: 120, y: 40 }),
    ])
    // A hull with no drive left is what a tow is for.
    shipOf(game, 'wreck').driveHits = 2
    const towing = aiActions(game, 'a').find((action) => action.type === 'begin-tow')
    expect(towing).toBeDefined()
    expect(towing && 'loadId' in towing ? towing.loadId : '').toBe('wreck')
  })

  it('leaves a hull that can still move to fly itself', () => {
    const game = battle([
      ship('tug', 'a', 'esu-heavy-cruiser', { x: 40, y: 40 }, { velocity: 0 }),
      ship('consort', 'a', 'esu-heavy-cruiser', { x: 41, y: 40 }, { velocity: 0 }),
      ship('enemy', 'b', 'esu-heavy-cruiser', { x: 120, y: 40 }),
    ])
    expect(aiActions(game, 'a').some((action) => action.type === 'begin-tow')).toBe(false)
  })

  it('actually forms the squadron when the orders are applied', () => {
    const game = battle([
      ship('one', 'a', 'esu-heavy-cruiser', { x: 40, y: 40 }),
      ship('two', 'a', 'esu-heavy-cruiser', { x: 44, y: 40 }),
      ship('enemy', 'b', 'esu-heavy-cruiser', { x: 120, y: 40 }),
    ])
    advanceTo(game, 'orders')
    for (const action of aiActions(game, 'a')) applyAction(game, action)
    expect(shipOf(game, 'one').squadronId).not.toBeNull()
    expect(shipOf(game, 'two').squadronId).toBe(shipOf(game, 'one').squadronId)
  })
})
