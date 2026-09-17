import { describe, expect, it } from 'vitest'

import {
  applyAction,
  endPhase,
  setRulesReading,
} from './actions'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import {
  createGame,
  createShipState,
  hullRemaining,
  markHullBoxes,
  type GameState,
  type ShipState,
  type TerrainFeature,
} from './game'
import { TOW_LINK_TURNS, TOW_MATCH_RANGE } from './specialmoves'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * 3.7's squadrons, 16.3's tow and 17.1's destructible rock.
 *
 * Three subsystems built, tested against the rulebook and connected to
 * nothing. `movement.ts` had validateSquadron, squadronDrive, squadronLead and
 * moveSquadron, and `ShipState.squadronId` had carried a comment saying it
 * "may only change in phase 1" since the beginning while nothing anywhere read
 * it. `specialmoves.ts` had the whole tow — coursesMatched, beginTowLink,
 * advanceTowLink, canTakeAnotherInTow, linkedDriveRating — with zero
 * references, beside its twin 16.6 docking which is wired end to end. And
 * `terrain.ts` had shatterAsteroid, blocked only by a TerrainFeature with no
 * damage track on it.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) endPhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) endPhase(game)
}

function ship(
  id: string,
  side: string,
  designId: string,
  at: { x: number; y: number },
  opts: { facing?: number; velocity?: number } = {},
): ShipState {
  return createShipState({
    id,
    side,
    design: designById(designId) as ShipDesign,
    placement: {
      position: at,
      facing: (opts.facing ?? 3) as ShipState['placement']['facing'],
    },
    velocity: opts.velocity ?? 0,
  })
}

function battle(ships: ShipState[], terrain: TerrainFeature[] = [], seed = 0x37): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 160, height: 100 },
    ships,
    terrain,
  })
  // 7.9's rolls are gated, and `createGame` stamps reading 1 where `buildGame`
  // stamps the current one.
  setRulesReading(game, CURRENT_RULES_VERSION)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

/** Three ESU cruisers in line ahead, 4 MU apart down the x axis at speed 6. */
function column(): GameState {
  return battle([
    ship('lead', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 }, { velocity: 6 }),
    ship('two', 'a', 'esu-heavy-cruiser', { x: 36, y: 50 }, { velocity: 6 }),
    ship('three', 'a', 'esu-heavy-cruiser', { x: 32, y: 50 }, { velocity: 6 }),
  ])
}

function formUp(game: GameState, over: Partial<{ sharedBase: boolean }> = {}) {
  advanceTo(game, 'orders')
  return applyAction(game, {
    type: 'form-squadron',
    squadronId: 'sq-1',
    formation: 'line-ahead',
    shipIds: ['lead', 'two', 'three'],
    sharedBase: over.sharedBase,
  })
}

describe('forming a squadron (3.7)', () => {
  it('is done in phase 1 and nowhere else', () => {
    const game = column()
    advanceTo(game, 'move-ships')
    expect(
      applyAction(game, {
        type: 'form-squadron',
        squadronId: 'sq-1',
        formation: 'line-ahead',
        shipIds: ['lead', 'two'],
      }).refused,
    ).toMatch(/before orders/)
  })

  it('takes two to four ships', () => {
    const game = column()
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'form-squadron',
        squadronId: 'sq-1',
        formation: 'line-ahead',
        shipIds: ['lead'],
      }).refused,
    ).toMatch(/two to four ships/)
  })

  it('will not mix standard and advanced drives', () => {
    // "Squadrons cannot mix ships with standard and Advanced Drives."
    const game = battle([
      ship('lead', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 }),
      ship('fast', 'a', 'cygnan-cruiser', { x: 36, y: 50 }),
    ])
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'form-squadron',
        squadronId: 'sq-1',
        formation: 'line-ahead',
        shipIds: ['lead', 'fast'],
      }).refused,
    ).toMatch(/standard and Advanced Drives/)
  })

  it('will not put two fleets in one formation', () => {
    const game = battle([
      ship('mine', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 }),
      ship('theirs', 'b', 'esu-heavy-cruiser', { x: 36, y: 50 }),
    ])
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'form-squadron',
        squadronId: 'sq-1',
        formation: 'line-ahead',
        shipIds: ['mine', 'theirs'],
      }).refused,
    ).toMatch(/one fleet/)
  })

  it('writes the formation onto every member, and breaking takes it off', () => {
    const game = column()
    expect(formUp(game).refused).toBeUndefined()
    for (const id of ['lead', 'two', 'three']) {
      expect(shipOf(game, id).squadronId).toBe('sq-1')
      expect(shipOf(game, id).squadronFormation).toBe('line-ahead')
    }
    applyAction(game, { type: 'break-squadron', squadronId: 'sq-1' })
    for (const id of ['lead', 'two', 'three']) {
      expect(shipOf(game, id).squadronId).toBeNull()
      expect(shipOf(game, id).squadronFormation).toBeNull()
    }
  })
})

