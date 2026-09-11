/**
 * Flight operations — fighters (section 8).
 *
 * Every worked example printed in section 8 is a test here, run on a scripted
 * die so the faces are the book's own. The rest of the coverage walks the
 * catalogue of 8.15 and the tables of 8.3, 8.8, 8.10, 8.12 and 8.16.
 */

import { describe, expect, it } from 'vitest'

import { Rng, rollBeamVolley } from './dice'
import {
  FIGHTER_MODIFIERS,
  FIGHTER_TYPES,
  FTL_FIGHTER_DEPLOY_RANGE,
  MKP_DAMAGE_PER_HIT,
  aceDuel,
  aceNeedleAttack,
  adfcLockedOut,
  applyFighterLosses,
  assignScreen,
  assignScreenEngagements,
  attackDiceCount,
  beginFighterTurn,
  canDeclareAttack,
  canLaunch,
  combatLanding,
  createFighterGroup,
  d3,
  declarePursuit,
  deployFtlFighters,
  effectiveType,
  evadeShipFire,
  fighterMoraleCheck,
  fighterProfile,
  groupProfile,
  interceptMissiles,
  isCannonArmed,
  isExhausted,
  launchFighterGroup,
  launchFighterMissiles,
  launchFighterMkps,
  launchPulseTorpedoes,
  mainMoveAllowance,
  moveFighterGroup,
  moveWithEscortedShip,
  pointDefenceAgainstFighters,
  reconfigureMultiRole,
  recoverFighterGroup,
  refuseDogfight,
  resolveAttackRun,
  resolveBoardingRun,
  resolveDogfight,
  resolveInterceptedAttackRun,
  resolveMultiGroupDogfight,
  rollExhaustedReturnFire,
  rollFighterKills,
  rollFighterVolley,
  rollPilotQuality,
  rollPlasmaFighterVolley,
  rollRearm,
  scrambleFighters,
  screenHasBrokenOff,
  secondaryMoveAllowance,
  secondaryMoveFighterGroup,
  shipFireAtFighters,
  splitKills,
  takesSecondaryMoveInPhaseFour,
  validateFighterBuild,
  worstRearm,
  type CarrierFlightState,
  type FighterGroup,
  type FighterModifierId,
  type FighterProfile,
  type FighterTypeId,
  type ScrambleResult,
} from './fighters'

// ---------------------------------------------------------------------------
// A die you can dictate to
// ---------------------------------------------------------------------------

/**
 * An `Rng` whose `d6` faces are handed to it in order. `d6` is
 * `floor(next() * 6) + 1`, so a face of `f` needs `next()` in
 * `[(f-1)/6, f/6)`.
 */
class ScriptedRng extends Rng {
  private queue: number[]

  constructor(faces: number[]) {
    super(1)
    this.queue = [...faces]
  }

  override next(): number {
    const face = this.queue.shift()
    if (face === undefined) throw new Error('scripted die exhausted — the test rolled more than it scripted')
    return (face - 1) / 6 + 1e-9
  }

  get remaining(): number {
    return this.queue.length
  }
}

const CARRIER: CarrierFlightState = {
  launchFacilities: 2,
  facilitiesUsed: 0,
  usedThrust: false,
  catapults: false,
}

function group(
  id: string,
  typeId: FighterTypeId = 'standard',
  overrides: Partial<FighterGroup> = {},
  modifiers: FighterModifierId[] = [],
): FighterGroup {
  return {
    ...createFighterGroup({ id, side: 'blue', typeId, modifiers, status: 'in-flight' }),
    ...overrides,
  }
}

/** Roll one scramble (8.3) on a dictated die. */
function scramble(
  face: number,
  opts: {
    carrierUsedThrust: boolean
    launchCapacity: number
    rearming?: boolean
    profile?: FighterProfile
  },
): ScrambleResult {
  return scrambleFighters(new ScriptedRng([face]), opts)
}

// ---------------------------------------------------------------------------
// The scripted die itself
// ---------------------------------------------------------------------------

describe('scripted die', () => {
  it('produces exactly the faces it is given', () => {
    const rng = new ScriptedRng([1, 2, 3, 4, 5, 6])
    const faces = rollExhaustedReturnFire(6, rng)
    expect(faces.dice).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('rolls a d3 as 1.7 prescribes: 1-2 = 1, 3-4 = 2, 5-6 = 3', () => {
    const rng = new ScriptedRng([1, 2, 3, 4, 5, 6])
    expect([d3(rng), d3(rng), d3(rng), d3(rng), d3(rng), d3(rng)]).toEqual([1, 1, 2, 2, 3, 3])
  })
})

// ---------------------------------------------------------------------------
// Reuse of the spine
// ---------------------------------------------------------------------------

describe('fighter dice reuse the beam table (4.5, 8.9)', () => {
  it('matches rollBeamVolley die for die when no modifier is in play', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = rollBeamVolley(6, 1, new Rng(seed), { penetrating: true })
      const b = rollFighterVolley(6, 1, new Rng(seed), { drm: 0, reroll: true })
      expect(b.dice).toEqual(a.dice.map((die) => die.natural))
      expect(b.normalDamage).toBe(a.normalDamage)
      expect(b.penetratingDamage).toBe(a.penetratingDamage)
    }
  })

  it('keeps the DRM off the re-roll (1.7)', () => {
    // Natural 6 under +1: 2 damage, then a re-roll of 3 that the +1 must not
    // lift to a 4. "the DRM will not normally be applied to the re-roll as well".
    const rng = new ScriptedRng([6, 3])
    const volley = rollFighterVolley(1, 0, rng, { drm: 1 })
    expect(volley.normalDamage).toBe(2)
    expect(volley.penetratingDamage).toBe(0)
  })

  it('re-rolls only on the natural six, never on a modified one (4.6)', () => {
    // A natural 5 under +1 reads as a 6 on the table but earns no extra die.
    const rng = new ScriptedRng([5])
    const volley = rollFighterVolley(1, 0, rng, { drm: 1 })
    expect(volley.normalDamage).toBe(2)
    expect(volley.dice).toEqual([5])
  })
})

// ---------------------------------------------------------------------------
// 8.15 the catalogue
// ---------------------------------------------------------------------------

