import { describe, expect, it } from 'vitest'

import {
  antiShipPdMounts,
  applyAction,
  pointDefenceCanEngage,
  setRulesReading,
  stealthLevelOf,
} from './actions'
import { aiActions } from './ai'
import {
  createGame,
  createShipState,
  hullRemaining,
  type GameState,
  type ShipState,
} from './game'
import { PDS_RANGE, STEALTH_PASSIVE_TARGET_RANGE } from './defences'
import { designById } from '../data/ships'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase, ShipDesign } from './types'

/**
 * Phase 9's allocation half (7.10 – 7.14, 8.8), 7.12's anti-ship mode and
 * 7.4's scan trade.
 *
 * `defences.ts` had the whole of it and the engine used the automatic half:
 * `pointDefenceOptions` takes an `allies` argument and the live handler passed
 * none, `PdDefender.flightOpsThisTurn` was never set, `resolvePointDefence`
 * counted the scattergun's friendly fire and nothing read it, and every marker
 * arrived stamped as attacking whichever ship was resolving its own defence —
 * so every ship defended every salvo on the table and an ADFC was never needed
 * to reach a neighbour.
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
  facing = 3,
): ShipState {
  return createShipState({
    id,
    side,
    design: designById(designId) as ShipDesign,
    placement: { position: at, facing: facing as ShipState['placement']['facing'] },
    velocity: 0,
  })
}

function battle(ships: ShipState[], seed = 0x910): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 160, height: 100 },
    ships,
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

/** Strip a hull to the state 7.12 wants: no screens left, no armour left. */
function strip(target: ShipState): void {
  target.armourMarked = target.design.armour.layers.map((boxes) => boxes)
  for (const system of target.design.systems) {
    if (system.kind === 'screen-generator') target.destroyedSystems.add(system.id)
  }
}

describe('who a marker is actually coming for (7.10)', () => {
  it('needs a working ADFC before a ship defends its neighbour', () => {
    // Two ESU cruisers 4 MU apart, one of them about to be hit. Knock the
    // escort's ADFC out and 7.10 leaves it nothing legal to shoot at: "the
    // ADFC allows a ship's point defence to be used in defence of another
    // ship", and a wrecked one allows nothing.
    const shooter = ship('shooter', 'b', 'durani-corsair', { x: 44, y: 50 }, 9)
    const game = battle([
      ship('escort', 'a', 'esu-heavy-cruiser', { x: 20, y: 50 }),
      ship('mark', 'a', 'esu-heavy-cruiser', { x: 24, y: 50 }),
      shooter,
    ])
    shipOf(game, 'escort').destroyedSystems.add('adfc-1')
    const launcher = shooter.design.weapons.find((w) => w.weaponClass.includes('salvo'))!
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: 'shooter',
      weaponId: launcher.id,
      aimPoint: { x: 24, y: 50 },
    })
    expect(game.ordnance).toHaveLength(1)

    advanceTo(game, 'point-defence')
    applyAction(game, { type: 'resolve-point-defence' })
    // The target defends itself; the neighbour with the dead ADFC does not.
    expect(game.log.some((entry) => /escort/i.test(entry.text) && /covers/.test(entry.text))).toBe(
      false,
    )
    expect(
      game.log.filter((entry) => /covers/.test(entry.text)).length,
    ).toBe(0)
  })

  it('lets an ADFC ship reach a neighbour inside 6 MU', () => {
    // The Solenoid carries an ADFC and three PDS. Park it beside a cruiser
    // that is about to be hit and it should cover.
    const shooter = ship('shooter', 'b', 'durani-corsair', { x: 44, y: 50 }, 9)
    const game = battle([
      ship('guard', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('mark', 'a', 'esu-heavy-cruiser', { x: 24, y: 50 }),
      shooter,
    ])
    const launcher = shooter.design.weapons.find((w) => w.weaponClass.includes('salvo'))!
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: 'shooter',
      weaponId: launcher.id,
      aimPoint: { x: 24, y: 50 },
    })
    advanceTo(game, 'point-defence')
    applyAction(game, { type: 'resolve-point-defence' })
    expect(game.log.some((entry) => /covers/.test(entry.text) && /7\.10/.test(entry.text))).toBe(true)
  })

  it('replays an older battle the way it was fought', () => {
    // Reading 8 is what made a marker's target the marker's business. Below
    // it, every ship still defends everything — which is how the saved
    // battles were played.
    const shooter = ship('shooter', 'b', 'durani-corsair', { x: 44, y: 50 }, 9)
    const game = battle([
      ship('escort', 'a', 'esu-heavy-cruiser', { x: 20, y: 50 }),
      ship('mark', 'a', 'esu-heavy-cruiser', { x: 24, y: 50 }),
      shooter,
    ])
    setRulesReading(game, 7)
    const launcher = shooter.design.weapons.find((w) => w.weaponClass.includes('salvo'))!
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: 'shooter',
      weaponId: launcher.id,
      aimPoint: { x: 24, y: 50 },
    })
    advanceTo(game, 'point-defence')
    applyAction(game, { type: 'resolve-point-defence' })
    // Two ships firing at one salvo, neither of them its target, and no ADFC
    // between them: the old reading let both.
    const shots = game.log.filter((entry) => /point defence/.test(entry.text))
    expect(shots.length).toBeGreaterThan(0)
  })
})