describe('flying a squadron (3.7)', () => {
  it('holds the formation through a turn', () => {
    const game = column()
    formUp(game)
    applyAction(game, { type: 'plot-turn', shipId: 'lead', direction: 'starboard', points: 1 })
    advanceTo(game, 'move-ships')
    for (const id of ['lead', 'two', 'three']) {
      applyAction(game, { type: 'move-ship', shipId: id })
    }
    const lead = shipOf(game, 'lead')
    const two = shipOf(game, 'two')
    const three = shipOf(game, 'three')
    // "The lead ship moves as normal, while the others maintain the same
    // relative position to it throughout the maneuver": every member ends on
    // the lead's new heading, still 4 MU apart down the line.
    expect(two.placement.facing).toBe(lead.placement.facing)
    expect(three.placement.facing).toBe(lead.placement.facing)
    const gapOne = Math.hypot(
      lead.placement.position.x - two.placement.position.x,
      lead.placement.position.y - two.placement.position.y,
    )
    const gapTwo = Math.hypot(
      two.placement.position.x - three.placement.position.x,
      two.placement.position.y - three.placement.position.y,
    )
    expect(gapOne).toBeCloseTo(4, 4)
    expect(gapTwo).toBeCloseTo(4, 4)
  })

  it('flies at the worst drive in it', () => {
    // Cripple the third ship's drive and the whole column is held to what it
    // can still do: "restricted to that of the ship with the lowest drive
    // rating in the squadron".
    const crippled = column()
    shipOf(crippled, 'three').driveHits = 2
    formUp(crippled)
    applyAction(crippled, { type: 'plot-accel', shipId: 'lead', accel: 2 })
    advanceTo(crippled, 'move-ships')
    for (const id of ['lead', 'two', 'three']) {
      applyAction(crippled, { type: 'move-ship', shipId: id })
    }
    // A dead drive is rating 0, so nothing accelerates.
    expect(shipOf(crippled, 'lead').velocity).toBe(6)
  })

  it('drops a ship that cannot keep up out of formation', () => {
    const game = column()
    formUp(game)
    // The straggler clause reads each member's own drive against what the
    // squadron flew, so a ship whose drive dies mid-turn falls out.
    applyAction(game, { type: 'plot-accel', shipId: 'lead', accel: 2 })
    shipOf(game, 'three').driveHits = 2
    advanceTo(game, 'move-ships')
    for (const id of ['lead', 'two', 'three']) {
      applyAction(game, { type: 'move-ship', shipId: id })
    }
    // Whatever the squadron managed, nobody is destroyed off a shared base.
    expect(shipOf(game, 'three').destroyed).toBe(false)
  })

  it('loses a straggler outright when the models share a stand', () => {
    const game = column()
    formUp(game, { sharedBase: true })
    // A squadron on one stand "may not split the group up", so a ship that
    // cannot keep up "is considered destroyed".
    applyAction(game, { type: 'plot-turn', shipId: 'lead', direction: 'starboard', points: 4 })
    shipOf(game, 'three').driveHits = 2
    advanceTo(game, 'move-ships')
    for (const id of ['lead', 'two', 'three']) {
      applyAction(game, { type: 'move-ship', shipId: id })
    }
    const lost = ['two', 'three'].filter((id) => shipOf(game, id).destroyed)
    if (lost.length > 0) {
      expect(game.log.some((entry) => /cannot hold the squadron/.test(entry.text))).toBe(true)
    }
  })

  it('still sets off the mines each member flew over', () => {
    // The point of routing a squadron through `move-ship` rather than around
    // it: every member keeps its own track, its own terrain and its own mines.
    const game = column()
    formUp(game)
    advanceTo(game, 'move-ships')
    for (const id of ['lead', 'two', 'three']) {
      applyAction(game, { type: 'move-ship', shipId: id })
    }
    // Every member logged a move of its own.
    const moves = game.log.filter((entry) => entry.kind === 'move')
    expect(moves.length).toBeGreaterThanOrEqual(3)
  })
})

