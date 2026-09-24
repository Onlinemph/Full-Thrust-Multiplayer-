/**
 * Stargrunt II — the generic weapons table (p. 34), personal armour (p. 28),
 * mobility (p. 22) and the two derivations everything else in the kit reads
 * off a quality: its range band in inches (p. 33) and a fire-value's
 * firepower die (p. 34).
 *
 * The digest's own page for the ARMOUR table is p. 28 (the brief that named
 * this file said p. 29; the scan is the authority, so this file cites p. 28
 * throughout and the report notes the correction).
 */

import { DIE_STEPS, type DieType, shiftClosed } from '../dice'
import type { ArmourKind, MobilityKind, Quality, SmallArmKind, SmallArmProfile, SupportWeaponKind, SupportWeaponProfile } from '../types'
import { QUALITY_DIE } from '../types'

// ---------------------------------------------------------------------------
// Generic weapons table (p. 34)
// ---------------------------------------------------------------------------

export const SMALL_ARMS: Record<SmallArmKind, SmallArmProfile> = {
  improvised: { kind: 'improvised', name: 'Improvised Firearm', firepower: 0.5, impact: 4, closeOnly: true },
  'light-autopistol': { kind: 'light-autopistol', name: 'Light Autopistol', firepower: 1, impact: 6, closeOnly: true },
  'heavy-autopistol': { kind: 'heavy-autopistol', name: 'Heavy Autopistol', firepower: 1, impact: 10, closeOnly: true },
  smg: { kind: 'smg', name: 'Machine Pistol/SMG', firepower: 3, impact: 8, closeOnly: true },
  'assault-shotgun': { kind: 'assault-shotgun', name: 'Assault Shotgun', firepower: 3, impact: 8, closeOnly: true },
  'hunting-rifle': { kind: 'hunting-rifle', name: 'Hunting Rifle', firepower: 1, impact: 10, closeOnly: false },
  'lowtech-rifle': { kind: 'lowtech-rifle', name: 'Low-Tech Assault Rifle', firepower: 2, impact: 8, closeOnly: false },
  'lowtech-rifle-gl': { kind: 'lowtech-rifle-gl', name: 'Low-Tech Assault Rifle (GL)', firepower: 3, impact: 8, closeOnly: false },
  'advanced-rifle': { kind: 'advanced-rifle', name: 'Advanced Assault Rifle', firepower: 2, impact: 10, closeOnly: false },
  'advanced-rifle-gl': { kind: 'advanced-rifle-gl', name: 'Advanced Assault Rifle (GL)', firepower: 3, impact: 10, closeOnly: false },
  'gauss-rifle': { kind: 'gauss-rifle', name: 'Gauss Rifle', firepower: 2, impact: 12, closeOnly: false },
  'gauss-rifle-gl': { kind: 'gauss-rifle-gl', name: 'Gauss Rifle (GL)', firepower: 3, impact: 12, closeOnly: false },
}

export function smallArmProfile(kind: SmallArmKind): SmallArmProfile {
  return SMALL_ARMS[kind]
}

/** Support weapons carry their own Firepower die (p. 34) rather than a per-trooper fire value. */
export const SUPPORT_WEAPONS: Record<SupportWeaponKind, SupportWeaponProfile> = {
  saw: { kind: 'saw', name: 'Conventional Machine Gun (SAW)', firepowerDie: 8, impact: 10, doubleVsPoint: false },
  'rotary-saw': { kind: 'rotary-saw', name: 'Rotary (Gatling) Machine Gun (SAW)', firepowerDie: 10, impact: 10, doubleVsPoint: false },
  'gauss-saw': { kind: 'gauss-saw', name: 'Gauss Machine Gun (SAW)', firepowerDie: 10, impact: 12, doubleVsPoint: false },
  'plasma-gun': { kind: 'plasma-gun', name: 'Infantry Plasma Gun', firepowerDie: 6, impact: 12, doubleVsPoint: true },
  agl: { kind: 'agl', name: 'Automatic Grenade Launcher', firepowerDie: 12, impact: 8, doubleVsPoint: true },
  mlp: { kind: 'mlp', name: 'Multiple Launcher Pack (MLP)', firepowerDie: 8, impact: 8, doubleVsPoint: true },
  iavr: { kind: 'iavr', name: 'Infantry Rocket (IAVR)', firepowerDie: 10, impact: 12, doubleVsPoint: true },
}

