import { describe, expect, it } from 'vitest'

import { applyAction, setRulesReading } from './actions'
import { advancePhase, createGame, createShipState, type GameState, type ShipState } from './game'
import {
  isInSpinalArc,
  isSpinalMount,
  spinalCanFire,
  spinalLocksShip,
  SPINAL_ARC_DEGREES,
} from './weapons/kinetics'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Spinal Mounts (5.23).
 *
 * Four rules make one not a heavy beam, and none of them was reachable: the
 * mount fired through `fire-weapon` at a single named ship, in the full
 * 60-degree forward arc, every turn, with no consequence afterwards.
 * `isInSpinalArc`, `spinalCanFire`, `spinalLocksShip` and `spinalBeamCatches`
 * were all written, tested against the rulebook, and called by nothing.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
  // Phase 11 is fired in turns from reading 16; these cases are about the
  // mount, so the lance's side is simply handed the turn.
  if (phase === 'ship-fire') game.fire = { side: 'a', sequence: 0 }
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

/** A lance pointed east, with two enemies strung out along the line. */
function lance(): {
  game: GameState
  ship: ShipState
  near: ShipState
  far: ShipState
  aside: ShipState
  weaponId: string
} {
  const design = designById('aethelgard-cruiser') as ShipDesign
  const mount = design.weapons.find(isSpinalMount)
  if (!mount) throw new Error('no spinal mount')
  const ship = createShipState({
    id: 'lance',
    side: 'a',
    design,
    placement: { position: { x: 10, y: 24 }, facing: 3 },
  })
  const enemy = (id: string, x: number, y: number) =>
    createShipState({
      id,
      side: 'b',
      design: designById('nac-destroyer') as ShipDesign,
      placement: { position: { x, y }, facing: 9 },
    })
  // Dead ahead at 10 and 20 MU, and one well off the line.
  const near = enemy('near', 20, 24)
  const far = enemy('far', 30, 24)
  const aside = enemy('aside', 20, 34)
  const game = createGame({
    seed: 0x5b1,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 84, height: 60 },
    ships: [ship, near, far, aside],
  })
  // Reading 6 is where a Spinal Mount stops being a beam; an older battle
  // replays firing it the way it was fought.
  setRulesReading(game, CURRENT_RULES_VERSION)
  return { game, ship, near, far, aside, weaponId: mount.id }
}

const lay = (game: GameState, ship: ShipState, weaponId: string, x: number, y: number) =>
  applyAction(game, { type: 'fire-spinal-mount', shipId: ship.id, weaponId, aimPoint: { x, y } })

const marked = (ship: ShipState) =>
  ship.hullMarked + ship.armourMarked.reduce((a, b) => a + b, 0)

describe('the beam catches what the line crosses', () => {
  it('hits everything down the swathe, not just the thing aimed at', () => {
    const { game, ship, near, far, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    expect(lay(game, ship, weaponId, 30, 24).refused).toBeUndefined()
    expect(marked(near)).toBeGreaterThan(0)
    expect(marked(far)).toBeGreaterThan(0)
  })

  it('leaves a ship off the line alone', () => {
    const { game, ship, aside, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    lay(game, ship, weaponId, 30, 24)
    expect(marked(aside)).toBe(0)
  })

  it('is laid on a point, and the point may be empty space', () => {
    const { game, ship, near, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    // Nothing at 40,24 — but the beam passes over `near` on the way.
    expect(lay(game, ship, weaponId, 40, 24).refused).toBeUndefined()
    expect(marked(near)).toBeGreaterThan(0)
  })

  it('burns fighters and markers out of the line too', () => {
    const { game, ship, weaponId } = lance()
    game.fighterGroups.push({
      id: 'wing',
      side: 'b',
      typeId: 'standard',
      modifiers: [],
      armament: 'beam',
      loadout: null,
      carrierId: null,
      status: 'in-flight',
      position: { x: 22, y: 24 },
      facing: 9,
      strength: 6,
      cef: 6,
      pilots: 'average',
      aceKilled: false,
      mission: 'free',
      escorting: null,
      launchedTurn: null,
      movedThisTurn: false,
      secondaryMovedThisTurn: false,
      evading: false,
      attackedThisTurn: false,
      engagedWith: [],
      payloadSpent: false,
      readyTurn: null,
      grounded: false,
      label: 'Wing',
      recoveredTurn: null,
      targetId: null,
    })
    advanceTo(game, 'ship-fire')
    lay(game, ship, weaponId, 40, 24)
    expect(game.fighterGroups[0]?.status).toBe('destroyed')
  })
})

describe('5.23 the narrow arc', () => {
  it('is half a normal one', () => {
    expect(SPINAL_ARC_DEGREES).toBe(30)
    const origin = { x: 0, y: 0 }
    // Course 3 points along +x; 15 degrees either side is in, 30 is out.
    expect(isInSpinalArc(origin, 3, { x: 10, y: 0 })).toBe(true)
    expect(isInSpinalArc(origin, 3, { x: 10, y: 2 })).toBe(true)
    expect(isInSpinalArc(origin, 3, { x: 10, y: 8 })).toBe(false)
  })

  it('refuses a point outside it', () => {
    const { game, ship, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    const refusal = lay(game, ship, weaponId, 20, 34)
    expect(refusal.refused).toContain('degree arc off the bow')
  })
})

describe('5.23 the reload', () => {
  it('is every other turn', () => {
    expect(spinalCanFire(null, 1)).toBe(true)
    expect(spinalCanFire(1, 2)).toBe(false)
    expect(spinalCanFire(1, 3)).toBe(true)
  })

  it('refuses the second shot on the next turn', () => {
    const { game, ship, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    lay(game, ship, weaponId, 30, 24)
    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(lay(game, ship, weaponId, 30, 24).refused).toContain('reloads every other turn')
    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(lay(game, ship, weaponId, 30, 24).refused).toBeUndefined()
  })
})

describe('5.23 the lockout', () => {
  it('is the turn after, and only that turn', () => {
    expect(spinalLocksShip(null, 3)).toBe(false)
    expect(spinalLocksShip(2, 3)).toBe(true)
    expect(spinalLocksShip(2, 4)).toBe(false)
  })

  it('holds the ship on course whatever it plotted', () => {
    const { game, ship, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    lay(game, ship, weaponId, 30, 24)
    nextTurn(game)
    applyAction(game, { type: 'plot-turn', shipId: ship.id, direction: 'port', points: 2 })
    const facingBefore = ship.placement.facing
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: ship.id })
    expect(ship.placement.facing).toBe(facingBefore)
    expect(game.log.some((entry) => /locked out by its Spinal Mount/.test(entry.text))).toBe(true)
  })

  it('will not let it charge its FTL drive either', () => {
    const { game, ship, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    lay(game, ship, weaponId, 30, 24)
    nextTurn(game)
    const refusal = applyAction(game, { type: 'plot-ftl-exit', shipId: ship.id, on: true })
    expect(refusal.refused).toContain('cannot charge its FTL drive')
  })
})

describe('it is not a beam', () => {
  it('is refused by fire-weapon', () => {
    const { game, ship, near, weaponId } = lance()
    advanceTo(game, 'ship-fire')
    const refusal = applyAction(game, {
      type: 'fire-weapon',
      shipId: ship.id,
      targetId: near.id,
      weaponId,
    })
    expect(refusal.refused).toContain('laid on a point, not a ship')
  })
})
