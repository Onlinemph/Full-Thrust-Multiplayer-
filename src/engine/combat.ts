/**
 * Full Thrust: Project Continuum — the firing and damage pipeline (4.1 – 4.11).
 *
 * Every weapon in the game, from a Beam-1 to a wave gun, ends its turn here:
 * a `WeaponResult` (see `weapons/contract.ts`) says how much damage the dice
 * produced and how it meets armour, and this module decides where it lands.
 * The split is deliberate — 4.9 puts it better than a comment can: *"The damage
 * inflicted by those hits depends on the nature of the weapon used"*, but where
 * that damage goes depends entirely on the target's armour, screens and hull.
 *
 * Rules are written out in full in `docs/rules/combat.md`.
 *
 * Three things this module deliberately does not do:
 *   - roll dice for a weapon (that is the weapon's resolver);
 *   - reduce damage for screens (`dice.beamDamage` does that before the damage
 *     ever reaches a `WeaponResult`, 4.7);
 *   - roll threshold checks (`dice.thresholdCheck`, phase 13). It only reports
 *     which hull rows an attack crossed, which is the input phase 13 needs.
 */

import { beamDamage, rollBeamVolley, type Rng, type ScreenLevel } from './dice'
import { beamDiceAtRange, bearsOn } from './geometry'
import type { Arc, DamageMode, HullRows, ShipDesign } from './types'
import type { WeaponResult } from './weapons/contract'

// ---------------------------------------------------------------------------
// Fire control (4.4)
// ---------------------------------------------------------------------------

/** Why an order could not be carried out (4.2, 4.4, 4.5). */
export type FireRefusal =
  | 'unknown-weapon'
  | 'unknown-target'
  /** 4.5: *"No single weapon may split its die rolls between targets"*. */
  | 'weapon-already-firing'
  | 'out-of-arc'
  /** 4.2: *"No ship may fire offensive weaponry through its aft arc"*. */
  | 'aft-arc'
  | 'no-firecon'

/**
 * One target as it bears from the firing ship this turn (4.2, 4.4).
 *
 * `arc` is the arc the target lies in — `geometry.arcTo` works it out — and is
 * passed in rather than recomputed here so that fire control stays a pure
 * bookkeeping problem with no map in it.
 */
export interface TargetBearing {
  id: string
  /**
   * 4.4: *"Each fighter group targeted requires a FireCon as if it were a
   * ship."* Missiles and other ordnance are shot at by point defence, which
   * needs no FireCon at all, so they never appear here.
   */
  kind: 'ship' | 'fighter-group'
  arc: Arc
}

/** One written firing order: this mount, at that target (4.4). */
export interface FireOrder {
  weaponId: string
  targetId: string
  /**
   * 4.4: *"Point defense fire against fighters or missiles does not require the
   * use of the ship's main FireCon systems."* A PD order is also exempt from
   * the aft-arc ban, since PD is not offensive weaponry and 4.2 gives systems
   * such as PDS *"all-round (6-arc) fire capabilities"*.
   */
  pointDefence?: boolean
}

/** A mount, reduced to the only thing fire control cares about: its arcs. */
export interface FireControlWeapon {
  id: string
  arcs: readonly Arc[]
}

export interface FireControlInput {
  /**
   * FireCon systems still operational (4.4). Destroyed ones are not counted by
   * the caller; this module never looks at threshold state.
   */
  fireCons: number
  weapons: readonly FireControlWeapon[]
  targets: readonly TargetBearing[]
  orders: readonly FireOrder[]
  /**
   * 4.2 optional rule: *"Aft arc fire is permitted on any game turn in which
   * the firing ship did not use any thrust from its main drive to accelerate,
   * decelerate, or change course"*. The movement module knows whether thrust
   * was spent; default is the standard ban.
   */
  aftArcFire?: boolean
}

