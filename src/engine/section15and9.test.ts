import { describe, expect, it } from 'vitest'

import { applyAction, setRulesReading } from './actions'
import {
  createGame,
  createShipState,
  damageControlParties,
  type GameState,
  type GunboatSquadronState,
  type ShipState,
} from './game'
import { createGunboatSquadron } from './gunboats'
import {
  availableTech,
  emptyTechBase,
  mayFieldSystem,
  mayFieldWeapon,
  prerequisitesMet,
  techBaseCost,
  techBaseHeld,
  techChoiceCost,
  techEntry,
  RECOMMENDED_TECH_CHOICE_LIMIT,
} from './techbase'
import { canField, designProblems } from '../data/techBaseCheck'
import { isDerelict, lifeSupportFailsOnTurn, outOfControlTurnsRemaining } from './threshold'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import type { Phase, ShipDesign, SystemKind, WeaponDef } from './types'

/**
 * Buying a tech base (15), shooting at gunboats (9.1), the transporter's
 * limit (5.9), and 10.3's two clocks.
 *
 * All four are the same failure: `techbase.ts` could check a fleet against one
 * of the book's two worked examples and could not build one; nothing on the
 * table ever shot at a gunboat squadron, so `directFireKills` and
 * `pointDefenceAgainstGunboats` had no caller; a transporter fired whether or
 * not anyone was left to send; and `outOfControlTurnsRemaining` and
 * `lifeSupportFailsOnTurn` counted turns nobody could read.
 */

const READING_BEFORE = 12

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

