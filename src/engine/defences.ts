/**
 * Full Thrust: Project Continuum — defences (7.2 – 7.16).
 *
 * Everything a ship does to *not* be damaged: screens and advanced screens,
 * stealth, armour and its regeneration, the antimatter suicide charge, and the
 * whole of the point-defence phase — which mounts may engage which incoming
 * threats, how many dice each contributes, and what ADFC adds.
 *
 * Rules are written out in full in `docs/rules/defences.md`, including the
 * readings taken where the text is ambiguous.
 *
 * Three deliberate boundaries:
 *   - the beam damage table and the PD/beam/fighter kill tables live in
 *     `dice.ts` and are called from here, never re-rolled (4.5 – 4.7, 6.4, 8.8);
 *   - applying damage to *hull* rows and rolling threshold checks belongs to
 *     `combat.ts` and `threshold.ts`; this module stops at the armour;
 *   - nothing here knows what a gunboat or a plasma bolt *is*. A threat arrives
 *     already classified, because how a scattergun treats it (7.14) is the only
 *     thing a defence needs to know.
 */

import {
  d6,
  pointDefenceKills,
  rollBeamVolley,
  rollD6,
  type PdMode,
  type Rng,
  type ScreenLevel,
} from './dice'
import { arcTo, bearsOn, distance } from './geometry'
import { ARC_ORDER, type Arc, type ArmourDef, type DamageMode, type Placement, type Point, type ScreenDef } from './types'

// ---------------------------------------------------------------------------
// Screens (4.7, 7.2, 7.3, 7.16)
// ---------------------------------------------------------------------------

/** The cap 7.2 and 7.3 both state: *"a ship cannot have ... greater than 2"*. */
export const MAX_SCREEN_LEVEL = 2

/**
 * 7.16: *"will 'stack' with any screens those ships have up to a maximum of
 * three"*. Only an area screen can push a ship past level 2.
 */
export const MAX_UMBRELLA_LEVEL = 3

/** Radius of an area screen's umbrella, and of the ADFC bubble (7.10, 7.16). */
export const AREA_RADIUS = 6

/** An effective screen level once an area screen is counted in (7.16). */
export type UmbrellaLevel = 0 | 1 | 2 | 3

/**
 * The working screen level of a ship (7.2).
 *
 * Each level is one screen generator symbol on the SSD (4.7), so knocking a
 * generator out drops the level. *"Extra screen generators may be fitted but
 * will only be useful as backups should one of the main screens be lost through
 * damage"* — which falls straight out of taking the minimum: a level-2 ship with
 * three generators still shows two survivors after the first is lost.
 *
 * `operationalGenerators` is the count still alive, which the threshold module
 * tracks; `ScreenDef.generators` is the count *fitted*.
 */
export function effectiveScreenLevel(
  screens: ScreenDef,
  operationalGenerators: number,
): ScreenLevel {
  const level = Math.min(MAX_SCREEN_LEVEL, screens.level, Math.max(0, operationalGenerators))
  return level as ScreenLevel
}

/**
 * An area screen projector as it bears on one moment of shooting (7.16).
 *
 * The projector's own position is what matters, not the covered ship's: the
 * umbrella is a 6 MU bubble around the generator, and *"the 'bubble' will not
 * affect any fire coming from inside the 6mu radius"*.
 */
export interface AreaScreenCover {
  generatorId: string
  position: Point
  /**
   * Levels the projector contributes. 7.16's opening sentence describes the
   * level-1 case (*"counts as one additional level"*) while its mass line prices
   * area screens *"per level (max of 2)"*; a projector built at level 2 therefore
   * contributes 2. `ScreenDef.area` carries no level, so callers reading a plain
   * SSD should pass 1.
   */
  level: 1 | 2
  /** An advanced area screen blunts ordnance for everyone under it (7.3, 7.16). */
  advanced: boolean
}

/** Which area screens actually protect this target against this shot (7.16). */
export function coveringAreaScreens(
  covers: readonly AreaScreenCover[],
  target: Point,
  attacker: Point,
): AreaScreenCover[] {
  return covers.filter(
    (cover) =>
      distance(cover.position, target) <= AREA_RADIUS &&
      // "the 'bubble' will not affect any fire coming from inside the 6mu
      // radius" — an attacker under the umbrella is shooting past it.
      distance(cover.position, attacker) > AREA_RADIUS,
  )
}

/** Everything a shot needs to know about the target's screens. */
export interface ScreenEffect {
  /** Total effective level, 0–3 (7.2, 7.16). */
  level: UmbrellaLevel
  /** Of that total, how much is *advanced* (7.3). */
  advancedLevel: UmbrellaLevel
  /**
   * 7.16: *"weapons that would normally penetrate do not get their re-rolls"*
   * once an area screen lifts a level-2 ship to 3.
   */
  suppressRerolls: boolean
}

export interface ScreenInput {
  /** The ship's own screens as built (7.2, 7.3). */
  screens: ScreenDef
  /** Its screen generators still operational (7.2). */
  operationalGenerators: number
  /** Area screens in play, from any friendly ship (7.16). */
  areaScreens?: readonly AreaScreenCover[]
  /** Where the target is, for the 6 MU umbrella test. */
  position: Point
  /** Where the shot comes from, for the "not from inside the bubble" test. */
  attacker: Point
}

/**
 * The target's screen state for one shot (7.2, 7.3, 7.16).
 *
 * A ship cannot mount both standard and advanced screens (7.3), so its own
 * level is entirely one or the other; an area screen may add levels of the
 * opposite kind, which is why `advancedLevel` is tracked separately from
 * `level`. Both are capped at 3 — the area-screen cap — because only an area
 * screen can take a ship past 2.
 */
export function screenEffect(input: ScreenInput): ScreenEffect {
  const own = effectiveScreenLevel(input.screens, input.operationalGenerators)
  const covers = coveringAreaScreens(input.areaScreens ?? [], input.position, input.attacker)
  const areaLevel = covers.reduce((sum, cover) => sum + cover.level, 0)
  const areaAdvanced = covers.reduce((sum, cover) => sum + (cover.advanced ? cover.level : 0), 0)

  const level = Math.min(MAX_UMBRELLA_LEVEL, own + areaLevel) as UmbrellaLevel
  const ownAdvanced = input.screens.advanced ? own : 0
  const advancedLevel = Math.min(MAX_UMBRELLA_LEVEL, ownAdvanced + areaAdvanced) as UmbrellaLevel

  return {
    level,
    advancedLevel,
    suppressRerolls: level >= MAX_UMBRELLA_LEVEL,
  }
}

