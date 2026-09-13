import { describe, expect, it } from 'vitest'

import { applyAction, areaEcmLevelOf, setRulesReading, stealthLevelOf } from './actions'
import {
  createGame,
  createShipState,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { acquireMissileTargets, attackRadiusFor, type MissileMarker } from './ordnance'
import { AREA_RADIUS } from './defences'
import { cloakCapability } from './ew'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import type { Phase, ScreenDef, ShipDesign, SystemKind } from './types'

/**
 * Screens and electronic warfare, through the action layer (7.4, 7.16 – 7.22).
 *
 * `defences.ts` and `ew.ts` have had all of this since the modules were
 * written, and unit tests have checked every table in both. What none of them
 * could see is that the handlers never asked: an area screen protected nobody,
 * stealth shortened a beam's reach but not a missile's, an Area ECM emitter
 * jammed for free while firing its own guns, an ECM suite never shortened a
 * FireCon, and a cloak crossed off the SSD went on cloaking.
 *
 * Everything here is gated at reading 11, so each case is fought twice — once
 * under the current reading and once under 10 — because every one of them adds
 * or deletes dice, and an older journal has to replay as it was fought.
 */

const READING_BEFORE = 10

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

/** A hull with one Beam-3, and whatever else the case needs. */
function design(
  name: string,
  opts: { systems?: SystemKind[]; screens?: ScreenDef; weapons?: ShipDesign['weapons'] } = {},
): ShipDesign {
  return {
    id: name,
    name,
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
    screens: opts.screens ?? { level: 0, generators: 0, advanced: false },
    weapons: opts.weapons ?? [
      {
        id: 'b1',
        label: 'Beam-3',
        weaponClass: 'beam',
        rating: 3,
        variant: 'standard',
        arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
        mass: 6,
        points: 18,
      },
    ],
    turrets: [],
    systems: [
      { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      ...Array.from({ length: opts.screens?.generators ?? 0 }, (_unused, i) => ({
        id: `screen-gen-${i + 1}`,
        kind: 'screen-generator' as SystemKind,
        label: 'Screen Gen',
        mass: 0,
        points: 0,
      })),
      ...(opts.systems ?? []).map((kind, i) => ({
        id: `${kind}-${i + 1}`,
        kind,
        label: kind,
        mass: 1,
        points: 3,
      })),
    ],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 1,
    marineParties: 0,
    points: 200,
  }
}

function at(x: number, y: number): ShipState['placement'] {
  return { position: { x, y }, facing: 6 }
}

function battle(ships: ShipState[], reading = CURRENT_RULES_VERSION, seed = 0x5c11): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 200, height: 200 },
    ships,
  })
  setRulesReading(game, reading)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

/** One salvo marker sitting on the table, mid-flight. */
function seeker(x: number): MissileMarker {
  return {
    id: 'm1',
    owner: 'b',
    sourceShipId: 'shooter',
    kind: 'salvo',
    grade: 'standard',
    missiles: 6,
    hits: 0,
    position: { x, y: 0 },
    facing: 3,
    launchedTurn: 1,
    rangeFlown: 0,
    endurance: 1,
    targetShipId: null,
    stagesRemaining: 0,
  }
}

// ---------------------------------------------------------------------------
// 7.16 Area screens
// ---------------------------------------------------------------------------

const plainScreens = (level: 1 | 2): ScreenDef => ({
  level,
  generators: level,
  advanced: false,
})

const areaScreens = (level: 1 | 2 = 1, advanced = false): ScreenDef => ({
  level: 1,
  generators: 1,
  advanced: false,
  area: { advanced, level },
})

/**
 * One Beam-3 volley at a screened target, with or without a friend throwing an
 * umbrella over it. Same seed both ways: only the screen level differs.
 */