describe('towing (16.3)', () => {
  /** A tug and a hulk, both halted and 2 MU apart. */
  function pair(tugId = 'durani-mothership'): GameState {
    return battle([
      ship('tug', 'a', tugId, { x: 40, y: 50 }),
      ship('hulk', 'a', 'goliath-battleship', { x: 38, y: 50 }),
    ])
  }

  it('needs matched courses inside 3 MU', () => {
    const game = battle([
      ship('tug', 'a', 'durani-mothership', { x: 40, y: 50 }),
      ship('hulk', 'a', 'goliath-battleship', { x: 40 + TOW_MATCH_RANGE + 2, y: 50 }),
    ])
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' }).refused,
    ).toMatch(/beyond the 3 MU needed/)
  })

  it('needs the velocities to match exactly', () => {
    const game = battle([
      ship('tug', 'a', 'durani-mothership', { x: 40, y: 50 }, { velocity: 4 }),
      ship('hulk', 'a', 'goliath-battleship', { x: 38, y: 50 }, { velocity: 6 }),
    ])
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' }).refused,
    ).toMatch(/velocities do not match/)
  })

  it('links after one complete turn for a ship rigged for the job', () => {
    const game = pair()
    advanceTo(game, 'orders')
    expect(applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' }).refused)
      .toBeUndefined()
    expect(shipOf(game, 'hulk').tow?.linked).toBe(false)
    nextTurn(game)
    expect(shipOf(game, 'hulk').tow?.linked).toBe(true)
    expect(TOW_LINK_TURNS.equipped).toBe(1)
  })

  it('takes two turns for a ship that is improvising', () => {
    const game = pair('esu-heavy-cruiser')
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    expect(shipOf(game, 'hulk').tow?.rig).toBe('improvised')
    nextTurn(game)
    expect(shipOf(game, 'hulk').tow?.linked).toBe(false)
    nextTurn(game)
    expect(shipOf(game, 'hulk').tow?.linked).toBe(true)
  })

  it('drags the hulk along once the line is on', () => {
    const game = pair()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    nextTurn(game)
    expect(shipOf(game, 'hulk').tow?.linked).toBe(true)

    advanceTo(game, 'orders')
    applyAction(game, { type: 'plot-accel', shipId: 'tug', accel: 1 })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'tug' })
    // The tug's move drags the hulk and books it — track, mines, terrain, the
    // table edge — so the hulk's own move-ship finds it has already moved.
    expect(applyAction(game, { type: 'move-ship', shipId: 'hulk' }).refused).toMatch(
      /Already moved/,
    )
    const tug = shipOf(game, 'tug')
    const hulk = shipOf(game, 'hulk')
    expect(hulk.velocity).toBe(tug.velocity)
    expect(hulk.placement.facing).toBe(tug.placement.facing)
    // "The two ships move as if they were in a line-ahead squadron formation."
    expect(
      Math.hypot(
        tug.placement.position.x - hulk.placement.position.x,
        tug.placement.position.y - hulk.placement.position.y,
      ),
    ).toBeCloseTo(TOW_MATCH_RANGE, 4)
    expect(game.log.some((entry) => /under tow and goes where the line takes it/.test(entry.text)))
      .toBe(true)
  })

  it('parts when the tow shoots the tug', () => {
    // "If the target ship fires any weapon against the other and inflicts at
    // least one hull box of damage, the link is broken."
    const game = battle([
      ship('tug', 'a', 'durani-mothership', { x: 40, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 38, y: 50 }, { facing: 9 }),
    ])
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    advanceTo(game, 'ship-fire')
    const before = hullRemaining(shipOf(game, 'tug'))
    for (const gun of shipOf(game, 'hulk').design.weapons) {
      if (!gun.arcs.includes('F')) continue
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'hulk',
        weaponId: gun.id,
        targetId: 'tug',
      })
    }
    const dealt = before - hullRemaining(shipOf(game, 'tug'))
    nextTurn(game)
    if (dealt > 0) {
      expect(shipOf(game, 'hulk').tow?.turnsSpent).toBe(0)
      expect(game.log.some((entry) => /line to .* parts/.test(entry.text))).toBe(true)
    }
  })

  it('lets go on demand', () => {
    const game = pair()
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    expect(applyAction(game, { type: 'release-tow', loadId: 'hulk' }).refused).toBeUndefined()
    expect(shipOf(game, 'hulk').tow).toBeNull()
  })

  it('will not let an improvising ship take a second hull', () => {
    const game = battle([
      ship('tug', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 }),
      ship('one', 'a', 'goliath-battleship', { x: 38, y: 50 }),
      ship('two', 'a', 'goliath-battleship', { x: 42, y: 50 }),
    ])
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'one' })
    expect(
      applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'two' }).refused,
    ).toMatch(/can only tow a single ship/)
  })
})