/**
 * Apply an advanced screen to one damage die of ordnance (7.3).
 *
 * *"Negative damage is treated as zero; the target ship cannot regain damage
 * points!"* — the floor is per die, not per volley, so three dice of 1 against
 * advanced-2 screens are three zeroes, not −3.
 */
export function advancedScreenDamageDie(face: number, advancedLevel: number): number {
  return Math.max(0, face - advancedLevel)
}

// ---------------------------------------------------------------------------
// Stealth (7.4, 7.5)
// ---------------------------------------------------------------------------

export type StealthLevel = 0 | 1 | 2

/**
 * 7.4: *"Level 1 Stealth reduces the size of range brackets by one-sixth. Level
 * 2 Stealth reduces the size of range brackets by one-third."* The printed table
 * (12 → 10 → 8, 9 → 7.5 → 6, 6 → 5 → 4, 4 → 3.33 → 2.66) is these two factors.
 */
export const STEALTH_BAND_SCALE: Record<StealthLevel, number> = {
  0: 1,
  1: 5 / 6,
  2: 2 / 3,
}

/**
 * A weapon's total reach against a stealthy target (7.4): *"A class 3 beam
 * normally has a range of 36 MU. Against a Stealth-1 target it would have a
 * range of 30 MU; against a Stealth-2 target it would have a range of 24 MU."*
 *
 * *"The reduction of effective range also applies to missile lock-on range."*
 */
export function stealthMaxRange(maxRange: number, level: StealthLevel): number {
  return maxRange * STEALTH_BAND_SCALE[level]
}

/**
 * Stealth left after hull damage (7.4).
 *
 * *"A Stealth-1 ship has a Stealth marker at the end of the second row of hull
 * boxes ... A Stealth-2 ship has a marker at the end of the first and third
 * rows"*, and *"these markers are placed on the hull rows as indicated here
 * regardless of how many rows of hull the ship has"* — so the thresholds are
 * fixed row numbers, not fractions of the track.
 */
export function stealthHullLevel(built: StealthLevel, hullRowsLost: number): StealthLevel {
  if (built === 0) return 0
  if (built === 1) return hullRowsLost >= 2 ? 0 : 1
  if (hullRowsLost >= 3) return 0
  return hullRowsLost >= 1 ? 1 : 2
}

/**
 * Hull and field stealth together (7.5): *"Stealth Fields and Stealth Hulls can
 * be combined, but the aggregate Stealth level cannot exceed 2."* A field that
 * has been switched off, destroyed or needled contributes nothing.
 */
export function combinedStealthLevel(
  hullLevel: StealthLevel,
  fieldLevel: StealthLevel,
  fieldOnline: boolean,
): StealthLevel {
  const field = fieldOnline ? fieldLevel : 0
  return Math.min(MAX_SCREEN_LEVEL, hullLevel + field) as StealthLevel
}

/** 7.4: *"the ship may only target units out to 24 MU"* while passive. */
export const STEALTH_PASSIVE_TARGET_RANGE = 24

/** 7.4: *"the normal FireCon range of 54 MU"*, available only on active scan. */
export const FIRECON_ACTIVE_RANGE = 54

/**
 * What a Stealth-2 ship pays to shoot far (7.4).
 *
 * Going active buys the full 54 MU FireCon range but *"the ship is only treated
 * as being Stealth-1 as long as the FireCon is in active mode"*. Only level 2 is
 * constrained — a Stealth-1 ship has no targeting limit to lift.
 */
export function stealthScanState(
  level: StealthLevel,
  goneActive: boolean,
): { effectiveLevel: StealthLevel; targetingRange: number } {
  if (level < 2) return { effectiveLevel: level, targetingRange: FIRECON_ACTIVE_RANGE }
  return goneActive
    ? { effectiveLevel: 1, targetingRange: FIRECON_ACTIVE_RANGE }
    : { effectiveLevel: 2, targetingRange: STEALTH_PASSIVE_TARGET_RANGE }
}

// ---------------------------------------------------------------------------
// Armour (4.8, 4.9, 7.6, 7.7)
// ---------------------------------------------------------------------------

/** What one hit did to the armour, and what got past it. */
export interface ArmourAbsorption {
  /** Boxes left per layer afterwards, inner first. */
  remaining: number[]
  /** Boxes taken off each layer by this hit, inner first. */
  absorbed: number[]
  /** Damage the armour could not stop, for the hull track. */
  toHull: number
}

/** Index of the outermost layer with boxes left, or −1 when the armour is gone. */
function outermostIntactLayer(layers: readonly number[]): number {
  for (let layer = layers.length - 1; layer >= 0; layer--) {
    if (layers[layer] > 0) return layer
  }
  return -1
}

/**
 * Pour damage inward from `startLayer` and return what is left over.
 *
 * The rulebook names only *"the next layer"* for SAP overflow (7.7) and for
 * penetrating damage (4.6); where that layer runs out mid-hit it is silent. At
 * the table the damage carries on down and then into the hull, because damage
 * does not evaporate — so this cascades.
 */
function soakInward(
  layers: number[],
  absorbed: number[],
  startLayer: number,
  damage: number,
): number {
  let remaining = damage
  for (let layer = Math.min(startLayer, layers.length - 1); layer >= 0 && remaining > 0; layer--) {
    if (layers[layer] <= 0) continue
    const taken = Math.min(layers[layer], remaining)
    layers[layer] -= taken
    absorbed[layer] += taken
    remaining -= taken
  }
  return remaining
}

/** The initial (non-re-roll) damage pile against armour, by weapon mode (4.9, 7.7). */
function soakByMode(
  layers: number[],
  absorbed: number[],
  damage: number,
  mode: DamageMode,
): number {
  if (damage <= 0) return 0
  const outer = outermostIntactLayer(layers)
  if (outer < 0) return damage

  switch (mode) {
    case 'AP': {
      // 7.7: "does one point of damage to each shell, and then deposits the
      // remainder of its damage into the hull".
      let remaining = damage
      for (let layer = layers.length - 1; layer >= 0 && remaining > 0; layer--) {
        if (layers[layer] <= 0) continue
        layers[layer] -= 1
        absorbed[layer] += 1
        remaining -= 1
      }
      return remaining
    }
    case 'SAP': {
      // 7.7: "half their damage to the outermost layer of Shell Armor (rounded
      // up), and the remaining half of their damage to the next shell layer".
      const half = Math.ceil(damage / 2)
      const taken = Math.min(layers[outer], half)
      layers[outer] -= taken
      absorbed[outer] += taken
      return soakInward(layers, absorbed, outer - 1, damage - taken)
    }
    case 'P':
    case 'standard':
      // 4.8: "All of this damage is taken on armor. Any excess damage is
      // applied directly to the hull." A (P) weapon's *initial* dice behave
      // exactly so; only its re-rolls skip a layer (4.6).
      return soakInward(layers, absorbed, outer, damage)
  }
}