export interface FireControlPlan {
  accepted: FireOrder[]
  refused: Array<{ order: FireOrder; reason: FireRefusal }>
  /** Targets engaged, in the order the FireCons were committed to them. */
  engagedTargets: string[]
  fireConsUsed: number
  fireConsAvailable: number
}

/**
 * Work out which of a ship's firing orders it can actually carry out this turn
 * (4.2, 4.4, 4.5).
 *
 * Orders are walked in the order they were written and each illegal one is
 * refused on its own with a reason — a player at the table corrects one order,
 * they do not throw the whole turn away. Targets take a FireCon
 * first-come-first-served; once the FireCons are committed, an order naming a
 * *new* target is refused while further orders against an already-engaged
 * target still go through, because 4.4 charges per target, not per weapon:
 * *"fire from the ship's various weapons may be divided in any way between the
 * targets"*.
 */
export function planFireControl(input: FireControlInput): FireControlPlan {
  const weapons = new Map(input.weapons.map((w) => [w.id, w]))
  const targets = new Map(input.targets.map((t) => [t.id, t]))
  const aftArcFire = input.aftArcFire ?? false

  const accepted: FireOrder[] = []
  const refused: Array<{ order: FireOrder; reason: FireRefusal }> = []
  const engaged: string[] = []
  const spentWeapons = new Set<string>()

  for (const order of input.orders) {
    const weapon = weapons.get(order.weaponId)
    if (!weapon) {
      refused.push({ order, reason: 'unknown-weapon' })
      continue
    }
    const target = targets.get(order.targetId)
    if (!target) {
      refused.push({ order, reason: 'unknown-target' })
      continue
    }
    // A mount fires once a turn, at one target (4.5). This also stops a beam
    // being spent on point defence and on a ship in the same turn (2.6).
    if (spentWeapons.has(order.weaponId)) {
      refused.push({ order, reason: 'weapon-already-firing' })
      continue
    }
    if (!bearsOn(weapon.arcs, target.arc)) {
      refused.push({ order, reason: 'out-of-arc' })
      continue
    }
    const offensive = !order.pointDefence
    if (offensive && target.arc === 'A' && !aftArcFire) {
      refused.push({ order, reason: 'aft-arc' })
      continue
    }
    if (offensive && !engaged.includes(target.id)) {
      if (engaged.length >= input.fireCons) {
        refused.push({ order, reason: 'no-firecon' })
        continue
      }
      engaged.push(target.id)
    }
    spentWeapons.add(order.weaponId)
    accepted.push(order)
  }

  return {
    accepted,
    refused,
    engagedTargets: engaged,
    fireConsUsed: engaged.length,
    fireConsAvailable: input.fireCons,
  }
}

/**
 * FireCons a set of orders would need (4.4): one per distinct target that is
 * being engaged offensively. Point-defence orders are free, and a target
 * engaged by six mounts still costs one.
 */
export function fireConsRequired(orders: readonly FireOrder[]): number {
  const engaged = new Set<string>()
  for (const order of orders) if (!order.pointDefence) engaged.add(order.targetId)
  return engaged.size
}

// ---------------------------------------------------------------------------
// Beam fire (4.5 – 4.7)
// ---------------------------------------------------------------------------

/**
 * Total dice a group of beam-type mounts throws at one target (4.5, and the
 * 4.12 sidebar: *"roll for all weapon systems of a particular type together and
 * add up the results"*).
 *
 * `ratings` are the beam classes bearing on the target; each loses one die per
 * range band past the first and drops out entirely once it runs out of dice.
 */
export function combinedBeamDice(
  ratings: readonly number[],
  range: number,
  bandSize?: number,
): number {
  return ratings.reduce((total, rating) => total + beamDiceAtRange(rating, range, bandSize), 0)
}

/** Die faces of an attack that has already been rolled, for replay and tests. */
export interface DeclaredBeamDice {
  /** The initial volley, one face per die (4.5). */
  initial: readonly number[]
  /**
   * Re-roll faces in the order they were thrown: every natural 6 in the initial
   * volley first, then the re-rolls those earned, and so on (4.6).
   */
  rerolls?: readonly number[]
}

