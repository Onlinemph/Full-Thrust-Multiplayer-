/**
 * Admirals, detection and espionage (campaign.md 7, "Detection (8, end)", 9).
 *
 * Every number checked below is quoted from campaign.md against the rule it
 * comes from, so a change that breaks one of these tests is a change that broke
 * a rule.
 */

import { describe, expect, it } from 'vitest'
import {
  ADMIRAL_COST,
  BURNED_SPY_MODIFIER,
  COUNTER_ESPIONAGE_COST_PER_LEVEL,
  DETECTION_RANGE,
  DETECTION_TARGET,
  DROP_POD_LAUNCH_TARGET,
  ESPIONAGE_COST,
  NO_INTEL,
  OBSERVATION_PASS_BONUS,
  SENSOR_BONUS,
  SLEEPER_SPY_BONUS,
  campaignRng,
  commandLevelFromRoll,
  counterEspionageCost,
  detectionCheck,
  detectionModifiers,
  discoveryCheck,
  discoveryOutcome,
  draw2d6,
  drawD6,
  effectiveCommandLevel,
  initiativeModifier,
  intelFromSpyingRoll,
  launchDropPod,
  mergeIntel,
  plotAheadTurns,
  recoverAdmiral,
  recruitAdmiral,
  rollAdmiralCasualty,
  routeBonus,
  runEspionage,
  sabotageRoll,
  sampleAt,
  spyingRoll,
  totalModifier,
  type Admiral,
} from './intel'

// ---------------------------------------------------------------------------
// Dice a test can read
// ---------------------------------------------------------------------------

/**
 * The campaign stream is keyed by position — a face is a function of (seed,
 * cursor) — so a test cannot inject faces the way a scripted generator would.
 * It can, however, *find* a seed whose opening draws are the faces it wants,
 * which is what this does. Cheap: six faces is about 47,000 candidates.
 */
function seedYielding(faces: readonly number[]): number {
  for (let seed = 1; seed < 20_000_000; seed++) {
    let matches = true
    for (let i = 0; i < faces.length; i++) {
      if (Math.floor(sampleAt(seed, i) * 6) + 1 !== faces[i]) {
        matches = false
        break
      }
    }
    if (matches) return seed
  }
  throw new Error(`no seed produces ${faces.join(',')}`)
}

function streamOf(faces: readonly number[]): ReturnType<typeof campaignRng> {
  return campaignRng(seedYielding(faces))
}

describe('the campaign dice stream', () => {
  it('draws the faces a seed was chosen for', () => {
    const rng = streamOf([3, 5, 1])
    expect(drawD6(rng)).toBe(3)
    expect(drawD6(rng)).toBe(5)
    expect(drawD6(rng)).toBe(1)
  })

  it('advances one cursor step per die', () => {
    const rng = campaignRng(1234)
    expect(rng.cursor).toBe(0)
    drawD6(rng)
    expect(rng.cursor).toBe(1)
    draw2d6(rng)
    expect(rng.cursor).toBe(3)
  })

  it('replays from a saved cursor, which is what makes a campaign replay', () => {
    const live = campaignRng(9876)
    draw2d6(live)
    draw2d6(live)
    const saved = { seed: live.seed, cursor: live.cursor }

    const continued = draw2d6(live)
    const resumed = draw2d6(campaignRng(saved.seed, saved.cursor))
    expect(resumed).toEqual(continued)
  })
})

// ---------------------------------------------------------------------------
// Admirals (7)
// ---------------------------------------------------------------------------

