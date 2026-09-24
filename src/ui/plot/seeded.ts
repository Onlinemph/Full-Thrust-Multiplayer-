/**
 * Stable "randomness" for the map's decoration.
 *
 * A wreck's rotation and its scatter of debris, a damaged hull's scorch marks
 * — none of it is meant to reshuffle on every re-render, or a battlefield
 * would visibly crawl each time a ship elsewhere moved. Seeding it off the
 * ship's own name gives every hull a fixed, unique-looking mess without the
 * map carrying any of it in state.
 */

/** A small string hash (FNV-1a), so the same name always gives the same seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** `count` pseudo-random numbers in [0, 1), deterministic from `seed`. */
export function seededSequence(seed: number, count: number): number[] {
  let state = (seed >>> 0) || 1
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    out.push(state / 0x100000000)
  }
  return out
}