/**
 * The armour damage ladder (4.8, 4.9, 7.6, 7.7).
 *
 * `layers` is boxes remaining, **inner first**, matching `ArmourDef.layers`; the
 * last entry is the outermost shell, which damage meets first.
 *
 * Penetrating damage starts one layer inward of wherever the initial damage was
 * landing (4.6: *"applied directly to the ship's ordinary hull (or next layer of
 * armor if it has multiple layers)"*). "Wherever it was landing" is read as the
 * outermost layer that still had boxes *before* this hit — a shell already
 * stripped cannot be the reference point, and a shell stripped *by this hit*
 * should not let the re-roll skip further in than the rule intends.
 */
export function applyArmourDamage(
  layers: readonly number[],
  hit: { normalDamage: number; penetratingDamage: number; mode: DamageMode },
): ArmourAbsorption {
  const remaining = [...layers]
  const absorbed = remaining.map(() => 0)
  const outerBefore = outermostIntactLayer(remaining)

  let toHull = soakByMode(remaining, absorbed, hit.normalDamage, hit.mode)
  toHull += soakInward(remaining, absorbed, outerBefore - 1, hit.penetratingDamage)

  return { remaining, absorbed, toHull }
}

// ---------------------------------------------------------------------------
// Regenerative armour (7.8)
// ---------------------------------------------------------------------------

/** One regeneration die, and what it did to that box (7.8). */
export interface RegenerationRoll {
  /** Layer index, inner first. */
  layer: number
  roll: number
  repaired: boolean
  /** A natural 1: *"it cannot regenerate further this battle"*. */
  burntOut: boolean
}

export interface RegenerationResult {
  /** Boxes standing per layer afterwards, inner first. */
  remaining: number[]
  /** Boxes per layer that can never come back, inner first. */
  burntOut: number[]
  rolls: RegenerationRoll[]
  repaired: number
}

/**
 * Regenerative armour repairing itself (7.8).
 *
 * *"During the End Phase roll a d6 for each point of Regenerative Armor that has
 * been damaged. On a 5 or 6 the armor box is repaired. On a 1 the armor has
 * sustained too much damage and it cannot regenerate further this battle."*
 *
 * Two readings, argued in `docs/rules/defences.md`:
 *  - a 1 burns out **that box**, not the ship's whole regenerative capacity.
 *    The paragraph is written one box at a time, and the alternative would make
 *    a thick regenerative belt worse than a thin one, which no player would
 *    accept at the table;
 *  - the 2.6 sequence has no "End Phase", so this runs after phase 15 — the end
 *    of the turn. A box repaired now soaks damage from the *next* turn.
 *
 * `remaining` and `burntOut` are per layer, inner first, alongside
 * `armour.layers`. Layers are rolled inner-first purely so a seeded replay is
 * deterministic; the order has no effect on the odds.
 */
export function regenerateArmour(
  armour: ArmourDef,
  remaining: readonly number[],
  burntOut: readonly number[],
  rng: Rng,
): RegenerationResult {
  const nextRemaining = [...remaining]
  const nextBurntOut = [...burntOut]
  const rolls: RegenerationRoll[] = []
  let repaired = 0

  if (!armour.regenerative) {
    return { remaining: nextRemaining, burntOut: nextBurntOut, rolls, repaired }
  }

  for (let layer = 0; layer < armour.layers.length; layer++) {
    const built = armour.layers[layer]
    const standing = nextRemaining[layer] ?? 0
    const dead = nextBurntOut[layer] ?? 0
    const damaged = Math.max(0, built - standing - dead)

    for (let box = 0; box < damaged; box++) {
      const roll = d6(rng)
      if (roll >= 5) {
        nextRemaining[layer] = (nextRemaining[layer] ?? 0) + 1
        repaired += 1
        rolls.push({ layer, roll, repaired: true, burntOut: false })
      } else if (roll === 1) {
        nextBurntOut[layer] = (nextBurntOut[layer] ?? 0) + 1
        rolls.push({ layer, roll, repaired: false, burntOut: true })
      } else {
        rolls.push({ layer, roll, repaired: false, burntOut: false })
      }
    }
  }

  return { remaining: nextRemaining, burntOut: nextBurntOut, rolls, repaired }
}

// ---------------------------------------------------------------------------
// Antimatter suicide charge (7.9)
// ---------------------------------------------------------------------------

/** 7.9: *"damaging any unit within 3 MU"*, and extra charges do not widen it. */
export const ANTIMATTER_CHARGE_BLAST_RADIUS = 3

/** 7.9: *"a -1 DRM whenever they take threshold tests (like Core Systems)"*. */
export const ANTIMATTER_CHARGE_THRESHOLD_DRM = -1

/**
 * Dice an antimatter suicide charge blast rolls at a given range (7.9).
 *
 * *"a ship with 3 charges would do 9d6 damage to 1 MU, 6d6 to 2 MU and 3d6 to
 * 3 MU"* — three, two and one die per charge, the antimatter missile's own
 * falloff (6.x: *"3d6 damage to the target ship and any other unit within 1 mu
 * ... 2d6 ... within 2 MU, and 1d6 ... within 3 MU"*).
 */
export function antimatterChargeDice(charges: number, range: number): number {
  if (charges <= 0 || range > ANTIMATTER_CHARGE_BLAST_RADIUS) return 0
  if (range <= 1) return 3 * charges
  if (range <= 2) return 2 * charges
  return charges
}

export interface BlastResult {
  dice: number[]
  damage: number
}

/**
 * The blast as it lands on another ship (7.9, 6.x).
 *
 * 7.9 says the charge explodes *"like a full strength Antimatter Missile"*, and
 * an antimatter missile's blast is blunted by screens: *"Apply a -1 DRM to each
 * die of Antimatter Missile damage per level of screen. So a ship with screen-2
 * caught in a 3d6 Antimatter Missile blast would only take 3d6−6 damage."* The
 * floor is per die — a ship cannot heal (7.3).
 */
