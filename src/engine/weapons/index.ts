/**
 * The weapon registry.
 *
 * Each family module exports a `WeaponSpecTable`; this merges them into one
 * lookup and is the only place anything outside `weapons/` needs to import.
 * Adding a weapon family is one import and one entry here — no switch grows a
 * limb, and nothing else in the engine learns a new name.
 *
 * A weapon class with no spec registered simply cannot fire, and says so. That
 * is deliberate: a half-built registry should refuse loudly rather than
 * silently resolve every unknown gun as a beam.
 */

import { BEAM_WEAPON_SPECS } from './beams'
import { KINETIC_WEAPON_SPECS } from './kinetics'
// The two superweapons of 7.23 and 7.24 live in ew.ts with the rest of the
// optional systems, because what makes them hard is the template sweeping the
// table and the ship powering everything else down to fire — not the dice.
import { EW_WEAPON_SPECS } from '../ew'
// Ordnance lives outside weapons/ because a missile is not resolved where it is
// fired: it is launched in phase 3, flies, and attacks in phase 10 (2.6, 6.3).
// Its spec table still belongs in the registry so nothing else has to know that.
import { ORDNANCE_WEAPON_SPECS } from '../ordnance'
import type { FiringContext, WeaponResult, WeaponSpec } from './contract'
import type { WeaponClass, WeaponDef } from '../types'

/** Every weapon the engine knows how to fire. */
export const WEAPON_SPECS: Partial<Record<WeaponClass, WeaponSpec>> = {
  ...BEAM_WEAPON_SPECS,
  ...KINETIC_WEAPON_SPECS,
  ...ORDNANCE_WEAPON_SPECS,
  ...EW_WEAPON_SPECS,
}

export function specFor(weapon: WeaponDef): WeaponSpec | undefined {
  return WEAPON_SPECS[weapon.weaponClass]
}

/** Whether the engine can resolve this weapon's fire at all. */
export function isImplemented(weapon: WeaponDef): boolean {
  return specFor(weapon) !== undefined
}

/**
 * Resolve one mount's fire, or say why it did not.
 *
 * The string is a refusal a player should see — "out of range", "no resolver" —
 * rather than an exception, because a weapon that cannot fire is an ordinary
 * situation in this game and not an error.
 */
export function fireWeapon(
  weapon: WeaponDef,
  context: FiringContext,
): WeaponResult | { refused: string } {
  const spec = specFor(weapon)
  if (!spec) return { refused: `${weapon.label} is not implemented yet` }
  const result = spec.fire(weapon, context)
  if (!result) return { refused: `${weapon.label} cannot bear on that target` }
  return result
}

/** Longest range at which a mount does anything, for targeting and the AI. */
export function maxRangeOf(weapon: WeaponDef): number {
  return specFor(weapon)?.maxRange(weapon.rating, weapon.variant) ?? 0
}

/** Whether firing this weapon spends one of the ship's FireCon (4.4). */
export function needsFireCon(weapon: WeaponDef): boolean {
  return specFor(weapon)?.requiresFireCon ?? true
}

/** Whether this is ordnance, launched in phase 3 rather than fired in 11. */
export function isOrdnance(weapon: WeaponDef): boolean {
  return specFor(weapon)?.ordnance ?? false
}

export type { FiringContext, WeaponResult, WeaponSpec } from './contract'