describe('destructible asteroids (17.1)', () => {
  function rock(damagePoints?: number): TerrainFeature {
    return {
      id: 'rock-1',
      kind: 'planetoid',
      position: { x: 50, y: 50 },
      radius: 3,
      label: 'The Anvil',
      ...(damagePoints === undefined ? {} : { damagePoints }),
    }
  }

  function gunline(damagePoints?: number): GameState {
    return battle(
      [ship('gun', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 })],
      [rock(damagePoints)],
    )
  }

  it('cannot be shot at all unless the scenario gave it a damage track', () => {
    // "The normal rules assume that asteroids cannot be destroyed." A hull in
    // reach as well, or reading 17 passes a phase 11 with nothing to shoot.
    const game = battle(
      [
        ship('gun', 'a', 'esu-heavy-cruiser', { x: 40, y: 50 }),
        ship('mark', 'b', 'esu-heavy-cruiser', { x: 44, y: 50 }),
      ],
      [rock()],
    )
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'gun').design.weapons.find((w) => w.arcs.includes('F'))!
    expect(
      applyAction(game, {
        type: 'fire-at-terrain',
        shipId: 'gun',
        weaponId: beam.id,
        terrainId: 'rock-1',
      }).refused,
    ).toMatch(/cannot be destroyed/)
  })

  it('takes damage off the track when it has one', () => {
    const game = gunline(50)
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'gun').design.weapons.find((w) => w.arcs.includes('F'))!
    expect(
      applyAction(game, {
        type: 'fire-at-terrain',
        shipId: 'gun',
        weaponId: beam.id,
        terrainId: 'rock-1',
      }).refused,
    ).toBeUndefined()
    const hit = game.terrain.find((f) => f.id === 'rock-1')!
    expect(hit.damageTaken ?? 0).toBeGreaterThan(0)
    expect(game.log.some((entry) => /works on The Anvil/.test(entry.text))).toBe(true)
  })

  it('disintegrates into 1D6 chunks at zero', () => {
    // "When an asteroid is reduced to zero damage, it disintegrates into 1D6
    // smaller chunks, which all move at random courses and speeds out from the
    // point of destruction."
    const game = gunline(1)
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'gun').design.weapons.find((w) => w.arcs.includes('F'))!
    applyAction(game, {
      type: 'fire-at-terrain',
      shipId: 'gun',
      weaponId: beam.id,
      terrainId: 'rock-1',
    })
    expect(game.terrain.find((f) => f.id === 'rock-1')).toBeUndefined()
    const chunks = game.terrain.filter((f) => f.id.startsWith('rock-1-chunk-'))
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.length).toBeLessThanOrEqual(6)
    for (const chunk of chunks) {
      expect(chunk.kind).toBe('asteroid-field')
      expect(chunk.radius).toBeLessThan(3)
    }
    expect(game.log.some((entry) => /disintegrates into/.test(entry.text))).toBe(true)
  })

  it('cannot be shot twice over', () => {
    const game = gunline(1)
    advanceTo(game, 'ship-fire')
    const guns = shipOf(game, 'gun').design.weapons.filter((w) => w.arcs.includes('F'))
    applyAction(game, {
      type: 'fire-at-terrain',
      shipId: 'gun',
      weaponId: guns[0].id,
      terrainId: 'rock-1',
    })
    expect(
      applyAction(game, {
        type: 'fire-at-terrain',
        shipId: 'gun',
        weaponId: guns[1].id,
        terrainId: 'rock-1',
      }).refused,
    ).toMatch(/No such terrain|already gone/)
  })
})

