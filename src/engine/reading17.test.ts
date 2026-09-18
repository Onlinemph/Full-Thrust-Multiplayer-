import { describe, expect, it } from 'vitest'

import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import { applyAction, endPhase, setRulesReading } from './actions'
import { createFighterGroup } from './fighters'
import {
  advancePhase,
  createGame,
  createShipState,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { MAGAZINE_LOAD_MASS, MAGAZINE_POINTS_PER_MASS } from './ordnance'
import type { MagazineDef, Phase, ShipDesign } from './types'

/**
 * Reading 17: a phase is passed over when nothing in it is *possible*, not
 * merely when nothing is in it (2.6).
 *
 * Reading 16 asked whether a phase had anything in it. A wing sitting in a
 * bay kept phase 4 whether or not its carrier could launch it, a marker
 * anywhere on the table kept phase 9, and phase 11 was walked by two fleets
 * sixty MU apart. Each check here is the guard the phase's actions refuse
 * on, so a player is never shown a phase they could do nothing in.
 */

/** Press through the turn with the engine's own boundary, noting each phase. */
function phasesOfTurn(game: GameState): Phase[] {
  const seen: Phase[] = []
  const turn = game.turn
  let guard = 40
  while (game.turn === turn && guard-- > 0) {
    seen.push(game.phase)
    if (game.phase === 'orders') {
      for (const ship of game.ships) {
        if (ship.order === null) applyAction(game, { type: 'plot-accel', shipId: ship.id, accel: 0 })
      }
    }
    if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
    if (game.phase === 'move-ships') {
      for (const ship of game.ships) applyAction(game, { type: 'move-ship', shipId: ship.id })
    }
    endPhase(game)
  }
  return seen
}

/** Line of Battle, both lines re-drawn `apart` MU from each other. */
function fleets(apart: number, rulesVersion = CURRENT_RULES_VERSION): GameState {
  const game = buildGame({ scenarioId: 'line-of-battle', seed: 0x17, rulesVersion })
  const first = game.sides[0].id
  const rank: Record<string, number> = {}
  for (const ship of game.ships) {
    const mine = ship.side === first
    const row = (rank[ship.side] = (rank[ship.side] ?? 0) + 1)
    ship.placement = {
      position: { x: mine ? 4 : 4 + apart, y: 6 + row * 6 },
      facing: mine ? 3 : 9,
    }
  }
  return game
}

describe('phase 11 is passed when no gun bears on anything in reach (2.6)', () => {
  it('goes from movement straight to the next turn with the fleets 80 MU apart', () => {
    const game = fleets(80)
    const seen = phasesOfTurn(game)
    expect(seen).not.toContain('ship-fire')
    expect(game.turn).toBe(2)
    expect(game.phase).toBe('orders')
    const passed = game.log.filter((entry) => entry.text.startsWith('Nothing to do'))
    expect(passed[passed.length - 1]?.text).toMatch(/phases 6, 7, 8, 9, 10, 11, 12, 13, 14 and 15/)
  })

  it('stands the moment a gun can reach', () => {
    const game = fleets(6)
    expect(phasesOfTurn(game)).toContain('ship-fire')
  })

  it('leaves reading 16 walking phase 11 whatever the range', () => {
    const game = fleets(80, 16)
    expect(phasesOfTurn(game)).toContain('ship-fire')
  })
})

/** A carrier, a wing, and an enemy far enough off that nothing else happens. */
function carrierTable(opts: {
  status: 'aboard' | 'in-flight'
  at?: { x: number; y: number }
  enemyAt?: { x: number; y: number }
  readyTurn?: number | null
  enemyWingAt?: { x: number; y: number }
}): { game: GameState; wing: FighterGroupState; enemy: ShipState } {
  const carrier = createShipState({
    id: 'carrier',
    side: 'a',
    design: designById('esu-carrier') as ShipDesign,
    placement: { position: { x: 10, y: 24 }, facing: 3 },
  })
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-destroyer') as ShipDesign,
    placement: { position: opts.enemyAt ?? { x: 90, y: 24 }, facing: 9 },
  })
  const wing = {
    ...createFighterGroup({
      id: 'wing',
      side: 'a',
      typeId: 'standard',
      carrierId: 'carrier',
      status: opts.status,
      position: opts.at ?? { x: 40, y: 24 },
      facing: 3,
    }),
    readyTurn: opts.readyTurn ?? null,
    side: 'a',
    label: 'Wing',
    recoveredTurn: null,
    targetId: null,
  } as FighterGroupState
  const groups = [wing]
  if (opts.enemyWingAt) {
    groups.push({
      ...createFighterGroup({
        id: 'theirs',
        side: 'b',
        typeId: 'standard',
        status: 'in-flight',
        position: opts.enemyWingAt,
        facing: 9,
      }),
      side: 'b',
      label: 'Theirs',
      recoveredTurn: null,
      targetId: null,
    } as FighterGroupState)
  }
  const game = createGame({
    seed: 0x17,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 48 },
    ships: [carrier, enemy],
    fighterGroups: groups,
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  return { game, wing, enemy }
}

