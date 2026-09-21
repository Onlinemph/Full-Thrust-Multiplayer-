/**
 * The direct-fire weapons (pp. 8–9), their ranges (p. 28), the dice the
 * shot is rolled with (pp. 28–29) and which damage chits count (p. 29).
 */

import type { SystemLevel, WeaponClass, WeaponType } from '../types'

export interface WeaponKind {
  type: WeaponType
  label: string
  short: string
  /** Size classes the weapon is made in (pp. 8–9). */
  classes: readonly WeaponClass[]
  /** Needs the vehicle's power plant: HELs and MDCs (p. 10). */
  needsPower: boolean
  /** Points per class (p. 52). */
  pointsPerClass: number
}

export const WEAPON_KINDS: readonly WeaponKind[] = [
  { type: 'rfac', label: 'Rapid-Fire Autocannon', short: 'RFAC', classes: [1, 2], needsPower: false, pointsPerClass: 5 },
  { type: 'hvc', label: 'High-Velocity Cannon', short: 'HVC', classes: [3, 4, 5], needsPower: false, pointsPerClass: 8 },
  { type: 'hkp', label: 'Hyper-Kinetic Penetrator', short: 'HKP', classes: [3, 4, 5], needsPower: false, pointsPerClass: 10 },
  { type: 'mdc', label: 'Mass-Driver Cannon', short: 'MDC', classes: [1, 2, 3, 4, 5], needsPower: true, pointsPerClass: 10 },
  { type: 'hel', label: 'High-Energy Laser', short: 'HEL', classes: [1, 2, 3, 4, 5], needsPower: true, pointsPerClass: 12 },
  { type: 'dffg', label: 'Direct-Fire Fusion Gun', short: 'DFFG', classes: [1, 2, 3, 4, 5], needsPower: false, pointsPerClass: 15 },
  { type: 'slam', label: 'Salvo-Launched Missile pack', short: 'SLAM', classes: [3, 4, 5], needsPower: false, pointsPerClass: 12 },
]

export function weaponKind(type: WeaponType): WeaponKind {
  return WEAPON_KINDS.find((k) => k.type === type)!
}

export type RangeBand = 'close' | 'medium' | 'long'
export const RANGE_BANDS: readonly RangeBand[] = ['close', 'medium', 'long']

/** Range bands in inches, "up to" (p. 28). A HEL has one 60" band. */
export interface RangeBands {
  close: number
  medium: number
  long: number
}

const RANGES: Record<WeaponType, Partial<Record<WeaponClass, RangeBands>>> = {
  hel: { 1: { close: 60, medium: 60, long: 60 }, 2: { close: 60, medium: 60, long: 60 }, 3: { close: 60, medium: 60, long: 60 }, 4: { close: 60, medium: 60, long: 60 }, 5: { close: 60, medium: 60, long: 60 } },
  rfac: { 1: { close: 8, medium: 12, long: 16 }, 2: { close: 12, medium: 18, long: 24 } },
  hvc: { 3: { close: 16, medium: 24, long: 32 }, 4: { close: 18, medium: 27, long: 36 }, 5: { close: 20, medium: 30, long: 40 } },
  hkp: { 3: { close: 18, medium: 30, long: 42 }, 4: { close: 24, medium: 36, long: 48 }, 5: { close: 30, medium: 42, long: 54 } },
  mdc: { 1: { close: 8, medium: 16, long: 24 }, 2: { close: 12, medium: 24, long: 36 }, 3: { close: 24, medium: 36, long: 48 }, 4: { close: 30, medium: 42, long: 54 }, 5: { close: 36, medium: 48, long: 60 } },
  dffg: { 1: { close: 4, medium: 8, long: 12 }, 2: { close: 6, medium: 12, long: 18 }, 3: { close: 8, medium: 16, long: 24 }, 4: { close: 10, medium: 20, long: 30 }, 5: { close: 12, medium: 24, long: 36 } },
  slam: { 3: { close: 12, medium: 24, long: 36 }, 4: { close: 12, medium: 24, long: 36 }, 5: { close: 12, medium: 24, long: 36 } },
}

