import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules } from './actions'
import {
  advancePhase,
  createGame,
  createShipState,
  type GameState,
  type ShipState,
  type TerrainFeature,
} from './game'
import { orbitMarkerPosition } from './terrain'
import { designById } from '../data/ships'
import type { Phase, ShipDesign, Streamlining } from './types'

/**
 * 17.8's orbit track and 17.11's atmosphere, from the table.
 *
 * Both were written, tested and reachable by nothing: fifteen exported
 * functions between them and not one caller. A `TerrainFeature` can now carry
 * a track, and a ship that flies into one either makes orbit, decays into the
 * atmosphere, or arrives too fast and does not come out again.
 */

const MERIDIAN: TerrainFeature = {
  id: 'world',
  kind: 'planet',
  position: { x: 48, y: 36 },
  radius: 10,
  label: 'Meridian',
  orbit: { velocity: 6, speed: -1, gravityG: 0.6, landable: true },
}

function hull(over: Partial<ShipDesign> = {}): ShipDesign {
  return { ...(designById('esu-destroyer') as ShipDesign), ...over }
}

/** A ship due north of the world, pointed at it, at the velocity given. */
function approach(velocity: number, design: ShipDesign = hull(), seed = 0x0b17): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 96, height: 72 },
    terrain: [structuredClone(MERIDIAN)],
    ships: [
      createShipState({
        id: 'ship',
        side: 'a',
        design,
        placement: { position: { x: 48, y: 36 + 10 + velocity }, facing: 12 },
        velocity,
      }),
    ],
  })
  setOptionalRules(game, { terrainHazards: true })
  return game
}

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

/** Fly one turn: wind on to the next phase 5, move, and stop there. */
function flyOneTurn(game: GameState, ship = 'ship'): void {
  if (game.phase === 'move-ships') advancePhase(game)
  advanceTo(game, 'move-ships')
  applyAction(game, { type: 'move-ship', shipId: ship })
}

const shipOf = (game: GameState): ShipState => game.ships[0]

describe('arriving at the track (17.8)', () => {
  it('makes orbit at exactly the orbital velocity', () => {
    const game = approach(6)
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.orbit?.featureId).toBe('world')
    // Placed at the nearest marker. The ship comes in from the +y side and
    // course 6 points that way (3.1), so the nearest marker is 6.
    expect(ship.orbit?.marker).toBe(6)
    expect(ship.velocity).toBe(6)
    expect(game.log.some((e) => /makes orbit around Meridian/.test(e.text ?? ''))).toBe(true)
  })

  it('decays into the atmosphere when it arrives too slow', () => {
    const game = approach(4)
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.orbit).toBeNull()
    // Either burnt up or crash-landed, but not still flying.
    expect(ship.destroyed || ship.landed !== null).toBe(true)
    expect(game.log.some((e) => /too slow to hold orbit/.test(e.text ?? ''))).toBe(true)
  })

  it('rams the atmosphere when it arrives too fast, and that is fatal', () => {
    const game = approach(14)
    flyOneTurn(game)
    const ship = shipOf(game)
    // 17.11: an unstreamlined hull is at +4 on a D6 before the excess velocity
    // is counted, so it can never roll the 2 that crash-lands it.
    expect(ship.destroyed).toBe(true)
    expect(game.log.some((e) => /atmosphere at speed/.test(e.text ?? ''))).toBe(true)
  })

  it('leaves a planet with no track alone', () => {
    const game = approach(6)
    delete game.terrain[0].orbit
    flyOneTurn(game)
    expect(shipOf(game).orbit).toBeNull()
  })
})

describe('going round (17.8)', () => {
  it('advances one marker a turn without an order, anticlockwise', () => {
    const game = approach(6)
    flyOneTurn(game)
    expect(shipOf(game).orbit?.marker).toBe(6)
    flyOneTurn(game)
    expect(shipOf(game).orbit?.marker).toBe(5)
    flyOneTurn(game)
    expect(shipOf(game).orbit?.marker).toBe(4)
  })

  it('faces the tangent, three points round from the marker', () => {
    const game = approach(6)
    flyOneTurn(game)
    // Marker 6, running anticlockwise, so the bow points three round at 3.
    expect(shipOf(game).placement.facing).toBe(3)
  })

  it('leaves on the tangent when it accelerates', () => {
    const game = approach(6)
    flyOneTurn(game)
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-accel', shipId: 'ship', accel: 2 })
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.orbit).toBeNull()
    expect(ship.velocity).toBe(8)
    expect(ship.placement.facing).toBe(3)
    expect(game.log.some((e) => /accelerates out of orbit/.test(e.text ?? ''))).toBe(true)
  })

  it('falls into the atmosphere when it slows without meaning to', () => {
    const game = approach(6)
    flyOneTurn(game)
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-accel', shipId: 'ship', accel: -2 })
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.orbit).toBeNull()
    expect(game.log.some((e) => /slows below orbital velocity/.test(e.text ?? ''))).toBe(true)
  })
})