function design(name: string, weapons: WeaponDef[], systems: SystemKind[] = []): ShipDesign {
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
    screens: { level: 0, generators: 0, advanced: false },
    weapons,
    turrets: [],
    systems: [
      { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      ...systems.map((kind, i) => ({
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
    marineParties: 2,
    points: 200,
  }
}

const beam = (over: Partial<WeaponDef> = {}): WeaponDef => ({
  id: 'b1',
  label: 'Beam-3',
  weaponClass: 'beam',
  rating: 3,
  variant: 'standard',
  arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
  mass: 6,
  points: 18,
  ...over,
})

function battle(ships: ShipState[], reading = CURRENT_RULES_VERSION, seed = 0x915): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 200, height: 160 },
    ships,
  })
  setRulesReading(game, reading)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

// ---------------------------------------------------------------------------
// 15 Building a tech base
// ---------------------------------------------------------------------------

describe('spending technology choices (15)', () => {
  it('starts an empire with the universal entries and nothing else', () => {
    // Every line printed "(0 technology choices)" is what an empire has before
    // it spends anything.
    const base = emptyTechBase('Test')
    expect(base.choices).toHaveLength(0)
    expect(techBaseHeld(base).size).toBeGreaterThan(0)
    expect(techBaseCost(base).spent).toBe(0)
    expect(techBaseCost(base).limit).toBe(RECOMMENDED_TECH_CHOICE_LIMIT)
  })

  it('charges each entry what its line prints, and reports the total', () => {
    const base = { ...emptyTechBase('Test'), choices: ['beams-1-3' as const] }
    expect(techChoiceCost('beams-1-3')).toBe(techEntry('beams-1-3').choices)
    expect(techBaseCost(base).spent).toBe(techChoiceCost('beams-1-3'))
  })

  it('opens up what the new entry is a prerequisite for', () => {
    const bare = emptyTechBase('Test')
    const withBeams = { ...bare, choices: ['beams-1-3' as const] }
    const before = new Set(availableTech(bare))
    const after = availableTech(withBeams)
    const opened = after.filter((id) => !before.has(id))
    expect(opened.length).toBeGreaterThan(0)
    for (const id of opened) {
      expect(prerequisitesMet(id, techBaseHeld(withBeams))).toBe(true)
    }
  })

  it('says outright which components a base may not field', () => {
    const bare = emptyTechBase('Test')
    // A base that bought nothing has no screens and no class-4 beam.
    expect(mayFieldSystem(bare, 'screen-generator').allowed).toBe(false)
    expect(
      mayFieldWeapon(bare, { weaponClass: 'beam', rating: 4, variant: 'standard' }).allowed,
    ).toBe(false)
  })

  it('checks a real hull against a base the table built', () => {
    const cruiser = designById('esu-heavy-cruiser') as ShipDesign
    const bare = emptyTechBase('this table')
    expect(canField('custom', cruiser, bare)).toBe(false)
    expect(designProblems('custom', cruiser, bare).length).toBeGreaterThan(0)
    // An unrestricted side never refuses anything.
    expect(canField('unrestricted', cruiser, bare)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 9.1 Shooting at gunboats
// ---------------------------------------------------------------------------

describe('a gunboat squadron under fire (9.1)', () => {
  const squadron = (side: string, at: { x: number; y: number }): GunboatSquadronState =>
    ({
      ...createGunboatSquadron({
        id: 'wing',
        side,
        label: 'Wing',
        position: at,
        status: 'in-flight',
      }),
      side,
    }) as GunboatSquadronState

  const gunline = (reading = CURRENT_RULES_VERSION, systems: SystemKind[] = []): GameState => {
    const game = battle(
      [
        createShipState({
          id: 'shooter',
          side: 'b',
          design: design('Shooter', [beam()], systems),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
        }),
      ],
      reading,
    )
    game.gunboatSquadrons.push(squadron('a', { x: 0, y: 5 }))
    return game
  }

  it('kills one boat per hit, and does not roll damage', () => {
    // "each HIT destroying ONE gunboat ... do not roll damage"
    let killed = 0
    for (let n = 0; n < 30; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'shooter',
            side: 'b',
            design: design('Shooter', [beam()]),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
        ],
        CURRENT_RULES_VERSION,
        n * 104729 + 17,
      )
      game.gunboatSquadrons.push(squadron('a', { x: 0, y: 5 }))
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-at-gunboats',
        shipId: 'shooter',
        weaponId: 'b1',
        squadronId: 'wing',
      })
      killed += 6 - game.gunboatSquadrons[0].boats.length
      // Reset for the next seed.
      game.gunboatSquadrons.length = 0
    }
    expect(killed).toBeGreaterThan(0)
  })

  it('refuses a shot at the shooter’s own squadron', () => {
    const game = gunline()
    game.gunboatSquadrons[0].side = 'b'
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-at-gunboats',
        shipId: 'shooter',
        weaponId: 'b1',
        squadronId: 'wing',
      }).refused,
    ).toMatch(/own gunboats/)
  })

  it('puts point defence on a squadron in phase 9', () => {
    // "PDS weapons engage gunboats like Plasma Bolts only scoring one hit on
    // a 6" — so it takes a lot of dice, and over thirty battles some land.
    let killed = 0
    for (let n = 0; n < 30; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'guard',
            side: 'b',
            design: design('Guard', [], ['pds', 'pds', 'pds', 'pds']),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
        ],
        CURRENT_RULES_VERSION,
        n * 7919 + 11,
      )
      game.gunboatSquadrons.push(squadron('a', { x: 0, y: 4 }))
      advanceTo(game, 'point-defence')
      applyAction(game, { type: 'resolve-point-defence' })
      killed += 6 - game.gunboatSquadrons[0].boats.length
    }
    expect(killed).toBeGreaterThan(0)
  })

  it('leaves a reading-12 battle’s squadron alone in phase 9', () => {
    for (let n = 0; n < 20; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'guard',
            side: 'b',
            design: design('Guard', [], ['pds', 'pds', 'pds', 'pds']),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
        ],
        READING_BEFORE,
        n * 7919 + 11,
      )
      game.gunboatSquadrons.push(squadron('a', { x: 0, y: 4 }))
      advanceTo(game, 'point-defence')
      applyAction(game, { type: 'resolve-point-defence' })
      expect(game.gunboatSquadrons[0].boats).toHaveLength(6)
    }
  })

  it('destroys an FTL squadron that jumps out beside a hull (9.1)', () => {
    // "if there is a ship, planet, asteroid or other object sufficient to
    // cause distortion where the Gunboat engages its FTL, the gunboat is
    // destroyed" — 6 MU.
    const close = gunline()
    close.gunboatSquadrons[0].modifiers.push('ftl')
    close.gunboatSquadrons[0].position = { x: 0, y: 4 }
    applyAction(close, { type: 'gunboat-ftl-exit', squadronId: 'wing' })
    expect(close.gunboatSquadrons[0].boats).toHaveLength(0)
    expect(close.log.some((line) => /too close to a hull/.test(line.text))).toBe(true)

    const clear = gunline()
    clear.gunboatSquadrons[0].modifiers.push('ftl')
    clear.gunboatSquadrons[0].position = { x: 0, y: 40 }
    applyAction(clear, { type: 'gunboat-ftl-exit', squadronId: 'wing' })
    expect(clear.gunboatSquadrons[0].boats).toHaveLength(6)
    expect(clear.log.some((line) => /jumps out/.test(line.text))).toBe(true)
  })

  it('refuses the jump on a squadron with no FTL drive', () => {
    const game = gunline()
    expect(applyAction(game, { type: 'gunboat-ftl-exit', squadronId: 'wing' }).refused).toMatch(
      /no FTL drive/,
    )
  })
})

// ---------------------------------------------------------------------------
// 5.9 Transporters
// ---------------------------------------------------------------------------