describe('the fighter phases are passed when no group can act (8.1, 8.7, 8.10)', () => {
  it('passes phase 4 while the only wing is re-arming, and stands once it is ready', () => {
    const rearming = carrierTable({ status: 'aboard', readyTurn: 5 })
    expect(phasesOfTurn(rearming.game)).not.toContain('move-fighters')
    const ready = carrierTable({ status: 'aboard' })
    expect(phasesOfTurn(ready.game)).toContain('move-fighters')
  })

  it('passes phases 7 and 8 for a wing with nothing in reach, but not its moves', () => {
    const { game } = carrierTable({ status: 'in-flight' })
    const seen = phasesOfTurn(game)
    expect(seen).toContain('move-fighters')
    expect(seen).toContain('secondary-fighter-moves')
    expect(seen).not.toContain('allocate-attacks')
    expect(seen).not.toContain('fighter-vs-fighter')
    expect(seen).not.toContain('point-defence')
    expect(seen).not.toContain('ordnance-vs-ships')
  })

  it('stands at phase 7 with a hull inside the lock-on, and at 8 with an enemy wing', () => {
    const hull = carrierTable({ status: 'in-flight', enemyAt: { x: 44, y: 24 } })
    expect(phasesOfTurn(hull.game)).toContain('allocate-attacks')
    const wings = carrierTable({ status: 'in-flight', enemyWingAt: { x: 44, y: 24 } })
    expect(phasesOfTurn(wings.game)).toContain('fighter-vs-fighter')
  })
})