describe('point defence against a ship (7.12, 7.13)', () => {
  it('will not fire at a hull that still has armour', () => {
    const game = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('mark', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    advanceTo(game, 'ship-fire')
    const mount = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'pds')!
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'mark',
      }).refused,
    ).toMatch(/still has screens or armour/)
  })

  it('fires at one that has neither', () => {
    const game = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    strip(shipOf(game, 'hulk'))
    advanceTo(game, 'ship-fire')
    const mount = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'pds')!
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'hulk',
      }).refused,
    ).toBeUndefined()
    expect(game.log.some((entry) => /point defence/.test(entry.text) && /7\.12/.test(entry.text))).toBe(
      true,
    )
  })

  it('reaches 6 MU and no further', () => {
    const game = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 20 + PDS_RANGE + 1, y: 50 }, 9),
    ])
    strip(shipOf(game, 'hulk'))
    advanceTo(game, 'ship-fire')
    const mount = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'pds')!
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'hulk',
      }).refused,
    ).toMatch(/Point defence reaches 6 MU/)
  })

  it('puts one point through on a 6 and nothing otherwise', () => {
    // One die a mount. Sixty battles, and the damage is only ever 0 or 1. The
    // seeds are spread rather than consecutive: consecutive seeds reach this
    // die after the same number of draws and their first faces correlate.
    const seen = new Set<number>()
    for (let n = 0; n < 60; n++) {
      const game = battle(
        [
          ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
          ship('hulk', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
        ],
        n * 104729 + 17,
      )
      strip(shipOf(game, 'hulk'))
      const before = hullRemaining(shipOf(game, 'hulk'))
      advanceTo(game, 'ship-fire')
      const mount = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'pds')!
      const outcome = applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'hulk',
      })
      expect(outcome.refused).toBeUndefined()
      seen.add(before - hullRemaining(shipOf(game, 'hulk')))
    }
    expect([...seen].sort()).toEqual([0, 1])
  })

  it('will not fire a mount that already point-defended this turn', () => {
    // 2.6: "any system used for point defense ... cannot be used again in
    // that turn against a ship."
    const game = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    strip(shipOf(game, 'hulk'))
    advanceTo(game, 'ship-fire')
    const mount = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'pds')!
    applyAction(game, {
      type: 'fire-point-defence',
      shipId: 'pd',
      systemId: mount.id,
      targetId: 'hulk',
    })
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'hulk',
      }).refused,
    ).toMatch(/no point-defence mount free/)
  })

  it('will not fire a scattergun or a grapeshot launcher this way', () => {
    const game = battle([
      ship('pd', 'a', 'goliath-longgun', { x: 20, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    strip(shipOf(game, 'hulk'))
    advanceTo(game, 'ship-fire')
    const grape = shipOf(game, 'pd').design.systems.find((s) => s.kind === 'grapeshot')!
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: grape.id,
        targetId: 'hulk',
      }).refused,
    ).toMatch(/Only a PDS or an ADS/)
  })

  it('is what the computer reaches for on a hulk and never on a fresh hull', () => {
    const soft = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('hulk', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    strip(shipOf(soft, 'hulk'))
    advanceTo(soft, 'ship-fire')
    expect(aiActions(soft, 'a').some((act) => act.type === 'fire-point-defence')).toBe(true)

    const fresh = battle([
      ship('pd', 'a', 'izotrope-heavy-cruiser', { x: 20, y: 50 }),
      ship('mark', 'b', 'goliath-battleship', { x: 24, y: 50 }, 9),
    ])
    advanceTo(fresh, 'ship-fire')
    expect(aiActions(fresh, 'a').some((act) => act.type === 'fire-point-defence')).toBe(false)
  })
})

