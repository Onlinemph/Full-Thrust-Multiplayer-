/**
 * A picked force as a fleet list (18.2, 18.3).
 *
 * `engine/battles.ts` checks a `FleetShip[]` — mass, points, embarked points,
 * a declared class and whether the hull is a carrier — and deliberately cannot
 * build one from a `ShipDesign`: a carrier's wings are priced in `fighters.ts`
 * and 18.2 counts them against the hull, *"including their fighters"*, but
 * `ShipDesign.points` does not include them and `battles.ts` may not import
 * the fighter catalogue. Somebody has to do that sum, and this is the file
 * where a design and a fighter price can be in the same room.
 *
 * Left at zero, a six-bay fleet carrier hides up to 252 points on the wrong
 * side of 18.2's 50% capital line, which is exactly what *"including their
 * fighters"* was written to prevent.
 */

import {
  applyCpv,
  breakdownFleet,
  checkFleetComposition,
  cpvPoints,
  fleetPoints,
  fleetShipFromDesign,
  type CompositionFormat,
  type FleetCompositionReport,
  type FleetShip,
} from '../engine/battles'
import { FIGHTER_TYPES, type FighterTypeId } from '../engine/fighters'
import { GUNBOAT_SQUADRON_SIZE, GUNBOAT_TYPES, type GunboatTypeId } from '../engine/gunboats'
import type { ShipDesign } from '../engine/types'

/** 14.7 prices a wing by its type; 9.1 prices a gunboat squadron by the boat. */
export function embarkedPointsOf(design: ShipDesign): number {
  let points = 0
  for (const bay of design.fighterBays) {
    const type = FIGHTER_TYPES[bay.typeId as FighterTypeId]
    points += type?.pointsPerWing ?? 0
  }
  for (const rack of design.gunboats) {
    const type = GUNBOAT_TYPES[rack.typeId as GunboatTypeId]
    points += (type?.pointsEach ?? 0) * GUNBOAT_SQUADRON_SIZE
  }
  return points
}

/**
 * A picked list of design ids as 18.2's fleet.
 *
 * Ids are made unique per copy, because 18.2's findings are about hulls and a
 * report that says "esu-destroyer" three times has lost the plot.
 */
export function fleetFromDesigns(designs: readonly ShipDesign[]): FleetShip[] {
  const seen = new Map<string, number>()
  return designs.map((design) => {
    const n = (seen.get(design.id) ?? 0) + 1
    seen.set(design.id, n)
    return fleetShipFromDesign(design, {
      id: `${design.id}-${n}`,
      embarkedPoints: embarkedPointsOf(design),
    })
  })
}

export interface FleetSummary {
  ships: FleetShip[]
  /** Total as 18.2 measures it: hulls plus what they carry. */
  total: number
  breakdown: ReturnType<typeof breakdownFleet>
  report: FleetCompositionReport
  /** True when the total is in Combat Points Value rather than printed points. */
  cpv: boolean
}

/**
 * Everything the fleet picker needs to say about a force.
 *
 * 18.3's CPV is a different currency, not a discount: it reprices every hull
 * by mass, so a fleet's total and its class shares both move. When it is on,
 * the shares are taken of the CPV total — 18.2's bands and limits are about
 * *"points"* and the table is playing in these ones.
 */
export function summariseFleet(
  designs: readonly ShipDesign[],
  opts: { format?: CompositionFormat; cpv?: boolean } = {},
): FleetSummary {
  const base = fleetFromDesigns(designs)
  const ships = opts.cpv ? applyCpv(base) : base
  return {
    ships,
    total: fleetPoints(ships),
    breakdown: breakdownFleet(ships),
    report: checkFleetComposition(ships, { format: opts.format ?? 'open' }),
    cpv: opts.cpv === true,
  }
}

/** One design's price in the currency the table is playing in (18.3). */
export function designCost(design: ShipDesign, cpv: boolean): number {
  const hull = cpv ? cpvPoints(design.points, design.mass) : design.points
  return hull + embarkedPointsOf(design)
}