/** A hull whose only launcher is an SML with `loads` salvoes behind it. */
function missileBoat(loads: number, apart: number): { game: GameState; ship: ShipState; launcherId: string } {
  const base = designById('durani-corsair') as ShipDesign
  const launcher = base.weapons.find((w) => w.weaponClass === 'salvo-missile-launcher')
  if (!launcher) throw new Error('no launcher')
  const mass = Math.max(1, loads) * MAGAZINE_LOAD_MASS.standard
  const magazine: MagazineDef = {
    id: 'm1',
    mass,
    points: mass * MAGAZINE_POINTS_PER_MASS,
    loads: Array.from({ length: loads }, () => ({ grade: 'standard' as const })),
    launcherIds: [launcher.id],
  }
  const ship = createShipState({
    id: 'boat',
    side: 'a',
    design: { ...base, weapons: [launcher], magazines: [magazine] },
    placement: { position: { x: 10, y: 24 }, facing: 3 },
  })
  const enemy = createShipState({
    id: 'enemy',
    side: 'b',
    design: designById('nac-destroyer') as ShipDesign,
    placement: { position: { x: 10 + apart, y: 24 }, facing: 9 },
  })
  const game = createGame({
    seed: 0xa17,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 48 },
    ships: [ship, enemy],
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  return { game, ship, launcherId: launcher.id }
}

describe('the ordnance phases are passed when nothing can be launched or reached (6.3, 6.6)', () => {
  it('passes phase 3 for a launcher with an empty magazine, and stands for a loaded one', () => {
    expect(phasesOfTurn(missileBoat(0, 80).game)).not.toContain('launch-missiles')
    expect(phasesOfTurn(missileBoat(1, 80).game)).toContain('launch-missiles')
  })

  it('passes phases 9 and 10 for a salvo that will find nothing, and removes it', () => {
    const { game, ship, launcherId } = missileBoat(1, 80)
    for (const hull of game.ships) applyAction(game, { type: 'plot-accel', shipId: hull.id, accel: 0 })
    endPhase(game)
    applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
    expect(game.phase).toBe('launch-missiles')
    expect(
      applyAction(game, { type: 'launch-ordnance', shipId: ship.id, weaponId: launcherId, aimPoint: { x: 34, y: 24 } })
        .refused,
    ).toBeUndefined()
    expect(game.ordnance).toHaveLength(1)
    const seen = phasesOfTurn(game)
    expect(seen).not.toContain('point-defence')
    expect(seen).not.toContain('ordnance-vs-ships')
    // 6.3: "the missile launch was wasted and the marker is removed from play."
    expect(game.ordnance).toHaveLength(0)
    expect(game.log.some((entry) => /finds nothing to attack/.test(entry.text))).toBe(true)
  })

  it('stands at phase 9 with a salvo that will take a hull', () => {
    const { game, ship, launcherId } = missileBoat(1, 30)
    for (const hull of game.ships) applyAction(game, { type: 'plot-accel', shipId: hull.id, accel: 0 })
    endPhase(game)
    applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
    expect(
      applyAction(game, { type: 'launch-ordnance', shipId: ship.id, weaponId: launcherId, aimPoint: { x: 34, y: 24 } })
        .refused,
    ).toBeUndefined()
    const seen = phasesOfTurn(game)
    expect(seen).toContain('point-defence')
    expect(seen).toContain('ordnance-vs-ships')
  })
})

describe('rocket markers attack the hull they sit on (6.7)', () => {
  function pod(): { game: GameState; target: ShipState; weaponId: string } {
    const shooter = createShipState({
      id: 'shooter',
      side: 'a',
      design: designById('chytrid-spore') as ShipDesign,
      placement: { position: { x: 40, y: 20 }, facing: 6 },
    })
    const target = createShipState({
      id: 'target',
      side: 'b',
      design: designById('esu-battleship') as ShipDesign,
      placement: { position: { x: 40, y: 26 }, facing: 12 },
    })
    const game = createGame({ seed: 0x5eed, sides: [{ id: 'a' }, { id: 'b' }], ships: [shooter, target] })
    setRulesReading(game, CURRENT_RULES_VERSION)
    const weapon = shooter.design.weapons.find((w) => w.weaponClass === 'rocket-pod' && w.arcs.includes('F'))
    if (!weapon) throw new Error('no forward pod')
    return { game, target, weaponId: weapon.id }
  }

  function advanceTo(game: GameState, phase: Phase): void {
    let guard = 40
    while (game.phase !== phase && guard-- > 0) advancePhase(game)
  }

  it('does its damage in phase 10 and is then spent', () => {
    const { game, target, weaponId } = pod()
    advanceTo(game, 'launch-missiles')
    expect(applyAction(game, { type: 'fire-rocket-pod', shipId: 'shooter', weaponId, targetId: 'target' }).refused).toBeUndefined()
    const marker = game.ordnance.find((m) => m.kind === 'rocket')
    expect(marker?.missiles).toBeGreaterThan(0)
    const marked = () => target.hullMarked + target.armourMarked.reduce((sum, n) => sum + n, 0)
    const before = marked()
    advanceTo(game, 'ordnance-vs-ships')
    expect(applyAction(game, { type: 'resolve-ordnance-attacks' }).refused).toBeUndefined()
    expect(marked()).toBeGreaterThan(before)
    expect(game.ordnance.filter((m) => m.kind === 'rocket')).toHaveLength(0)
  })

  it('left an older journal with the rockets sitting on the hull for ever', () => {
    const { game, weaponId } = pod()
    setRulesReading(game, 16)
    advanceTo(game, 'launch-missiles')
    applyAction(game, { type: 'fire-rocket-pod', shipId: 'shooter', weaponId, targetId: 'target' })
    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'resolve-ordnance-attacks' })
    expect(game.ordnance.filter((m) => m.kind === 'rocket')).toHaveLength(1)
  })
})

describe('reading', () => {
  it('is at least 17', () => {
    expect(CURRENT_RULES_VERSION).toBeGreaterThanOrEqual(17)
  })
})
