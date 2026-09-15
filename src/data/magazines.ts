import type { MagazineDef, ShipDesign, WeaponDef } from '../engine/types'
import {
  MAGAZINE_POINTS_PER_MASS,
  magazineLoadMass,
  type MagazineLoad,
} from '../engine/ordnance'

/**
 * Magazines in the shipyard (6.6).
 *
 * *"Any one launcher system may only be fed from one magazine, though a single
 * magazine may feed more than one launcher."* Feeding is therefore a move, not
 * a toggle: putting a launcher on one magazine takes it off whichever fed it
 * before. And a magazine's mass is its loads — 2 for a standard salvo, 3 for
 * ER, 2 more for a second stage — so adding or dropping a load reprices the
 * magazine around what it holds, at section 6's three points a mass.
 */

/** The launchers a magazine can feed: Salvo Missile Launchers, and nothing else. */
export function launchersOf(design: ShipDesign): WeaponDef[] {
  return design.weapons.filter((w) => w.weaponClass === 'salvo-missile-launcher')
}

/** The magazine feeding a launcher, if one does. */
export function magazineFor(design: ShipDesign, launcherId: string): MagazineDef | undefined {
  return (design.magazines ?? []).find((m) => m.launcherIds.includes(launcherId))
}

/** Put a launcher on a magazine, taking it off any other. */
export function feedLauncher(
  design: ShipDesign,
  magazineId: string,
  launcherId: string,
): Partial<ShipDesign> {
  return {
    magazines: (design.magazines ?? []).map((m) => ({
      ...m,
      launcherIds:
        m.id === magazineId
          ? [...m.launcherIds.filter((id) => id !== launcherId), launcherId]
          : m.launcherIds.filter((id) => id !== launcherId),
    })),
  }
}

/** Take a launcher off whatever feeds it. */
export function unfeedLauncher(design: ShipDesign, launcherId: string): Partial<ShipDesign> {
  return {
    magazines: (design.magazines ?? []).map((m) => ({
      ...m,
      launcherIds: m.launcherIds.filter((id) => id !== launcherId),
    })),
  }
}

/** A new, empty magazine feeding every launcher nothing feeds yet. */
export function newMagazine(design: ShipDesign): MagazineDef {
  const taken = new Set((design.magazines ?? []).flatMap((m) => m.launcherIds))
  const ids = new Set((design.magazines ?? []).map((m) => m.id))
  let n = (design.magazines ?? []).length + 1
  while (ids.has(`m${n}`)) n += 1
  return {
    id: `m${n}`,
    mass: 0,
    points: 0,
    loads: [],
    launcherIds: launchersOf(design)
      .filter((w) => !taken.has(w.id))
      .map((w) => w.id),
  }
}

/** The magazine repriced around its loads (6.6). */
function repriced(magazine: MagazineDef, loads: MagazineDef['loads']): MagazineDef {
  const mass = loads.reduce((sum, load) => sum + magazineLoadMass(load), 0)
  return { ...magazine, loads, mass, points: mass * MAGAZINE_POINTS_PER_MASS }
}

/** One more load in the magazine. */
export function withLoadAdded(
  design: ShipDesign,
  magazineId: string,
  load: MagazineLoad,
): Partial<ShipDesign> {
  return {
    magazines: (design.magazines ?? []).map((m) =>
      m.id === magazineId ? repriced(m, [...m.loads, { ...load }]) : m,
    ),
  }
}

/** The last load out of the magazine. */
export function withLoadDropped(design: ShipDesign, magazineId: string): Partial<ShipDesign> {
  return {
    magazines: (design.magazines ?? []).map((m) =>
      m.id === magazineId ? repriced(m, m.loads.slice(0, -1)) : m,
    ),
  }
}

/** The magazine gone, and its launchers left for another to feed. */
export function withoutMagazine(design: ShipDesign, magazineId: string): Partial<ShipDesign> {
  return { magazines: (design.magazines ?? []).filter((m) => m.id !== magazineId) }
}

/** The sheet's symbol for what a magazine holds (2.4): multi-stage, ER, or standard. */
export function magazineIcon(loads: ReadonlyArray<MagazineLoad>): string {
  if (loads.some((load) => load.multiStage)) return 'salvo-missile-magazine-multistage'
  if (loads.length > 0 && loads.every((load) => load.grade === 'extended')) {
    return 'salvo-missile-magazine-long-range'
  }
  return 'salvo-missile-magazine'
}

/** How a load-out reads: "3 standard, 1 ER" or "2 multi-stage". */
export function describeLoads(loads: ReadonlyArray<MagazineLoad>): string {
  if (loads.length === 0) return 'empty'
  const parts: string[] = []
  const count = (test: (load: MagazineLoad) => boolean, name: string) => {
    const n = loads.filter(test).length
    if (n > 0) parts.push(`${n} ${name}`)
  }
  count((l) => l.grade === 'standard' && !l.multiStage, 'standard')
  count((l) => l.grade === 'extended' && !l.multiStage, 'ER')
  count((l) => l.multiStage === true, 'multi-stage')
  return parts.join(', ')
}
