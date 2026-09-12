import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { combatLandingAvailable, flightOrders, bearingAwayFrom, type FlightOrderKind } from './flightorders'
import { createFighterGroup } from './fighters'
import { advancePhase, createGame, createShipState, type FighterGroupState, type GameState, type ShipState } from './game'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Every order a fighter group can be given, and whether a player can give it.
 *
 * Fifteen of section 8's actions were reachable from the engine's API, from
 * the tests, and from nothing on the screen. `flightOrders` is what the panel
 * renders, so this is the test that says a control exists — and, for each one,
 * that the action it would send is actually accepted rather than refused.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

const kinds = (game: GameState, flight: FighterGroupState): FlightOrderKind[] =>
  flightOrders(game, flight).map((order) => order.kind)

interface Table {
  game: GameState
  ours: FighterGroupState
  theirs: FighterGroupState
  carrier: ShipState
  enemy: ShipState
}

function table(
  opts: {
    typeId?: Parameters<typeof createFighterGroup>[0]['typeId']
    modifiers?: Parameters<typeof createFighterGroup>[0]['modifiers']
    pilots?: 'average' | 'ace' | 'turkey'
    status?: 'aboard' | 'in-flight'
    at?: { x: number; y: number }
    facing?: 1|2|3|4|5|6|7|8|9|10|11|12
    enemyAt?: { x: number; y: number }
  } = {},
): Table {
  const carrier = createShipState({
    id: 'carrier',
    side: 'a',
    design: designById('esu-carrier') as ShipDesign,
    placement: { position: { x: 30, y: 24 }, facing: 3 },
  })
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-heavy-cruiser') as ShipDesign,
    placement: { position: { x: 36, y: 24 }, facing: 9 },
  })
  const ours = {
    ...createFighterGroup({
      id: 'ours',
      side: 'a',
      typeId: opts.typeId ?? 'standard',
      modifiers: opts.modifiers,
      pilots: opts.pilots,
      carrierId: 'carrier',
      status: opts.status ?? 'in-flight',
      position: opts.at ?? { x: 33, y: 24 },
      // 8.7 gives a group a front 180 degree arc, so the default table has it
      // pointed at the enemy — otherwise every attack test is testing the arc.
      facing: opts.facing ?? 3,
    }),
    side: 'a',
    label: 'Ours',
    recoveredTurn: null,
    targetId: null,
  } as FighterGroupState
  const theirs = {
    ...createFighterGroup({
      id: 'theirs',
      side: 'b',
      typeId: 'standard',
      status: 'in-flight',
      position: opts.enemyAt ?? { x: 34, y: 24 },
    }),
    side: 'b',
    label: 'Theirs',
    recoveredTurn: null,
    targetId: null,
  } as FighterGroupState
  const game = createGame({
    seed: 0xf19,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 72, height: 48 },
    ships: [carrier, enemy],
    fighterGroups: [ours, theirs],
  })
  return { game, ours, theirs, carrier, enemy }
}

describe('phase 1, in the bay (8.15)', () => {
  it('offers a Multi-Role group its loadouts', () => {
    const t = table({ typeId: 'multi-role', status: 'aboard' })
    expect(kinds(t.game, t.ours)).toContain('rearm')
    const order = flightOrders(t.game, t.ours).find((o) => o.kind === 'rearm')
    // Three loadouts against two armaments (8.15).
    expect(order?.options).toHaveLength(6)
  })

  it('offers nothing to a group that is not Multi-Role', () => {
    const t = table({ status: 'aboard' })
    expect(kinds(t.game, t.ours)).not.toContain('rearm')
  })

  it('offers nothing to a Multi-Role group already in the air', () => {
    const t = table({ typeId: 'multi-role', status: 'in-flight' })
    expect(kinds(t.game, t.ours)).not.toContain('rearm')
  })

  it('lets FTL fighters start in space, on turn one only', () => {
    const t = table({ modifiers: ['ftl'], status: 'aboard' })
    expect(kinds(t.game, t.ours)).toContain('ftl-deploy')
    advancePhase(t.game)
    let guard = 40
    while (t.game.turn === 1 && guard-- > 0) advancePhase(t.game)
    advanceTo(t.game, 'orders')
    expect(kinds(t.game, t.ours)).not.toContain('ftl-deploy')
  })
})