export function rollAntimatterChargeBlast(
  charges: number,
  range: number,
  targetScreens: number,
  rng: Rng,
): BlastResult {
  const count = antimatterChargeDice(charges, range)
  const dice = rollD6(count, rng)
  const damage = dice.reduce((sum, face) => sum + Math.max(0, face - targetScreens), 0)
  return { dice, damage }
}

/**
 * The blast as it lands on the carrying ship (7.9).
 *
 * *"causes damage directly to the hull of the carrying ship, it is not reduced
 * by armor or screens (the explosion starts within)"* — so no screen DRM and no
 * armour ladder, and the ship is at range zero, which is the 3d6-per-charge
 * band. *"A large ship might survive the accidental detonation of a single
 * Antimatter Suicide Charge"*, which is why this is rolled rather than assumed
 * fatal; a *deliberate* detonation destroys the ship outright.
 */
export function rollAntimatterChargeSelfDamage(charges: number, rng: Rng): BlastResult {
  const dice = rollD6(Math.max(0, charges) * 3, rng)
  return { dice, damage: dice.reduce((sum, face) => sum + face, 0) }
}

/**
 * The end-of-turn roll for a damaged, unrepaired charge (7.9).
 *
 * *"If the Antimatter Suicide Charge is not repaired by the end of the turn roll
 * a die. On a 5 or 6 the Antimatter Suicide Charge explodes ... Roll every turn
 * until the damage is repaired or an explosion occurs."*
 *
 * One die per damaged charge; any 5 or 6 sets the whole complement off, since
 * 7.9 gives multiple charges as one additive blast and *"there is plenty of
 * matter around ... for the antimatter to annihilate"*.
 */
export function rollUnrepairedChargeDetonation(
  damagedCharges: number,
  rng: Rng,
): { rolls: number[]; detonates: boolean } {
  const rolls = rollD6(Math.max(0, damagedCharges), rng)
  return { rolls, detonates: rolls.some((face) => face >= 5) }
}

// ---------------------------------------------------------------------------
// Point defence: mounts and threats (7.12 – 7.15, 8.8)
// ---------------------------------------------------------------------------

/** 7.12: *"a maximum range of 6 MU"*, and the reach used against attackers. */
export const PDS_RANGE = 6

/** 7.13: *"It can fire once to a range of 12 MU, or twice to a range of 6 MU."* */
export const ADS_LONG_RANGE = 12
export const ADS_SHORT_RANGE = 6

/** 7.14: *"The range of a Scattergun is 6 MU."* */
export const SCATTERGUN_RANGE = 6

/** 7.15: *"the player rolls 4 PDS dice for each launcher"*. */
export const GRAPESHOT_DICE = 4

/** 6.x: *"Three hits will disrupt the warhead sufficiently"*. */
export const ANTIMATTER_MISSILE_HITS_TO_KILL = 3

/**
 * What is coming in. A defence only needs to know the category, because that is
 * all that changes the dice: the heavy-missile column of 6.4, the scattergun's
 * own table (7.14), or nothing at all.
 */
export type PdTargetKind =
  | 'fighter-group'
  | 'heavy-fighter-group'
  | 'gunboat-group'
  | 'salvo-missile'
  | 'heavy-missile'
  | 'antimatter-missile'
  | 'plasma-bolt'

/** One incoming threat as phase 9 sees it (2.6, 6.4, 8.8). */
export interface PdThreat {
  id: string
  kind: PdTargetKind
  position: Point
  /**
   * The ship it is making its attack run against this turn, or `null` for a
   * fighter group that has not committed — which only an ADFC may shoot at
   * (8.8: *"Ships with ADFC may also target unengaged fighter groups within
   * 6 MU"*).
   */
  attacking: string | null
  /**
   * 8.8: *"the fighter group targeted must not be engaged by other fighters"*,
   * because 8.10 bars ships from firing into a dogfight at all.
   */
  dogfighting?: boolean
}

/** The kinds of mount the point-defence phase distinguishes (7.12 – 7.15, 8.8). */
export type PdMountKind = 'pds' | 'ads' | 'beam-1' | 'dual-purpose' | 'scattergun' | 'grapeshot'

/**
 * One mount as point defence sees it.
 *
 * `arcs` is what the mount actually covers: a PDS has no directionality on the
 * SSD and so covers all six (4.2, 7.12), while a Gatling, TPA, Meson Projector
 * or Pulser in PD mode is *"limited to the fire arcs of the weapon mount"*
 * (5.10, 5.11, 5.12, 5.21). Aft-arc PD is always allowed — 7.12: *"including the
 * rear arc even if the ship has used the main drive in this turn"*.
 */
export interface PdMount {
  id: string
  kind: PdMountKind
  arcs: readonly Arc[]
  /** Which kill table it rolls on (6.4, 8.8). */
  mode: PdMode
  /**
   * A DRM the mount's own rules give it in PD mode — a K-1 gun is at −1 (5.16),
   * an EMP-1 at −1 (5.4), an Interceptor at +1 (8.15), any PD at −2 against a
   * plasma bolt (6.8). `dice.pointDefenceKills` has no DRM parameter, so a
   * non-zero value is rolled by `rollPointDefenceDice` below instead.
   */
  drm?: number
  /** One-shot systems already spent this battle (7.14, 7.15). */
  expended?: boolean
}

/**
 * All six arcs — what a mount with no directionality on the SSD covers (4.2:
 * *"Systems that have no 'directionality' to their symbol, e.g. PDS, have
 * all-round (6-arc) fire capabilities"*). Re-exported from `ARC_ORDER` so a
 * PD mount and a fire arc are never two different lists.
 */
export const ALL_ARCS: readonly Arc[] = ARC_ORDER

/** A ship doing the defending (7.10 – 7.15). */
export interface PdDefender {
  id: string
  placement: Placement
  mounts: readonly PdMount[]
  /** Standard ADFC still operational (7.10). */
  adfc: number
  /** Advanced ADFC still operational (7.11). */
  advancedAdfc: number
  /**
   * 7.10: *"An ADFC may not be used if the ship launched or recovered any
   * fighters (section 8) during the turn."* This locks out every ADFC on the
   * ship, not one of them — and leaves scatterguns untouched, since their ADFC
   * capability is their own (7.14).
   */
  flightOpsThisTurn?: boolean
}

/** A friendly ship an ADFC or scattergun might cover (7.10, 7.14). */
export interface PdAlly {
  id: string
  position: Point
}

