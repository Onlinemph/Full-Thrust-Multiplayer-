import type { WeaponClass, WeaponDef } from '../../engine/types'

/**
 * How big a weapon draws, relative to an ordinary class-3 mount.
 *
 * The sheet prints every weapon symbol the same size, and on paper that is
 * fine: the digit inside says what it is. On a screen the digit is the last
 * thing the eye gets to, so the size says it first — a Beam-4 is the biggest
 * thing on the deck and a Beam-1 is a fitting, the way a real turret dwarfs a
 * real point-defence mount. The same weight sizes the gun on the counter, so
 * a ship that is mostly gun on its sheet is mostly gun on the table.
 *
 * Nothing here is read by a rule. The rating still decides the dice; this
 * only decides how much of the sheet the rating gets.
 */

/** A classed mount: one step per class, a Beam-3 being the unit (5.3). */
const BY_CLASS: readonly number[] = [0.72, 0.86, 1, 1.16, 1.32, 1.46]

function classed(rating: number): number {
  const index = Math.max(1, Math.min(BY_CLASS.length, Math.round(rating))) - 1
  return BY_CLASS[index]
}

/** The mounts the rules size by something other than a class. */
const FIXED: Partial<Record<WeaponClass, number>> = {
  gatling: 0.95,
  'twin-particle-array': 0.87,
  'meson-projector': 0.87,
  'submunition-pack': 0.8,
  mkp: 0.9,
  'boarding-torpedo': 0.9,
  'fusion-array': 1,
  pulser: 0.9,
  // 7.23, 7.24: a gun with a capital ship built round it.
  'nova-cannon': 1.55,
  'wave-gun': 1.55,
  // 6: a launcher is a box of missiles, not a gun, and draws a little lighter.
  'heavy-missile': 0.95,
  'salvo-missile-launcher': 1.05,
  'salvo-missile-rack': 0.9,
  'antimatter-missile': 1,
  'rocket-pod': 0.78,
  'mine-rack': 0.85,
}

export function weaponWeight(weapon: Pick<WeaponDef, 'weaponClass' | 'rating' | 'variant' | 'mass'>): number {
  const fixed = FIXED[weapon.weaponClass]
  if (fixed !== undefined) return fixed
  switch (weapon.weaponClass) {
    // 5.7: 18 MU bands rather than 12 — a class heavier than it says.
    case 'heavy-graser':
      return classed(weapon.rating + 1)
    // 5.14: the tube is the tube; the range line stretches it a little.
    case 'pulse-torpedo':
      return weapon.variant === 'long'
        ? 1.08
        : weapon.variant === 'short'
          ? 0.92
          : weapon.variant === 'variable'
            ? 1.04
            : 1
    // 5.23: small, medium or large, by rating where the design says and by
    // mass where it does not, the same way the engine reads it.
    case 'spinal-beam':
    case 'spinal-plasma':
    case 'spinal-psp': {
      const size =
        weapon.rating >= 1 && weapon.rating <= 3
          ? weapon.rating
          : weapon.mass >= 32
            ? 3
            : weapon.mass >= 16
              ? 2
              : 1
      return 1.2 + 0.15 * size
    }
    default:
      return classed(weapon.rating)
  }
}