describe('phase 3, the salvo (8.15)', () => {
  it('offers a Missile Fighter group its one shot', () => {
    const t = table({ typeId: 'missile' })
    advanceTo(t.game, 'launch-missiles')
    expect(kinds(t.game, t.ours)).toContain('salvo')
  })

  it('offers it nothing once the payload is spent', () => {
    const t = table({ typeId: 'missile' })
    t.ours.payloadSpent = true
    advanceTo(t.game, 'launch-missiles')
    expect(kinds(t.game, t.ours)).not.toContain('salvo')
  })

  it('offers a standard group nothing', () => {
    const t = table()
    advanceTo(t.game, 'launch-missiles')
    expect(kinds(t.game, t.ours)).not.toContain('salvo')
  })
})

describe('phase 4, station keeping (8.3, 8.6)', () => {
  it('offers a screen and a scramble in the right states', () => {
    const flying = table()
    advanceTo(flying.game, 'move-fighters')
    expect(kinds(flying.game, flying.ours)).toContain('screen')

    const inBay = table({ status: 'aboard' })
    advanceTo(inBay.game, 'move-fighters')
    inBay.theirs.movedThisTurn = true
    expect(kinds(inBay.game, inBay.ours)).toContain('scramble')
    expect(kinds(inBay.game, inBay.ours)).not.toContain('screen')
  })

  it('offers pursuit only of what the group attacked last turn', () => {
    const t = table()
    advanceTo(t.game, 'move-fighters')
    expect(kinds(t.game, t.ours)).not.toContain('pursue')
    t.ours.lastTargetId = 'theirs'
    expect(kinds(t.game, t.ours)).toContain('pursue')
  })

  it('offers a group on a mission the way out of it', () => {
    const t = table()
    advanceTo(t.game, 'move-fighters')
    expect(kinds(t.game, t.ours)).not.toContain('clear-mission')
    t.ours.mission = 'screen'
    expect(kinds(t.game, t.ours)).toContain('clear-mission')
  })

  it('does not offer a scramble with no enemy near the carrier', () => {
    const t = table({ status: 'aboard', enemyAt: { x: 5, y: 5 } })
    t.theirs.movedThisTurn = true
    advanceTo(t.game, 'move-fighters')
    expect(kinds(t.game, t.ours)).not.toContain('scramble')
  })

  it('does not offer a scramble against a group that has not just moved', () => {
    // 8.3 is "the opponent has just moved one or more fighter groups into
    // position", not "there are enemy fighters about".
    const t = table({ status: 'aboard' })
    advanceTo(t.game, 'move-fighters')
    expect(kinds(t.game, t.ours)).not.toContain('scramble')
  })
})

