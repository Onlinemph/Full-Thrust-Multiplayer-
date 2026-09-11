import { describe, expect, it } from 'vitest'

import { Rng } from './dice'
import {
  GATLING_GUNBOAT_SHORT_RANGE,
  GUNBOAT_BAY_MASS,
  GUNBOAT_CEF,
  GUNBOAT_FIRE_CONTROL,
  GUNBOAT_MOVE,
  GUNBOAT_RACK_MASS,
  GUNBOAT_SECONDARY_MOVE,
  GUNBOAT_SQUADRON_SIZE,
  GUNBOAT_TYPES,
  beginGunboatTurn,
  canLaunchSquadron,
  canRecoverSquadron,
  canSquadronAttack,
  createGunboatSquadron,
  directFireKills,
  ftlTransitDestroys,
  gatlingGunboatDice,
  isSquadronDestroyed,
  isSquadronExhausted,
  launchGunboatSquadron,
  moveGunboatSquadron,
  pointDefenceAgainstGunboats,
  recoverGunboatSquadron,
  resolveGunboatAttack,
  secondaryMoveGunboatSquadron,
  squadronPoints,
  squadronStrength,
  validateGunboatBuild,
  type GunboatCarrierState,
  type GunboatTypeId,
} from './gunboats'

/**
 * Section 9, checked against its own prose.
 *
 * The rules worth guarding are the ones that invert section 8: a gunboat is
 * easier to kill with ship guns and harder to kill with point defence, and
 * every distance is smaller than a fighter's. Those are the numbers a reader
 * would assume they knew and get wrong.
 */

const rng = () => new Rng(0x9117)

function squadron(boats?: GunboatTypeId[], modifiers: ('ftl' | 'heavy')[] = []) {
  return createGunboatSquadron({
    id: 'gb1',
    side: 'a',
    boats: boats ?? (Array(6).fill('beam') as GunboatTypeId[]),
    modifiers,
    carrierId: 'ship1',
    position: { x: 0, y: 0 },
    status: 'in-flight',
  })
}

const rack: GunboatCarrierState = { racks: 1, bays: 0, used: 0 }
const bay: GunboatCarrierState = { racks: 1, bays: 1, used: 0 }

describe('the squadron (9.1)', () => {
  it('is six gunboats with six points of endurance', () => {
    const gb = createGunboatSquadron({ id: 'g', side: 'a' })
    expect(squadronStrength(gb)).toBe(GUNBOAT_SQUADRON_SIZE)
    expect(gb.cef).toBe(GUNBOAT_CEF)
    expect(GUNBOAT_SQUADRON_SIZE).toBe(6)
    expect(GUNBOAT_CEF).toBe(6)
  })

  it('moves 18 MU, not a fighter’s 24', () => {
    expect(GUNBOAT_MOVE).toBe(18)
    const gb = squadron()
    expect(moveGunboatSquadron(gb, { x: 18, y: 0 }).moved).toBe(true)
    const tooFar = moveGunboatSquadron(gb, { x: 18.5, y: 0 })
    expect(tooFar.moved).toBe(false)
    expect(tooFar.reason).toContain('18 MU')
  })

  it('makes a 9 MU secondary move for one endurance point', () => {
    expect(GUNBOAT_SECONDARY_MOVE).toBe(9)
    const gb = squadron()
    const moved = secondaryMoveGunboatSquadron(gb, { x: 9, y: 0 })
    expect(moved.moved).toBe(true)
    expect(moved.squadron.cef).toBe(GUNBOAT_CEF - 1)
    expect(secondaryMoveGunboatSquadron(gb, { x: 9.5, y: 0 }).moved).toBe(false)
  })

  it('will not make a secondary move on an empty tank', () => {
    const dry = { ...squadron(), cef: 0 }
    expect(isSquadronExhausted(dry)).toBe(true)
    const result = secondaryMoveGunboatSquadron(dry, { x: 1, y: 0 })
    expect(result.moved).toBe(false)
    expect(result.reason).toContain('endurance')
  })

  it('clears its per-turn flags at the top of a turn', () => {
    const spent = { ...squadron(), movedThisTurn: true, attackedThisTurn: true, evading: true }
    const fresh = beginGunboatTurn(spent)
    expect(fresh.movedThisTurn).toBe(false)
    expect(fresh.attackedThisTurn).toBe(false)
    expect(fresh.evading).toBe(false)
    // Endurance is not a per-turn flag: it runs down over the battle (9.1).
    expect(fresh.cef).toBe(spent.cef)
  })
})