/**
 * Score a beam-type attack from known die faces (4.5 – 4.7).
 *
 * This is `dice.rollBeamVolley` with the dice supplied instead of rolled, which
 * is what lets the rulebook's worked examples be tested verbatim and what a
 * replay needs when re-reading a battle journal. The scoring is identical: a
 * natural 6 earns a re-roll, re-rolls are scored as though the target were
 * unscreened (*"the re-roll is assumed to have already penetrated the screen"*),
 * and DRMs shift what a die scores but never earn a re-roll (4.6:
 * *"Re-rolls are made for a natural (unmodified) 6 only"*).
 *
 * Throws if the re-roll faces do not match the sixes rolled, because that is a
 * malformed journal rather than a legal-but-unlucky roll.
 */
export function scoreBeamDice(
  faces: DeclaredBeamDice,
  screens: ScreenLevel,
  opts: { drm?: number; penetrating?: boolean } = {},
): WeaponResult {
  const drm = opts.drm ?? 0
  const penetrating = opts.penetrating ?? true
  const rerolls = faces.rerolls ?? []

  const dice: number[] = []
  let normalDamage = 0
  let penetratingDamage = 0
  let owed = 0

  const score = (natural: number, isReroll: boolean): void => {
    const modified = Math.max(1, Math.min(6, natural + drm))
    const damage = beamDamage(modified, isReroll ? 0 : screens)
    dice.push(natural)
    if (isReroll) penetratingDamage += damage
    else normalDamage += damage
    if (penetrating && natural === 6) owed += 1
  }

  for (const face of faces.initial) score(face, false)
  let index = 0
  while (owed > 0) {
    if (index >= rerolls.length) {
      throw new RangeError(
        `scoreBeamDice: ${owed} re-roll(s) owed but only ${rerolls.length} supplied`,
      )
    }
    owed -= 1
    score(rerolls[index++], true)
  }
  if (index !== rerolls.length) {
    throw new RangeError(
      `scoreBeamDice: ${rerolls.length - index} re-roll(s) supplied that no natural 6 earned`,
    )
  }

  return {
    normalDamage,
    penetratingDamage,
    mode: penetrating ? 'P' : 'standard',
    dice,
    detail: describeBeamVolley(faces.initial, rerolls, screens, normalDamage, penetratingDamage),
  }
}

/**
 * Roll a beam-type attack and hand back a `WeaponResult` (4.5 – 4.7).
 *
 * A thin bridge from `dice.rollBeamVolley` to the weapon contract, so that a
 * caller holding a dice count and an `Rng` does not have to know the shape of
 * a `BeamVolley`.
 */
export function rollBeamAttack(
  diceCount: number,
  screens: ScreenLevel,
  rng: Rng,
  opts: { drm?: number; penetrating?: boolean } = {},
): WeaponResult {
  const volley = rollBeamVolley(diceCount, screens, rng, opts)
  const initial = volley.dice.filter((d) => !d.penetrating).map((d) => d.natural)
  const rerolls = volley.dice.filter((d) => d.penetrating).map((d) => d.natural)
  return {
    normalDamage: volley.normalDamage,
    penetratingDamage: volley.penetratingDamage,
    mode: (opts.penetrating ?? true) ? 'P' : 'standard',
    dice: volley.dice.map((d) => d.natural),
    detail: describeBeamVolley(
      initial,
      rerolls,
      screens,
      volley.normalDamage,
      volley.penetratingDamage,
    ),
  }
}

function describeBeamVolley(
  initial: readonly number[],
  rerolls: readonly number[],
  screens: ScreenLevel,
  normalDamage: number,
  penetratingDamage: number,
): string {
  const head = `${initial.length}D6 vs screen-${screens}: ${initial.join(',') || '—'} → ${normalDamage}`
  if (rerolls.length === 0) return head
  return `${head}; re-rolls ${rerolls.join(',')} → ${penetratingDamage} penetrating`
}