/** The weapon's three range bands, or undefined for a class it is not made in. */
export function rangeBandsOf(type: WeaponType, cls: WeaponClass): RangeBands | undefined {
  return RANGES[type][cls]
}

/** A HEL is a single 60" band: "ALL CLASSES (1-5) 60" — — —" (p. 28). */
export function singleBand(type: WeaponType): boolean {
  return type === 'hel'
}

/** Maximum effective ranges of the weapons that have no bands (p. 28). */
export const GMS_RANGE = { light: 36, heavy: 48 } as const
export const IAVR_RANGE = 4
export const APSW_RANGE = 12

/** Die types, in the order the rules step them (p. 4, p. 28). */
export const DIE_STEPS = [4, 6, 8, 10, 12] as const
export type DieType = (typeof DIE_STEPS)[number]

/** The medium-range die for a fire-control level (p. 28). */
export const FIRE_CONTROL_DIE: Record<SystemLevel, DieType> = { basic: 6, enhanced: 8, superior: 10 }

/** Step a die up or down the scale; off the bottom is null, "drops it off the end of the dice scale" (p. 28). */
export function stepDie(die: DieType, steps: number): DieType | null {
  const at = DIE_STEPS.indexOf(die) + steps
  if (at < 0) return null
  return DIE_STEPS[Math.min(at, DIE_STEPS.length - 1)]!
}

/** The firer's die for a fire-control level in a range band (p. 28): close +1, long −1. */
export function firerDie(level: SystemLevel, band: RangeBand): DieType {
  const base = FIRE_CONTROL_DIE[level]
  return stepDie(base, band === 'close' ? 1 : band === 'long' ? -1 : 0)!
}

/** The target's primary die by effective signature (p. 29). */
export function targetDie(effectiveSignature: number): DieType {
  const table: Record<number, DieType> = { 1: 12, 2: 10, 3: 8, 4: 6, 5: 4 }
  return table[Math.max(1, Math.min(5, effectiveSignature))]!
}

/** Which colours of damage chit count, as the card prints them (p. 29). */
export type ChitValidity = 'ALL' | 'ALL×2' | 'ALL÷2' | 'R/Y' | 'RED' | 'YELLOW' | 'GREEN'

/** Chit validity of a direct-fire weapon against a vehicle, by band (p. 29). */
export function validityOf(type: WeaponType, band: RangeBand, target: { ablative?: boolean; reactive?: boolean } = {}): ChitValidity {
  switch (type) {
    case 'hel':
      return target.ablative ? 'GREEN' : 'RED'
    case 'rfac':
    case 'hvc':
      return band === 'close' ? 'R/Y' : band === 'medium' ? 'RED' : 'GREEN'
    case 'hkp':
    case 'mdc':
      return band === 'close' ? 'ALL' : band === 'medium' ? 'R/Y' : 'RED'
    case 'dffg':
      return band === 'close' ? 'ALL×2' : band === 'medium' ? 'ALL' : 'ALL÷2'
    case 'slam':
      return target.reactive ? 'RED' : 'R/Y'
  }
}

/** Chit validity of the weapons against infantry (p. 29); null for a weapon with no effect. */
export function validityAgainstInfantry(type: WeaponType | 'gms' | 'iavr'): ChitValidity | null {
  switch (type) {
    case 'hel':
    case 'rfac':
    case 'hvc':
    case 'mdc':
    case 'slam':
      return 'YELLOW'
    case 'dffg':
      return 'RED'
    case 'hkp':
    case 'gms':
    case 'iavr':
      return null
  }
}

/** A guided missile's validity (p. 29) and the die its guidance rolls (p. 31). */
export function missileValidity(target: { reactive?: boolean } = {}): ChitValidity {
  return target.reactive ? 'RED' : 'R/Y'
}
export const GUIDANCE_DIE: Record<SystemLevel, DieType> = { basic: 6, enhanced: 8, superior: 10 }
/** Point-defence and area-defence dice by level (p. 31). */
export const DEFENCE_DIE: Record<SystemLevel, DieType> = { basic: 6, enhanced: 8, superior: 10 }
/** The target's primary die against a missile, by ECM (p. 31). */
export const ECM_DIE = { none: 4, basic: 6, enhanced: 8, superior: 10 } as const