function volleyUnderUmbrella(
  opts: { umbrella: boolean; targetScreens: 1 | 2; gap?: number; reading?: number },
): number {
  // One volley is three dice and the difference between level 1 and level 2 is
  // a fraction of a hit, so the comparison is made over fifty battles. The
  // seeds are spread rather than consecutive: the same number of draws happens
  // before the volley either way, so 1, 2, 3 … would correlate.
  let total = 0
  for (let n = 0; n < 50; n += 1) {
    const ships = [
      createShipState({
        id: 'shooter',
        side: 'b',
        design: design('Shooter'),
        placement: at(0, 0),
      }),
      createShipState({
        id: 'target',
        side: 'a',
        design: design('Target', { screens: plainScreens(opts.targetScreens) }),
        placement: at(0, 10),
      }),
    ]
    if (opts.umbrella) {
      ships.push(
        createShipState({
          id: 'aegis',
          side: 'a',
          design: design('Aegis', { screens: areaScreens() }),
          placement: at(opts.gap ?? 3, 10),
        }),
      )
    }
    const game = battle(ships, opts.reading ?? CURRENT_RULES_VERSION, n * 104729 + 17)
    advanceTo(game, 'ship-fire')
    applyAction(game, {
      type: 'fire-weapon',
      shipId: 'shooter',
      weaponId: 'b1',
      targetId: 'target',
    })
    total += shipOf(game, 'target').hullMarked
  }
  return total
}

describe('an area screen, once a shot goes through the engine (7.16)', () => {
  it('lifts a level-1 ship to level 2 against fire from outside the bubble', () => {
    // "a frigate with a level one screen is being protected by a ship
    // generating an area screen. The frigate would count as having a level two
    // screen against any incoming fire."
    const alone = volleyUnderUmbrella({ umbrella: false, targetScreens: 1 })
    const covered = volleyUnderUmbrella({ umbrella: true, targetScreens: 1 })
    expect(alone).toBeGreaterThan(0)
    expect(covered).toBeLessThan(alone)
  })

  it('does nothing against fire that starts inside the 6 MU radius', () => {
    // "the 'bubble' will not affect any fire coming from inside the 6mu radius"
    const inside = (umbrella: boolean): number => {
      const ships = [
        createShipState({ id: 'shooter', side: 'b', design: design('Shooter'), placement: at(0, 16) }),
        createShipState({
          id: 'target',
          side: 'a',
          design: design('Target', { screens: plainScreens(1) }),
          placement: at(0, 18),
        }),
      ]
      if (umbrella) {
        ships.push(
          createShipState({
            id: 'aegis',
            side: 'a',
            design: design('Aegis', { screens: areaScreens() }),
            placement: at(2, 18),
          }),
        )
      }
      const game = battle(ships)
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
      return shipOf(game, 'target').hullMarked
    }
    expect(inside(true)).toBe(inside(false))
  })

  it('stops at 6 MU from the generator', () => {
    const covered = volleyUnderUmbrella({ umbrella: true, targetScreens: 1, gap: AREA_RADIUS })
    const outside = volleyUnderUmbrella({
      umbrella: true,
      targetScreens: 1,
      gap: AREA_RADIUS + 0.5,
    })
    const alone = volleyUnderUmbrella({ umbrella: false, targetScreens: 1 })
    expect(covered).toBeLessThan(alone)
    expect(outside).toBe(alone)
  })

  it('is not read at all under reading 10', () => {
    const alone = volleyUnderUmbrella({
      umbrella: false,
      targetScreens: 1,
      reading: READING_BEFORE,
    })
    const covered = volleyUnderUmbrella({
      umbrella: true,
      targetScreens: 1,
      reading: READING_BEFORE,
    })
    expect(covered).toBe(alone)
  })

  it('takes the (P) re-rolls off a level-2 ship lifted to three', () => {
    // "In the case of ships with level two screens being protected by an area
    // screen weapons that would normally penetrate do not get their re-rolls."
    const penetrating: ShipDesign['weapons'] = [
      {
        id: 'b1',
        label: 'Graser-3',
        weaponClass: 'graser',
        rating: 3,
        variant: 'standard',
        arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
        mass: 9,
        points: 27,
      },
    ]
    const damage = (umbrella: boolean): number => {
      let total = 0
      for (let n = 0; n < 50; n += 1) {
        const ships = [
          createShipState({
            id: 'shooter',
            side: 'b',
            design: design('Shooter', { weapons: penetrating }),
            placement: at(0, 0),
          }),
          createShipState({
            id: 'target',
            side: 'a',
            design: design('Target', { screens: plainScreens(2) }),
            placement: at(0, 10),
          }),
        ]
        if (umbrella) {
          ships.push(
            createShipState({
              id: 'aegis',
              side: 'a',
              design: design('Aegis', { screens: areaScreens() }),
              placement: at(3, 10),
            }),
          )
        }
        const game = battle(ships, CURRENT_RULES_VERSION, n * 7919 + 11)
        advanceTo(game, 'ship-fire')
        applyAction(game, {
          type: 'fire-weapon',
          shipId: 'shooter',
          weaponId: 'b1',
          targetId: 'target',
        })
        total += shipOf(game, 'target').hullMarked
      }
      return total
    }
    // The table cannot go past level 2, so the third level pays entirely in
    // lost re-rolls — and a graser is a (P) weapon, so it loses a lot.
    expect(damage(true)).toBeLessThan(damage(false))
  })

  it('is carried by a hull in the roster, priced as 7.16 prints it', () => {
    const anzio = designById('sol-marines-aegis') as ShipDesign
    expect(anzio.screens.area).toEqual({ advanced: false, level: 1 })
  })
})