describe('8.15 fighter catalogue', () => {
  it('prices every base type per fighter and per wing as printed', () => {
    const printed: Array<[FighterTypeId, number, number]> = [
      ['standard', 3, 18],
      ['interceptor', 3, 18],
      ['attack', 4, 24],
      ['torpedo', 6, 36],
      ['graser', 7, 42],
      ['plasma', 7, 42],
      ['mkp', 6, 36],
      ['missile', 4, 24],
      ['multi-role', 5, 30],
    ]
    for (const [id, perFighter, perWing] of printed) {
      expect(FIGHTER_TYPES[id].pointsPerFighter).toBe(perFighter)
      expect(FIGHTER_TYPES[id].pointsPerWing).toBe(perWing)
      expect(perFighter * 6).toBe(perWing)
    }
    // "Assault Shuttles cost 6 points per wing" — the one type priced per wing.
    expect(FIGHTER_TYPES['assault-shuttle'].pointsPerWing).toBe(6)
  })

  it('reproduces the pre-priced modifier combinations the book lists', () => {
    // "Fast standard fighters cost 4 each, 24 per wing."
    expect(fighterProfile('standard', ['fast']).points).toBe(24)
    // "Long Range standard fighters cost 4 each, 24 per wing."
    expect(fighterProfile('standard', ['long-range']).points).toBe(24)
    // "Standard Robot Fighters cost 2 each, 12 per wing."
    expect(fighterProfile('standard', ['robot']).points).toBe(12)
    // Heavy is "+3 per fighter (+18 per wing)".
    expect(fighterProfile('standard', ['heavy']).points).toBe(18 + 18)
  })

  it('gives Fast 36 MU but keeps the secondary move at 12 MU', () => {
    const fast = fighterProfile('standard', ['fast'])
    expect(fast.move).toBe(36)
    expect(fast.secondaryMove).toBe(12)
    expect(fighterProfile('standard').move).toBe(24)
  })

  it('gives Long Range nine CEF and Light four', () => {
    expect(fighterProfile('standard').cef).toBe(6)
    expect(fighterProfile('standard', ['long-range']).cef).toBe(9)
    expect(fighterProfile('standard', ['light']).cef).toBe(4)
  })

  it('puts eight fighters in a Light group at the price of six regulars', () => {
    const light = fighterProfile('standard', ['light'])
    expect(light.groupSize).toBe(8)
    expect(light.points).toBe(18)
    // "Light Fighters cost the same as other fighter types. 18 for standard,
    // 24 for attack, etc."
    expect(fighterProfile('attack', ['light']).points).toBe(24)
  })

  it('scores Heavy at -1 and Light at +1 to whoever is shooting at them', () => {
    expect(fighterProfile('standard', ['heavy']).defenceDrm).toBe(-1)
    expect(fighterProfile('standard', ['light']).defenceDrm).toBe(1)
    expect(fighterProfile('standard').defenceDrm).toBe(0)
  })

  it('rejects the builds 8.15 forbids for Light Fighters', () => {
    expect(validateFighterBuild('standard', ['light', 'heavy'])).toHaveLength(1)
    expect(validateFighterBuild('standard', ['light', 'long-range'])).toHaveLength(1)
    expect(validateFighterBuild('torpedo', ['light'])).toEqual([
      'Light Fighters may not be built as Torpedo Fighter (8.15)',
    ])
    // "Light Fighters may have Fast, Interceptor, or Attack modifications."
    expect(validateFighterBuild('attack', ['light', 'fast'])).toEqual([])
    expect(validateFighterBuild('missile', ['light'])).toEqual([])
  })

  it('applies Long Range only once', () => {
    expect(validateFighterBuild('standard', ['long-range', 'long-range'])).toContain(
      'Long Range may only be applied once (8.15)',
    )
  })

  it('keeps Attack and Torpedo Fighters off missile interception (8.12)', () => {
    expect(FIGHTER_TYPES.attack.canInterceptMissiles).toBe(false)
    expect(FIGHTER_TYPES.torpedo.canInterceptMissiles).toBe(false)
    expect(FIGHTER_TYPES.standard.canInterceptMissiles).toBe(true)
    expect(FIGHTER_TYPES.interceptor.canInterceptMissiles).toBe(true)
  })

  it('marks every (+Mod) entry as a modifier, not a type of its own', () => {
    const ids = Object.keys(FIGHTER_MODIFIERS)
    expect(ids.sort()).toEqual(['fast', 'ftl', 'heavy', 'light', 'long-range', 'robot'].sort())
    for (const id of ids) {
      expect(Object.keys(FIGHTER_TYPES)).not.toContain(id)
    }
  })

  it('treats the graser and plasma secondary "cannon" as BD*, not the cannon option', () => {
    // 8.15 Graser: "secondary cannon that inflict only BD* hits with a -2 DRM".
    expect(isCannonArmed(group('g', 'graser'))).toBe(false)
    expect(isCannonArmed(group('p', 'plasma'))).toBe(false)
    expect(isCannonArmed(group('s', 'standard', { armament: 'cannon' }))).toBe(true)
    expect(isCannonArmed(group('s2', 'standard', { armament: 'beam' }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.1 – 8.4 flight deck operations
// ---------------------------------------------------------------------------

describe('8.1/8.2 launch', () => {
  it('halves the move on the launch turn and restores it afterwards', () => {
    const launched = launchFighterGroup(
      group('a', 'standard', { status: 'aboard' }),
      CARRIER,
      3,
      { x: 0, y: 0 },
    )
    expect(launched.launched).toBe(true)
    // "Move distance on the launch turn is only half normal".
    expect(mainMoveAllowance(launched.group, 3)).toBe(12)
    expect(mainMoveAllowance(launched.group, 4)).toBe(24)
  })

  it('halves a Fast group to 18 MU on the launch turn', () => {
    const fast = group('f', 'standard', { status: 'aboard' }, ['fast'])
    const launched = launchFighterGroup(fast, CARRIER, 1, { x: 0, y: 0 })
    expect(mainMoveAllowance(launched.group, 1)).toBe(18)
    expect(mainMoveAllowance(launched.group, 2)).toBe(36)
  })

  it('refuses to launch from a carrier that applied thrust unless it has catapults (8.2)', () => {
    const aboard = group('a', 'standard', { status: 'aboard' })
    const thrusting: CarrierFlightState = { ...CARRIER, usedThrust: true }
    expect(canLaunch(aboard, thrusting, 1).allowed).toBe(false)
    expect(canLaunch(aboard, { ...thrusting, catapults: true }, 1).allowed).toBe(true)
  })

  it('launches only as many groups as there are operational tubes (8.1)', () => {
    const aboard = group('a', 'standard', { status: 'aboard' })
    expect(canLaunch(aboard, { ...CARRIER, launchFacilities: 1, facilitiesUsed: 0 }, 1).allowed).toBe(true)
    expect(canLaunch(aboard, { ...CARRIER, launchFacilities: 1, facilitiesUsed: 1 }, 1).allowed).toBe(false)
  })

  it('holds a re-arming group back until its ready turn (8.16)', () => {
    const rearming = group('a', 'standard', { status: 'aboard', readyTurn: 5 })
    expect(canLaunch(rearming, CARRIER, 4).allowed).toBe(false)
    expect(canLaunch(rearming, CARRIER, 5).allowed).toBe(true)
  })

  it('lets FTL fighters deploy within 6 MU of the carrier for 1 CEF (8.15)', () => {
    const ftl = group('a', 'standard', { status: 'aboard' }, ['ftl'])
    const near = deployFtlFighters(ftl, { x: 0, y: 0 }, { x: FTL_FIGHTER_DEPLOY_RANGE, y: 0 })
    expect(near.launched).toBe(true)
    expect(near.group.cef).toBe(5)
    expect(near.group.status).toBe('in-flight')
    const far = deployFtlFighters(ftl, { x: 0, y: 0 }, { x: 7, y: 0 })
    expect(far.launched).toBe(false)
  })
})

describe('8.3 scrambling', () => {
  it('walks the whole 1-6 table', () => {
    const table = [
      { face: 1, outcome: 'bay-wrecked', launched: 0, inTime: false },
      { face: 2, outcome: 'no-launch', launched: 0, inTime: false },
      { face: 3, outcome: 'no-launch', launched: 0, inTime: false },
      { face: 4, outcome: 'too-late', launched: 1, inTime: false },
      { face: 5, outcome: 'intercept', launched: 1, inTime: true },
      { face: 6, outcome: 'double-intercept', launched: 2, inTime: true },
    ]
    for (const row of table) {
      const result = scramble(row.face, { carrierUsedThrust: false, launchCapacity: 2 })
      expect(result.outcome).toBe(row.outcome)
      expect(result.groupsLaunched).toBe(row.launched)
      expect(result.interceptsInTime).toBe(row.inTime)
    }
  })

  it('makes the attackers fire first on a 4, and not on a 5', () => {
    expect(scramble(4, { carrierUsedThrust: false, launchCapacity: 2 }).attackersFireFirst).toBe(true)
    expect(scramble(5, { carrierUsedThrust: false, launchCapacity: 2 }).attackersFireFirst).toBe(false)
  })

  it('caps a 6 at one group on a carrier that can only launch one per turn', () => {
    const result = scramble(6, { carrierUsedThrust: false, launchCapacity: 1 })
    expect(result.groupsLaunched).toBe(1)
    expect(result.outcome).toBe('intercept')
  })

  it('refuses outright if the ship applied thrust', () => {
    const result = scramble(6, { carrierUsedThrust: true, launchCapacity: 3 })
    expect(result.groupsLaunched).toBe(0)
    expect(result.reason).toContain('thrust')
  })

  it('launches re-arming fighters on half fuel — 3 CEF standard, 4 Long Range', () => {
    // The book's own worked figures, which is why the half rounds down.
    expect(
      scramble(5, { carrierUsedThrust: false, launchCapacity: 1, rearming: true, profile: fighterProfile('standard') })
        .cefOnLaunch,
    ).toBe(3)
    expect(
      scramble(5, {
        carrierUsedThrust: false,
        launchCapacity: 1,
        rearming: true,
        profile: fighterProfile('standard', ['long-range']),
      }).cefOnLaunch,
    ).toBe(4)
  })
})

describe('8.4 combat landings', () => {
  it('recovers everything and grounds it for the rest of the game', () => {
    const groups = [group('a'), group('b'), group('c', 'standard', { status: 'aboard' })]
    const result = combatLanding(groups, { carrierUsedThrust: false, hangarCriticalHits: 0 })
    expect(result.landed).toBe(2)
    expect(result.deckFouled).toBe(true)
    expect(result.groups.filter((g) => g.grounded)).toHaveLength(2)
    expect(result.groups.every((g) => g.status === 'aboard')).toBe(true)
  })

  it('adds +1 to the collateral damage rolls when hangar bays have been hit', () => {
    const result = combatLanding([group('a')], { carrierUsedThrust: false, hangarCriticalHits: 2 })
    expect(result.collateralDrm).toBe(1)
  })

  it('is barred to a ship that applied thrust', () => {
    const result = combatLanding([group('a')], { carrierUsedThrust: true, hangarCriticalHits: 0 })
    expect(result.allowed).toBe(false)
    expect(result.landed).toBe(0)
  })

  it('locks out the ADFC on any launch or recovery turn', () => {
    expect(adfcLockedOut({ launchedThisTurn: true, recoveredThisTurn: false })).toBe(true)
    expect(adfcLockedOut({ launchedThisTurn: false, recoveredThisTurn: true })).toBe(true)
    expect(adfcLockedOut({ launchedThisTurn: false, recoveredThisTurn: false })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.5 movement, and the figure-18 worked example
// ---------------------------------------------------------------------------

describe('8.5 movement', () => {
  it('allows any distance up to 24 MU in any direction and no further', () => {
    const flight = group('a', 'standard', { position: { x: 0, y: 0 } })
    expect(moveFighterGroup(flight, { x: 24, y: 0 }, 2).moved).toBe(true)
    expect(moveFighterGroup(flight, { x: 0, y: -24 }, 2).moved).toBe(true)
    expect(moveFighterGroup(flight, { x: 25, y: 0 }, 2).moved).toBe(false)
  })

  it('costs no endurance in the main phase (8.13)', () => {
    const moved = moveFighterGroup(group('a'), { x: 20, y: 0 }, 2)
    expect(moved.group.cef).toBe(6)
  })

  it('runs the figure-18 example: 20 MU in phase 4, then a 12 MU secondary move for 1 CEF', () => {
    const first = moveFighterGroup(group('a'), { x: 20, y: 0 }, 2)
    expect(first.moved).toBe(true)
    expect(first.distance).toBeCloseTo(20)
    const second = secondaryMoveFighterGroup(first.group, { x: 32, y: 0 })
    expect(second.moved).toBe(true)
    expect(second.group.cef).toBe(5)
    expect(second.group.secondaryMovedThisTurn).toBe(true)
  })

  it('caps the secondary move at 12 MU even for a Fast group', () => {
    const fast = group('f', 'standard', {}, ['fast'])
    expect(secondaryMoveAllowance(fast)).toBe(12)
    expect(secondaryMoveFighterGroup(fast, { x: 13, y: 0 }).moved).toBe(false)
    expect(secondaryMoveFighterGroup(fast, { x: 12, y: 0 }).moved).toBe(true)
  })

  it('refuses a secondary move to a group already dogfought, or out of fuel', () => {
    expect(secondaryMoveFighterGroup(group('a', 'standard', { engagedWith: ['x'] }), { x: 1, y: 0 }).moved).toBe(false)
    expect(secondaryMoveFighterGroup(group('a', 'standard', { cef: 0 }), { x: 1, y: 0 }).moved).toBe(false)
  })

  it('moves Robot groups in phase 4 rather than phase 6 (8.15)', () => {
    expect(takesSecondaryMoveInPhaseFour(group('r', 'standard', {}, ['robot']))).toBe(true)
    expect(takesSecondaryMoveInPhaseFour(group('a'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.6 screens, pursuits, ship fire, evading
// ---------------------------------------------------------------------------

describe('8.6 screens and pursuits', () => {
  it('pairs four attacking groups off against three screens, leaving one free', () => {
    // The book's worked example: an NAC transport with three screening groups
    // and four ESU groups attacking.
    const { pairings, freeAttackers } = assignScreenEngagements(
      ['esu1', 'esu2', 'esu3', 'esu4'],
      ['nac1', 'nac2', 'nac3'],
    )
    expect(pairings).toHaveLength(3)
    expect(freeAttackers).toEqual(['esu4'])
  })

  it('refuses a mutual screening assignment', () => {
    const a = group('a')
    const bad = assignScreen(a, 'b', { alreadyScreenedBy: ['b'] })
    expect(bad.assigned).toBe(false)
    expect(assignScreen(a, 'ship1').assigned).toBe(true)
  })

  it('lets a screen exceed its own move allowance when tied to a faster ship', () => {
    const screen = assignScreen(group('a', 'standard', { position: { x: 0, y: 0 } }), 'ship1').group
    // 40 MU is well past the 24 MU allowance, and that is the point of 8.6.
    const moved = moveWithEscortedShip(screen, { x: 40, y: 0 })
    expect(moved.moved).toBe(true)
    expect(moved.distance).toBeCloseTo(40)
  })

  it('breaks a screen off when it drifts away from its charge', () => {
    const screen = assignScreen(group('a', 'standard', { position: { x: 0, y: 0 } }), 'ship1').group
    expect(screenHasBrokenOff(screen, { x: 0.5, y: 0 })).toBe(false)
    expect(screenHasBrokenOff(screen, { x: 4, y: 0 })).toBe(true)
  })

  it('only lets a group pursue what it attacked last turn', () => {
    expect(declarePursuit(group('a'), 'ship1', { attackedTargetLastTurn: false }).assigned).toBe(false)
    const chasing = declarePursuit(group('a'), 'ship1', { attackedTargetLastTurn: true })
    expect(chasing.group.mission).toBe('pursuit')
    expect(chasing.group.escorting).toBe('ship1')
  })
})

describe('8.6 ship fire against fighters, and the destroyer/battleship example', () => {
  it('rolls one die per mount and kills only on a 6', () => {
    // "a destroyer 9 MU away will fire two Beam-2 weapons against the group …
    // Each Beam-2 would normally roll 2D6 at this range, but against fighters it
    // is always 1D6. The destroyer rolls 4 and 6, killing one fighter."
    const rng = new ScriptedRng([4, 6])
    const result = shipFireAtFighters(group('a'), 2, rng)
    expect(result.rolls).toEqual([4, 6])
    expect(result.kills).toBe(1)
    expect(result.group.strength).toBe(5)
    expect(rng.remaining).toBe(0)
  })

  it('never re-rolls a 6 (8.6)', () => {
    const rng = new ScriptedRng([6])
    const result = shipFireAtFighters(group('a'), 1, rng)
    expect(result.kills).toBe(1)
    expect(rng.remaining).toBe(0)
  })

  it('lets the battleship fire be evaded for 1 CEF, and the earlier kill stands', () => {
    const rng = new ScriptedRng([4, 6])
    const afterDestroyer = shipFireAtFighters(group('a'), 2, rng).group
    expect(afterDestroyer.strength).toBe(5)

    const evaded = evadeShipFire(afterDestroyer)
    expect(evaded.evaded).toBe(true)
    expect(evaded.group.cef).toBe(5)

    // "The ship weapons automatically miss (and cannot be fired against another
    // target), but the group has been forced to expend a CEF."
    const battleship = shipFireAtFighters(evaded.group, 10, new ScriptedRng([]))
    expect(battleship.evaded).toBe(true)
    expect(battleship.kills).toBe(0)
    expect(battleship.group.strength).toBe(5)
  })

  it('gives Light Fighters no protection from ship fire but hands attackers the +1', () => {
    // 8.15: "Any attack at a group of Light Fighters gets a +1 bonus."
    const light = group('l', 'standard', {}, ['light'])
    const result = shipFireAtFighters(light, 2, new ScriptedRng([5, 4]))
    expect(result.kills).toBe(1)
  })

  it('gives Heavy Fighters no shelter from full-strength anti-ship weapons (8.15)', () => {
    const heavy = group('h', 'standard', {}, ['heavy'])
    const result = shipFireAtFighters(heavy, 1, new ScriptedRng([6]))
    expect(result.kills).toBe(1)
  })

  it('cannot evade with no endurance left', () => {
    expect(evadeShipFire(group('a', 'standard', { cef: 0 })).evaded).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.7 target selection
// ---------------------------------------------------------------------------

describe('8.7 target selection', () => {
  const flight = group('a', 'standard', { position: { x: 0, y: 0 }, facing: 12 })

  it('reaches 6 MU and no further', () => {
    expect(canDeclareAttack(flight, { x: 0, y: -6 }, { kind: 'ship' }).allowed).toBe(true)
    expect(canDeclareAttack(flight, { x: 0, y: -6.5 }, { kind: 'ship' }).allowed).toBe(false)
  })

  it('covers the front 180 degrees and nothing behind', () => {
    // Facing 12 is "up the table", which is -y in screen coordinates.
    expect(canDeclareAttack(flight, { x: 3, y: -3 }, { kind: 'ship' }).allowed).toBe(true)
    expect(canDeclareAttack(flight, { x: -3, y: -3 }, { kind: 'ship' }).allowed).toBe(true)
    expect(canDeclareAttack(flight, { x: 0, y: 4 }, { kind: 'ship' }).allowed).toBe(false)
    expect(canDeclareAttack(flight, { x: 3, y: 3 }, { kind: 'ship' }).allowed).toBe(false)
  })

  it('extends a Missile Fighter salvo to 12 MU but leaves its guns at 6', () => {
    const missile = group('m', 'missile', { position: { x: 0, y: 0 }, facing: 12 })
    expect(canDeclareAttack(missile, { x: 0, y: -12 }, { kind: 'ship', payloadAttack: true }).allowed).toBe(true)
    expect(canDeclareAttack(missile, { x: 0, y: -12 }, { kind: 'ship' }).allowed).toBe(false)
  })

  it('refuses missile interception to Attack and Torpedo Fighters', () => {
    const attack = group('t', 'attack', { position: { x: 0, y: 0 }, facing: 12 })
    expect(canDeclareAttack(attack, { x: 0, y: -3 }, { kind: 'missile' }).allowed).toBe(false)
    expect(canDeclareAttack(attack, { x: 0, y: -3 }, { kind: 'ship' }).allowed).toBe(true)
  })

  it('refuses any attack once the endurance is gone (8.13)', () => {
    const spent = group('a', 'standard', { cef: 0, position: { x: 0, y: 0 }, facing: 12 })
    expect(canDeclareAttack(spent, { x: 0, y: -1 }, { kind: 'ship' }).allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.8 point defence
// ---------------------------------------------------------------------------

describe('8.8 point defence against fighters', () => {
  it('runs the PDS table: 4 or 5 kills one, 6 kills two and re-rolls', () => {
    expect(pointDefenceAgainstFighters(group('a'), ['pds'], new ScriptedRng([3])).kills).toBe(0)
    expect(pointDefenceAgainstFighters(group('a'), ['pds'], new ScriptedRng([4])).kills).toBe(1)
    expect(pointDefenceAgainstFighters(group('a'), ['pds'], new ScriptedRng([5])).kills).toBe(1)
    expect(pointDefenceAgainstFighters(group('a'), ['pds'], new ScriptedRng([6, 2])).kills).toBe(2)
    expect(pointDefenceAgainstFighters(group('a'), ['pds'], new ScriptedRng([6, 4])).kills).toBe(3)
  })

  it('runs the Beam-1 table: 5 or 6 kills one, with a re-roll on the 6', () => {
    expect(pointDefenceAgainstFighters(group('a'), ['beam-1'], new ScriptedRng([4])).kills).toBe(0)
    expect(pointDefenceAgainstFighters(group('a'), ['beam-1'], new ScriptedRng([5])).kills).toBe(1)
    expect(pointDefenceAgainstFighters(group('a'), ['beam-1'], new ScriptedRng([6, 5])).kills).toBe(2)
  })

  it('rolls four PDS dice for a Grapeshot launcher (7.15)', () => {
    const rng = new ScriptedRng([4, 5, 1, 2])
    const result = pointDefenceAgainstFighters(group('a'), ['grapeshot'], rng)
    expect(result.results[0].rolls).toHaveLength(4)
    expect(result.kills).toBe(2)
  })

  it('kills 1d6 with a Scattergun, 1d3 against Heavy, d6+1 against Light (7.14, 8.15)', () => {
    expect(pointDefenceAgainstFighters(group('a'), ['scattergun'], new ScriptedRng([5])).kills).toBe(5)
    expect(
      pointDefenceAgainstFighters(group('h', 'standard', {}, ['heavy']), ['scattergun'], new ScriptedRng([5])).kills,
    ).toBe(3)
    expect(
      pointDefenceAgainstFighters(group('l', 'standard', {}, ['light']), ['scattergun'], new ScriptedRng([5])).kills,
    ).toBe(6)
  })

  it('drops the PDS by one against Heavy Fighters but spares the Beam-1', () => {
    // 8.15: "Point defense weapons, including other fighters, suffer a -1 DRM
    // when engaging Heavy Fighters" — but "Heavy anti-ship weapons used in
    // defensive fire (beams, K-1) have only their normal -1 DRM."
    const heavy = group('h', 'standard', {}, ['heavy'])
    expect(pointDefenceAgainstFighters(heavy, ['pds'], new ScriptedRng([4])).kills).toBe(0)
    expect(pointDefenceAgainstFighters(heavy, ['pds'], new ScriptedRng([5])).kills).toBe(1)
    expect(pointDefenceAgainstFighters(heavy, ['beam-1'], new ScriptedRng([5])).kills).toBe(1)
  })

  it('lifts every point-defence die by one against Light Fighters', () => {
    const light = group('l', 'standard', {}, ['light'])
    expect(pointDefenceAgainstFighters(light, ['pds'], new ScriptedRng([3])).kills).toBe(1)
    expect(pointDefenceAgainstFighters(light, ['beam-1'], new ScriptedRng([4])).kills).toBe(1)
  })

  it('wastes overkill rather than reallocating it', () => {
    const small = group('a', 'standard', { strength: 2 })
    const result = pointDefenceAgainstFighters(small, ['pds'], new ScriptedRng([6, 6, 4]))
    expect(result.rawKills).toBe(5)
    expect(result.kills).toBe(2)
    expect(result.group.strength).toBe(0)
    expect(result.group.status).toBe('destroyed')
  })
})

// ---------------------------------------------------------------------------
// 8.9 attack runs
// ---------------------------------------------------------------------------

describe('8.9 attack runs', () => {
  it('rolls one die per surviving fighter on the beam table', () => {
    const rng = new ScriptedRng([1, 3, 4, 5, 2, 3])
    const run = resolveAttackRun(group('a'), { screens: 0 }, rng)
    expect(run.dice).toHaveLength(6)
    // 4 and 5 score one each on an unscreened target.
    expect(run.normalDamage).toBe(2)
    expect(run.penetratingDamage).toBe(0)
    expect(run.cefSpent).toBe(1)
    expect(run.group.cef).toBe(5)
  })

  it('re-rolls a beam six for penetrating damage', () => {
    const rng = new ScriptedRng([6, 5, 1, 1, 1, 1, 1])
    const run = resolveAttackRun(group('a'), { screens: 0 }, rng)
    expect(run.normalDamage).toBe(2)
    expect(run.penetratingDamage).toBe(1)
  })

  it('lets cannon ignore standard screens and lose the re-roll', () => {
    const cannon = group('a', 'standard', { armament: 'cannon', strength: 2 })
    const rng = new ScriptedRng([4, 6])
    const run = resolveAttackRun(cannon, { screens: 2 }, rng)
    // Unscreened table: 4 → 1, 6 → 2, and no re-roll die is drawn.
    expect(run.normalDamage).toBe(3)
    expect(run.penetratingDamage).toBe(0)
    expect(rng.remaining).toBe(0)
  })

  it('lets an advanced screen bite a cannon fighter [reading]', () => {
    const cannon = group('a', 'standard', { armament: 'cannon', strength: 1 })
    const run = resolveAttackRun(cannon, { screens: 2, advancedScreens: true }, new ScriptedRng([4]))
    expect(run.normalDamage).toBe(0)
  })

  it('runs the Attack Fighter +1 table the book prints out', () => {
    // "If firing on an unscreened target ship they would inflict one damage
    // point with rolls of 3 or 4, and two damage points with 5 or 6."
    const damageFor = (face: number): number => {
      const one = group('a', 'attack', { strength: 1 })
      const rng = new ScriptedRng(face === 6 ? [6, 1] : [face])
      const run = resolveAttackRun(one, { screens: 0 }, rng)
      return run.normalDamage
    }
    expect(damageFor(1)).toBe(0)
    expect(damageFor(2)).toBe(0)
    expect(damageFor(3)).toBe(1)
    expect(damageFor(4)).toBe(1)
    expect(damageFor(5)).toBe(2)
    expect(damageFor(6)).toBe(2)
  })

  it('gives the Interceptor -2 against ships and +1 against fighters', () => {
    const one = group('i', 'interceptor', { strength: 1 })
    // A natural 6 modified to 4 scores one, and still re-rolls on the natural 6.
    const run = resolveAttackRun(one, { screens: 0 }, new ScriptedRng([6, 1]))
    expect(run.normalDamage).toBe(1)
    expect(FIGHTER_TYPES.interceptor.antiFighter.drm).toBe(1)
  })

  it('gives the Graser 1d3 SAP per BD* hit and burns 2 CEF', () => {
    // 4 and 5 each score one hit; the two d3 rolls are 3 → 2 and 6 → 3.
    const rng = new ScriptedRng([4, 5, 3, 6])
    const run = resolveAttackRun(group('g', 'graser', { strength: 2 }), { screens: 0 }, rng)
    expect(run.mode).toBe('SAP')
    expect(run.normalDamage).toBe(5)
    expect(run.cefSpent).toBe(2)
    expect(run.group.cef).toBe(4)
  })

  it('refuses to fire a Graser on a single point of endurance', () => {
    const low = group('g', 'graser', { cef: 1 })
    const run = resolveAttackRun(low, { screens: 0 }, new ScriptedRng([]))
    expect(run.fired).toBe(false)
    expect(run.reason).toContain('2 CEF')
  })

  it('runs the Plasma Cannon hit ladder of 5.5 / 8.15', () => {
    // "on a roll of 3 it inflicts 1 hit, on a 4 it inflicts 2 hits, on a 5 it
    // inflicts 3 hits, and on a 6 it inflicts 4 hits … and gets a reroll!"
    const hitsFor = (face: number): number => {
      const rng = new ScriptedRng(face === 6 ? [6, 1] : [face])
      const volley = rollPlasmaFighterVolley(1, 0, rng, 0)
      return volley.normalDamage + volley.penetratingDamage
    }
    expect(hitsFor(1)).toBe(0)
    expect(hitsFor(2)).toBe(0)
    expect(hitsFor(3)).toBe(1)
    expect(hitsFor(4)).toBe(2)
    expect(hitsFor(5)).toBe(3)
    expect(hitsFor(6)).toBe(4)
  })

  it('subtracts one plasma hit per level of screen', () => {
    expect(rollPlasmaFighterVolley(1, 1, new ScriptedRng([5]), 0).normalDamage).toBe(2)
    expect(rollPlasmaFighterVolley(1, 2, new ScriptedRng([5]), 0).normalDamage).toBe(1)
  })

  it('burns 2 CEF for a Plasma Fighter volley', () => {
    const run = resolveAttackRun(
      group('p', 'plasma', { strength: 1 }),
      { screens: 0 },
      new ScriptedRng([5]),
    )
    expect(run.cefSpent).toBe(2)
    expect(run.normalDamage).toBe(3)
  })

  it('lets an intercepted attack run press on, taking the interceptor fire first', () => {
    // 8.9: the interceptor "fires as if in a dogfight, and the survivors carry
    // out the attack against the ship" — and it is a one-sided exchange.
    const attacker = group('a', 'standard', { strength: 6 })
    const interceptor = group('i', 'interceptor', { id: 'i', strength: 2 })
    // Interceptor rolls 2 dice at +1: 4 → 5 → 1 kill, 3 → 4 → 1 kill.
    // The 4 survivors then roll 1,1,1,4 → 1 damage.
    const rng = new ScriptedRng([4, 3, 1, 1, 1, 4])
    const result = resolveInterceptedAttackRun(attacker, interceptor, { screens: 0 }, rng)
    expect(result.interceptorKills).toBe(2)
    expect(result.run.normalDamage).toBe(1)
    expect(result.attacker.strength).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 8.10 / 8.11 dogfights
// ---------------------------------------------------------------------------

describe('8.10 dogfights', () => {
  it('reproduces the printed example: A 5 vs B 4, ending 3 against 1', () => {
    // "Player A rolls 5 dice, scoring 2,2,6,4,1 and a re-roll of 3; therefore
    // getting three kills. … In retaliation, player B rolls 4 dice … and scores
    // 3,1,5,5 for two kills. … leaving A with three and B with only one."
    const a = group('A', 'standard', { strength: 5 })
    const b = group('B', 'standard', { strength: 4 })
    // The re-roll is resolved the moment the 6 comes up.
    const rng = new ScriptedRng([2, 2, 6, 3, 4, 1, 3, 1, 5, 5])
    const result = resolveDogfight(a, b, rng)

    const sideA = result.sides.find((s) => s.groupId === 'A')
    const sideB = result.sides.find((s) => s.groupId === 'B')
    expect(sideA?.kills).toBe(3)
    expect(sideB?.kills).toBe(2)

    const afterA = result.groups.find((g) => g.id === 'A')
    const afterB = result.groups.find((g) => g.id === 'B')
    expect(afterA?.strength).toBe(3)
    expect(afterB?.strength).toBe(1)
    expect(rng.remaining).toBe(0)
  })

  it('is simultaneous: casualties never reduce the retaliation', () => {
    // A wipes B out; B still rolls its full four dice.
    const a = group('A', 'standard', { strength: 6 })
    const b = group('B', 'standard', { strength: 4 })
    const rng = new ScriptedRng([6, 1, 6, 1, 6, 1, 4, 4, 4, 4, 5, 5, 5, 5])
    const result = resolveDogfight(a, b, rng)
    expect(result.groups.find((g) => g.id === 'B')?.strength).toBe(0)
    expect(result.sides.find((s) => s.groupId === 'B')?.dice).toHaveLength(4)
    expect(result.groups.find((g) => g.id === 'A')?.strength).toBe(2)
  })

  it('burns one CEF from each group that fights', () => {
    const rng = new ScriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    const result = resolveDogfight(group('A'), group('B'), rng)
    expect(result.groups.every((g) => g.cef === 5)).toBe(true)
    expect(result.groups.every((g) => g.attackedThisTurn)).toBe(true)
  })

  it('runs the Light Fighter defensive table exactly as 8.15 prints it', () => {
    // "1-2, no kills; 3-4, 1 kill; 5, 2 kills; 6, 2 kills and a re-roll."
    const killsFor = (face: number): number =>
      rollFighterKills(1, new ScriptedRng(face === 6 ? [6, 1] : [face]), { drm: 1 }).kills
    expect(killsFor(1)).toBe(0)
    expect(killsFor(2)).toBe(0)
    expect(killsFor(3)).toBe(1)
    expect(killsFor(4)).toBe(1)
    expect(killsFor(5)).toBe(2)
    expect(killsFor(6)).toBe(2)
    // And the 6 really does draw a further die.
    expect(rollFighterKills(1, new ScriptedRng([6, 5]), { drm: 1 }).kills).toBe(3)
  })

  it('applies the Heavy -1 to other fighters', () => {
    const attacker = group('A', 'standard', { strength: 1 })
    const heavy = group('H', 'standard', { strength: 6 }, ['heavy'])
    // A natural 4 drops to a 3 and scores nothing.
    const result = resolveMultiGroupDogfight(
      [
        { group: attacker, targets: ['H'] },
        { group: heavy, targets: [] },
      ],
      new ScriptedRng([4]),
    )
    expect(result.sides[0].kills).toBe(0)
    expect(result.groups.find((g) => g.id === 'H')?.strength).toBe(6)
    expect(groupProfile(heavy).defenceDrm).toBe(-1)
  })

  it('lets an exhausted group return fire, killing only on sixes', () => {
    const spent = group('A', 'standard', { strength: 4, cef: 0 })
    const rng = new ScriptedRng([6, 5, 4, 6])
    const result = resolveMultiGroupDogfight([{ group: spent, targets: ['B'] }, { group: group('B'), targets: [] }], rng)
    const side = result.sides.find((s) => s.groupId === 'A')
    expect(side?.exhausted).toBe(true)
    expect(side?.kills).toBe(2)
    // No re-rolls are drawn from the exhausted table.
    expect(side?.dice).toEqual([6, 5, 4, 6])
    expect(side?.cefSpent).toBe(0)
  })

  it('strips the re-roll from a cannon-armed group in a dogfight [reading]', () => {
    const cannon = group('A', 'standard', { strength: 1, armament: 'cannon' })
    const rng = new ScriptedRng([6])
    const result = resolveMultiGroupDogfight(
      [
        { group: cannon, targets: ['B'] },
        { group: group('B'), targets: [] },
      ],
      rng,
    )
    expect(result.sides[0].kills).toBe(2)
    expect(rng.remaining).toBe(0)
  })
})

describe('8.11 multiple group dogfights', () => {
  it('divides kills as equally as possible, remainder to the earlier targets', () => {
    expect(splitKills(5, 2)).toEqual([3, 2])
    expect(splitKills(6, 3)).toEqual([2, 2, 2])
    expect(splitKills(1, 3)).toEqual([1, 0, 0])
    expect(splitKills(0, 2)).toEqual([0, 0])
  })

  it('rolls one volley for the whole group and then splits the casualties', () => {
    const attacker = group('A', 'standard', { strength: 4 })
    const b = group('B', 'standard', { strength: 6 })
    const c = group('C', 'standard', { strength: 6 })
    // 4,4,4,4 → four kills, split 2 and 2.
    const rng = new ScriptedRng([4, 4, 4, 4])
    const result = resolveMultiGroupDogfight(
      [
        { group: attacker, targets: ['B', 'C'] },
        { group: b, targets: [] },
        { group: c, targets: [] },
      ],
      rng,
    )
    expect(result.sides[0].allocation).toEqual({ B: 2, C: 2 })
    expect(result.groups.find((g) => g.id === 'B')?.strength).toBe(4)
    expect(result.groups.find((g) => g.id === 'C')?.strength).toBe(4)
  })

  it('marks every participant as engaged with the other side', () => {
    const rng = new ScriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    const result = resolveDogfight(group('A'), group('B'), rng)
    expect(result.groups.find((g) => g.id === 'A')?.engagedWith).toEqual(['B'])
    expect(result.groups.find((g) => g.id === 'B')?.engagedWith).toEqual(['A'])
  })
})

describe('8.10 refusing a dogfight', () => {
  it('will not let a group that has already moved refuse', () => {
    const defender = group('D', 'standard', { movedThisTurn: true })
    const result = refuseDogfight(group('A'), defender, new ScriptedRng([]), 2)
    expect(result.withdrew).toBe(false)
  })

  it('lets a faster group slip away without being shot at', () => {
    const fast = group('D', 'standard', {}, ['fast'])
    const result = refuseDogfight(group('A'), fast, new ScriptedRng([]), 2)
    expect(result.withdrew).toBe(true)
    expect(result.freeRound).toBeNull()
  })

  it('gives the attacker a free round when the defender is no faster', () => {
    const rng = new ScriptedRng([4, 4, 1, 1, 1, 1])
    const result = refuseDogfight(group('A'), group('D'), rng, 2)
    expect(result.withdrew).toBe(true)
    expect(result.freeRound?.kills).toBe(2)
    expect(result.defender.strength).toBe(4)
    expect(result.attacker.cef).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 8.12 interception of missiles
// ---------------------------------------------------------------------------

describe('8.12 intercepting missiles', () => {
  it('kills a salvo missile on 5 or 6 with a re-roll on the 6 (6.4)', () => {
    // Six dice: 5 kills; 6 kills and re-rolls into a 5 that kills too; then
    // 4, 3, 2, 1 miss. Three kills, so three "did the fighter die too?" dice.
    const rng = new ScriptedRng([5, 6, 5, 4, 3, 2, 1, 1, 1, 1])
    const result = interceptMissiles(group('a'), { kind: 'salvo', count: 6 }, rng)
    expect(result.kills).toBe(3)
    expect(result.losses).toBe(0)
    expect(rng.remaining).toBe(0)
    expect(result.cefSpent).toBe(1)
    expect(result.group.cef).toBe(5)
  })

  it('kills a Heavy Missile only on a 6 (6.4)', () => {
    const rng = new ScriptedRng([5, 5, 5, 5, 5, 5])
    expect(interceptMissiles(group('a'), { kind: 'heavy', count: 1 }, rng).kills).toBe(0)
    const lucky = new ScriptedRng([6, 1, 1, 1, 1, 1, 1, 1])
    expect(interceptMissiles(group('a'), { kind: 'heavy', count: 1 }, lucky).kills).toBe(1)
  })

  it('loses a fighter for every kill that rolls a 6 afterwards (6.4)', () => {
    // Two kills, then two casualty dice: a 6 costs a fighter, a 2 does not.
    const rng = new ScriptedRng([5, 5, 1, 1, 1, 1, 6, 2])
    const result = interceptMissiles(group('a'), { kind: 'salvo', count: 6 }, rng)
    expect(result.kills).toBe(2)
    expect(result.casualtyRolls).toEqual([6, 2])
    expect(result.losses).toBe(1)
    expect(result.group.strength).toBe(5)
  })

  it('wastes overkill against a small salvo', () => {
    const rng = new ScriptedRng([5, 5, 5, 5, 5, 5, 1, 1])
    const result = interceptMissiles(group('a'), { kind: 'salvo', count: 2 }, rng)
    expect(result.rawKills).toBe(6)
    expect(result.kills).toBe(2)
  })

  it('is closed to Attack and Torpedo Fighters, and to an empty tank', () => {
    expect(interceptMissiles(group('t', 'torpedo'), { kind: 'salvo', count: 4 }, new ScriptedRng([])).intercepted).toBe(
      false,
    )
    expect(interceptMissiles(group('x', 'attack'), { kind: 'salvo', count: 4 }, new ScriptedRng([])).intercepted).toBe(
      false,
    )
    const spent = group('a', 'standard', { cef: 0 })
    expect(interceptMissiles(spent, { kind: 'salvo', count: 4 }, new ScriptedRng([])).intercepted).toBe(false)
  })

  it('adds +1 against light missiles (8.15)', () => {
    const rng = new ScriptedRng([4, 1, 1, 1, 1, 1, 1])
    const result = interceptMissiles(group('a'), { kind: 'salvo', count: 6, light: true }, rng)
    expect(result.kills).toBe(1)
  })

  it('subtracts one from every Turkey die (8.18)', () => {
    const turkeys = group('a', 'standard', { pilots: 'turkey' })
    const rng = new ScriptedRng([5, 5, 5, 5, 5, 5])
    expect(interceptMissiles(turkeys, { kind: 'salvo', count: 6 }, rng).kills).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 8.13 endurance
// ---------------------------------------------------------------------------

describe('8.13 combat endurance', () => {
  it('starts a standard group on six factors', () => {
    expect(createFighterGroup({ id: 'a', side: 'blue', typeId: 'standard' }).cef).toBe(6)
  })

  it('spends one factor per turn in combat, not one per action', () => {
    const rng = new ScriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    const after = resolveDogfight(group('A'), group('B'), rng).groups[0]
    // The same group pressing on to a ship in the same turn pays nothing more.
    const run = resolveAttackRun(after, { screens: 0 }, new ScriptedRng([1, 1, 1, 1, 1, 1]))
    expect(run.cefSpent).toBe(0)
    expect(run.group.cef).toBe(5)
  })

  it('bars attacks once exhausted but still allows movement', () => {
    const spent = group('a', 'standard', { cef: 0 })
    expect(isExhausted(spent)).toBe(true)
    expect(resolveAttackRun(spent, { screens: 0 }, new ScriptedRng([])).fired).toBe(false)
    expect(moveFighterGroup(spent, { x: 20, y: 0 }, 2).moved).toBe(true)
    expect(secondaryMoveFighterGroup(spent, { x: 5, y: 0 }).moved).toBe(false)
  })

  it('scores only sixes on the exhausted return-fire table', () => {
    const roll = rollExhaustedReturnFire(6, new ScriptedRng([1, 2, 3, 4, 5, 6]))
    expect(roll.kills).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 8.15 one-shot payloads
// ---------------------------------------------------------------------------

describe('8.15 one-shot payloads', () => {
  it('hits with a Pulse Torpedo on 4+ for damage equal to the die', () => {
    // "a roll of a '5' would both hit and inflict 5 points of damage".
    const rng = new ScriptedRng([5, 3, 4, 6, 2, 1])
    const result = launchPulseTorpedoes(group('t', 'torpedo'), rng)
    expect(result.hits).toBe(3)
    expect(result.damage).toBe(5 + 4 + 6)
    expect(result.mode).toBe('SAP')
    expect(result.cefSpent).toBe(1)
    expect(result.group.payloadSpent).toBe(true)
  })

  it('fires the torpedoes only once, and never alongside the secondary guns', () => {
    const fired = launchPulseTorpedoes(group('t', 'torpedo'), new ScriptedRng([1, 1, 1, 1, 1, 1])).group
    expect(launchPulseTorpedoes(fired, new ScriptedRng([])).fired).toBe(false)
    const gunsFirst = group('t', 'torpedo', { attackedThisTurn: true })
    expect(launchPulseTorpedoes(gunsFirst, new ScriptedRng([])).fired).toBe(false)
  })

  it('runs the MKP table: 1 hit on 4+, 2 on a 6, four AP damage each', () => {
    const rng = new ScriptedRng([4, 6, 3, 5, 6, 1])
    const result = launchFighterMkps(group('m', 'mkp'), rng)
    expect(result.hits).toBe(6)
    expect(result.damage).toBe(6 * MKP_DAMAGE_PER_HIT)
    expect(result.mode).toBe('AP')
  })

  it('rolls one lock-on die and subtracts a missile per fighter already lost', () => {
    const full = launchFighterMissiles(group('m', 'missile'), 12, new ScriptedRng([4]))
    expect(full.salvoSize).toBe(6)
    expect(full.lockOnRoll).toBe(4)
    expect(full.lockedOn).toBe(4)

    const mauled = launchFighterMissiles(group('m', 'missile', { strength: 4 }), 8, new ScriptedRng([4]))
    expect(mauled.salvoSize).toBe(4)
    expect(mauled.lockedOn).toBe(2)
  })

  it('will not launch a salvo beyond 12 MU or while engaged by fighters', () => {
    expect(launchFighterMissiles(group('m', 'missile'), 13, new ScriptedRng([])).fired).toBe(false)
    const pinned = group('m', 'missile', { engagedWith: ['x'] })
    expect(launchFighterMissiles(pinned, 6, new ScriptedRng([])).fired).toBe(false)
  })

  it('lands an Assault Shuttle boarding party on 3+, and on 2+ with Marines', () => {
    const plain = resolveBoardingRun(group('s', 'assault-shuttle'), new ScriptedRng([1, 2, 3, 4, 5, 6]))
    expect(plain.landed).toBe(4)
    expect(plain.lost).toBe(2)
    const marines = resolveBoardingRun(group('s', 'assault-shuttle'), new ScriptedRng([1, 2, 3, 4, 5, 6]), {
      marines: true,
    })
    expect(marines.landed).toBe(5)
  })

  it('is stopped dead by Advanced Screens but not by Standard ones', () => {
    const blocked = resolveBoardingRun(group('s', 'assault-shuttle'), new ScriptedRng([]), {
      advancedScreens: true,
    })
    expect(blocked.blockedByScreens).toBe(true)
    expect(blocked.landed).toBe(0)
    const through = resolveBoardingRun(group('s', 'assault-shuttle'), new ScriptedRng([6, 6, 6, 6, 6, 6]))
    expect(through.landed).toBe(6)
  })

  it('gives the Assault Shuttle no anti-ship gun run', () => {
    const run = resolveAttackRun(group('s', 'assault-shuttle'), { screens: 0 }, new ScriptedRng([]))
    expect(run.fired).toBe(false)
    expect(run.reason).toContain('boarding run')
  })
})

// ---------------------------------------------------------------------------
// 8.15 Multi-Role, 8.16 re-arming
// ---------------------------------------------------------------------------

describe('8.15 Multi-Role Fighters', () => {
  it('flies as whichever of standard, Interceptor or Attack it was armed as', () => {
    const aboard = group('m', 'multi-role', { status: 'aboard' })
    const attack = reconfigureMultiRole(aboard, 'attack', 'beam')
    expect(attack.changed).toBe(true)
    expect(effectiveType(attack.group)).toBe('attack')
    expect(groupProfile(attack.group).antiShip?.drm).toBe(1)
    // But it keeps its own points (8.15: "cost 5 each, or 30 per wing").
    expect(groupProfile(attack.group).points).toBe(30)
  })

  it('re-configures only in a hangar bay, and only into a legal role', () => {
    expect(reconfigureMultiRole(group('m', 'multi-role'), 'attack', 'beam').changed).toBe(false)
    const aboard = group('m', 'multi-role', { status: 'aboard' })
    expect(reconfigureMultiRole(aboard, 'graser', 'beam').changed).toBe(false)
  })
})

describe('8.16 re-arming', () => {
  it('grounds the group on a 1, releases it in T+2 on a 2-5 and T+1 on a 6', () => {
    expect(rollRearm(new ScriptedRng([1]), 4)).toEqual({ roll: 1, outcome: 'lost', readyTurn: null })
    for (const face of [2, 3, 4, 5]) {
      expect(rollRearm(new ScriptedRng([face]), 4).readyTurn).toBe(6)
    }
    expect(rollRearm(new ScriptedRng([6]), 4)).toEqual({
      roll: 6,
      outcome: 'crash-turnaround',
      readyTurn: 5,
    })
  })

  it('takes the worst case when depleted groups are combined', () => {
    const crash = rollRearm(new ScriptedRng([6]), 1)
    const normal = rollRearm(new ScriptedRng([3]), 1)
    const lost = rollRearm(new ScriptedRng([1]), 1)
    expect(worstRearm([crash, normal]).outcome).toBe('standard')
    expect(worstRearm([crash, normal, lost]).outcome).toBe('lost')
    expect(worstRearm([crash]).outcome).toBe('crash-turnaround')
  })

  it('refuels and rearms on recovery, and records the ready turn', () => {
    const tired = group('a', 'standard', { cef: 1, payloadSpent: true, strength: 4 })
    const result = recoverFighterGroup(tired, CARRIER, 3, new ScriptedRng([6]))
    expect(result.recovered).toBe(true)
    expect(result.group.status).toBe('aboard')
    expect(result.group.cef).toBe(6)
    expect(result.group.payloadSpent).toBe(false)
    expect(result.group.readyTurn).toBe(4)
    // Casualties are not made good by re-arming.
    expect(result.group.strength).toBe(4)
    expect(canLaunch(result.group, CARRIER, 4).allowed).toBe(true)
  })

  it('grounds a group that rolls a 1 on recovery', () => {
    const result = recoverFighterGroup(group('a'), CARRIER, 3, new ScriptedRng([1]))
    expect(result.group.grounded).toBe(true)
    expect(canLaunch(result.group, CARRIER, 9).allowed).toBe(false)
  })

  it('will not recover onto a carrier that has used its tubes up', () => {
    const busy: CarrierFlightState = { ...CARRIER, launchFacilities: 1, facilitiesUsed: 1 }
    expect(recoverFighterGroup(group('a'), busy, 3, new ScriptedRng([])).recovered).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8.17 morale, 8.18 aces and turkeys
// ---------------------------------------------------------------------------

describe('8.17 fighter morale (optional)', () => {
  it('does not apply to a group at full strength', () => {
    const check = fighterMoraleCheck(group('a'), new ScriptedRng([]))
    expect(check.applies).toBe(false)
    expect(check.attacks).toBe(true)
  })

  it('attacks on a roll at or below the fighters remaining, and aborts above', () => {
    const two = group('a', 'standard', { strength: 2 })
    expect(fighterMoraleCheck(two, new ScriptedRng([1])).attacks).toBe(true)
    expect(fighterMoraleCheck(two, new ScriptedRng([2])).attacks).toBe(true)
    expect(fighterMoraleCheck(two, new ScriptedRng([3])).attacks).toBe(false)
  })

  it('never applies to Robot Fighters', () => {
    const robots = group('r', 'standard', { strength: 1 }, ['robot'])
    const check = fighterMoraleCheck(robots, new ScriptedRng([]))
    expect(check.applies).toBe(false)
    expect(check.attacks).toBe(true)
  })
})

describe('8.18 aces and turkeys (optional)', () => {
  it('rolls a 6 for an Ace, a 1 for a Turkey and 2-5 for average', () => {
    expect(rollPilotQuality(new ScriptedRng([6])).quality).toBe('ace')
    expect(rollPilotQuality(new ScriptedRng([1])).quality).toBe('turkey')
    for (const face of [2, 3, 4, 5]) {
      expect(rollPilotQuality(new ScriptedRng([face])).quality).toBe('average')
    }
  })

  it('gives an Ace group one extra die: six fighters roll seven', () => {
    expect(attackDiceCount(group('a', 'standard', { pilots: 'ace' }))).toBe(7)
    expect(attackDiceCount(group('a'))).toBe(6)
  })

  it('runs the book arithmetic for a five-fighter Ace group: six dice, or four plus a needle', () => {
    const five = group('a', 'standard', { strength: 5, pilots: 'ace' })
    expect(attackDiceCount(five)).toBe(6)
    const special = resolveAttackRun(five, { screens: 0 }, new ScriptedRng([1, 1, 1, 1]), {
      aceSpecialAttack: true,
    })
    expect(special.dice).toHaveLength(4)
  })

  it('resolves the Ace needle shot on the Needle Beam table (5.13)', () => {
    const ace = group('a', 'standard', { pilots: 'ace' })
    expect(aceNeedleAttack(ace, new ScriptedRng([3]))).toMatchObject({ damage: 0, systemDestroyed: false })
    expect(aceNeedleAttack(ace, new ScriptedRng([4]))).toMatchObject({ damage: 1, systemDestroyed: false })
    expect(aceNeedleAttack(ace, new ScriptedRng([6]))).toMatchObject({ damage: 1, systemDestroyed: true })
    expect(aceNeedleAttack(group('b'), new ScriptedRng([])).fired).toBe(false)
  })

  it('lets an Ace duel an opposing Ace, the one way an Ace dies early', () => {
    const attacker = group('A', 'standard', { pilots: 'ace' })
    const defender = group('B', 'standard', { pilots: 'ace' })
    const hit = aceDuel(attacker, defender, new ScriptedRng([4]))
    expect(hit.aceKilled).toBe(true)
    expect(hit.defender.aceKilled).toBe(true)
    expect(hit.defender.strength).toBe(5)

    const miss = aceDuel(attacker, defender, new ScriptedRng([2]))
    expect(miss.aceKilled).toBe(false)
    expect(miss.defender.aceKilled).toBe(false)

    // There must be an opposing Ace to single out.
    expect(aceDuel(attacker, group('C'), new ScriptedRng([])).fired).toBe(false)
  })

  it('keeps the Ace alive to the last fighter in ordinary losses', () => {
    const ace = group('a', 'standard', { pilots: 'ace' })
    const mauled = applyFighterLosses(ace, 5)
    expect(mauled.strength).toBe(1)
    expect(attackDiceCount(mauled)).toBe(2)
    expect(applyFighterLosses(mauled, 1).strength).toBe(0)
    expect(attackDiceCount(applyFighterLosses(mauled, 1))).toBe(0)
  })

  it('penalises a Turkey group in dogfights but not against ships', () => {
    const turkeys = group('T', 'standard', { strength: 1, pilots: 'turkey' })
    // Against a ship: "Turkey groups attack target ships as normal".
    expect(resolveAttackRun(turkeys, { screens: 0 }, new ScriptedRng([4])).normalDamage).toBe(1)
    // In a dogfight the -1 turns that 4 into a 3.
    const fight = resolveMultiGroupDogfight(
      [
        { group: turkeys, targets: ['B'] },
        { group: group('B'), targets: [] },
      ],
      new ScriptedRng([4]),
    )
    expect(fight.sides[0].kills).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

describe('group bookkeeping', () => {
  it('clears the per-turn flags at the top of a turn', () => {
    const dirty = group('a', 'standard', {
      movedThisTurn: true,
      secondaryMovedThisTurn: true,
      evading: true,
      attackedThisTurn: true,
      engagedWith: ['x'],
    })
    const fresh = beginFighterTurn(dirty)
    expect(fresh.movedThisTurn).toBe(false)
    expect(fresh.secondaryMovedThisTurn).toBe(false)
    expect(fresh.evading).toBe(false)
    expect(fresh.attackedThisTurn).toBe(false)
    expect(fresh.engagedWith).toEqual([])
    // Endurance and losses survive the turn boundary.
    expect(fresh.cef).toBe(dirty.cef)
  })

  it('destroys a group when the last fighter goes', () => {
    const dead = applyFighterLosses(group('a'), 6)
    expect(dead.strength).toBe(0)
    expect(dead.status).toBe('destroyed')
    expect(resolveAttackRun(dead, { screens: 0 }, new ScriptedRng([])).fired).toBe(false)
  })
})

