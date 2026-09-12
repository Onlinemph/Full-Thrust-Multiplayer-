/**
 * An SSD's fighter and gunboat modifications, as the engine's own ids.
 *
 * A design names its bays and racks in plain strings, because `types.ts` is the
 * schema every module reads and may not depend on `fighters.ts` or
 * `gunboats.ts`. Turning those strings into the ids the two modules understand
 * is this file's whole job, and it lives here rather than in either of them so
 * the shipyard, the fleet list and a scenario's deployment all read a bay the
 * same way.
 *
 * An unrecognised name is dropped rather than refused: a Robot wing that
 * launches as an ordinary one is a lesser bug than a carrier that cannot
 * deploy, and `validateDesign` reports the build separately.
 */

import { FIGHTER_MODIFIERS, type FighterModifierId } from '../engine/fighters'
import { GUNBOAT_MODIFIERS, type GunboatModifierId } from '../engine/gunboats'

/** 8.15's "(+Mod)" options: Heavy, Fast, Long Range, FTL, Robot, Light. */
export function fighterMods(ids: readonly string[] | undefined): FighterModifierId[] {
  return (ids ?? []).filter((id): id is FighterModifierId => id in FIGHTER_MODIFIERS)
}

/** 9.2's squadron options: FTL, Heavy, ECM. */
export function gunboatMods(ids: readonly string[] | undefined): GunboatModifierId[] {
  return (ids ?? []).filter((id): id is GunboatModifierId => id in GUNBOAT_MODIFIERS)
}