/** How a mount reaches a threat (7.10, 7.14, 8.8). */
export type PdReach = 'self' | 'adfc-ally' | 'adfc-direct' | 'scattergun-ally'

/** One legal (mount, threat) pairing, with the dice it would contribute. */
export interface PdOption {
  mountId: string
  threatId: string
  reach: PdReach
  /** The allied ship being covered, for the two "ally" reaches. */
  coveringShipId?: string
  /** Dice this mount may commit; an ADS inside 6 MU has two and may split them. */
  dice: number
  /** True when those dice may be pointed at different threats (7.13). */
  splittable: boolean
  mode: PdMode
  drm: number
  /** Range from the defending ship to the threat, in MU. */
  range: number
}

/** The reach a mount has against a threat it is engaging itself (7.12 – 7.15). */
function selfEnvelope(mount: PdMount): number {
  switch (mount.kind) {
    case 'ads':
      return ADS_LONG_RANGE
    case 'scattergun':
      return SCATTERGUN_RANGE
    case 'grapeshot':
      return PDS_RANGE
    case 'pds':
      return PDS_RANGE
    case 'beam-1':
    case 'dual-purpose':
      // A Beam-1 in PD mode reaches as far as a Beam-1 does: one range band
      // (4.5). Other dual-purpose mounts hand in their own arcs and are used
      // against attackers that are, by definition, on top of the ship.
      return 12
  }
}

/** Dice a mount contributes at a range, and whether they may be split (7.13, 7.15). */
function mountDice(mount: PdMount, range: number): { dice: number; splittable: boolean } {
  if (mount.kind === 'ads') {
    // 7.13: "once to a range of 12 MU, or twice to a range of 6 MU. Inside 6 MU
    // the two PDS dice may be targeted at different enemy units."
    return range <= ADS_SHORT_RANGE ? { dice: 2, splittable: true } : { dice: 1, splittable: false }
  }
  if (mount.kind === 'grapeshot') return { dice: GRAPESHOT_DICE, splittable: false }
  if (mount.kind === 'scattergun') return { dice: 1, splittable: false }
  return { dice: 1, splittable: false }
}

/**
 * Whether a mount may be used for *area* defence at all (8.8, 7.14).
 *
 * 8.8: *"Beam-1s may not be used for area defense."* Everything else 7.10 lists
 * — *"PDS, ADS and weapons that can fire as a PDS - Pulsers, Gatling Batteries,
 * Twin Particle Arrays and Meson Projectors"* — may.
 */
function canAreaDefend(mount: PdMount): boolean {
  return mount.kind !== 'beam-1'
}

/**
 * Every legal way this ship's point defence could engage this turn's threats
 * (2.6 phase 9, 6.4, 7.10 – 7.15, 8.8).
 *
 * This is the *allocation* half of phase 9 and is deliberately separate from
 * rolling: *"A ship that wishes to shoot at multiple fighter groups or missiles
 * must divide point defense weapons between them before rolling any dice"*
 * (2.6), and 6.4 says the same for missiles.
 *
 * Three reaches, from 7.10, 7.14 and 8.8:
 *  - `self` — anything making an attack run on this ship, inside the mount's own
 *    envelope;
 *  - `adfc-ally` — anything making an attack run on a nominated allied ship
 *    within 6 MU **of this ship**. The mount's own envelope does *not* apply
 *    here: 8.8's worked example has ship B's PDS engage group X *"although the
 *    fighters are more than 6MU away"*, because the range test is B → the ally,
 *    not B → the fighters;
 *  - `adfc-direct` — one unengaged fighter group within 6 MU, per ADFC.
 *
 * A scattergun gets `scattergun-ally` for free: *"Scatterguns have an in-built
 * ADFC capability, and they can be used to support allied ships within 6 MU"*
 * (7.14), so it neither needs nor spends one of the ship's ADFC.
 */
export function pointDefenceOptions(
  defender: PdDefender,
  threats: readonly PdThreat[],
  allies: readonly PdAlly[] = [],
): PdOption[] {
  const options: PdOption[] = []
  const adfcAvailable =
    !defender.flightOpsThisTurn && defender.adfc + defender.advancedAdfc > 0
  const coverableAllies = allies.filter(
    (ally) =>
      ally.id !== defender.id &&
      distance(defender.placement.position, ally.position) <= AREA_RADIUS,
  )

  for (const mount of defender.mounts) {
    if (mount.expended) continue
    for (const threat of threats) {
      // 8.8 / 8.10: a group locked in a dogfight is off limits to every ship.
      if (threat.dogfighting) continue

      const range = distance(defender.placement.position, threat.position)
      const arc = arcTo(defender.placement.position, defender.placement.facing, threat.position)
      if (!bearsOn(mount.arcs, arc)) continue

      const { dice, splittable } = mountDice(mount, range)
      const drm = mount.drm ?? 0
      const base = { mountId: mount.id, threatId: threat.id, dice, splittable, mode: mount.mode, drm, range }

      if (threat.attacking === defender.id && range <= selfEnvelope(mount)) {
        options.push({ ...base, reach: 'self' })
        continue
      }

      if (threat.attacking !== null) {
        const ally = coverableAllies.find((candidate) => candidate.id === threat.attacking)
        if (!ally) continue
        if (mount.kind === 'scattergun') {
          options.push({ ...base, reach: 'scattergun-ally', coveringShipId: ally.id })
        } else if (adfcAvailable && canAreaDefend(mount)) {
          options.push({ ...base, reach: 'adfc-ally', coveringShipId: ally.id })
        }
        continue
      }

      // Unengaged. 8.8 lets an ADFC reach out at fighter groups only, within
      // 6 MU of the ADFC ship itself.
      const isFighterGroup =
        threat.kind === 'fighter-group' || threat.kind === 'heavy-fighter-group'
      if (
        adfcAvailable &&
        canAreaDefend(mount) &&
        isFighterGroup &&
        range <= Math.min(AREA_RADIUS, selfEnvelope(mount))
      ) {
        options.push({ ...base, reach: 'adfc-direct' })
      }
    }
  }

  return options
}

// ---------------------------------------------------------------------------
// Point defence: validating an allocation (2.6 phase 9, 7.10, 7.11, 7.13)
// ---------------------------------------------------------------------------

/** One mount's committed dice against one threat. */
export interface PdAllocation {
  mountId: string
  threatId: string
  reach: PdReach
  coveringShipId?: string
  /** Dice committed. Only an ADS inside 6 MU may commit fewer than its full count. */
  dice: number
}