// ---------------------------------------------------------------------------
// Hull rows (4.9, 4.11, 13.7)
// ---------------------------------------------------------------------------

/**
 * Cumulative index of the last box in each hull row (4.11, 13.7).
 *
 * 12 boxes in four rows gives `[3, 6, 9, 12]` — the rulebook's own example of
 * *"12 hull boxes in four rows of three"*. Where the boxes do not divide
 * evenly the earlier rows get the extra box (14 in 4 rows → 4/4/3/3), which is
 * how an SSD is drawn: full rows first and a short one at the bottom.
 */
export function hullRowBounds(hullBoxes: number, hullRows: number): number[] {
  const rows = Math.max(1, Math.floor(hullRows))
  const base = Math.floor(hullBoxes / rows)
  const extra = hullBoxes % rows
  const bounds: number[] = []
  let cumulative = 0
  for (let row = 0; row < rows; row++) {
    const size = base + (row < extra ? 1 : 0)
    // A row with no boxes in it is not a threshold point: nothing can cross
    // it, and counting it would hand out a free check at the same damage that
    // crossed the row before. `game.hullRowBoundaries` has always dropped
    // these; this is the same rule, on the damage pipeline's side of it.
    if (size <= 0) continue
    cumulative += size
    bounds.push(cumulative)
  }
  return bounds
}

/**
 * The 1-based indices of every hull row *completed* by damage running from
 * `before` boxes crossed off to `after` (4.9, 4.11). Rows are only counted
 * when their last box goes: 7 damage into rows of three completes rows 1 and 2
 * and leaves row 3 open.
 */
export function rowsCrossedBetween(before: number, after: number, bounds: readonly number[]): number[] {
  const crossed: number[] = []
  for (let row = 0; row < bounds.length; row++) {
    const end = bounds[row]
    if (end > before && end <= after) crossed.push(row + 1)
  }
  return crossed
}

// ---------------------------------------------------------------------------
// Damage application (4.8 – 4.10)
// ---------------------------------------------------------------------------

/**
 * The part of a ship damage can be applied to (4.8, 4.9). Kept separate from
 * `ShipDesign` so fighters, stations and anything else with a damage track can
 * be shot at through the same function.
 */
export interface DamageableTarget {
  /** Hull boxes as printed on the SSD (13.7). */
  hullBoxes: number
  hullRows: HullRows
  /** Hull boxes crossed off so far, left to right (4.9). */
  hullDamage: number
  /**
   * Armour boxes still standing, per layer, **inner layer first** — the same
   * order as `ArmourDef.layers` (7.7). The last entry is the outermost layer,
   * which is the rulebook's *"first layer of armor"*.
   */
  armourRemaining: number[]
  /**
   * Boxes in each hull row, where a printed SSD does not divide them the way
   * `hullRowBounds` would. Some published SSDs draw an uneven track, and a row
   * boundary is a threshold point (4.11), so it has to be honoured exactly as
   * printed rather than recomputed.
   */
  hullRowSizes?: number[]
}

/** Battle state for a fresh, undamaged ship (4.8). */
export function createTargetState(design: ShipDesign): DamageableTarget {
  return {
    hullBoxes: design.hullBoxes,
    hullRows: design.hullRows,
    hullDamage: 0,
    armourRemaining: [...design.armour.layers],
  }
}

/**
 * Where this target's hull rows end (4.11). An SSD that prints its own row
 * lengths wins; otherwise the rows are derived from the box and row counts.
 */
export function rowBoundsFor(target: DamageableTarget): number[] {
  if (!target.hullRowSizes) return hullRowBounds(target.hullBoxes, target.hullRows)
  const bounds: number[] = []
  let cumulative = 0
  for (const size of target.hullRowSizes) {
    cumulative += size
    bounds.push(cumulative)
  }
  return bounds
}

