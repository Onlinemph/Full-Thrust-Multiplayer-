import {
  FIGHTER_MODIFIERS,
  FIGHTER_TYPES,
  fighterProfile,
  validateFighterBuild,
  type FighterModifierId,
  type FighterTypeId,
} from '../engine/fighters'
import {
  GUNBOAT_MODIFIERS,
  GUNBOAT_SQUADRON_SIZE,
  GUNBOAT_TYPES,
  squadronPoints,
  validateGunboatBuild,
  type GunboatModifierId,
  type GunboatTypeId,
} from '../engine/gunboats'
import { fighterMods, gunboatMods } from './smallCraftMods'

/**
 * Building a wing or a squadron in the shipyard (8.15, 9.2).
 *
 * 8.15's modifications — Heavy, Fast, Long Range, FTL, Robot, Light — stack
 * onto a base type, and most of them stack with each other: a Heavy Fast Long
 * Range Attack wing is a legal, expensive thing. The engine holds the rules
 * (`validateFighterBuild`: Light bars Heavy and Long Range and only some
 * roles, nothing twice) and the price (`fighterProfile`: per fighter, so a
 * Light wing of eight pays eight). This module asks those two questions the
 * way a chip on a panel needs them asked: may this one be added, and what
 * does the wing cost now.
 */

/** Every modification 8.15 offers, in the order the book lists them. */
export const FIGHTER_MODIFIER_IDS: readonly FighterModifierId[] = [
  'heavy',
  'fast',
  'long-range',
  'ftl',
  'robot',
  'light',
]

/** 9.2's squadron options. */
export const GUNBOAT_MODIFIER_IDS: readonly GunboatModifierId[] = ['ftl', 'heavy', 'ecm']

/** The modifications with one added or taken off, in the book's order. */
export function toggleFighterMod(mods: readonly string[] | undefined, id: FighterModifierId): FighterModifierId[] {
  const current = fighterMods(mods)
  const next = current.includes(id) ? current.filter((m) => m !== id) : [...current, id]
  return FIGHTER_MODIFIER_IDS.filter((m) => next.includes(m))
}

export function toggleGunboatMod(mods: readonly string[] | undefined, id: GunboatModifierId): GunboatModifierId[] {
  const current = gunboatMods(mods)
  const next = current.includes(id) ? current.filter((m) => m !== id) : [...current, id]
  return GUNBOAT_MODIFIER_IDS.filter((m) => next.includes(m))
}

/**
 * Why a modification cannot be added to this wing, or null when it can. A
 * modification already on the wing can always be taken off.
 */
export function fighterModProblem(
  typeId: FighterTypeId,
  mods: readonly string[] | undefined,
  id: FighterModifierId,
): string | null {
  const current = fighterMods(mods)
  if (current.includes(id)) return null
  const problems = validateFighterBuild(typeId, [...current, id])
  const before = new Set(validateFighterBuild(typeId, current))
  const fresh = problems.filter((p) => !before.has(p))
  return fresh[0] ?? null
}

export function gunboatModProblem(
  typeId: GunboatTypeId,
  mods: readonly string[] | undefined,
  id: GunboatModifierId,
  carriedOnRack: boolean,
): string | null {
  const current = gunboatMods(mods)
  if (current.includes(id)) return null
  const boats = Array<GunboatTypeId>(GUNBOAT_SQUADRON_SIZE).fill(typeId)
  const problems = validateGunboatBuild(boats, [...current, id], { carriedOnRack })
  const before = new Set(validateGunboatBuild(boats, current, { carriedOnRack }))
  return problems.filter((p) => !before.has(p))[0] ?? null
}

/** "Heavy Fast Attack wing": the profile's own name, as the bay is labelled. */
export function wingLabel(typeId: FighterTypeId, mods: readonly string[] | undefined): string {
  return `${fighterProfile(typeId, fighterMods(mods)).label} wing`
}

/** What the wing costs, modifications and all (8.15, per fighter). */
export function wingPoints(typeId: FighterTypeId, mods: readonly string[] | undefined): number {
  return fighterProfile(typeId, fighterMods(mods)).points
}

/** "FTL Heavy Beam squadron". */
export function squadronLabel(typeId: GunboatTypeId, mods: readonly string[] | undefined): string {
  const parts = gunboatMods(mods).map((id) => GUNBOAT_MODIFIERS[id].label.replace(' or Screened', ''))
  return `${[...parts, GUNBOAT_TYPES[typeId].label].join(' ')} squadron`
}

/** What a full squadron costs with its options (9.2, per squadron). */
export function squadronPointsFor(typeId: GunboatTypeId, mods: readonly string[] | undefined): number {
  return squadronPoints(Array<GunboatTypeId>(GUNBOAT_SQUADRON_SIZE).fill(typeId), gunboatMods(mods))
}

/** A short line for a chip's tooltip: the rule, and the price. */
export function fighterModTitle(id: FighterModifierId): string {
  const mod = FIGHTER_MODIFIERS[id]
  const each = mod.pointsPerFighter
  const price = each === 0 ? 'no extra cost' : `${each > 0 ? '+' : '−'}${Math.abs(each)} a fighter`
  return `${mod.label} — ${price}. ${mod.notes}`
}

export function gunboatModTitle(id: GunboatModifierId): string {
  const mod = GUNBOAT_MODIFIERS[id]
  return `${mod.label} — +${mod.pointsPerSquadron} a squadron. ${mod.notes}`
}

export { FIGHTER_TYPES }