export type PdRefusalCode =
  | 'unknown-mount'
  | 'unknown-threat'
  | 'mount-expended'
  | 'illegal-pairing'
  | 'mount-overcommitted'
  | 'mount-cannot-split'
  | 'adfc-budget-exceeded'
  | 'flight-ops-lockout'

export interface PdRefusal {
  code: PdRefusalCode
  mountId?: string
  threatId?: string
  detail: string
}

export interface PdPlan {
  ok: boolean
  allocations: PdAllocation[]
  refusals: PdRefusal[]
  /** ADFC spent: one per covered ally, one per unengaged group (7.10, 8.8). */
  adfcSpent: number
  /** ADFC available this turn (7.10, 7.11). */
  adfcBudget: number
}

/**
 * ADFC budget (7.10, 7.11, 8.8).
 *
 * A standard ADFC buys one thing: *"may support ONE allied ship within 6 MU"*
 * (7.10) or *"one unengaged fighter group ... Each group targeted requires one
 * ADFC"* (8.8). An Advanced ADFC *"may support ANY number of allied ships within
 * 6 MU"* (7.11), so a single one lifts the budget entirely — read as lifting the
 * group limit too, since 8.8 states both as one per ADFC and 7.11 says the
 * advanced set differs only in how many things it can cover.
 *
 * `Infinity` is returned for an AADFC because the budget genuinely has no cap;
 * callers compare against it rather than counting.
 */
export function adfcBudget(defender: PdDefender): number {
  if (defender.flightOpsThisTurn) return 0
  if (defender.advancedAdfc > 0) return Number.POSITIVE_INFINITY
  return defender.adfc
}

/**
 * Check a written point-defence allocation against the rules of phase 9
 * (2.6, 6.4, 7.10 – 7.15, 8.8).
 *
 * The once-per-turn rule is the backbone: *"any system used for point defense
 * can only be directed against a single fighter group or missile, and cannot be
 * used again in that turn against a ship"* (2.6). The one exception is the ADS
 * inside 6 MU, whose *"two PDS dice may be targeted at different enemy units"*
 * (7.13).
 */
export function validatePointDefence(
  defender: PdDefender,
  threats: readonly PdThreat[],
  allocations: readonly PdAllocation[],
  allies: readonly PdAlly[] = [],
): PdPlan {
  const refusals: PdRefusal[] = []
  const accepted: PdAllocation[] = []
  const options = pointDefenceOptions(defender, threats, allies)
  const budget = adfcBudget(defender)

  const mountsById = new Map(defender.mounts.map((mount) => [mount.id, mount]))
  const threatIds = new Set(threats.map((threat) => threat.id))
  const diceUsed = new Map<string, number>()
  const pairingsPerMount = new Map<string, number>()
  const coveredAllies = new Set<string>()
  const directGroups = new Set<string>()

  for (const allocation of allocations) {
    const mount = mountsById.get(allocation.mountId)
    if (!mount) {
      refusals.push({
        code: 'unknown-mount',
        mountId: allocation.mountId,
        detail: `No mount ${allocation.mountId} on ${defender.id}`,
      })
      continue
    }
    if (!threatIds.has(allocation.threatId)) {
      refusals.push({
        code: 'unknown-threat',
        mountId: allocation.mountId,
        threatId: allocation.threatId,
        detail: `No threat ${allocation.threatId} in this phase`,
      })
      continue
    }
    if (mount.expended) {
      refusals.push({
        code: 'mount-expended',
        mountId: mount.id,
        detail: `${mount.id} is a one-shot system and has already been fired (7.14, 7.15)`,
      })
      continue
    }

    const option = options.find(
      (candidate) =>
        candidate.mountId === allocation.mountId &&
        candidate.threatId === allocation.threatId &&
        candidate.reach === allocation.reach &&
        (allocation.reach === 'adfc-ally' || allocation.reach === 'scattergun-ally'
          ? candidate.coveringShipId === allocation.coveringShipId
          : true),
    )
    if (!option) {
      const locked =
        defender.flightOpsThisTurn &&
        (allocation.reach === 'adfc-ally' || allocation.reach === 'adfc-direct')
      refusals.push({
        code: locked ? 'flight-ops-lockout' : 'illegal-pairing',
        mountId: mount.id,
        threatId: allocation.threatId,
        detail: locked
          ? `${defender.id} launched or recovered fighters this turn, so no ADFC may be used (7.10)`
          : `${mount.id} may not engage ${allocation.threatId} by ${allocation.reach}`,
      })
      continue
    }

    // The split test comes first: pointing one mount at two targets is a
    // different mistake from spending more dice than it has, and 2.6's
    // once-per-turn rule is the one a player will have broken.
    const pairings = pairingsPerMount.get(mount.id) ?? 0
    if (pairings >= 1 && !option.splittable) {
      refusals.push({
        code: 'mount-cannot-split',
        mountId: mount.id,
        threatId: allocation.threatId,
        detail: `${mount.id} may only be directed at a single target this turn (2.6)`,
      })
      continue
    }
    const already = diceUsed.get(mount.id) ?? 0
    if (already + allocation.dice > option.dice) {
      refusals.push({
        code: 'mount-overcommitted',
        mountId: mount.id,
        threatId: allocation.threatId,
        detail: `${mount.id} has ${option.dice} die/dice here; ${already + allocation.dice} committed (2.6)`,
      })
      continue
    }

    if (allocation.reach === 'adfc-ally' && allocation.coveringShipId) {
      coveredAllies.add(allocation.coveringShipId)
    }
    if (allocation.reach === 'adfc-direct') directGroups.add(allocation.threatId)

    diceUsed.set(mount.id, already + allocation.dice)
    pairingsPerMount.set(mount.id, pairings + 1)
    accepted.push(allocation)
  }

  const adfcSpent = coveredAllies.size + directGroups.size
  if (adfcSpent > budget) {
    refusals.push({
      code: 'adfc-budget-exceeded',
      detail: `${defender.id} has ${budget} ADFC but is covering ${adfcSpent} ship(s)/group(s) (7.10, 7.11, 8.8)`,
    })
  }

  return {
    ok: refusals.length === 0,
    allocations: accepted,
    refusals,
    adfcSpent,
    adfcBudget: budget,
  }
}

// ---------------------------------------------------------------------------
// Point defence: rolling (6.4, 7.14, 7.15, 8.8)
// ---------------------------------------------------------------------------