describe("the stealth ship's scan mode (7.4)", () => {
  /** A Stealth-2 hull: two stealth fields, which is the only way to reach it. */
  function stealthy(id: string, side: string, at: { x: number; y: number }): ShipState {
    const base = designById('esu-heavy-cruiser') as ShipDesign
    return createShipState({
      id,
      side,
      design: {
        ...base,
        systems: [
          ...base.systems,
          { id: 'sf-1', kind: 'stealth-field', label: 'Stealth Field', mass: 1, points: 0 },
          { id: 'sf-2', kind: 'stealth-field', label: 'Stealth Field', mass: 1, points: 0 },
        ],
      },
      placement: { position: at, facing: 3 },
      velocity: 0,
    })
  }

  it('is Stealth-2 while passive and Stealth-1 once it goes active', () => {
    const game = battle([stealthy('ghost', 'a', { x: 20, y: 50 })])
    expect(stealthLevelOf(shipOf(game, 'ghost'))).toBe(2)
    advanceTo(game, 'orders')
    applyAction(game, { type: 'set-active-scan', shipId: 'ghost', on: true })
    expect(stealthLevelOf(shipOf(game, 'ghost'))).toBe(1)
  })

  it('cannot target past 24 MU while passive', () => {
    const game = battle([
      stealthy('ghost', 'a', { x: 20, y: 50 }),
      ship('mark', 'b', 'esu-heavy-cruiser', { x: 20 + STEALTH_PASSIVE_TARGET_RANGE + 4, y: 50 }, 9),
    ])
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'ghost').design.weapons.find(
      (w) => w.weaponClass === 'beam' && w.arcs.includes('F'),
    )!
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'ghost',
        weaponId: beam.id,
        targetId: 'mark',
      }).refused,
    ).toMatch(/running passive and cannot target past 24 MU/)
  })

  it('buys the range back by going active', () => {
    const game = battle([stealthy('ghost', 'a', { x: 20, y: 50 })])
    game.ships.push(
      ship('mark', 'b', 'esu-heavy-cruiser', { x: 20 + STEALTH_PASSIVE_TARGET_RANGE + 4, y: 50 }, 9),
    )
    advanceTo(game, 'orders')
    applyAction(game, { type: 'set-active-scan', shipId: 'ghost', on: true })
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'ghost').design.weapons.find(
      (w) => w.weaponClass === 'beam' && w.arcs.includes('F'),
    )!
    const outcome = applyAction(game, {
      type: 'fire-weapon',
      shipId: 'ghost',
      weaponId: beam.id,
      targetId: 'mark',
    })
    expect(outcome.refused ?? '').not.toMatch(/running passive/)
  })

  it('is written in orders and lapses with the turn', () => {
    const game = battle([stealthy('ghost', 'a', { x: 20, y: 50 })])
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'set-active-scan', shipId: 'ghost', on: true }).refused,
    ).toMatch(/orders/)

    advanceTo(game, 'orders')
    applyAction(game, { type: 'set-active-scan', shipId: 'ghost', on: true })
    expect(shipOf(game, 'ghost').activeScan).toBe(true)
    const turn = game.turn
    let guard = 60
    while (game.turn === turn && guard-- > 0) applyAction(game, { type: 'advance-phase' })
    expect(shipOf(game, 'ghost').activeScan).toBe(false)
  })

  it('has nothing to offer a ship that is not Stealth-2', () => {
    const game = battle([ship('plain', 'a', 'esu-heavy-cruiser', { x: 20, y: 50 })])
    advanceTo(game, 'orders')
    expect(
      applyAction(game, { type: 'set-active-scan', shipId: 'plain', on: true }).refused,
    ).toMatch(/not Stealth-2/)
    // And an ordinary ship's FireCon is not capped at 24 MU.
    game.ships.push(ship('mark', 'b', 'esu-heavy-cruiser', { x: 50, y: 50 }, 9))
    advanceTo(game, 'ship-fire')
    const beam = shipOf(game, 'plain').design.weapons.find(
      (w) => w.weaponClass === 'beam' && w.arcs.includes('F'),
    )!
    expect(
      (applyAction(game, {
        type: 'fire-weapon',
        shipId: 'plain',
        weaponId: beam.id,
        targetId: 'mark',
      }).refused ?? ''),
    ).not.toMatch(/running passive/)
  })
})

