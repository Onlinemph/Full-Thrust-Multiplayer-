/**
 * Admirals, detection and espionage — campaign.md sections 7, "Detection (8,
 * end)" and 9.
 *
 * These are the parts of the campaign that are rolled for, often in secret, so
 * they are also the parts where replay discipline matters most: a spy's roll
 * must come out the same when the campaign is replayed from its move journal or
 * the whole story changes. Every die here therefore comes from a `CampaignRng`
 * — a seed plus a cursor — and the cursor lives in the state being randomised,
 * so a saved campaign carries its own position in the stream.
 *
 * Reconciliation note: `CampaignRng` and the dice helpers are declared here
 * because `src/campaign/types.ts` is being written in parallel. They belong in
 * that file and are meant to move there on a later pass; the shape — `{ seed,
 * cursor }` — is what matters and is deliberately plain JSON.
 */

// ---------------------------------------------------------------------------
// The campaign dice stream
// ---------------------------------------------------------------------------

/**
 * A seeded stream of campaign dice. `cursor` is the number of draws taken, and
 * it lives in the campaign state rather than inside a generator object, so
 * `(setup + move journal)` replays a campaign exactly: the same move made at
 * the same cursor draws the same face.
 */
export interface CampaignRng {
  readonly seed: number
  cursor: number
}

/** Open a campaign dice stream, optionally resuming at a saved cursor. */
export function campaignRng(seed: number, cursor = 0): CampaignRng {
  return { seed: seed >>> 0, cursor }
}

/**
 * The value at an absolute position in the stream (mulberry32, keyed by
 * position rather than iterated). Keying on the position is what lets a saved
 * cursor resume the stream without replaying every draw before it.
 */
