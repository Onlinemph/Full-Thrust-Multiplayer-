import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules, tableIsCrowded } from './actions'
import { advancePhase, createGame, createShipState, type GameState } from './game'
import { damageLevelOf } from './victory'
import { distance } from './geometry'
import type { Phase, ShipDesign } from './types'

/**
 * The table has edges (3.9, 16.4, 16.5).
 *
 * `movement.isOffTable` and `movement.departureEdge` were written with 3.9's
 * text quoted over them and called by nothing outside their own test: no ship
 * had ever left the table by flying, because `GameState` carried no table to
 * fly off. `ship.offTable = true` appeared once in the whole engine, for an FTL
 * jump.
 */

function design(over: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'h',
    name: 'Hull',
    faction: 'Test',
    group: 'cruiser',
    mass: 100,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 40,
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 0,
    marineParties: 0,
    points: 200,
    ...over,
  }
}

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

/** One ship 6 MU from the top edge, heading for it at `velocity`. */
function runningOut(velocity: number, rules: Parameters<typeof setOptionalRules>[1] = {}): GameState {
  const game = createGame({
    seed: 0x39,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      createShipState({
        id: 'red',
        side: 'a',
        design: design({ id: 'red', name: 'Red' }),
        placement: { position: { x: 36, y: 6 }, facing: 12 },
        velocity,
      }),
      createShipState({
        id: 'blue',
        side: 'b',
        design: design({ id: 'blue', name: 'Blue', drive: { thrust: 8, advanced: false } }),
        placement: { position: { x: 36, y: 40 }, facing: 12 },
        velocity: 0,
      }),
    ],
  })
  setOptionalRules(game, rules)
  return game
}

describe('flying off the table (3.9)', () => {
  it('takes the ship out of the battle, by the edge it left through', () => {
    const game = runningOut(10)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].offTable).toBe(true)
    expect(game.ships[0].exitEdge).toBe('top')
    expect(damageLevelOf(game.ships[0]), '4.12 scores a disengaged hull in full').toBe('disengaged')
  })

  it('leaves a ship that stays on it alone', () => {
    const game = runningOut(4)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.ships[0].offTable).toBe(false)
    expect(game.ships[0].exitEdge).toBeNull()
  })

  it('rolls for a return only when the table asked for it', () => {
    const plain = runningOut(10)
    advanceTo(plain, 'move-ships')
    applyAction(plain, { type: 'move-ship', shipId: 'red' })
    expect(plain.ships[0].reentryTurn).toBeNull()
    expect(
      plain.log.some((e) => e.text.includes('3.9') && (e.dice?.length ?? 0) > 0),
      'the optional roll is optional, and an unasked-for die moves the whole stream',
    ).toBe(false)

    const optional = runningOut(10, { tableReentry: true })
    advanceTo(optional, 'move-ships')
    applyAction(optional, { type: 'move-ship', shipId: 'red' })
    expect(optional.log.some((e) => e.text.includes('3.9') && e.dice?.length === 1)).toBe(true)
  })

  it('is not a retreat under the moving table', () => {
    const game = runningOut(10, { movingTable: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(game.log.some((e) => e.text.includes('16.4'))).toBe(true)
    expect(game.log.some((e) => e.text.includes('retreat'))).toBe(false)
  })
})

describe('the moving table (16.4)', () => {
  it('changes every position and no range at all', () => {
    const game = runningOut(0, { movingTable: true })
    game.terrain.push({ id: 'rock', kind: 'planetoid', position: { x: 20, y: 20 }, radius: 4 })
    const before = distance(game.ships[0].placement.position, game.ships[1].placement.position)
    const rockBefore = distance(game.ships[0].placement.position, game.terrain[0].position)

    expect(
      applyAction(game, { type: 'shift-table', crowding: 'top', distance: 12 }).refused,
    ).toBeUndefined()

    expect(game.ships[0].placement.position.y, 'slid away from the crowded edge').toBe(18)
    expect(distance(game.ships[0].placement.position, game.ships[1].placement.position)).toBeCloseTo(
      before,
      9,
    )
    expect(distance(game.ships[0].placement.position, game.terrain[0].position)).toBeCloseTo(
      rockBefore,
      9,
    )
  })

  it('does not move at all unless the table agreed to it', () => {
    const game = runningOut(0)
    expect(
      applyAction(game, { type: 'shift-table', crowding: 'top', distance: 12 }).refused,
    ).toContain('16.4')
  })

  it('says when the whole action has drifted into an edge', () => {
    const game = runningOut(0, { movingTable: true })
    expect(tableIsCrowded(game, 6), 'one ship is deep in the table').toBeNull()
    game.ships[1].placement.position = { x: 36, y: 4 }
    expect(tableIsCrowded(game, 8)).toBe('top')
  })
})

describe('disengaging (16.5)', () => {
  function fleeing(): GameState {
    const game = runningOut(10, { movingTable: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    return game
  }

  it('waits for the last ship to leave, by the same edge', () => {
    const game = runningOut(0, { movingTable: true })
    expect(applyAction(game, { type: 'resolve-disengagement', sideId: 'a' }).refused).toContain(
      'until the last ship',
    )
  })

  it('is rolled once the fleet is clear', () => {
    const game = fleeing()
    expect(applyAction(game, { type: 'resolve-disengagement', sideId: 'a' }).refused).toBeUndefined()
    expect(game.log.some((e) => e.text.includes('16.5'))).toBe(true)
  })

  it('puts a failed runner back on the new playing area', () => {
    // Ties go to the runner, so a failure needs the pursuer to roll higher —
    // over enough seeds both answers turn up, and the ship comes back on
    // exactly when the roll went against it.
    const outcomes = new Set<boolean>()
    for (let seed = 1; seed <= 30; seed++) {
      const game = runningOut(10, { movingTable: true })
      game.rng = new (game.rng.constructor as new (seed: number) => typeof game.rng)(seed)
      advanceTo(game, 'move-ships')
      applyAction(game, { type: 'move-ship', shipId: 'red' })
      applyAction(game, { type: 'resolve-disengagement', sideId: 'a' })
      outcomes.add(game.ships[0].offTable)
    }
    expect(outcomes, 'thirty seeds should give both answers').toEqual(new Set([true, false]))
  })

  it('is not offered at all without the moving table', () => {
    const game = runningOut(10)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'red' })
    expect(applyAction(game, { type: 'resolve-disengagement', sideId: 'a' }).refused).toContain(
      '16.4',
    )
  })
})