describe('phase 8, the dogfight (8.10, 8.11)', () => {
  it('offers a way out to a group that is engaged', () => {
    const t = table()
    advanceTo(t.game, 'fighter-vs-fighter')
    expect(kinds(t.game, t.ours)).not.toContain('refuse-dogfight')
    t.ours.engagedWith = ['theirs']
    expect(kinds(t.game, t.ours)).toContain('refuse-dogfight')
  })

  it('sends the runner directly away from whoever caught it', () => {
    const t = table({ at: { x: 40, y: 24 }, enemyAt: { x: 34, y: 24 } })
    advanceTo(t.game, 'fighter-vs-fighter')
    t.ours.engagedWith = ['theirs']
    const order = flightOrders(t.game, t.ours).find((o) => o.kind === 'refuse-dogfight')
    const action = order?.options[0]?.action
    if (!action || action.type !== 'refuse-dogfight') throw new Error('no run')
    // The threat is to the west, so the run is east — course 3.
    expect(action.facing).toBe(3)
    expect(action.to.x).toBeGreaterThan(t.ours.position.x)
  })

  it('offers a furball only when both sides have more than one group in it', () => {
    const t = table()
    advanceTo(t.game, 'fighter-vs-fighter')
    expect(kinds(t.game, t.ours)).not.toContain('furball')
    for (const [id, side, x] of [
      ['ours2', 'a', 33],
      ['theirs2', 'b', 35],
    ] as const) {
      t.game.fighterGroups.push({
        ...createFighterGroup({
          id,
          side,
          typeId: 'standard',
          status: 'in-flight',
          position: { x, y: 24 },
        }),
        side,
        label: id,
        recoveredTurn: null,
        targetId: null,
      } as FighterGroupState)
    }
    expect(kinds(t.game, t.ours)).toContain('furball')
  })

  it('names every group on both sides in the furball it builds', () => {
    const t = table()
    advanceTo(t.game, 'fighter-vs-fighter')
    for (const [id, side, x] of [
      ['ours2', 'a', 33],
      ['theirs2', 'b', 35],
    ] as const) {
      t.game.fighterGroups.push({
        ...createFighterGroup({
          id,
          side,
          typeId: 'standard',
          status: 'in-flight',
          position: { x, y: 24 },
        }),
        side,
        label: id,
        recoveredTurn: null,
        targetId: null,
      } as FighterGroupState)
    }
    const order = flightOrders(t.game, t.ours).find((o) => o.kind === 'furball')
    if (!order?.action || order.action.type !== 'flight-furball') throw new Error('no furball')
    expect(order.action.entries.map((e) => e.flightId).sort()).toEqual(['ours', 'ours2'])
    expect(order.action.entries[0]?.targetFlightIds.sort()).toEqual(['theirs', 'theirs2'])
  })
})

describe('phase 9, into the missiles (8.9)', () => {
  it('offers an interception when a salvo is in reach', () => {
    const t = table()
    advanceTo(t.game, 'point-defence')
    expect(kinds(t.game, t.ours)).not.toContain('intercept')
    t.game.ordnance.push({
      id: 'salvo',
      side: 'b',
      sourceShipId: 'enemy',
      kind: 'salvo',
      grade: 'standard',
      missiles: 6,
      position: { x: 34, y: 24 },
      launchedTurn: 1,
      stagesRemaining: 0,
      targetShipId: null,
    })
    expect(kinds(t.game, t.ours)).toContain('intercept')
  })

  it('offers nothing to a group with no endurance left', () => {
    const t = table()
    t.ours.cef = 0
    advanceTo(t.game, 'point-defence')
    t.game.ordnance.push({
      id: 'salvo',
      side: 'b',
      sourceShipId: 'enemy',
      kind: 'salvo',
      grade: 'standard',
      missiles: 6,
      position: { x: 34, y: 24 },
      launchedTurn: 1,
      stagesRemaining: 0,
      targetShipId: null,
    })
    expect(kinds(t.game, t.ours)).not.toContain('intercept')
  })
})

