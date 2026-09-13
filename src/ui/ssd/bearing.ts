import { ARC_ORDER } from '../../engine/types'
import type { Arc } from '../../engine/types'

/**
 * Where a mounting points, and how tightly (4.2).
 *
 * The six arcs are 60° wedges around the bow, so a set of them has a mean
 * direction and a concentration: a single arc is tight and points one way, the
 * three arcs of a battery point one way less tightly, and all six cancel out
 * exactly. That cancelling is the useful part — it is how an all-round mount
 * identifies itself as belonging on the keel rather than on any one side.
 *
 * Done in integers. Each arc's unit vector, doubled, is (a·√3, b) with a and b
 * whole numbers, so a set of arcs sums to whole numbers too and the answer
 * cannot depend on the order the arcs were written in or on which JS engine
 * rounded the sines. That matters at the ties: a mount covering an even number
 * of adjacent arcs points exactly between two sectors, and a tie broken by
 * floating-point noise put mirror-image broadsides in different bands.
 */

/** 2·sin(60°·k) = SIN3[k]·√3 and 2·cos(60°·k) = COS2[k], for k = 0..5. */
const SIN3 = [0, 1, 1, 0, -1, -1] as const
const COS2 = [2, 1, -1, -2, -1, 1] as const

export interface Bearing {
  /** Mean direction, clockwise from the bow, in [0, 360). */
  degrees: number
  /** From 1 for a single arc down to 0 for a mount that bears every way. */
  spread: number
  /** The 60° sector the mean falls in, 0 at the bow and clockwise. */
  sector: number
}

/**
 * The concentration below which a mounting is on the keel however its mean
 * happens to fall. Adjacent 60° arcs concentrate as 2·sin(30n°)/n, so the
 * ladder is 1 arc 1.00, two 0.87, three 0.67, four 0.43, five 0.20 and six
 * exactly nothing. 0.34 sits in the one wide gap on it: a mount covering four
 * arcs still has a side to be bolted to, and one covering five does not.
 */
export const KEEL_SPREAD = 0.34

/**
 * A tie between two sectors goes to the one nearer the bow, on both sides.
 *
 * The rule has to be mirror-symmetric or a port broadside and its starboard
 * twin draw in different places, and "nearer the bow" is the only symmetric
 * choice that is also the useful one: a mount bearing exactly between the bow
 * and the forward-starboard sector is a bow chaser that can also fire abeam,
 * and belongs with the chasers.
 */
const FORWARDNESS = [0, 1, 2, 3, 2, 1] as const

export function arcBearing(arcs: readonly Arc[]): Bearing {
  if (arcs.length === 0) return { degrees: 0, spread: 0, sector: 0 }
  let a = 0
  let b = 0
  for (const arc of arcs) {
    const k = ARC_ORDER.indexOf(arc)
    if (k < 0) continue
    a += SIN3[k]
    b += COS2[k]
  }
  if (a === 0 && b === 0) return { degrees: 0, spread: 0, sector: 0 }

  const spread = Math.sqrt(3 * a * a + b * b) / (2 * arcs.length)
  let degrees = (Math.atan2(a * Math.sqrt(3), b) * 180) / Math.PI
  if (degrees < 0) degrees += 360

  // Exactly between two sectors: tan(30°) = 1/√3, so the mean sits on a sector
  // boundary precisely when b = ±3a, or when b = 0 (dead abeam).
  const onBoundary = b === 0 || b === 3 * a || b === -3 * a
  let sector: number
  if (onBoundary) {
    const lower = Math.floor(degrees / 60 + 1e-9) % 6
    const upper = (lower + 1) % 6
    sector = FORWARDNESS[lower] <= FORWARDNESS[upper] ? lower : upper
  } else {
    sector = Math.round(degrees / 60) % 6
  }
  return { degrees, spread, sector }
}

/** True when a set of arcs leaves a mounting with a side to be bolted to. */
export function bearsSomewhere(arcs: readonly Arc[]): boolean {
  return arcBearing(arcs).spread >= KEEL_SPREAD
}