export function sampleAt(seed: number, cursor: number): number {
  let t = (seed + Math.imul(cursor + 1, 0x6d2b79f5)) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Draw one integer in `[0, maxExclusive)` and advance the stream. */
export function drawInt(rng: CampaignRng, maxExclusive: number): number {
  const value = sampleAt(rng.seed, rng.cursor)
  rng.cursor += 1
  return Math.floor(value * maxExclusive)
}

/** One six-sided die. */
export function drawD6(rng: CampaignRng): number {
  return drawInt(rng, 6) + 1
}

/** Two six-sided dice, as rolled — the campaign's standard check. */
export function draw2d6(rng: CampaignRng): [number, number] {
  const first = drawD6(rng)
  const second = drawD6(rng)
  return [first, second]
}

/** A twenty-sided die — the hazardous-world disaster check (6.2.1). */
export function drawD20(rng: CampaignRng): number {
  return drawInt(rng, 20) + 1
}

/** A percentile die, 1–100, as the system generation tables read it (6.2.1). */
export function drawD100(rng: CampaignRng): number {
  return drawInt(rng, 100) + 1
}

/** Pick one item at random, advancing the stream. Undefined on an empty list. */
export function drawFrom<T>(rng: CampaignRng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[drawInt(rng, items.length)]
}

/** One named entry in a die roll modifier table, kept so the log can show its working. */
export interface RollModifier {
  label: string
  value: number
}

/** Sum a modifier table. */
export function totalModifier(modifiers: readonly RollModifier[]): number {
  return modifiers.reduce((sum, modifier) => sum + modifier.value, 0)
}

// ---------------------------------------------------------------------------
// Admirals (7)
// ---------------------------------------------------------------------------

/** "recruited for 100 RP" (7). */
export const ADMIRAL_COST = 100

/**
 * Command level (7). Level 1 is excellent and Level 3 inept — the ladder runs
 * the opposite way to most ratings, which is why nothing here compares levels
 * with `>` without saying so.
 */
export type CommandLevel = 1 | 2 | 3

/** "a 1 gives Level 3 (inept), 2–5 Level 2 (average), 6 Level 1 (excellent)" (7). */
export function commandLevelFromRoll(roll: number): CommandLevel {
  if (roll <= 1) return 3
  if (roll >= 6) return 1
  return 2
}

/** "+1 fleet initiative" for a Level 1, "−1" for a Level 3, nothing for a Level 2 (7). */
export function initiativeModifier(level: CommandLevel | null): number {
  if (level === 1) return 1
  if (level === 3) return -1
  return 0
}

/**
 * How many turns ahead a task force under this admiral must plot its FTL
 * movement (7): Level 1 plots 1 turn ahead, Level 2 two, Level 3 three.
 * "Anything without a named admiral plots as Level 3", which is what a null
 * level means here.
 */
export function plotAheadTurns(level: CommandLevel | null): 1 | 2 | 3 {
  return level ?? 3
}

/** A named admiral (7). No captains: the admiral is the whole command model. */
export interface Admiral {
  id: string
  name: string
  /** The faction that pays for them. */
  faction: string
  level: CommandLevel
  /** Turns of convalescence left after an injury; 0 when fit (7). */
  injuredFor: number
  dead: boolean
}

export interface AdmiralRecruitment {
  admiral: Admiral
  /** The 1d6 that set the command level (7). */
  roll: number
  cost: number
}

/** Recruit an admiral: 100 RP, command level on 1d6 (7). */
export function recruitAdmiral(
  rng: CampaignRng,
  identity: { id: string; name: string; faction: string },
): AdmiralRecruitment {
  const roll = drawD6(rng)
  return {
    admiral: {
      id: identity.id,
      name: identity.name,
      faction: identity.faction,
      level: commandLevelFromRoll(roll),
      injuredFor: 0,
      dead: false,
    },
    roll,
    cost: ADMIRAL_COST,
  }
}

/**
 * The command level a task force actually fights and plots under (7).
 *
 * A dead or convalescing admiral is not commanding, and section 7 says what
 * happens to a force with nobody named at its head: it "plots as Level 3". The
 * same reading is applied to initiative, because the alternative — an injured
 * admiral still lending his +1 from a hospital bed — is not a reading of the
 * rule so much as an exception to it.
 */
export function effectiveCommandLevel(admiral: Admiral | null): CommandLevel | null {
  if (!admiral || admiral.dead || admiral.injuredFor > 0) return null
  return admiral.level
}

export type AdmiralCasualty = 'dead' | 'injured' | 'unharmed'

export interface AdmiralCasualtyResult {
  roll: number
  outcome: AdmiralCasualty
  /** Turns of injury, from the second 1d6. Zero unless `outcome` is `injured`. */
  turns: number
}

/**
 * "If a flagship dies or takes a bridge hit, roll 1d6 for the admiral: 1 dead,
 * 2–3 injured for 1d6 turns, 4–6 unharmed" (7). The admiral record is updated
 * in place, the way the tactical engine marks an SSD.
 */
export function rollAdmiralCasualty(admiral: Admiral, rng: CampaignRng): AdmiralCasualtyResult {
  const roll = drawD6(rng)
  if (roll <= 1) {
    admiral.dead = true
    admiral.injuredFor = 0
    return { roll, outcome: 'dead', turns: 0 }
  }
  if (roll <= 3) {
    const turns = drawD6(rng)
    // A second wound does not shorten the first: the longer convalescence wins.
    admiral.injuredFor = Math.max(admiral.injuredFor, turns)
    return { roll, outcome: 'injured', turns }
  }
  return { roll, outcome: 'unharmed', turns: 0 }
}

/** Tick one strategic turn off an admiral's convalescence (7). */
export function recoverAdmiral(admiral: Admiral): Admiral {
  if (!admiral.dead && admiral.injuredFor > 0) admiral.injuredFor -= 1
  return admiral
}

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

/**
 * The sensor fit aboard the observing force. The detection table names the two
 * grades "+1 Advanced sensors aboard" and "+2 Superior sensors aboard"; the
 * tactical schema calls the +1 grade `enhanced-sensors` (12.1), which is the
 * same fit under the other book's name.
 */
export type SensorGrade = 'none' | 'advanced' | 'superior'

/** The bonus each grade carries (detection table, and the observation pass in 9). */
export const SENSOR_BONUS: Readonly<Record<SensorGrade, number>> = {
  none: 0,
  advanced: 1,
  superior: 2,
}

// ---------------------------------------------------------------------------
// The information ladder (9, spying roll)
// ---------------------------------------------------------------------------

/**
 * What a successful look at an enemy force tells you (9). The ladder is
 * cumulative: an 11 gives everything a 10 gave and the class designations too.
 */
export interface IntelReport {
  /** 8: how many ships are there. */
  shipCounts: boolean
  /** 9: hull categories and station classes. */
  hullCategories: boolean
  /** 10: hull masses and station damage. */
  hullMasses: boolean
  /** 11: ship class designations. */
  classDesignations: boolean
  /** 12+: individual ship IDs and their damage status. */
  shipIdentities: boolean
}

/** A look that told you nothing — the spying roll's "7 or less" (9). */
export const NO_INTEL: IntelReport = Object.freeze({
  shipCounts: false,
  hullCategories: false,
  hullMasses: false,
  classDesignations: false,
  shipIdentities: false,
})

/**
 * Read a spying-roll total off the information ladder (9):
 * 7 or less nothing; 8 ship counts; 9 + hull categories and station classes;
 * 10 + hull masses and station damage; 11 + class designations; 12+ + ship IDs
 * and damage status.
 */
export function intelFromSpyingRoll(total: number): IntelReport {
  return {
    shipCounts: total >= 8,
    hullCategories: total >= 9,
    hullMasses: total >= 10,
    classDesignations: total >= 11,
    shipIdentities: total >= 12,
  }
}

/** Merge two reports — a force watched twice in a turn knows the better of the two. */
export function mergeIntel(a: IntelReport, b: IntelReport): IntelReport {
  return {
    shipCounts: a.shipCounts || b.shipCounts,
    hullCategories: a.hullCategories || b.hullCategories,
    hullMasses: a.hullMasses || b.hullMasses,
    classDesignations: a.classDesignations || b.classDesignations,
    shipIdentities: a.shipIdentities || b.shipIdentities,
  }
}

// ---------------------------------------------------------------------------
// Detection (8, end)
// ---------------------------------------------------------------------------

/** "a task force within 4 hexes" (8, end). */
export const DETECTION_RANGE = 4

/** "8+ succeeds" (8, end). */
export const DETECTION_TARGET = 8

/**
 * Everything the detection modifier table asks about (8, end). Each field is a
 * fact about the attempt, never a pre-computed modifier — the table is applied
 * here so that a hand-edited journal entry cannot smuggle a bonus in.
 */
export interface DetectionContext {
  /** Range in hexes. Beyond `DETECTION_RANGE` the check may not be made. */
  distance: number
  /** The observing task force's admiral, after `effectiveCommandLevel`. */
  admiral?: CommandLevel | null
  /** The best sensor fit aboard the observing force. */
  sensors?: SensorGrade
  /** "Every target ship has a stealth hull". */
  allTargetsStealthHulled?: boolean
  /** "Target is a cloaked ship staying cloaked". */
  targetStaysCloaked?: boolean
  /** "Target system is a nebula" — the gas/dust cloud of 6.2.1. */
  nebula?: boolean
}

/**
 * The detection modifier table, in the order campaign.md prints it (8, end):
 *
 *   −1 per hex beyond the first   Distance
 *   +1 / −1                       Level 1 / Level 3 admiral
 *   +1                            Advanced sensors aboard
 *   +2                            Superior sensors aboard
 *   −2                            Every target ship has a stealth hull
 *   −2                            Target is a cloaked ship staying cloaked
 *   −2                            Target system is a nebula
 *
 * The two sensor lines are grades of one fit, not two bonuses, so only the best
 * one aboard counts.
 */
export function detectionModifiers(context: DetectionContext): RollModifier[] {
  const modifiers: RollModifier[] = []
  const beyondFirst = Math.max(0, Math.floor(context.distance) - 1)
  if (beyondFirst > 0) modifiers.push({ label: 'Distance', value: -beyondFirst })

  const admiral = initiativeModifier(context.admiral ?? null)
  if (admiral !== 0) modifiers.push({ label: `Level ${context.admiral} admiral`, value: admiral })

  const sensors = SENSOR_BONUS[context.sensors ?? 'none']
  if (sensors !== 0) modifiers.push({ label: `${context.sensors} sensors`, value: sensors })

  if (context.allTargetsStealthHulled) modifiers.push({ label: 'Stealth hulls', value: -2 })
  if (context.targetStaysCloaked) modifiers.push({ label: 'Target stays cloaked', value: -2 })
  // The same −2 the nebula's own entry in 6.2.1 gives "external discovery
  // checks": one hex, one penalty, stated twice.
  if (context.nebula) modifiers.push({ label: 'Nebula', value: -2 })

  return modifiers
}

export interface DetectionResult {
  /** False when the target was out of range: no dice were drawn and nothing changed. */
  attempted: boolean
  dice: [number, number] | null
  modifiers: RollModifier[]
  modifier: number
  total: number
  success: boolean
  /** "A successful check against a cloaked ship uncloaks it for good" (8, end). */
  uncloaks: boolean
  /** What the check revealed: "what an 8 on the spying roll would" (8, end). */
  report: IntelReport
  refusedReason?: string
}

/**
 * The voluntary detection check (8, end): 2d6 against a task force within 4
 * hexes, 8 or more succeeds, and it reveals what an 8 on the spying roll would.
 *
 * An out-of-range attempt draws no dice at all. A refused move must not move
 * the stream cursor, or journalling the refusal would shift every roll after it
 * — the same discipline the tactical engine keeps for refused actions.
 */
export function detectionCheck(context: DetectionContext, rng: CampaignRng): DetectionResult {
  if (context.distance > DETECTION_RANGE || context.distance < 0) {
    return {
      attempted: false,
      dice: null,
      modifiers: [],
      modifier: 0,
      total: 0,
      success: false,
      uncloaks: false,
      report: NO_INTEL,
      refusedReason: `target is ${context.distance} hexes away; detection reaches ${DETECTION_RANGE}`,
    }
  }

  const modifiers = detectionModifiers(context)
  const modifier = totalModifier(modifiers)
  const dice = draw2d6(rng)
  const total = dice[0] + dice[1] + modifier
  const success = total >= DETECTION_TARGET
  return {
    attempted: true,
    dice,
    modifiers,
    modifier,
    total,
    success,
    uncloaks: success && (context.targetStaysCloaked ?? false),
    report: success ? intelFromSpyingRoll(DETECTION_TARGET) : NO_INTEL,
  }
}

// ---------------------------------------------------------------------------
// Espionage (9)
// ---------------------------------------------------------------------------

/**
 * The four ways of putting a spy in place (9). "Taking risks" is the fifth way
 * in, but it is a dial on whichever of these is used rather than a route of its
 * own, so it rides on the mission as `risk`.
 */
export type EspionageRoute = 'drop-pod' | 'cloaked-ship' | 'observation-pass' | 'sleeper-spy'

/** What each route costs to mount (9). A ship already on station costs nothing extra. */
export const ESPIONAGE_COST: Readonly<Record<EspionageRoute, number>> = {
  'drop-pod': 50,
  'cloaked-ship': 0,
  'observation-pass': 0,
  'sleeper-spy': 100,
}

/** "a drop pod (50 RP, launched on 7+ on 2d6)" (9). */
export const DROP_POD_LAUNCH_TARGET = 7

/** "an observation pass (+3 plus the best sensor bonus)" (9). */
export const OBSERVATION_PASS_BONUS = 3

/** "a sleeper spy (100 RP, +1)" (9). */
export const SLEEPER_SPY_BONUS = 1

/** "Counter-espionage costs 200 RP a level" (9). */
export const COUNTER_ESPIONAGE_COST_PER_LEVEL = 200

/** "the spy takes −3 thereafter" once sabotage has destroyed a ship (9). */
export const BURNED_SPY_MODIFIER = -3

/** What a level of counter-espionage costs to maintain in a system for a turn (9). */
export function counterEspionageCost(levels: number): number {
  return Math.max(0, Math.floor(levels)) * COUNTER_ESPIONAGE_COST_PER_LEVEL
}

/**
 * The bonus a route lends the roll it supports (9). The drop pod and a cloaked
 * ship on station buy access, not a better look, so they carry no bonus.
 */
export function routeBonus(route: EspionageRoute, sensors: SensorGrade = 'none'): number {
  if (route === 'observation-pass') return OBSERVATION_PASS_BONUS + SENSOR_BONUS[sensors]
  if (route === 'sleeper-spy') return SLEEPER_SPY_BONUS
  return 0
}

/** The 2d6 launch a drop pod must pass before it is anywhere at all (9). */
export interface DropPodLaunch {
  dice: [number, number]
  total: number
  launched: boolean
}

export function launchDropPod(rng: CampaignRng): DropPodLaunch {
  const dice = draw2d6(rng)
  const total = dice[0] + dice[1]
  return { dice, total, launched: total >= DROP_POD_LAUNCH_TARGET }
}

/**
 * The discovery check's four outcomes (9). The two "may be" rungs name an
 * option the *discovering* player takes, so the outcome records the option
 * rather than its exercise.
 */
export type DiscoveryOutcome =
  /** 3 or less: observed, may be doubled. */
  | 'observed-may-double'
  /** 4: observed, may be captured. */
  | 'observed-may-capture'
  /** 5: observed but escapes. */
  | 'observed-escaped'
  /** 6+: not observed, the mission proceeds. */
  | 'unobserved'

export function discoveryOutcome(total: number): DiscoveryOutcome {
  if (total <= 3) return 'observed-may-double'
  if (total === 4) return 'observed-may-capture'
  if (total === 5) return 'observed-escaped'
  return 'unobserved'
}

export interface DiscoveryCheck {
  dice: [number, number]
  modifiers: RollModifier[]
  modifier: number
  total: number
  outcome: DiscoveryOutcome
}

/**
 * The discovery check that decides whether the spy is seen going in (9).
 *
 * Two things push it down: counter-espionage, at "−1 to every discovery check
 * in that system that turn", and the risks the spy chose to take — "each 1 on
 * the discovery check gives +1 to the roll it supports", which is a trade of
 * one point of exposure here for one point of intelligence later.
 */
export function discoveryCheck(
  rng: CampaignRng,
  opts: { counterEspionage?: number; risk?: number; burned?: boolean } = {},
): DiscoveryCheck {
  const modifiers: RollModifier[] = []
  const counter = Math.max(0, Math.floor(opts.counterEspionage ?? 0))
  if (counter > 0) modifiers.push({ label: `Counter-espionage ×${counter}`, value: -counter })
  const risk = Math.max(0, Math.floor(opts.risk ?? 0))
  if (risk > 0) modifiers.push({ label: `Risks taken ×${risk}`, value: -risk })
  if (opts.burned) modifiers.push({ label: 'Spy burned by an earlier sabotage', value: BURNED_SPY_MODIFIER })

  const modifier = totalModifier(modifiers)
  const dice = draw2d6(rng)
  const total = dice[0] + dice[1] + modifier
  return { dice, modifiers, modifier, total, outcome: discoveryOutcome(total) }
}

export interface SpyingRoll {
  dice: [number, number]
  modifiers: RollModifier[]
  modifier: number
  total: number
  report: IntelReport
}

/** The spying roll proper: 2d6 plus the route's bonus, read off the ladder (9). */
export function spyingRoll(
  rng: CampaignRng,
  opts: { route?: EspionageRoute; sensors?: SensorGrade; risk?: number; burned?: boolean; extra?: number } = {},
): SpyingRoll {
  const modifiers: RollModifier[] = []
  if (opts.route) {
    const bonus = routeBonus(opts.route, opts.sensors ?? 'none')
    if (bonus !== 0) modifiers.push({ label: opts.route, value: bonus })
  }
  const risk = Math.max(0, Math.floor(opts.risk ?? 0))
  if (risk > 0) modifiers.push({ label: `Risks taken ×${risk}`, value: risk })
  if (opts.burned) modifiers.push({ label: 'Spy burned by an earlier sabotage', value: BURNED_SPY_MODIFIER })
  if (opts.extra) modifiers.push({ label: 'Other', value: opts.extra })

  const modifier = totalModifier(modifiers)
  const dice = draw2d6(rng)
  const total = dice[0] + dice[1] + modifier
  return { dice, modifiers, modifier, total, report: intelFromSpyingRoll(total) }
}

/** Sabotage's three results (9). */
export type SabotageOutcome = 'failed' | 'system-sabotaged' | 'ship-destroyed'

export interface SabotageResult {
  roll: number
  outcome: SabotageOutcome
  /**
   * The system that will fail under combat stress, on a 5. Null on any other
   * result, or when the target was handed over with no systems to pick from.
   */
  systemId: string | null
  /** True on a 6: the spy is at −3 on everything thereafter (9). */
  burnsSpy: boolean
}

/**
 * "after a clean discovery check, roll d6: 1–4 fails, 5 partly sabotages one
 * random system so it fails under combat stress, 6 destroys the ship (and the
 * spy takes −3 thereafter)" (9).
 *
 * `systemIds` are the target's system and weapon ids as they appear on its SSD,
 * so the id this returns can be handed straight to the tactical layer as the
 * system that fails.
 */
export function sabotageRoll(rng: CampaignRng, systemIds: readonly string[] = []): SabotageResult {
  const roll = drawD6(rng)
  if (roll <= 4) return { roll, outcome: 'failed', systemId: null, burnsSpy: false }
  if (roll === 5) {
    const systemId = drawFrom(rng, systemIds) ?? null
    return { roll, outcome: 'system-sabotaged', systemId, burnsSpy: false }
  }
  return { roll, outcome: 'ship-destroyed', systemId: null, burnsSpy: true }
}

/** One espionage attempt, as it appears in the campaign's move journal (9). */
export interface EspionageMission {
  route: EspionageRoute
  /** The best sensor fit supporting the mission — an observation pass adds it. */
  sensors?: SensorGrade
  /** Risks taken: −1 on the discovery check, +1 on the roll it supports, each. */
  risk?: number
  /** Levels of counter-espionage in the target system this turn. */
  counterEspionage?: number
  /** This spy has already destroyed a ship and is at −3 thereafter. */
  burned?: boolean
  /** Attempt sabotage as well as observation, against a ship with these systems. */
  sabotage?: readonly string[]
}

export interface EspionageResult {
  route: EspionageRoute
  /** RP the mission costs to mount, before counter-espionage. */
  cost: number
  /** Present only for a drop pod, which must be launched before anything else (9). */
  launch: DropPodLaunch | null
  /** Null when the pod never launched. */
  discovery: DiscoveryCheck | null
  /** Null unless the discovery check came back clean. */
  spying: SpyingRoll | null
  /** Null unless sabotage was ordered and the discovery check came back clean. */
  sabotage: SabotageResult | null
  /** What the mission learned. */
  intel: IntelReport
  /** The spy is at −3 on future missions from here on (9). */
  burned: boolean
}

/**
 * Run one espionage mission end to end (9): mount it, get in, look, and — if
 * ordered — break something.
 *
 * The order is the order the rules put it in, and it matters for replay: a drop
 * pod that fails to launch never makes a discovery check, so it draws two dice,
 * not four, and every campaign roll after it lands where it did the first time.
 */
export function runEspionage(mission: EspionageMission, rng: CampaignRng): EspionageResult {
  const cost = ESPIONAGE_COST[mission.route]
  const result: EspionageResult = {
    route: mission.route,
    cost,
    launch: null,
    discovery: null,
    spying: null,
    sabotage: null,
    intel: NO_INTEL,
    burned: mission.burned ?? false,
  }

  if (mission.route === 'drop-pod') {
    result.launch = launchDropPod(rng)
    if (!result.launch.launched) return result
  }

  result.discovery = discoveryCheck(rng, {
    counterEspionage: mission.counterEspionage,
    risk: mission.risk,
    burned: mission.burned,
  })
  if (result.discovery.outcome !== 'unobserved') return result

  result.spying = spyingRoll(rng, {
    route: mission.route,
    sensors: mission.sensors,
    risk: mission.risk,
    burned: mission.burned,
  })
  result.intel = result.spying.report

  if (mission.sabotage) {
    result.sabotage = sabotageRoll(rng, mission.sabotage)
    if (result.sabotage.burnsSpy) result.burned = true
  }

  return result
}