/**
 * 6.4 splits the kill tables by target: a heavy missile is harder to stop than
 * a salvo missile or a fighter. An antimatter missile is a heavy-missile body,
 * so it uses the heavy column — but each success is a *hit*, not a kill (6.x).
 */
function usesHeavyMissileTable(kind: PdTargetKind): boolean {
  return kind === 'heavy-missile' || kind === 'antimatter-missile'
}

/**
 * Roll point-defence dice, honouring a DRM (6.4, 8.8).
 *
 * With no DRM this is `dice.pointDefenceKills` verbatim — that function owns
 * the tables and this module does not second-guess them. A DRM is the one case
 * it cannot express (it takes no modifier), so the modified-face version is
 * rolled here: the modified face decides the kill, the **natural** face decides
 * the re-roll, exactly as 4.6 requires (*"Re-rolls are made for a natural
 * (unmodified) 6 only"*).
 */
export function rollPointDefenceDice(
  dice: number,
  mode: PdMode,
  rng: Rng,
  opts: { heavyMissile?: boolean; drm?: number } = {},
): { rolls: number[]; kills: number } {
  const drm = opts.drm ?? 0
  const heavy = opts.heavyMissile ?? false
  if (drm === 0) return pointDefenceKills(dice, mode, rng, { heavyMissile: heavy })

  const rolls: number[] = []
  let kills = 0

  const resolve = (): void => {
    const natural = d6(rng)
    const modified = Math.max(1, Math.min(6, natural + drm))
    rolls.push(natural)
    if (heavy) {
      if (mode === 'pds' ? modified >= 5 : modified === 6) kills += 1
      return
    }
    if (mode === 'pds') {
      if (modified === 6) kills += 2
      else if (modified >= 4) kills += 1
    } else if (modified >= 5) {
      kills += 1
    }
    if (natural === 6) resolve()
  }

  for (let i = 0; i < dice; i++) resolve()
  return { rolls, kills }
}

/**
 * A scattergun's spray (7.14).
 *
 * *"They inflict 1d6 hits on fighters and missiles (including Salvo Missiles),
 * 1d3 hits on Heavy Fighters, and 1 BD\* hits on Plasma Bolts and gunboats."*
 * A "hit" here is a kill outright — there is no separate to-hit roll.
 *
 * 1d3 is rolled as `ceil(1d6 / 2)`, the usual table substitute for a die nobody
 * owns; that keeps the friendly-fire test below on the same physical die.
 *
 * *"Scatterguns used in ADFC-mode have a chance of causing some damage to the
 * ship being assisted. On a roll of '1' the allied ship suffers one point of
 * damage, in addition to the effect of the Scattergun on the attacking
 * fighter/missile."* — the hits die is the only die a scattergun rolls, so that
 * is the roll in question.
 */
export function rollScattergun(
  kind: PdTargetKind,
  rng: Rng,
  opts: { supportingAlly?: boolean } = {},
): { rolls: number[]; kills: number; friendlyFire: number } {
  if (kind === 'plasma-bolt' || kind === 'gunboat-group') {
    // 1 BD*: a beam die with re-rolls, against no screens.
    const volley = rollBeamVolley(1, 0, rng, { penetrating: true })
    return {
      rolls: volley.dice.map((die) => die.natural),
      kills: volley.normalDamage + volley.penetratingDamage,
      friendlyFire: 0,
    }
  }
  const face = d6(rng)
  const kills = kind === 'heavy-fighter-group' ? Math.ceil(face / 2) : face
  const friendlyFire = opts.supportingAlly && face === 1 ? 1 : 0
  return { rolls: [face], kills, friendlyFire }
}

/** What the phase-9 dice did to one threat. */
export interface PdResolution {
  threatId: string
  kind: PdTargetKind
  /**
   * Kills, or for an antimatter missile *hits* — capped at 3, since *"Three
   * hits will disrupt the warhead sufficiently to prevent any meaningful
   * explosion"* (6.x) and further hits do nothing.
   */
  kills: number
  rolls: number[]
  detail: string
}

export interface PdOutcome {
  results: PdResolution[]
  /** Damage scatterguns did to the ships they were covering (7.14). */
  friendlyFire: Array<{ shipId: string; damage: number }>
}

/**
 * Resolve an allocated point-defence phase (6.4, 7.14, 7.15, 8.8).
 *
 * Allocation happens first and in full — *"announce all targets before rolling
 * any dice"* (2.6) — so this takes a finished, validated allocation and only
 * rolls. Overkill is not redistributed: *"'Wasted' shots when point defense fire
 * kills more fighters than are in the group may not be reallocated to other
 * groups"* (8.8), which is why this reports raw kills per threat and never looks
 * at how many fighters or missiles are actually there.
 */
export function resolvePointDefence(
  defender: PdDefender,
  threats: readonly PdThreat[],
  allocations: readonly PdAllocation[],
  rng: Rng,
): PdOutcome {
  const mountsById = new Map(defender.mounts.map((mount) => [mount.id, mount]))
  const threatsById = new Map(threats.map((threat) => [threat.id, threat]))
  const byThreat = new Map<string, PdResolution>()
  const friendlyFire = new Map<string, number>()

  for (const allocation of allocations) {
    const mount = mountsById.get(allocation.mountId)
    const threat = threatsById.get(allocation.threatId)
    if (!mount || !threat) continue

    let result = byThreat.get(threat.id)
    if (!result) {
      result = { threatId: threat.id, kind: threat.kind, kills: 0, rolls: [], detail: '' }
      byThreat.set(threat.id, result)
    }

    if (mount.kind === 'scattergun') {
      const supportingAlly =
        allocation.reach === 'scattergun-ally' || allocation.reach === 'adfc-ally'
      const shot = rollScattergun(threat.kind, rng, { supportingAlly })
      result.kills += shot.kills
      result.rolls.push(...shot.rolls)
      if (shot.friendlyFire > 0 && allocation.coveringShipId) {
        friendlyFire.set(
          allocation.coveringShipId,
          (friendlyFire.get(allocation.coveringShipId) ?? 0) + shot.friendlyFire,
        )
      }
      continue
    }

    const shot = rollPointDefenceDice(allocation.dice, mount.mode, rng, {
      heavyMissile: usesHeavyMissileTable(threat.kind),
      drm: mount.drm ?? 0,
    })
    result.kills += shot.kills
    result.rolls.push(...shot.rolls)
  }

  const results = [...byThreat.values()].map((result) => {
    const kills =
      result.kind === 'antimatter-missile'
        ? Math.min(ANTIMATTER_MISSILE_HITS_TO_KILL, result.kills)
        : result.kills
    const noun = result.kind === 'antimatter-missile' ? 'hit' : 'kill'
    return {
      ...result,
      kills,
      detail: `${result.rolls.join(',') || '—'} → ${kills} ${noun}${kills === 1 ? '' : 's'}`,
    }
  })

  return {
    results,
    friendlyFire: [...friendlyFire.entries()].map(([shipId, damage]) => ({ shipId, damage })),
  }
}