export function supportWeaponProfile(kind: SupportWeaponKind): SupportWeaponProfile {
  return SUPPORT_WEAPONS[kind]
}

// ---------------------------------------------------------------------------
// Personal armour (p. 28)
// ---------------------------------------------------------------------------

/** Battledress up to heavy power armour (p. 28); an unarmoured or civilian figure counts as battledress. */
export const ARMOUR_DIE: Record<ArmourKind, DieType> = {
  battledress: 4,
  'partial-light': 6,
  'full-light': 8,
  'light-power': 10,
  'heavy-power': 12,
}

export function armourDie(kind: ArmourKind): DieType {
  return ARMOUR_DIE[kind]
}

// ---------------------------------------------------------------------------
// Mobility (p. 22)
// ---------------------------------------------------------------------------

/**
 * Base Normal Movement in inches, and the Combat Movement die's face count
 * (p. 22): the book gives these as the same number (base mobility 6 rolls a
 * D6, doubled), so one field serves both.
 */
export interface MobilityProfile {
  kind: MobilityKind
  baseInches: DieType
}

export const MOBILITY: Record<MobilityKind, MobilityProfile> = {
  foot: { kind: 'foot', baseInches: 6 },
  'very-light': { kind: 'very-light', baseInches: 8 },
  'slow-power': { kind: 'slow-power', baseInches: 6 },
  'fast-power': { kind: 'fast-power', baseInches: 12 },
}

export function mobilityProfile(kind: MobilityKind): MobilityProfile {
  return MOBILITY[kind]
}

/**
 * Heavy/manpacked equipment, or carrying a casualty (p. 22, p. 24): one
 * step down the scale. [reading, spec 02 §2.6] The book gives three
 * independent triggers for this same "one step down" effect and never
 * says what a figure encumbered by more than one of them does; this
 * engine applies the shift once no matter how many triggers apply
 * (non-stacking), floored at D4 by `shiftClosed`.
 */
export function encumberedBase(base: DieType): DieType {
  return shiftClosed(base, -1)
}

// ---------------------------------------------------------------------------
// Range bands (p. 33)
// ---------------------------------------------------------------------------

/**
 * The range band in inches for small arms and infantry support-weapon fire
 * (p. 33) is the firing unit's quality die, read as a number of inches —
 * Untrained 4", Green 6", Regular 8", Veteran 10", Elite 12" — the same
 * table as the quality die itself.
 */
export const RANGE_BAND_INCHES: Record<Quality, number> = QUALITY_DIE

export function rangeBandInches(quality: Quality): number {
  return RANGE_BAND_INCHES[quality]
}

// ---------------------------------------------------------------------------
// Firepower value → firepower die (p. 34)
// ---------------------------------------------------------------------------

/**
 * A squad's total small-arms fire value, rounded UP to the nearest die
 * type, floored at D4, capped at D12 with no bonus above it (p. 34).
 */
export function fireValueToDie(totalFireValue: number): DieType {
  for (const d of DIE_STEPS) if (totalFireValue <= d) return d
  return 12
}

/**
 * The Squad Small Arms Firepower Die (p. 34): the weapon's per-trooper
 * Firepower times the number of troopers actually firing it this action
 * (anyone doing something else that activation is excluded), rounded up
 * to a die type.
 */
export function squadFirepowerDie(perTrooperFirepower: number, troopersFiring: number): DieType {
  return fireValueToDie(perTrooperFirepower * troopersFiring)
}