describe('admirals (7)', () => {
  it('rolls command level: 1 is Level 3, 2-5 Level 2, 6 Level 1', () => {
    expect(commandLevelFromRoll(1)).toBe(3)
    expect([2, 3, 4, 5].map(commandLevelFromRoll)).toEqual([2, 2, 2, 2])
    expect(commandLevelFromRoll(6)).toBe(1)
  })

  it('gives Level 1 +1 fleet initiative and Level 3 -1', () => {
    expect(initiativeModifier(1)).toBe(1)
    expect(initiativeModifier(2)).toBe(0)
    expect(initiativeModifier(3)).toBe(-1)
    expect(initiativeModifier(null)).toBe(0)
  })

  it('plots 1, 2 or 3 turns ahead by level, and 3 with nobody named', () => {
    expect(plotAheadTurns(1)).toBe(1)
    expect(plotAheadTurns(2)).toBe(2)
    expect(plotAheadTurns(3)).toBe(3)
    expect(plotAheadTurns(null)).toBe(3)
  })

  it('recruits for 100 RP on a single d6', () => {
    const recruitment = recruitAdmiral(streamOf([6]), { id: 'a1', name: 'Kerensky', faction: 'esu' })
    expect(recruitment.cost).toBe(ADMIRAL_COST)
    expect(ADMIRAL_COST).toBe(100)
    expect(recruitment.roll).toBe(6)
    expect(recruitment.admiral.level).toBe(1)
    expect(recruitment.admiral.dead).toBe(false)
    expect(recruitment.admiral.injuredFor).toBe(0)
  })

  const fit = (): Admiral => ({ id: 'a1', name: 'Kerensky', faction: 'esu', level: 1, injuredFor: 0, dead: false })

  it('kills the admiral on a 1', () => {
    const admiral = fit()
    const result = rollAdmiralCasualty(admiral, streamOf([1]))
    expect(result.outcome).toBe('dead')
    expect(admiral.dead).toBe(true)
  })

  it('injures on a 2 or 3, for a second 1d6 of turns', () => {
    const admiral = fit()
    const result = rollAdmiralCasualty(admiral, streamOf([3, 4]))
    expect(result.outcome).toBe('injured')
    expect(result.turns).toBe(4)
    expect(admiral.injuredFor).toBe(4)
  })

  it('leaves the admiral unharmed on 4-6', () => {
    const admiral = fit()
    const result = rollAdmiralCasualty(admiral, streamOf([5]))
    expect(result.outcome).toBe('unharmed')
    expect(admiral.injuredFor).toBe(0)
    expect(admiral.dead).toBe(false)
  })

  it('treats a dead or convalescing admiral as nobody named, which plots as Level 3', () => {
    const injured = fit()
    injured.injuredFor = 2
    expect(effectiveCommandLevel(injured)).toBeNull()
    expect(plotAheadTurns(effectiveCommandLevel(injured))).toBe(3)

    const dead = fit()
    dead.dead = true
    expect(effectiveCommandLevel(dead)).toBeNull()
    expect(effectiveCommandLevel(fit())).toBe(1)
  })

  it('convalesces one turn at a time', () => {
    const admiral = fit()
    admiral.injuredFor = 2
    recoverAdmiral(admiral)
    expect(admiral.injuredFor).toBe(1)
    recoverAdmiral(admiral)
    recoverAdmiral(admiral)
    expect(admiral.injuredFor).toBe(0)
    expect(effectiveCommandLevel(admiral)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Detection (8, end)
// ---------------------------------------------------------------------------

describe('the detection check (8, end)', () => {
  it('is -1 per hex beyond the first', () => {
    expect(totalModifier(detectionModifiers({ distance: 1 }))).toBe(0)
    expect(totalModifier(detectionModifiers({ distance: 2 }))).toBe(-1)
    expect(totalModifier(detectionModifiers({ distance: 4 }))).toBe(-3)
  })

  it('applies the whole modifier table at once', () => {
    // Distance 3 (-2), Level 3 admiral (-1), superior sensors (+2), stealth
    // hulls (-2), a target staying cloaked (-2), and a nebula (-2).
    const modifiers = detectionModifiers({
      distance: 3,
      admiral: 3,
      sensors: 'superior',
      allTargetsStealthHulled: true,
      targetStaysCloaked: true,
      nebula: true,
    })
    expect(totalModifier(modifiers)).toBe(-7)
    expect(modifiers).toHaveLength(6)
  })

  it('counts only the best sensor fit aboard', () => {
    expect(SENSOR_BONUS.advanced).toBe(1)
    expect(SENSOR_BONUS.superior).toBe(2)
    expect(totalModifier(detectionModifiers({ distance: 1, sensors: 'superior' }))).toBe(2)
  })

  it('refuses beyond 4 hexes without drawing a die', () => {
    const rng = campaignRng(5)
    const result = detectionCheck({ distance: DETECTION_RANGE + 1 }, rng)
    expect(result.attempted).toBe(false)
    expect(result.dice).toBeNull()
    // A refused check that moved the cursor would shift every later roll.
    expect(rng.cursor).toBe(0)
  })

  it('succeeds on 8 or more and reveals what an 8 on the spying roll would', () => {
    const result = detectionCheck({ distance: 1 }, streamOf([4, 4]))
    expect(result.total).toBe(DETECTION_TARGET)
    expect(result.success).toBe(true)
    expect(result.report).toEqual(intelFromSpyingRoll(8))
    expect(result.report.shipCounts).toBe(true)
    expect(result.report.hullCategories).toBe(false)
  })

  it('fails on 7 and learns nothing', () => {
    const result = detectionCheck({ distance: 1 }, streamOf([3, 4]))
    expect(result.total).toBe(7)
    expect(result.success).toBe(false)
    expect(result.report).toEqual(NO_INTEL)
  })

  it('uncloaks a cloaked target for good when it succeeds', () => {
    // 6 + 6 = 12, less the -2 for a target staying cloaked, is a clear success.
    const result = detectionCheck({ distance: 1, targetStaysCloaked: true }, streamOf([6, 6]))
    expect(result.total).toBe(10)
    expect(result.success).toBe(true)
    expect(result.uncloaks).toBe(true)
  })

  it('does not uncloak anything on a failure', () => {
    const result = detectionCheck({ distance: 4, targetStaysCloaked: true }, streamOf([2, 2]))
    expect(result.success).toBe(false)
    expect(result.uncloaks).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The information ladder (9)
// ---------------------------------------------------------------------------

describe('the spying roll ladder (9)', () => {
  it('gives nothing on 7 or less', () => {
    expect(intelFromSpyingRoll(7)).toEqual(NO_INTEL)
    expect(intelFromSpyingRoll(2)).toEqual(NO_INTEL)
  })

  it('climbs one rung at a time and never loses a rung', () => {
    expect(intelFromSpyingRoll(8)).toEqual({
      shipCounts: true,
      hullCategories: false,
      hullMasses: false,
      classDesignations: false,
      shipIdentities: false,
    })
    expect(intelFromSpyingRoll(9).hullCategories).toBe(true)
    expect(intelFromSpyingRoll(9).hullMasses).toBe(false)
    expect(intelFromSpyingRoll(10).hullMasses).toBe(true)
    expect(intelFromSpyingRoll(11).classDesignations).toBe(true)
    expect(intelFromSpyingRoll(11).shipIdentities).toBe(false)
    expect(intelFromSpyingRoll(12)).toEqual({
      shipCounts: true,
      hullCategories: true,
      hullMasses: true,
      classDesignations: true,
      shipIdentities: true,
    })
    expect(intelFromSpyingRoll(15)).toEqual(intelFromSpyingRoll(12))
  })

  it('merges two looks into the better of the two', () => {
    expect(mergeIntel(intelFromSpyingRoll(8), intelFromSpyingRoll(11))).toEqual(intelFromSpyingRoll(11))
  })
})

// ---------------------------------------------------------------------------
// Espionage (9)
// ---------------------------------------------------------------------------

describe('espionage (9)', () => {
  it('prices the five ways in', () => {
    expect(ESPIONAGE_COST['drop-pod']).toBe(50)
    expect(ESPIONAGE_COST['sleeper-spy']).toBe(100)
    expect(ESPIONAGE_COST['cloaked-ship']).toBe(0)
    expect(ESPIONAGE_COST['observation-pass']).toBe(0)
    expect(counterEspionageCost(3)).toBe(3 * COUNTER_ESPIONAGE_COST_PER_LEVEL)
    expect(COUNTER_ESPIONAGE_COST_PER_LEVEL).toBe(200)
  })

  it('gives an observation pass +3 plus the best sensor bonus', () => {
    expect(routeBonus('observation-pass')).toBe(OBSERVATION_PASS_BONUS)
    expect(routeBonus('observation-pass', 'advanced')).toBe(4)
    expect(routeBonus('observation-pass', 'superior')).toBe(5)
    expect(routeBonus('sleeper-spy')).toBe(SLEEPER_SPY_BONUS)
    expect(routeBonus('drop-pod', 'superior')).toBe(0)
    expect(routeBonus('cloaked-ship')).toBe(0)
  })

  it('launches a drop pod on 7+ on 2d6', () => {
    expect(launchDropPod(streamOf([3, 4])).total).toBe(DROP_POD_LAUNCH_TARGET)
    expect(launchDropPod(streamOf([3, 4])).launched).toBe(true)
    expect(launchDropPod(streamOf([3, 3])).launched).toBe(false)
  })

  it('reads the discovery check off its four rungs', () => {
    expect(discoveryOutcome(2)).toBe('observed-may-double')
    expect(discoveryOutcome(3)).toBe('observed-may-double')
    expect(discoveryOutcome(4)).toBe('observed-may-capture')
    expect(discoveryOutcome(5)).toBe('observed-escaped')
    expect(discoveryOutcome(6)).toBe('unobserved')
    expect(discoveryOutcome(12)).toBe('unobserved')
  })

  it('puts counter-espionage and risks taken against the discovery check', () => {
    const check = discoveryCheck(streamOf([4, 4]), { counterEspionage: 2, risk: 1 })
    expect(check.modifier).toBe(-3)
    expect(check.total).toBe(5)
    expect(check.outcome).toBe('observed-escaped')
  })

  it('puts a burned spy at -3', () => {
    const check = discoveryCheck(streamOf([5, 5]), { burned: true })
    expect(check.modifier).toBe(BURNED_SPY_MODIFIER)
    expect(check.total).toBe(7)
  })

  it('pays the risks back on the roll they support', () => {
    const roll = spyingRoll(streamOf([3, 3]), { route: 'observation-pass', sensors: 'advanced', risk: 2 })
    // 3 + 3, +3 for the pass, +1 for advanced sensors, +2 for two risks taken.
    expect(roll.modifier).toBe(6)
    expect(roll.total).toBe(12)
    expect(roll.report.shipIdentities).toBe(true)
  })

  it('fails sabotage on 1-4', () => {
    const result = sabotageRoll(streamOf([4]), ['fc-1'])
    expect(result.outcome).toBe('failed')
    expect(result.systemId).toBeNull()
    expect(result.burnsSpy).toBe(false)
  })

  it('part-sabotages one system on a 5', () => {
    const result = sabotageRoll(streamOf([5]), ['fc-1'])
    expect(result.outcome).toBe('system-sabotaged')
    expect(result.systemId).toBe('fc-1')
    expect(result.burnsSpy).toBe(false)
  })

  it('destroys the ship on a 6 and burns the spy', () => {
    const result = sabotageRoll(streamOf([6]), ['fc-1'])
    expect(result.outcome).toBe('ship-destroyed')
    expect(result.burnsSpy).toBe(true)
  })

  it('stops a drop pod that never launched, having drawn only its two dice', () => {
    const rng = streamOf([3, 3])
    const result = runEspionage({ route: 'drop-pod' }, rng)
    expect(result.launch?.launched).toBe(false)
    expect(result.discovery).toBeNull()
    expect(result.spying).toBeNull()
    expect(result.intel).toEqual(NO_INTEL)
    expect(rng.cursor).toBe(2)
  })

  it('stops a mission whose spy was seen going in', () => {
    // Discovery check 2 + 2 = 4: observed, and may be captured.
    const rng = streamOf([2, 2])
    const result = runEspionage({ route: 'sleeper-spy' }, rng)
    expect(result.discovery?.outcome).toBe('observed-may-capture')
    expect(result.spying).toBeNull()
    expect(result.intel).toEqual(NO_INTEL)
    expect(rng.cursor).toBe(2)
  })

  it('runs a drop pod all the way through to sabotage', () => {
    //  [5,5] launch 10 -> away;  [4,4] discovery 8 -> unobserved;
    //  [6,5] spying 11 -> class designations;  [6] sabotage -> ship destroyed.
    const rng = streamOf([5, 5, 4, 4, 6, 5, 6])
    const result = runEspionage({ route: 'drop-pod', sabotage: ['fc-1', 'beam-1'] }, rng)
    expect(result.cost).toBe(50)
    expect(result.launch?.launched).toBe(true)
    expect(result.discovery?.outcome).toBe('unobserved')
    expect(result.spying?.total).toBe(11)
    expect(result.intel.classDesignations).toBe(true)
    expect(result.intel.shipIdentities).toBe(false)
    expect(result.sabotage?.outcome).toBe('ship-destroyed')
    expect(result.burned).toBe(true)
  })

  it('replays a mission exactly from the cursor it started at', () => {
    const first = campaignRng(4242)
    const a = runEspionage({ route: 'observation-pass', sensors: 'superior', risk: 1 }, first)
    const b = runEspionage({ route: 'observation-pass', sensors: 'superior', risk: 1 }, campaignRng(4242))
    expect(b).toEqual(a)
  })
})