describe('launch and recovery (9.1)', () => {
  it('launches off a rack', () => {
    const gb = createGunboatSquadron({ id: 'g', side: 'a', carrierId: 's' })
    expect(canLaunchSquadron(gb, rack).allowed).toBe(true)
    const out = launchGunboatSquadron(gb, rack, 3, { x: 10, y: 10 })
    expect(out.launched).toBe(true)
    expect(out.squadron.status).toBe('in-flight')
    expect(out.squadron.launchedTurn).toBe(3)
    expect(out.squadron.position).toEqual({ x: 10, y: 10 })
  })

  it('refuses a second launch when the rack is already used', () => {
    const gb = createGunboatSquadron({ id: 'g', side: 'a' })
    const used: GunboatCarrierState = { racks: 1, bays: 0, used: 1 }
    expect(canLaunchSquadron(gb, used).allowed).toBe(false)
  })

  it('will not take a squadron back onto a rack, only into a bay', () => {
    // "Gunboats cannot be refueled or rearmed in combat using their carrying
    // rack" (9.1) — a rack is a one-way trip.
    const gb = squadron()
    const onRack = canRecoverSquadron(gb, rack)
    expect(onRack.allowed).toBe(false)
    expect(onRack.reason).toContain('boat bay')
    expect(canRecoverSquadron(gb, bay).allowed).toBe(true)
  })

  it('refuels a squadron that lands in a bay', () => {
    const tired = { ...squadron(), cef: 1 }
    const back = recoverGunboatSquadron(tired, bay, 5)
    expect(back.recovered).toBe(true)
    expect(back.squadron.status).toBe('aboard')
    expect(back.squadron.cef).toBe(GUNBOAT_CEF)
    expect(back.squadron.recoveredTurn).toBe(5)
  })

  it('destroys an FTL gunboat that jumps too close to something massive', () => {
    // "if they jump or arrive within 6 MU of a 'massive object', they are
    // automatically destroyed" (9.1).
    expect(ftlTransitDestroys({ x: 0, y: 0 }, [{ x: 5, y: 0 }])).toBe(true)
    expect(ftlTransitDestroys({ x: 0, y: 0 }, [{ x: 6, y: 0 }])).toBe(true)
    expect(ftlTransitDestroys({ x: 0, y: 0 }, [{ x: 6.5, y: 0 }])).toBe(false)
    expect(ftlTransitDestroys({ x: 0, y: 0 }, [])).toBe(false)
  })
})

describe('attacking (9.1, 9.2)', () => {
  it('reaches 12 MU, twice as far as a fighter', () => {
    expect(GUNBOAT_FIRE_CONTROL).toBe(12)
    const gb = squadron()
    expect(canSquadronAttack(gb, 12).allowed).toBe(true)
    const far = canSquadronAttack(gb, 12.5)
    expect(far.allowed).toBe(false)
    expect(far.reason).toContain('fire control')
  })

  it('spends one endurance point for the squadron, however many boats fire', () => {
    const result = resolveGunboatAttack(squadron(), { screens: 0, range: 6 }, rng())
    expect(result.fired).toBe(true)
    expect(result.cefSpent).toBe(1)
    expect(result.squadron.cef).toBe(GUNBOAT_CEF - 1)
    expect(result.squadron.attackedThisTurn).toBe(true)
  })

  it('rolls two beams for every Beam Gunboat', () => {
    // "Beam Gunboats carry 2 class-1 beams" (9.2), so a full squadron throws
    // twelve dice before any re-roll.
    const result = resolveGunboatAttack(squadron(), { screens: 0, range: 6 }, rng())
    expect(result.dice.length).toBeGreaterThanOrEqual(12)
    expect(result.shots).toHaveLength(12)
  })

  it('will not fire twice in a turn, or on an empty tank', () => {
    const fired = { ...squadron(), attackedThisTurn: true }
    expect(canSquadronAttack(fired, 6).allowed).toBe(false)
    const dry = { ...squadron(), cef: 0 }
    expect(canSquadronAttack(dry, 6).allowed).toBe(false)
  })

  it('gives the Gatling Gunboat six dice close in and two at reach', () => {
    // "6 BD* against a single target within 6 MU, or 2BD* at 12 MU" (9.2).
    expect(gatlingGunboatDice(1)).toBe(6)
    expect(gatlingGunboatDice(GATLING_GUNBOAT_SHORT_RANGE)).toBe(6)
    expect(gatlingGunboatDice(6.5)).toBe(2)
    expect(gatlingGunboatDice(12)).toBe(2)
    expect(gatlingGunboatDice(12.5)).toBe(0)
  })

  it('lets a squadron mix its types, as 9.1 says it may', () => {
    const mixed = squadron(['beam', 'graser', 'plasma', 'needle', 'gatling', 'beam'])
    const result = resolveGunboatAttack(mixed, { screens: 0, range: 4 }, rng())
    expect(result.fired).toBe(true)
    // Two Beam Gunboats fire two mounts each; the other four fire one apiece.
    expect(result.shots).toHaveLength(8)
    expect(result.dice.length).toBeGreaterThan(0)
  })

  it('feels screens, because a gunboat’s guns are ship guns', () => {
    const open = resolveGunboatAttack(squadron(), { screens: 0, range: 6 }, new Rng(7))
    const screened = resolveGunboatAttack(squadron(), { screens: 2, range: 6 }, new Rng(7))
    expect(screened.normalDamage).toBeLessThan(open.normalDamage)
  })
})