export interface DamageOptions {
  /**
   * The optional rear-arc rule is in play for this game (4.10). Off by default
   * — the rulebook flags it "optional rule".
   */
  rearArcRule?: boolean
  /** This shot came from inside the target's rear arc (`geometry.isRearArcAttack`). */
  rearArc?: boolean
  /**
   * 4.10: *"Missiles or fighters do not benefit from rear arc attacks"*, so
   * only direct fire can turn the rule on.
   */
  source?: 'direct-fire' | 'ordnance' | 'fighter'
  /**
   * 4.10: the rule *"does not apply when firing at starbases (section 17) or
   * other Really Big Things"*.
   */
  targetIsBigThing?: boolean
  /**
   * Take up to half the remaining damage on each shell layer instead of filling
   * the outermost layer first. This is the reading of 7.7 written into
   * `ArmourDef`'s documentation; it is **off** by default because the worked
   * example in 4.9 contradicts it — a Class-3 beam's three points are *"all
   * scored against the first layer of armor"* of a cruiser that has a further
   * row behind it. Offered as a toggle for groups that play it that way.
   */
  layeredHalfAbsorption?: boolean
}

/** What one hit did to a target (4.8 – 4.11). */
export interface DamageApplication {
  /** The target after the hit. The input state is never mutated. */
  target: DamageableTarget
  /** Boxes taken off each armour layer, inner layer first. */
  armourAbsorbed: number[]
  /** Hull boxes crossed off by this hit. */
  hullDamage: number
  /** Damage with nowhere left to go once the last hull box went (4.9). */
  overkill: number
  /** 1-based indices of the hull rows this hit completed (4.11). */
  rowsCrossed: number[]
  /**
   * What phase 13 should roll, or null when no row was completed — or when the
   * ship died, since 4.11 waives the check on the last row.
   */
  threshold: { row: number; extraRows: number } | null
  /** 4.9: *"If the ship loses its last hull box, it is destroyed."* */
  destroyed: boolean
  /** Armour was skipped outright under the optional rear-arc rule (4.10). */
  rearArcBypass: boolean
  /** Carried through from the weapon: needle-beam and boarding effects. */
  targetedSystems?: string[]
  boarders?: number
  disruption?: WeaponResult['disruption']
  log: string
}

/**
 * Apply one weapon's result to a target (4.8, 4.9, 4.10).
 *
 * The order of business is the order a player works in: the initial damage
 * pile meets the armour according to the weapon's mode, then the penetrating
 * pile — the re-roll dice set aside as their own clump — goes in one layer
 * deeper, then whatever is left crosses off hull boxes from the left.
 */
export function applyDamage(
  target: DamageableTarget,
  result: WeaponResult,
  opts: DamageOptions = {},
): DamageApplication {
  const armour = [...target.armourRemaining]
  const absorbed = armour.map(() => 0)

  // 4.6: the re-roll pile skips *the layer the initial dice were hitting*,
  // "irrespective of whether it still has armor remaining". So the layer to
  // skip is sampled before this hit's own normal damage strips anything —
  // otherwise a volley that happened to finish off the outer layer would push
  // its own re-rolls a layer deeper than the rule allows.
  const outerBeforeHit = outermostIntactLayer(armour)

  const rearArcBypass =
    (opts.rearArcRule ?? false) &&
    (opts.rearArc ?? false) &&
    (opts.source ?? 'direct-fire') === 'direct-fire' &&
    !(opts.targetIsBigThing ?? false)

  let toHull = 0
  if (rearArcBypass) {
    // 4.10: the attack "automatically ignores the targets armor" — all of it,
    // both piles, and no armour box is crossed off.
    toHull = result.normalDamage + result.penetratingDamage
  } else {
    toHull += soakNormalDamage(armour, absorbed, result.normalDamage, result.mode, opts)
    toHull += soakInward(armour, absorbed, outerBeforeHit - 1, result.penetratingDamage, false)
  }

  const bounds = rowBoundsFor(target)
  const before = target.hullDamage
  const capacity = Math.max(0, target.hullBoxes - before)
  const hullDamage = Math.min(capacity, toHull)
  const after = before + hullDamage
  const overkill = toHull - hullDamage
  const rowsCrossed = rowsCrossedBetween(before, after, bounds)
  const destroyed = after >= target.hullBoxes && target.hullBoxes > 0

  return {
    target: {
      ...target,
      hullDamage: after,
      armourRemaining: armour,
    },
    armourAbsorbed: absorbed,
    hullDamage,
    overkill,
    rowsCrossed,
    threshold: thresholdTrigger(rowsCrossed, destroyed),
    destroyed,
    rearArcBypass,
    targetedSystems: result.targetedSystems,
    boarders: result.boarders,
    disruption: result.disruption,
    log: describeApplication(result, absorbed, hullDamage, overkill, rearArcBypass),
  }
}