describe('landing on purpose (17.11)', () => {
  const streamlined = (streamlining: Streamlining) => hull({ streamlining })

  it('puts a fully streamlined ship down on any thrust at all', () => {
    const game = approach(6, streamlined('full'))
    flyOneTurn(game)
    advanceTo(game, 'orders')
    expect(applyAction(game, { type: 'plot-landing', shipId: 'ship', on: true }).refused).toBeUndefined()
    applyAction(game, { type: 'plot-accel', shipId: 'ship', accel: -2 })
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.landed).toBe('landed')
    expect(ship.offTable).toBe(true)
    expect(ship.destroyed).toBe(false)
  })

  it('lands a partially streamlined ship that out-pushes the gravity', () => {
    const game = approach(6, streamlined('partial'))
    flyOneTurn(game)
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-landing', shipId: 'ship', on: true })
    applyAction(game, { type: 'plot-accel', shipId: 'ship', accel: -1 })
    flyOneTurn(game)
    // Meridian is 0.6G and an ESU destroyer has thrust to spare.
    expect(shipOf(game).landed).toBe('landed')
  })

  it('will not let an unstreamlined hull land, whatever it declares', () => {
    const game = approach(6, streamlined('none'))
    flyOneTurn(game)
    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-landing', shipId: 'ship', on: true })
    applyAction(game, { type: 'plot-accel', shipId: 'ship', accel: -1 })
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.landed).not.toBe('landed')
    expect(ship.destroyed || ship.landed === 'crash-landed').toBe(true)
  })

  it('refuses the order from a ship that is not in orbit', () => {
    const game = approach(6, streamlined('full'))
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'plot-landing', shipId: 'ship', on: true }).refused,
    ).toMatch(/must be in orbit/)
  })

  it('refuses it over a world nobody can land on', () => {
    const game = approach(6, streamlined('full'))
    game.terrain[0].orbit = { ...MERIDIAN.orbit!, landable: false }
    flyOneTurn(game)
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'plot-landing', shipId: 'ship', on: true }).refused,
    ).toMatch(/cannot be landed on/)
  })
})

describe('firing from the track (17.8)', () => {
  function twoInOrbit(markerGap: number): GameState {
    // A hull with an all-round Beam-1, so a refusal is about the track rather
    // than about the arc.
    const game = approach(6, designById('esu-battleship') as ShipDesign)
    // A second hull, put straight onto the track at a chosen marker.
    const enemy = createShipState({
      id: 'enemy',
      side: 'b',
      design: hull(),
      placement: { position: { x: 48, y: 46 }, facing: 6 },
      velocity: 6,
    })
    game.ships.push(enemy)
    flyOneTurn(game)
    const mine = shipOf(game)
    expect(mine.orbit).not.toBeNull()
    const marker = mine.orbit!.marker
    const at = (((marker + markerGap - 1) % 12) + 1) as 1
    enemy.orbit = { featureId: 'world', marker: at }
    enemy.placement = {
      position: orbitMarkerPosition(
        {
          center: MERIDIAN.position,
          radius: MERIDIAN.radius,
          orbitalVelocity: 6,
          orbitSpeed: -1,
        },
        at,
      ),
      facing: 12,
    }
    return game
  }

  it('lets a ship shoot the marker ahead of it', () => {
    // Running anticlockwise, so the marker ahead is one lower. The one behind
    // sits in the aft arc, where 4.2 bans the shot for reasons of its own.
    const game = twoInOrbit(-1)
    advanceTo(game, 'ship-fire')
    // The all-round Beam-1, so the arc is never the reason for a refusal.
    const weapon = shipOf(game).design.weapons.find((w) => w.arcs.length === 6)!
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'ship',
      weaponId: weapon.id,
      targetId: 'enemy',
    })
    expect(outcome.refused).toBeUndefined()
  })

  it('refuses a shot round the other side of the world', () => {
    const game = twoInOrbit(6)
    advanceTo(game, 'ship-fire')
    const weapon = shipOf(game).design.weapons.find((w) => w.arcs.length === 6)!
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'ship',
      weaponId: weapon.id,
      targetId: 'enemy',
    })
    expect(outcome.refused).toMatch(/other side of the track/)
  })
})

describe('the simple way (17.10)', () => {
  function objective(velocity: number, passBy: number): GameState {
    const game = createGame({
      seed: 0x51,
      sides: [{ id: 'a' }, { id: 'b' }],
      table: { width: 96, height: 72 },
      terrain: [
        {
          id: 'rock',
          kind: 'planetoid',
          position: { x: 48, y: 36 },
          radius: 1,
          label: 'the objective',
          simpleOrbit: true,
        },
      ],
      ships: [
        createShipState({
          id: 'ship',
          side: 'a',
          design: hull(),
          // Flies straight past, offset so the closest approach is `passBy`
          // and the run spans the objective.
          placement: { position: { x: 48 - velocity / 2, y: 36 + passBy }, facing: 3 },
          velocity,
        }),
      ],
    })
    setOptionalRules(game, { terrainHazards: true })
    return game
  }

  it('parks a ship that passes the band at the right speed', () => {
    const game = objective(7, 3)
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.destroyed).toBe(false)
    expect(ship.velocity).toBe(0)
    expect(game.log.some((e) => /settles into orbit over the objective/.test(e.text ?? ''))).toBe(true)
  })

  it('crashes a ship that cuts inside two MU', () => {
    const game = objective(7, 1)
    flyOneTurn(game)
    expect(shipOf(game).destroyed).toBe(true)
    expect(game.log.some((e) => /gravity well and crashes/.test(e.text ?? ''))).toBe(true)
  })

  it('lets a ship at the wrong speed fly past unharmed', () => {
    const game = objective(12, 3)
    flyOneTurn(game)
    const ship = shipOf(game)
    expect(ship.destroyed).toBe(false)
    expect(ship.velocity).toBe(12)
    expect(game.log.some((e) => /settles into orbit/.test(e.text ?? ''))).toBe(false)
  })

  it('ignores a body that is not playing 17.10', () => {
    const game = objective(7, 3)
    game.terrain[0].simpleOrbit = false
    flyOneTurn(game)
    expect(shipOf(game).velocity).toBe(7)
  })
})