describe('the panel and the engine ask the same question (7.12)', () => {
  it('offers the shot 7.23 opened up by taking the target’s screens away', () => {
    // A ship that armed its Nova Cannon has no screens for the turn (7.23),
    // which is what makes it soft enough for 7.12 — but only if the question
    // is asked the way the engine asks it. `effectiveScreenLevel` reads the
    // design's generators and would still say 2.
    const base = designById('esu-heavy-cruiser') as ShipDesign
    const nova = designById('goliath-dreadnought') as ShipDesign
    const armed = createShipState({
      id: 'armed',
      side: 'b',
      // A Mercator with screens bolted on: the roster's Nova ship carries
      // none, and the whole point is a hull whose screens would have hidden it.
      design: {
        ...nova,
        armour: { layers: [0], regenerative: false },
        screens: { level: 2, generators: 2, advanced: false },
        systems: [
          ...nova.systems,
          { id: 'screen-1', kind: 'screen-generator', label: 'Screen', mass: 1, points: 3 },
          { id: 'screen-2', kind: 'screen-generator', label: 'Screen', mass: 1, points: 3 },
        ],
      },
      placement: { position: { x: 24, y: 50 }, facing: 9 },
      velocity: 0,
    })
    const game = battle([
      createShipState({
        id: 'pd',
        side: 'a',
        design: base,
        placement: { position: { x: 20, y: 50 }, facing: 3 },
        velocity: 0,
      }),
      armed,
    ])
    // Screens up: 7.12 says no.
    expect(pointDefenceCanEngage(game, shipOf(game, 'pd'), shipOf(game, 'armed'))).toBe(false)

    advanceTo(game, 'orders')
    const cannon = nova.weapons.find((w) => w.weaponClass === 'nova-cannon')!
    applyAction(game, {
      type: 'arm-nova-cannon',
      shipId: 'armed',
      weaponId: cannon.id,
      on: true,
    })
    // 7.23 took them down, so 7.12 says yes — and the panel, the computer and
    // the handler all read the same predicate to find that out.
    expect(pointDefenceCanEngage(game, shipOf(game, 'pd'), shipOf(game, 'armed'))).toBe(true)
    advanceTo(game, 'ship-fire')
    const mount = antiShipPdMounts(game, shipOf(game, 'pd'), shipOf(game, 'armed'))[0]
    expect(mount).toBeDefined()
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'pd',
        systemId: mount.id,
        targetId: 'armed',
      }).refused,
    ).toBeUndefined()
  })

  it('mirrors the mount arcs when the ship has rolled (16.2)', () => {
    // `pdMountsOf` runs the arcs through `arcsWhenInverted`, so the panel's
    // list has to come from there rather than from the raw design.
    const base = designById('esu-heavy-cruiser') as ShipDesign
    const narrow: ShipDesign = {
      ...base,
      systems: base.systems.map((system) =>
        system.kind === 'pds' ? { ...system, arcs: ['FS' as const] } : system,
      ),
    }
    const game = battle([
      createShipState({
        id: 'pd',
        side: 'a',
        design: narrow,
        placement: { position: { x: 20, y: 50 }, facing: 3 },
        velocity: 0,
      }),
      ship('hulk', 'b', 'goliath-battleship', { x: 22, y: 47 }, 9),
    ])
    strip(shipOf(game, 'hulk'))
    const upright = antiShipPdMounts(game, shipOf(game, 'pd'), shipOf(game, 'hulk')).length
    shipOf(game, 'pd').rollStatus = { ...shipOf(game, 'pd').rollStatus, inverted: true }
    const rolled = antiShipPdMounts(game, shipOf(game, 'pd'), shipOf(game, 'hulk')).length
    // Rolling swaps port and starboard, so a mount that bore does not and a
    // mount that did not now does. One of the two counts has to change.
    expect(upright).not.toBe(rolled)
  })
})