describe('being shot at (9.1)', () => {
  it('loses one gunboat per anti-ship hit, with no damage roll', () => {
    // "each HIT destroying ONE gunboat … do not roll damage" (9.1).
    const hit = directFireKills(squadron(), 3, rng())
    expect(hit.killed).toBe(3)
    expect(squadronStrength(hit.squadron)).toBe(3)
  })

  it('cannot lose more gunboats than it has', () => {
    const hit = directFireKills(squadron(), 99, rng())
    expect(hit.killed).toBe(6)
    expect(isSquadronDestroyed(hit.squadron)).toBe(true)
    expect(hit.squadron.status).toBe('destroyed')
  })

  it('takes its losses at random, not by the owner’s choice', () => {
    // "the owning player should roll randomly" (9.1) — which matters because
    // 9.1 lets a squadron mix cheap and expensive boats.
    const mixed = squadron(['beam', 'graser', 'plasma', 'needle', 'gatling', 'beam'])
    const a = directFireKills(mixed, 2, new Rng(1)).lost
    const b = directFireKills(mixed, 2, new Rng(99)).lost
    expect(a).toHaveLength(2)
    expect(b).toHaveLength(2)
    // Different streams pick different boats; if they never did, the roll is
    // not a roll.
    expect(a.join() === b.join() && a[0] === a[1]).toBe(false)
  })

  it('shrugs off a PDS on anything but a 6', () => {
    // "PDS weapons engage gunboats like Plasma Bolts only scoring one hit on
    // a 6" (9.1). Over many mounts the kill rate is about one in six, which is
    // far below the 4-or-5 table a fighter faces.
    let kills = 0
    const stream = new Rng(0xbeef)
    for (let i = 0; i < 200; i++) {
      kills += pointDefenceAgainstGunboats(squadron(), ['pds'], stream).killed
    }
    expect(kills).toBeGreaterThan(10)
    expect(kills).toBeLessThan(60)
  })

  it('takes a scattergun harder than a PDS', () => {
    // "Scatterguns/Interceptor Pods cause 1 BD* of hits" (9.1): the beam table
    // read as kills, which lands on a 4 as well as a 6.
    const count = (mount: 'pds' | 'scattergun') => {
      let kills = 0
      const stream = new Rng(0x51ee)
      for (let i = 0; i < 200; i++) {
        kills += pointDefenceAgainstGunboats(squadron(), [mount], stream).killed
      }
      return kills
    }
    expect(count('scattergun')).toBeGreaterThan(count('pds'))
  })

  it('is harder to hit when it is a Heavy squadron', () => {
    // "All weapons fire against the gunboat has a -1 DRM" (9.2), so a PDS that
    // needed a 6 now needs a face of 7 and never gets one.
    let kills = 0
    const stream = new Rng(0xf00d)
    for (let i = 0; i < 100; i++) {
      kills += pointDefenceAgainstGunboats(squadron(undefined, ['heavy']), ['pds'], stream).killed
    }
    expect(kills).toBe(0)
  })
})

describe('building a squadron (9.1, 9.2)', () => {
  it('prices the hulls per gunboat and the modifications per squadron', () => {
    expect(squadronPoints(Array(6).fill('beam'))).toBe(54)
    expect(squadronPoints(Array(6).fill('gatling'))).toBe(90)
    expect(squadronPoints(Array(6).fill('beam'), ['heavy'])).toBe(54 + 12)
    expect(squadronPoints(Array(6).fill('beam'), ['ftl'])).toBe(54 + 6)
    expect(squadronPoints(Array(6).fill('beam'), ['ftl', 'heavy'])).toBe(54 + 6 + 12)
  })

  it('prices every catalogued type as printed', () => {
    expect(GUNBOAT_TYPES.beam.pointsEach).toBe(9)
    expect(GUNBOAT_TYPES.plasma.pointsEach).toBe(9)
    expect(GUNBOAT_TYPES.graser.pointsEach).toBe(9)
    expect(GUNBOAT_TYPES.gatling.pointsEach).toBe(15)
    expect(GUNBOAT_TYPES.needle.pointsEach).toBe(9)
  })

  it('gives a rack 18 mass and a bay 24', () => {
    expect(GUNBOAT_RACK_MASS).toBe(18)
    expect(GUNBOAT_BAY_MASS).toBe(24)
  })

  it('refuses a seventh gunboat and an FTL squadron on a rack', () => {
    expect(validateGunboatBuild(Array(7).fill('beam'))).toHaveLength(1)
    expect(validateGunboatBuild([])).toHaveLength(1)
    const ftlOnRack = validateGunboatBuild(Array(6).fill('beam'), ['ftl'], {
      carriedOnRack: true,
    })
    expect(ftlOnRack[0]).toContain('cannot be carried in racks')
    expect(validateGunboatBuild(Array(6).fill('beam'), ['ftl'])).toEqual([])
    expect(validateGunboatBuild(Array(6).fill('beam'), ['heavy', 'heavy'])).toHaveLength(1)
  })
})