/** What one phase of firing did to a target (4.8, 4.11). */
export interface VolleyApplication extends Omit<DamageApplication, 'log'> {
  /** One line per hit, in the order they were applied. */
  log: string[]
  /** Each hit's own application, for a detailed battle log. */
  hits: DamageApplication[]
}

/**
 * Apply a whole phase of fire — every weapon that engaged this target — as one
 * attack (4.8, 4.11).
 *
 * 4.8 has the player *"add up the damage inflicted"* before it meets the
 * armour, and applying the hits one after another comes to the same total for
 * ordinary damage while keeping each hit's own armour behaviour: AP spends one
 * point per layer *per hit*, and SAP halves *per hit*, so they cannot be summed
 * first. What must be aggregated is the row count, because 4.11 makes only one
 * threshold check for a phase however many hits landed in it.
 */
export function applyVolley(
  target: DamageableTarget,
  results: readonly WeaponResult[],
  opts: DamageOptions = {},
): VolleyApplication {
  let state = target
  const hits: DamageApplication[] = []
  const absorbed = target.armourRemaining.map(() => 0)
  let hullDamage = 0
  let overkill = 0
  const rows = new Set<number>()
  let destroyed = false
  let rearArcBypass = false
  const targetedSystems: string[] = []
  let boarders = 0

  for (const result of results) {
    const hit = applyDamage(state, result, opts)
    hits.push(hit)
    state = hit.target
    hit.armourAbsorbed.forEach((boxes, layer) => (absorbed[layer] += boxes))
    hullDamage += hit.hullDamage
    overkill += hit.overkill
    for (const row of hit.rowsCrossed) rows.add(row)
    destroyed = destroyed || hit.destroyed
    rearArcBypass = rearArcBypass || hit.rearArcBypass
    if (hit.targetedSystems) targetedSystems.push(...hit.targetedSystems)
    boarders += hit.boarders ?? 0
  }

  const rowsCrossed = [...rows].sort((a, b) => a - b)
  return {
    target: state,
    armourAbsorbed: absorbed,
    hullDamage,
    overkill,
    rowsCrossed,
    threshold: thresholdTrigger(rowsCrossed, destroyed),
    destroyed,
    rearArcBypass,
    targetedSystems: targetedSystems.length > 0 ? targetedSystems : undefined,
    boarders: boarders > 0 ? boarders : undefined,
    hits,
    log: hits.map((hit) => hit.log),
  }
}

/**
 * The threshold check a phase of damage calls for (4.11).
 *
 * One check only, *"for the last row destroyed"*, with *"1 to each die roll for
 * each extra threshold point passed in that attack"*. Null when nothing was
 * crossed, and null when the ship died: *"No threshold checks need to be made
 * at the end of the last hull row, since the ship is considered to be
 * destroyed"*.
 */
export function thresholdTrigger(
  rowsCrossed: readonly number[],
  destroyed: boolean,
): { row: number; extraRows: number } | null {
  if (destroyed || rowsCrossed.length === 0) return null
  return { row: rowsCrossed[rowsCrossed.length - 1], extraRows: rowsCrossed.length - 1 }
}