/**
 * Missiles that get through (6.4).
 *
 * *"The attacking player then rolls a D6 for each Salvo Missile marker. The
 * result is the number of missiles in the salvo that are actually on target.
 * Subtract the number of missiles killed from the D6 score ... If defensive fire
 * killed more missiles than were in the salvo then the extras are 'overkill'.
 * ... If there are no defenses at all, at least one missile in a salvo will
 * always get through."*
 */
export function salvoMissilesThrough(onTarget: number, kills: number, defencesFired: boolean): number {
  const through = Math.max(0, onTarget - kills)
  if (!defencesFired) return Math.max(1, through)
  return through
}

// ---------------------------------------------------------------------------
// Point defence against ships (7.12, 7.13)
// ---------------------------------------------------------------------------

/**
 * Whether a ship is soft enough for point defence to shoot at it (7.12).
 *
 * *"Point Defense Systems can only be fired against ships without an operational
 * screen/field (of any type) or any remaining armor boxes – i.e. undamaged
 * warships are not vulnerable to such light weapons."*
 *
 * Read as *neither*: no operational screen or field of any type **and** no
 * armour left. The gloss that follows settles the reading — an undamaged
 * warship, which has both, must not be a legal target.
 */
export function pdMayEngageShip(target: {
  screenLevel: number
  armourRemaining: number
  /** Any other defensive field still up — a stealth field, holofield, cloak. */
  fieldsUp?: boolean
}): boolean {
  return target.screenLevel <= 0 && target.armourRemaining <= 0 && !target.fieldsUp
}

/**
 * Point defence firing at a ship (7.12, 7.13).
 *
 * *"Each Point Defense System rolls only 1D6, with a roll of 6 inflicting 1
 * damage point with no re-roll."* — and 7.13 gives the ADS the same: *"like a
 * PDS it inflicts one hit on a roll of 6"*. Range is 6 MU and no FireCon is
 * needed; the caller checks the range and `pdMayEngageShip` first.
 */
export function rollPointDefenceAtShip(
  dice: number,
  rng: Rng,
  drm = 0,
): { rolls: number[]; damage: number } {
  const rolls = rollD6(Math.max(0, dice), rng)
  const damage = rolls.filter((face) => Math.min(6, face + drm) >= 6).length
  return { rolls, damage }
}

// ---------------------------------------------------------------------------
// Construction costs for the systems in this section (7.2 – 7.16)
// ---------------------------------------------------------------------------

/**
 * Mass and points for the defences of 7.2 – 7.16, as printed.
 *
 * Kept here rather than in the construction tables because several are stated
 * *only* in these paragraphs, and a designer reading 7.3 should find 7.3's
 * number in the module that implements 7.3.
 */
export const DEFENCE_COSTS = {
  /** 7.2: *"5% of the total ship mass per level"*, *"3 per mass"*. */
  screens: { massFractionPerLevel: 0.05, pointsPerMass: 3 },
  /** 7.3: *"7.5% of the total ship mass per level"*, *"4 per mass"*. */
  advancedScreens: { massFractionPerLevel: 0.075, pointsPerMass: 4 },
  /** 7.5: *"5% of ship mass per level"*, *"6 per mass"*. */
  stealthField: { massFractionPerLevel: 0.05, pointsPerMass: 6 },
  /** 7.4: no mass; *"+2 for every point of hull and armor"* at level 1, +4 at level 2. */
  stealthHull: { pointsPerHullOrArmourBox: { 1: 2, 2: 4 } as Record<1 | 2, number> },
  /** 7.16: *"20% the mass (15 min) ... or 30% for Advanced Screen (20 min) per level"*, *"3.5 per mass"*. */
  areaScreens: {
    massFractionPerLevel: 0.2,
    minimumMass: 15,
    advancedMassFractionPerLevel: 0.3,
    advancedMinimumMass: 20,
    pointsPerMass: 3.5,
  },
  /** 7.9: *"AM Suicide Charge is mass 1"*, *"cost 5 per mass"*. */
  antimatterCharge: { mass: 1, pointsPerMass: 5 },
  /** 7.10: *"a mass of 2, and costs 4 per mass"*. */
  adfc: { mass: 2, pointsPerMass: 4 },
  /** 7.11: *"a mass of 2, and costs 5 per mass"*. */
  advancedAdfc: { mass: 2, pointsPerMass: 5 },
  /** 7.12: *"a mass of 1, and costs 3 per mass"*. */
  pds: { mass: 1, pointsPerMass: 3 },
  /** 7.13: *"mass 2, and has 3 arcs of fire. For +1 mass ... all 6 arcs"*, *"3 per mass"*. */
  ads: { mass: 2, sixArcExtraMass: 1, pointsPerMass: 3 },
  /** 7.14: *"a mass of 1, and cost 5 per mass"*. */
  scattergun: { mass: 1, pointsPerMass: 5 },
  /** 7.15: *"Mass: 1, cost 4 each"*. */
  grapeshot: { mass: 1, points: 4 },
} as const

/**
 * Points per mass for one armour layer (7.7, 7.8).
 *
 * *"Inner layer - 2 per mass, First shell - 4 ... Second shell - 6 ... Third
 * shell - 8 ... Fourth shell - 10"*, and regenerative *"adds 2 to the cost"* at
 * every layer. `layer` is the index in `ArmourDef.layers`, so 0 is the inner
 * layer and each shell outward costs 2 more.
 */
export function armourPointsPerMass(layer: number, regenerative: boolean): number {
  return 2 + 2 * layer + (regenerative ? 2 : 0)
}

/**
 * The points a ship's armour costs (7.6, 7.7, 7.8). One mass per box throughout,
 * so mass is simply the sum of the layers.
 */
export function armourPoints(armour: ArmourDef): number {
  return armour.layers.reduce(
    (total, boxes, layer) => total + boxes * armourPointsPerMass(layer, armour.regenerative),
    0,
  )
}