describe('phases 10 and 11, the attack run (8.9, 8.15, 8.18)', () => {
  it('offers a Torpedo group its payload', () => {
    const t = table({ typeId: 'torpedo' })
    advanceTo(t.game, 'ordnance-vs-ships')
    expect(kinds(t.game, t.ours)).toContain('payload')
    t.ours.payloadSpent = true
    expect(kinds(t.game, t.ours)).not.toContain('payload')
  })

  it('offers an Assault Shuttle group a boarding run', () => {
    const t = table({ typeId: 'assault-shuttle' })
    advanceTo(t.game, 'ordnance-vs-ships')
    expect(kinds(t.game, t.ours)).toContain('boarding-run')
  })

  it('offers an Ace the needle shot, and only against a named target', () => {
    const t = table({ pilots: 'ace' })
    advanceTo(t.game, 'ordnance-vs-ships')
    expect(kinds(t.game, t.ours)).not.toContain('ace-needle')
    t.ours.targetId = 'enemy'
    expect(kinds(t.game, t.ours)).toContain('ace-needle')
  })

  it('offers no needle shot to a group with no Ace', () => {
    const t = table()
    t.ours.targetId = 'enemy'
    advanceTo(t.game, 'ordnance-vs-ships')
    expect(kinds(t.game, t.ours)).not.toContain('ace-needle')
  })

  it('offers a way through an interceptor', () => {
    const t = table()
    t.ours.targetId = 'enemy'
    t.ours.engagedWith = ['theirs']
    advanceTo(t.game, 'ordnance-vs-ships')
    expect(kinds(t.game, t.ours)).toContain('press-attack')
  })
})

describe('8.4, the combat landing', () => {
  it('is a carrier order, offered while its wing is up', () => {
    const t = table()
    advanceTo(t.game, 'move-fighters')
    expect(combatLandingAvailable(t.game, 'carrier')).toBe(true)
    t.ours.status = 'aboard'
    expect(combatLandingAvailable(t.game, 'carrier')).toBe(false)
  })

  it('is not offered outside the fighter move phases', () => {
    const t = table()
    advanceTo(t.game, 'ship-fire')
    expect(combatLandingAvailable(t.game, 'carrier')).toBe(false)
  })
})

describe('the bearing away from a threat (3.1, 8.10)', () => {
  it('reads the clock face the way the table does', () => {
    // Course 6 points toward increasing y, course 12 toward decreasing y.
    expect(bearingAwayFrom({ x: 10, y: 10 }, { x: 4, y: 10 }, 12)).toBe(3)
    expect(bearingAwayFrom({ x: 10, y: 10 }, { x: 16, y: 10 }, 12)).toBe(9)
    expect(bearingAwayFrom({ x: 10, y: 10 }, { x: 10, y: 16 }, 3)).toBe(12)
    expect(bearingAwayFrom({ x: 10, y: 10 }, { x: 10, y: 4 }, 3)).toBe(6)
    expect(bearingAwayFrom({ x: 10, y: 10 }, { x: 10, y: 10 }, 7)).toBe(7)
  })
})

describe('every order the panel offers is one the engine takes', () => {
  it('is accepted rather than refused', () => {
    // The panel's own gating and applyAction's are written separately, and a
    // control that is always refused is worse than no control at all.
    const cases: Array<[string, () => Table, Phase]> = [
      ['rearm', () => table({ typeId: 'multi-role', status: 'aboard' }), 'orders'],
      ['ftl-deploy', () => table({ modifiers: ['ftl'], status: 'aboard' }), 'orders'],
      ['salvo', () => table({ typeId: 'missile' }), 'launch-missiles'],
      ['screen', () => table(), 'move-fighters'],
      [
        'scramble',
        () => {
          const t = table({ status: 'aboard' })
          t.theirs.movedThisTurn = true
          return t
        },
        'move-fighters',
      ],
      ['payload', () => table({ typeId: 'torpedo' }), 'ordnance-vs-ships'],
      ['boarding-run', () => table({ typeId: 'assault-shuttle' }), 'ordnance-vs-ships'],
    ]
    const refused: string[] = []
    for (const [kind, build, phase] of cases) {
      const t = build()
      advanceTo(t.game, phase)
      const order = flightOrders(t.game, t.ours).find((o) => o.kind === kind)
      const action = order?.action ?? order?.options[0]?.action
      if (!action) {
        refused.push(`${kind}: not offered at all`)
        continue
      }
      const outcome = applyAction(t.game, action)
      if (outcome.refused) refused.push(`${kind}: ${outcome.refused}`)
    }
    expect(refused).toEqual([])
  })
})