describe('a transporter with nobody to send (5.9)', () => {
  const beamer: WeaponDef = {
    id: 'tb1',
    label: 'TB-2',
    weaponClass: 'transporter',
    rating: 2,
    variant: 'standard',
    arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
    mass: 4,
    points: 12,
  }

  const pair = (reading = CURRENT_RULES_VERSION): GameState =>
    battle(
      [
        createShipState({
          id: 'raider',
          side: 'b',
          design: design('Raider', [beamer]),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
        }),
        createShipState({
          id: 'prize',
          side: 'a',
          design: design('Prize', [], ['pds']),
          placement: { position: { x: 0, y: 6 }, facing: 12 },
        }),
      ],
      reading,
    )

  it('is refused once the Marines and the parties are gone', () => {
    // "If a ship runs out of Damage Control Parties and Marines, it may no
    // longer use transporters."
    // A party comes from a surviving crew factor and from what the design
    // bought, so the hull has to be shot away to the last box and the design
    // must have bought none.
    const game = battle([
      createShipState({
        id: 'raider',
        side: 'b',
        design: {
          ...design('Raider', [beamer]),
          additionalDamageControlParties: 0,
          marineParties: 0,
        },
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'prize',
        side: 'a',
        design: design('Prize', [], ['pds']),
        placement: { position: { x: 0, y: 6 }, facing: 12 },
      }),
    ])
    const raider = shipOf(game, 'raider')
    raider.marinesAboard = 0
    // Every party has already been transported away, which is the only way a
    // live ship runs out: they are aboard somebody else now.
    raider.partiesTransported = damageControlParties(raider)
    expect(damageControlParties(raider)).toBe(0)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
      }).refused,
    ).toMatch(/no parties left/)
  })

  it('fires normally while somebody is left', () => {
    const game = pair()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
      }).refused,
    ).toBeUndefined()
  })

  it('spends the parties it sends over', () => {
    // "Every hit generated allows the player to send one unit of Marines or a
    // Damage Control Party over to the enemy ship" — and a party aboard
    // somebody else is not aboard this one.
    let spent = false
    for (let n = 0; n < 40 && !spent; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'raider',
            side: 'b',
            design: design('Raider', [beamer]),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'prize',
            side: 'a',
            design: design('Prize', [], ['pds']),
            placement: { position: { x: 0, y: 4 }, facing: 12 },
          }),
        ],
        CURRENT_RULES_VERSION,
        n * 7919 + 11,
      )
      const raider = shipOf(game, 'raider')
      const marines = raider.marinesAboard
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
      })
      if (raider.marinesAboard < marines) {
        spent = true
        expect(shipOf(game, 'prize').boarders.length).toBeGreaterThan(0)
      }
    }
    expect(spent).toBe(true)
  })

  it('will not send a Damage Control Party on a commando raid', () => {
    // "ONLY Marines may be used for such actions"
    const game = pair()
    shipOf(game, 'raider').marinesAboard = 0
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'commando-raid',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
        systemId: 'pds-1',
      }).refused,
    ).toMatch(/no Marines left/)
  })

  it('will not send them against a protected system', () => {
    const game = battle([
      createShipState({
        id: 'raider',
        side: 'b',
        design: design('Raider', [beamer]),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'prize',
        side: 'a',
        design: design('Prize', [], ['antimatter-charge']),
        placement: { position: { x: 0, y: 6 }, facing: 12 },
      }),
    ])
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'commando-raid',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
        systemId: 'antimatter-charge-1',
      }).refused,
    ).toMatch(/Core or protected/)
  })

  it('runs the raid and can take the system off the SSD', () => {
    let destroyed = false
    for (let n = 0; n < 60 && !destroyed; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'raider',
            side: 'b',
            design: design('Raider', [beamer]),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'prize',
            side: 'a',
            design: design('Prize', [], ['pds']),
            placement: { position: { x: 0, y: 4 }, facing: 12 },
          }),
        ],
        CURRENT_RULES_VERSION,
        n * 104729 + 17,
      )
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'commando-raid',
        shipId: 'raider',
        weaponId: 'tb1',
        targetId: 'prize',
        systemId: 'pds-1',
      })
      if (shipOf(game, 'prize').destroyedSystems.has('pds-1')) destroyed = true
      expect(game.log.some((line) => /raids/.test(line.text))).toBe(true)
    }
    expect(destroyed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 10.3 The two clocks
// ---------------------------------------------------------------------------

describe('10.3’s clocks, as a player reads them', () => {
  const hurt = (): { game: GameState; ship: ShipState } => {
    const game = battle([
      createShipState({
        id: 'hulk',
        side: 'a',
        design: design('Hulk', [beam()]),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
    ])
    return { game, ship: shipOf(game, 'hulk') }
  }

  it('counts the turns a bridge hit still has to run', () => {
    const { game, ship } = hurt()
    expect(outOfControlTurnsRemaining(ship, game.turn)).toBeNull()
    ship.ongoing.push({
      source: 'bridge',
      expiresAfterTurn: game.turn + 2,
    } as (typeof ship.ongoing)[number])
    expect(outOfControlTurnsRemaining(ship, game.turn)).toBe(3)
  })

  it('says which turn the crew is lost on', () => {
    const { game, ship } = hurt()
    expect(lifeSupportFailsOnTurn(ship)).toBeNull()
    expect(isDerelict(ship)).toBe(false)
    ship.ongoing.push({
      source: 'life-support',
      expiresAfterTurn: game.turn + 3,
    } as (typeof ship.ongoing)[number])
    expect(lifeSupportFailsOnTurn(ship)).toBe(game.turn + 4)
  })
})
