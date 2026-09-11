/**
 * Full Thrust: Project Continuum — dice (1.7) and the beam damage table
 * (4.5 – 4.7).
 *
 * Full Thrust is a pure d6 game: every roll in the book is one or more plain
 * six-sided dice, and every weapon reads its result off a variation of the
 * beam table. That keeps this module small and makes it the one place a die
 * roll can enter the engine.
 */

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

/**
 * Seeded RNG so a battle replays identically from its journal — which is what
 * save/resume, undo, replays and two browsers staying in step are all made of.
 * mulberry32.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  /** Fisher–Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return items
  }
}

/** One six-sided die (1.7). */
export function d6(rng: Rng): number {
  return rng.int(6) + 1
}

export function rollD6(count: number, rng: Rng): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(d6(rng))
  return out
}

/** Sum of `count` dice — 3D6 missile damage and the like (6.5). */
export function sumD6(count: number, rng: Rng): number {
  return rollD6(count, rng).reduce((a, b) => a + b, 0)
}

// ---------------------------------------------------------------------------
// The beam damage table (4.5, 4.7)
// ---------------------------------------------------------------------------

/** Screen level in effect against this die (4.7). Level is capped at 2. */
export type ScreenLevel = 0 | 1 | 2

/**
 * Damage one beam die inflicts, after screens.
 *
 *   unscreened   1-3 → 0   4-5 → 1   6 → 2
 *   level 1      1-4 → 0   5 → 1     6 → 2
 *   level 2      1-4 → 0   5 → 1     6 → 1
 *
 * `face` is the die as read after any DRM. Re-rolls are decided on the
 * *natural* face, which is why `beamDamage` never looks at re-rolls itself
 * (4.6).
 */
export function beamDamage(face: number, screens: ScreenLevel): number {
  if (face >= 6) return screens === 2 ? 1 : 2
  if (face === 5) return 1
  if (face === 4) return screens === 0 ? 1 : 0
  return 0
}

/**
 * A resolved beam die: what was rolled, what it did, and whether it opened a
 * re-roll.
 */
export interface BeamDie {
  /** The face as rolled, before any modifier. */
  natural: number
  /** The face after die roll modifiers (1.7 DRMs). */
  modified: number
  /** Damage this die inflicted. */
  damage: number
  /** True when this die's damage bypassed screens and armour (4.6). */
  penetrating: boolean
}

export interface BeamVolley {
  dice: BeamDie[]
  /** Damage screens and armour may absorb (4.8). */
  normalDamage: number
  /** Re-roll damage, applied straight to the hull (4.6, 4.9). */
  penetratingDamage: number
}

/**
 * Roll a beam-type volley (4.5 – 4.7).
 *
 * A natural 6 inflicts its damage *and* opens a re-roll; the re-roll's damage
 * ignores screens and armour, and a re-rolled 6 rolls again with no limit. The
 * re-roll test is on the natural face only: a +1 DRM makes a 5 hit as though it
 * were a 6 but does not earn the extra die (4.6).
 *
 * `penetrating` is the weapon's (P) designation — a plain `BD` weapon scores
 * its damage and stops (4.6).
 */
export function rollBeamVolley(
  diceCount: number,
  screens: ScreenLevel,
  rng: Rng,
  opts: { drm?: number; penetrating?: boolean } = {},
): BeamVolley {
  const drm = opts.drm ?? 0
  const penetrating = opts.penetrating ?? true
  const dice: BeamDie[] = []
  let normalDamage = 0
  let penetratingDamage = 0

  const resolve = (isReroll: boolean): void => {
    const natural = d6(rng)
    const modified = Math.max(1, Math.min(6, natural + drm))
    // A re-roll has already burned through the screen, so it is scored as if
    // the target were unscreened (4.6).
    const damage = beamDamage(modified, isReroll ? 0 : screens)
    dice.push({ natural, modified, damage, penetrating: isReroll })
    if (isReroll) penetratingDamage += damage
    else normalDamage += damage
    if (penetrating && natural === 6) resolve(true)
  }

  for (let i = 0; i < diceCount; i++) resolve(false)
  return { dice, normalDamage, penetratingDamage }
}

// ---------------------------------------------------------------------------
// Point defence (7.12, 7.14, 8.8)
// ---------------------------------------------------------------------------

/**
 * A point-defence die against fighters or salvo missiles (8.8): 4 or 5 kills
 * one, a 6 kills two and rolls again. A Beam-1 used as point defence is worse
 * — it kills on 5 or 6 only, with the re-roll still on the 6.
 *
 * Against *heavy* missiles the whole table shifts up: a PDS kills on 5 or 6,
 * a beam or fighter on a 6 (6.4).
 */
export type PdMode = 'pds' | 'beam-1' | 'fighter'

export function pointDefenceKills(
  dice: number,
  mode: PdMode,
  rng: Rng,
  opts: { heavyMissile?: boolean } = {},
): { rolls: number[]; kills: number } {
  const heavy = opts.heavyMissile ?? false
  const rolls: number[] = []
  let kills = 0

  const resolve = (): void => {
    const face = d6(rng)
    rolls.push(face)
    if (heavy) {
      // Against a heavy missile: PDS kills on 5-6, everything else on 6 (6.4).
      if (mode === 'pds' ? face >= 5 : face === 6) kills += 1
      return
    }
    if (mode === 'pds') {
      if (face === 6) {
        kills += 2
        resolve()
      } else if (face >= 4) kills += 1
    } else {
      // Beam-1 and fighters kill on 5 or 6, with a re-roll on the 6 (8.8).
      if (face === 6) {
        kills += 1
        resolve()
      } else if (face === 5) kills += 1
    }
  }

  for (let i = 0; i < dice; i++) resolve()
  return { rolls, kills }
}

// ---------------------------------------------------------------------------
// Threshold checks (4.11)
// ---------------------------------------------------------------------------

/**
 * The die a system must beat to survive a threshold check. The first row lost
 * knocks a system out on a 6, the second on 5+, the third on 4+ — and crossing
 * several rows in one attack adds 1 to each die per extra row, rather than
 * making several checks (4.11).
 *
 * Returns the *target number*: a roll at or above it destroys the system.
 */
export function thresholdTarget(rowsLost: number): number {
  return Math.max(2, 7 - rowsLost)
}

/**
 * Roll one system's threshold check (4.11).
 *
 * `rowsLost` is the index of the row just crossed (1 for the first row of hull
 * gone), `extraRows` the additional rows crossed in the same attack, and `drm`
 * any modifier — a Flawed Design carries −1 for the life of the ship (13.13).
 */
export function thresholdCheck(
  rowsLost: number,
  extraRows: number,
  rng: Rng,
  drm = 0,
): { roll: number; modified: number; destroyed: boolean } {
  const roll = d6(rng)
  const modified = roll + extraRows + drm
  return { roll, modified, destroyed: modified >= thresholdTarget(rowsLost) }
}

// ---------------------------------------------------------------------------
// Damage control (10.4)
// ---------------------------------------------------------------------------

/**
 * A damage control party repair roll (10.4): up to three parties may work one
 * system, and the repair succeeds on a d6 at or below the number of parties
 * assigned.
 */
export function damageControlRoll(
  parties: number,
  rng: Rng,
): { roll: number; repaired: boolean } {
  const assigned = Math.max(0, Math.min(3, parties))
  const roll = d6(rng)
  return { roll, repaired: assigned > 0 && roll <= assigned }
}