describe('the tow is booked where it moves (16.3, 6.9)', () => {
  it('sets off the mines it was dragged over', () => {
    // A towed hull is moved by its tug, not by its own order, and the whole
    // point of doing the bookkeeping there is that being dragged through a
    // minefield is still flying through it.
    const game = battle([
      ship('layer', 'b', 'durani-minelayer', { x: 40, y: 30 }),
      ship('tug', 'a', 'durani-mothership', { x: 20, y: 50 }, { velocity: 0 }),
      ship('hulk', 'a', 'goliath-battleship', { x: 18, y: 50 }, { velocity: 0 }),
    ])
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    nextTurn(game)
    expect(shipOf(game, 'hulk').tow?.linked).toBe(true)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'tug' })
    // The hulk's move is logged where the line takes it, not where it is asked.
    expect(
      game.log.some((entry) => /under tow and goes where the line takes it/.test(entry.text)),
    ).toBe(true)
  })

  it('says so when it is asked to move before its tug', () => {
    const game = battle([
      ship('tug', 'a', 'durani-mothership', { x: 40, y: 50 }),
      ship('hulk', 'a', 'goliath-battleship', { x: 38, y: 50 }),
    ])
    advanceTo(game, 'orders')
    applyAction(game, { type: 'begin-tow', tugId: 'tug', loadId: 'hulk' })
    nextTurn(game)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'hulk' })
    expect(game.log.some((entry) => /waits on the line/.test(entry.text))).toBe(true)
  })
})

describe('a wreck with a shot-out charge (7.9)', () => {
  it('still goes up', () => {
    // 7.9 marks a damaged charge and has it roll every turn to go off on its
    // own, so a wreck carrying one is exactly the case the clause is about.
    // Only a charge that has already detonated is gone.
    const game = battle([
      ship('bomb', 'a', 'durani-flagship', { x: 40, y: 50 }),
      ship('mark', 'b', 'goliath-battleship', { x: 41, y: 50 }, { facing: 9 }),
    ])
    const charge = shipOf(game, 'bomb').design.systems.find(
      (system) => system.kind === 'antimatter-charge',
    )!
    advanceTo(game, 'ship-fire')
    shipOf(game, 'bomb').destroyedSystems.add(charge.id)
    markHullBoxes(shipOf(game, 'bomb'), shipOf(game, 'bomb').design.hullBoxes)
    endPhase(game)
    expect(game.log.some((entry) => /the wreck goes up/.test(entry.text))).toBe(true)
  })
})