// ---------------------------------------------------------------------------
// Armour internals (4.8, 4.9, 7.7)
// ---------------------------------------------------------------------------

/** Index of the outermost layer with boxes left, or −1 when armour is gone. */
function outermostIntactLayer(armour: readonly number[]): number {
  for (let layer = armour.length - 1; layer >= 0; layer--) {
    if (armour[layer] > 0) return layer
  }
  return -1
}

/**
 * Pour damage into the armour from `startLayer` inward and return what is left
 * over for the hull (4.8: *"All of this damage is taken on armor. Any excess
 * damage is applied directly to the hull."*).
 *
 * `half` is the optional 7.7 reading: each layer takes at most half of what is
 * still coming, rounded up so that a single point never stalls.
 */
function soakInward(
  armour: number[],
  absorbed: number[],
  startLayer: number,
  damage: number,
  half: boolean,
): number {
  let remaining = damage
  for (let layer = Math.min(startLayer, armour.length - 1); layer >= 0 && remaining > 0; layer--) {
    if (armour[layer] <= 0) continue
    const offered = half ? Math.ceil(remaining / 2) : remaining
    const taken = Math.min(armour[layer], offered)
    armour[layer] -= taken
    absorbed[layer] += taken
    remaining -= taken
  }
  return remaining
}

/**
 * The initial damage pile against armour, by the weapon's mode (4.9, 7.7).
 * Returns what reaches the hull.
 */
function soakNormalDamage(
  armour: number[],
  absorbed: number[],
  damage: number,
  mode: DamageMode,
  opts: DamageOptions,
): number {
  if (damage <= 0) return 0
  const outer = outermostIntactLayer(armour)
  if (outer < 0) return damage

  switch (mode) {
    case 'AP': {
      // 4.9: "one point of damage is applied to each layer of [armor] ... with
      // the remaining being applied to the hull". Only layers that still have
      // boxes can stop a point — a crossed-off shell is not there any more.
      let remaining = damage
      for (let layer = armour.length - 1; layer >= 0 && remaining > 0; layer--) {
        if (armour[layer] <= 0) continue
        armour[layer] -= 1
        absorbed[layer] += 1
        remaining -= 1
      }
      return remaining
    }
    case 'SAP': {
      // 4.9: "half is applied to the armor (rounding up), and the remainder to
      // the hull OR next layer of armor if present". The remainder is not
      // halved again — 7.7 says plainly "the remaining half of their damage to
      // the next shell layer", and the worked example puts all 3 leftover
      // points on the next row rather than splitting them 2/1.
      const half = Math.ceil(damage / 2)
      const taken = Math.min(armour[outer], half)
      armour[outer] -= taken
      absorbed[outer] += taken
      return soakInward(armour, absorbed, outer - 1, damage - taken, false)
    }
    case 'P':
    case 'standard':
    default:
      // (P) changes nothing about the initial pile: 4.9 has "the damage from
      // that initial roll of 6 ... applied to the armor" like any other die.
      return soakInward(armour, absorbed, outer, damage, opts.layeredHalfAbsorption ?? false)
  }
}

function describeApplication(
  result: WeaponResult,
  absorbed: readonly number[],
  hullDamage: number,
  overkill: number,
  rearArcBypass: boolean,
): string {
  const parts: string[] = [
    `${result.mode} ${result.normalDamage}+${result.penetratingDamage}P`,
  ]
  const armourHit = absorbed
    .map((boxes, layer) => (boxes > 0 ? `L${layer + 1}−${boxes}` : ''))
    .filter((piece) => piece.length > 0)
  if (rearArcBypass) parts.push('rear arc: armour ignored')
  else if (armourHit.length > 0) parts.push(`armour ${armourHit.join(' ')}`)
  parts.push(`hull −${hullDamage}`)
  if (overkill > 0) parts.push(`overkill ${overkill}`)
  return parts.join(', ')
}