// ---------------------------------------------------------------------------
// 7.4 Stealth against a seeker
// ---------------------------------------------------------------------------

describe('stealth shortens missile lock-on as well as gun range (7.4)', () => {
  it('scales the 6 MU attack radius by the same two factors as a beam', () => {
    // "The reduction of effective range also applies to missile lock-on range."
    const seen = { id: 't', owner: 'a', position: { x: 0, y: 0 } }
    expect(attackRadiusFor(seen)).toBe(6)
    expect(attackRadiusFor({ ...seen, stealth: 1 })).toBe(5)
    expect(attackRadiusFor({ ...seen, stealth: 2 })).toBe(4)
    // 6.3's optional vector radius shrinks the same way.
    expect(attackRadiusFor({ ...seen, vectorMovement: true, stealth: 2 })).toBe(2)
  })

  it('leaves a marker at 5.5 MU nothing to home on', () => {
    const marker = seeker(0)
    const plain = acquireMissileTargets([marker], [
      { id: 't', owner: 'a', position: { x: 5.5, y: 0 } },
    ])
    expect(plain.acquisitions).toHaveLength(1)

    const stealthy = acquireMissileTargets([marker], [
      { id: 't', owner: 'a', position: { x: 5.5, y: 0 }, stealth: 1 },
    ])
    expect(stealthy.acquisitions).toHaveLength(0)
    expect(stealthy.removed).toHaveLength(1)
  })

  it('reads a stealth hull off the ship the handler hands it', () => {
    const game = battle([
      createShipState({
        id: 'ghost',
        side: 'a',
        design: design('Ghost', { systems: ['stealth-hull'] }),
        placement: at(0, 0),
      }),
    ])
    expect(stealthLevelOf(shipOf(game, 'ghost'))).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 7.17 – 7.20 Lock-on against ECM, holofields and cloaks
// ---------------------------------------------------------------------------

describe('electronic warfare against a seeker (7.17 – 7.20)', () => {
  it('takes 1 MU a level off the radius, down to 2 MU against three (7.18)', () => {
    // "this would reduce fighter/missile lock-on range to 2 MU"
    expect(attackRadiusFor({ id: 't', owner: 'a', position: { x: 0, y: 0 }, lockOn: 2 })).toBe(2)
  })

  it('never locks on a cloaked hull at all (7.20)', () => {
    // "Missiles and fighters will not lock at all."
    const result = acquireMissileTargets([seeker(0)], [
      { id: 't', owner: 'a', position: { x: 0.5, y: 0 }, lockOn: null },
    ])
    expect(result.acquisitions).toHaveLength(0)
  })

  it('stops a fighter group attacking a ship it cannot see', () => {
    // A group 5 MU out is inside 8.7's 6 MU but outside the 3 MU that three
    // levels of ECM leave it (7.18).
    const strike = (levels: number, reading = CURRENT_RULES_VERSION) => {
      const game = battle(
        [
          createShipState({ id: 'carrier', side: 'b', design: design('Carrier'), placement: at(0, 0) }),
          createShipState({
            id: 'mark',
            side: 'a',
            design: design('Mark', {
              systems: Array.from({ length: levels }, () => 'ecm' as SystemKind),
            }),
            placement: at(0, 5),
          }),
        ],
        reading,
      )
      const wing: FighterGroupState = {
        ...createFighterGroup({
          id: 'wing',
          side: 'b',
          typeId: 'standard',
          position: { x: 0, y: 0 },
          facing: 6,
          status: 'in-flight',
        }),
        side: 'b',
        label: 'Wing',
        carrierId: 'carrier',
        recoveredTurn: null,
        targetId: null,
        lastTargetId: null,
      } as FighterGroupState
      game.fighterGroups.push(wing)
      advanceTo(game, 'ordnance-vs-ships')
      return applyAction(game, { type: 'flight-strike', flightId: 'wing', targetId: 'mark' })
    }
    expect(strike(0).refused).toBeUndefined()
    expect(strike(3).refused).toBeTruthy()
    // Reading 10 flew straight in.
    expect(strike(3, READING_BEFORE).refused).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 7.18, 7.19 ECM against a FireCon
// ---------------------------------------------------------------------------

describe('ECM against the guns (7.18, 7.19)', () => {
  it('shortens the shooter’s sensor reach by 6 MU a level', () => {
    // 54 MU of FireCon, less 12 for two levels, is 42.
    const shot = (range: number, levels: number, reading = CURRENT_RULES_VERSION) => {
      const game = battle(
        [
          createShipState({ id: 'shooter', side: 'b', design: design('Shooter'), placement: at(0, 0) }),
          createShipState({
            id: 'target',
            side: 'a',
            design: design('Target', { systems: Array.from({ length: levels }, () => 'ecm' as SystemKind) }),
            placement: at(0, range),
          }),
        ],
        reading,
      )
      advanceTo(game, 'ship-fire')
      return applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
    }
    expect(shot(44, 0).refused).toBeUndefined()
    expect(shot(44, 2).refused).toMatch(/jamming/)
    expect(shot(40, 2).refused).toBeUndefined()
    // Reading 10 knew nothing about it.
    expect(shot(44, 2, READING_BEFORE).refused).toBeUndefined()
  })

  it('takes the emitter’s own FireCons away while Area ECM runs (7.19)', () => {
    const build = (reading = CURRENT_RULES_VERSION) =>
      battle(
        [
          createShipState({
            id: 'jammer',
            side: 'b',
            design: design('Jammer', { systems: ['area-ecm'] }),
            placement: at(0, 0),
          }),
          createShipState({ id: 'target', side: 'a', design: design('Target'), placement: at(0, 18) }),
        ],
        reading,
      )

    const game = build()
    expect(areaEcmLevelOf(shipOf(game, 'jammer'))).toBe(1)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'jammer',
        weaponId: 'b1',
        targetId: 'target',
      }).refused,
    ).toMatch(/Area ECM/)

    // Shut it down and the guns come back.
    applyAction(game, { type: 'set-area-ecm', shipId: 'jammer', on: false })
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'jammer',
        weaponId: 'b1',
        targetId: 'target',
      }).refused,
    ).toBeUndefined()

    // And reading 10 never asked.
    const old = build(READING_BEFORE)
    advanceTo(old, 'ship-fire')
    expect(
      applyAction(old, {
        type: 'fire-weapon',
        shipId: 'jammer',
        weaponId: 'b1',
        targetId: 'target',
      }).refused,
    ).toBeUndefined()
  })

  it('refuses the switch on a ship with no emitter', () => {
    const game = battle([
      createShipState({ id: 'plain', side: 'b', design: design('Plain'), placement: at(0, 0) }),
    ])
    expect(applyAction(game, { type: 'set-area-ecm', shipId: 'plain', on: false }).refused).toMatch(
      /no Area ECM/,
    )
  })

  it('stops covering a neighbour once it is switched off', () => {
    // 7.19's cover counts towards the same aggregate as the ship's own ECM
    // (7.18), so a friend inside 6 MU of a level-3 emitter is invisible past
    // 54 − 18 = 36 MU. Switching the emitter off hands the shooter its sensors
    // back.
    const shot = (off: boolean) => {
      const game = battle([
        createShipState({ id: 'shooter', side: 'b', design: design('Shooter'), placement: at(0, 0) }),
        createShipState({ id: 'target', side: 'a', design: design('Target'), placement: at(0, 40) }),
        createShipState({
          id: 'jammer',
          side: 'a',
          design: design('Jammer', { systems: ['area-ecm', 'area-ecm', 'area-ecm'] }),
          placement: at(3, 40),
        }),
      ])
      if (off) applyAction(game, { type: 'set-area-ecm', shipId: 'jammer', on: false })
      advanceTo(game, 'ship-fire')
      return applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'b1',
        targetId: 'target',
      })
    }
    expect(shot(false).refused).toMatch(/jamming/)
    expect(shot(true).refused).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 7.20 – 7.22 A cloak crossed off the SSD
// ---------------------------------------------------------------------------

describe('a cloak that has taken damage (7.20 – 7.22)', () => {
  const cloakShip = (kind: SystemKind, reading = CURRENT_RULES_VERSION): GameState =>
    battle(
      [
        createShipState({
          id: 'ghost',
          side: 'a',
          design: design('Ghost', { systems: [kind] }),
          placement: at(0, 0),
        }),
      ],
      reading,
    )

  it('drops a Cloaking Field to a standard cloak when one box goes', () => {
    // 7.21: "If one of its damage boxes has been checked off for any reason the
    // cloak operates as a standard cloak."
    const game = cloakShip('cloaking-field')
    const ghost = shipOf(game, 'ghost')
    expect(cloakCapability(ghost.cloak!)).toBe('total')

    ghost.destroyedSystems.add('cloaking-field-1')
    applyAction(game, { type: 'advance-phase' })
    expect(ghost.cloak!.boxesLost).toBe(1)
    expect(cloakCapability(ghost.cloak!)).toBe('partial')
    expect(game.log.some((line) => /runs as a standard cloak/.test(line.text))).toBe(true)
  })

  it('kills a Cloaking Device outright, and says so in the log', () => {
    const game = cloakShip('cloaking-device')
    const ghost = shipOf(game, 'ghost')
    expect(cloakCapability(ghost.cloak!)).toBe('partial')

    ghost.destroyedSystems.add('cloaking-device-1')
    applyAction(game, { type: 'advance-phase' })
    expect(cloakCapability(ghost.cloak!)).toBe('none')
    expect(game.log.some((line) => /cloak is knocked out/.test(line.text))).toBe(true)
  })

  it('sweeps idempotently — a second boundary changes nothing', () => {
    const game = cloakShip('cloaking-field')
    const ghost = shipOf(game, 'ghost')
    ghost.destroyedSystems.add('cloaking-field-1')
    applyAction(game, { type: 'advance-phase' })
    const after = ghost.cloak!.boxesLost
    const spoke = () => game.log.filter((line) => /cloak is/.test(line.text)).length
    const said = spoke()
    applyAction(game, { type: 'advance-phase' })
    expect(ghost.cloak!.boxesLost).toBe(after)
    expect(spoke()).toBe(said)
  })

  it('leaves a reading-10 battle with the cloak it was fought with', () => {
    const game = cloakShip('cloaking-device', READING_BEFORE)
    const ghost = shipOf(game, 'ghost')
    ghost.destroyedSystems.add('cloaking-device-1')
    applyAction(game, { type: 'advance-phase' })
    expect(ghost.cloak!.boxesLost).toBe(0)
    expect(cloakCapability(ghost.cloak!)).toBe('partial')
  })
})
