import { ARC_ORDER, type Arc, type WeaponDef } from '../engine/types'
import { CATALOGUE_WEAPONS, type CatalogueWeapon } from './buildCatalog'

/**
 * Which arcs a mounting covers, and how many it was bought to cover (4.2).
 *
 * 4.2 sells a mounting by the number of arcs and leaves which arcs to the
 * designer — and 5.22 adds that they need not even be adjacent. So the count
 * is a fact about what was paid for, read back from the price, and the arcs
 * themselves are free to change underneath it. Reading the count off the arcs
 * currently chosen was the bug: take one off a three-arc mounting and it
 * became a two-arc mounting, take them all off and it could never be given
 * any again.
 */

/** The arcs a new mounting covers, the bow first: F, the two beside it, then aft. */
const BOW_FIRST: readonly Arc[] = ['F', 'FS', 'FP', 'AS', 'AP', 'A']

/** A sensible spread for a mounting of so many arcs: a forward battery, widening aft. */
export function defaultArcs(count: number): Arc[] {
  const n = Math.max(0, Math.min(6, Math.floor(count)))
  const picked = new Set(BOW_FIRST.slice(0, n))
  return ARC_ORDER.filter((arc) => picked.has(arc))
}

/** The catalogue entry a fitted weapon was bought from, where the catalogue sells it. */
export function catalogueEntryFor(weapon: WeaponDef): CatalogueWeapon | undefined {
  return CATALOGUE_WEAPONS.find(
    (entry) =>
      entry.weaponClass === weapon.weaponClass &&
      entry.variant === weapon.variant &&
      entry.rating === weapon.rating,
  )
}

/** The mounting a fitted weapon was bought as, by its price; undefined off the catalogue. */
export function mountingFor(weapon: WeaponDef): CatalogueWeapon['mountings'][number] | undefined {
  return catalogueEntryFor(weapon)?.mountings.find(
    (m) => m.mass === weapon.mass && m.points === weapon.points,
  )
}

/**
 * How many arcs the mounting was bought to cover. Read from the price where
 * the catalogue knows the weapon; otherwise the arcs it has, and at least one.
 */
export function boughtArcs(weapon: WeaponDef): number {
  return mountingFor(weapon)?.arcs ?? Math.max(1, Math.min(6, weapon.arcs.length))
}

/**
 * The same arcs made to fit a count: trimmed to the first so many, or filled
 * out bow-first. In the book's own order either way.
 */
export function fitArcs(arcs: readonly Arc[], count: number): Arc[] {
  const n = Math.max(0, Math.min(6, Math.floor(count)))
  const kept: Arc[] = [...new Set(arcs)].slice(0, n)
  for (const arc of BOW_FIRST) {
    if (kept.length >= n) break
    if (!kept.includes(arc)) kept.push(arc)
  }
  return ARC_ORDER.filter((arc) => kept.includes(arc))
}
