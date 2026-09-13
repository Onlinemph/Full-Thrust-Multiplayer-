/**
 * The contract every weapon resolver implements.
 *
 * Full Thrust has some thirty weapon systems and each reads its result off its
 * own variation of the beam table (4.5) — different range bands, different
 * damage, different relationship with armour. Rather than a switch that grows
 * a limb per weapon, each family lives in its own module and registers a
 * `WeaponSpec` here; `weapons/index.ts` is then only a lookup.
 *
 * A resolver is pure apart from the `Rng` it is handed, and it never touches
 * ship state: it says what the dice did and hands back damage. Applying that
 * damage to screens, armour and hull is `combat.ts`'s job, because how damage
 * lands depends on the *target*, not the gun (4.8, 4.9).
 */

import type { PdMode, Rng, ScreenLevel } from '../dice'
import type { Arc, DamageMode, WeaponClass, WeaponDef, WeaponVariant } from '../types'

/** Everything a resolver needs to know about one shot. */
export interface FiringContext {
  /** Range to the target in MU (2.1). */
  range: number
  /** The arc the target lies in, as seen from the firing ship (4.2). */
  arc: Arc
  /** Screen level in effect on the target (4.7). Already capped at 2. */
  targetScreens: ScreenLevel
  /** The shot comes from inside the target's rear arc (4.10, optional). */
  rearArc: boolean
  /** Net die roll modifier from ECM, holofields, cloaks and the rest (1.7). */
  drm: number
  /**
   * 5.13: the one system a needle beam — or a phaser in needle mode — is aimed
   * at. Every other resolver ignores it; it is here rather than only on
   * `BeamFiringContext` because `fireWeapon` dispatches through this type and
   * the caller cannot know which resolver it is about to reach.
   */
  needleTarget?: string
  /**
   * 7.3: the target's screens are Advanced Screens rather than Standard.
   *
   * Here for the same reason `needleTarget` is: `fireWeapon` dispatches
   * through this type, so the caller cannot know which resolver it is about to
   * reach and has to hand over everything any of them might read. Only the
   * kinetic family looks at it, and to that family it is the *only* screen
   * that counts — a Standard Screen stops nothing solid.
   */
  advancedScreens?: boolean
  /** Target's total mass, for the Point Singularity Projector's scale (5.23). */
  targetMass?: number
  /** Target's current velocity in MU, for the Gravitic Gun (5.20). */
  targetVelocity?: number
  /**
   * 7.23: which generation of the nova template is passing over the target.
   *
   * Here beside `needleTarget` and for the same reason — `fireWeapon`
   * dispatches through this type, so a caller cannot know which resolver it is
   * about to reach. `EwFiringContext` narrows it; only the Nova Cannon reads
   * it, and to it `range` means the distance along the burst's line of flight
   * rather than the range from the ship, which has moved on since.
   */
  novaStage?: 1 | 2 | 3
  /**
   * 7.16: the target is under an area screen that takes its effective level to
   * three. The beam family asks it as `areaScreen && targetScreens >= 2`, which
   * is what switches the (P) re-roll off and takes a plasma cannon to −3.
   *
   * Here beside `needleTarget` for the same reason those are: `fireWeapon`
   * dispatches through this type, so the caller cannot know which resolver it
   * is about to reach.
   */
  areaScreen?: boolean
  /**
   * The three per-turn weapon settings 2.6 phase 1 writes down, and that have
   * no home on `WeaponDef` because they change every turn: 5.14's overload,
   * 5.14's Variable Strength setting, and 5.19's Fusion Array mode.
   *
   * Here for the same reason `needleTarget` is — `fireWeapon` dispatches
   * through this type — and only the kinetic family reads them.
   */
  overloaded?: boolean
  vptMode?: 'short' | 'standard' | 'long'
  fusionMode?: 'flare' | 'torpedo'
  rng: Rng
}

/**
 * What one mount's fire did.
 *
 * `normalDamage` is what screens and armour may absorb; `penetratingDamage` is
 * what goes straight to the hull, which for a (P) weapon is its re-roll
 * damage (4.6). `mode` tells `combat.ts` how to split `normalDamage` across
 * armour layers (4.9).
 */
export interface WeaponResult {
  normalDamage: number
  penetratingDamage: number
  mode: DamageMode
  /** Every die face rolled, in order, for the battle log. */
  dice: number[]
  /** One line describing the roll, as a player would say it out loud. */
  detail: string
  /**
   * Systems the shot singled out rather than damaging the hull — needle beams
   * (5.13) and boarding torpedoes (5.18) work this way. Values are
   * `SystemKind`s or weapon ids.
   */
  targetedSystems?: string[]
  /** Marines or boarders delivered onto the target (5.9, 5.18). */
  boarders?: number
  /** Thrust or systems disabled without hull damage — EMP (5.4). */
  disruption?: { thrustLost?: number; systemsOffline?: number }
}

/** How a weapon family behaves. One instance per `WeaponClass`. */
export interface WeaponSpec {
  weaponClass: WeaponClass
  label: string
  /** How its damage meets armour (4.9). */
  damageMode: DamageMode
  /**
   * Longest range in MU at which a mount of this rating and variant can do
   * anything at all. Used for range checks, targeting and the AI.
   */
  maxRange(rating: number, variant: WeaponVariant): number
  /**
   * Resolve one mount's fire. Returns `null` when the weapon cannot fire at
   * all — out of range, out of arc, or out of ammunition.
   */
  fire(weapon: WeaponDef, ctx: FiringContext): WeaponResult | null
  /**
   * Set when the weapon may also be used as point defence (7.12, 8.8). Using
   * it that way spends its fire for the turn — in Full Thrust a weapon fires
   * once a turn, so a beam used against missiles is a beam not used against
   * ships (2.6).
   */
  pointDefence?: PdMode
  /** Whether firing it consumes one of the ship's FireCon (4.4). */
  requiresFireCon: boolean
  /** Ordnance is launched in phase 3 and arrives later, not fired in phase 11. */
  ordnance?: boolean
}

/** A family module exports this, and `weapons/index.ts` collects them. */
export type WeaponSpecTable = Partial<Record<WeaponClass, WeaponSpec>>
