import { distance, featureAt } from '../../../dirtside/table/terrain'
import { inDeploymentZone } from '../../../stargrunt/table/game'
import { COST_PER_INCH, movementGoing, terrainFamilyOf } from '../../../stargrunt/table/movement'
import type { GameSetup, MobilityKind, Point, SideId, TerrainFeature } from '../../../stargrunt/types'
import { nearbyFeatures } from '../../dirtside/map/geometry'

/**
 * The two Dirtside map-geometry helpers that read a game-specific type
 * (`05-reuse-map.md` §3): `reachPolygon` needs Stargrunt's own `pathCost`
 * (a squad's terrain table is not a vehicle's), and `deploymentBand` needs
 * Stargrunt's own `inDeploymentZone`. Everything else — `pts`, `round`,
 * `hash`, `decorRandom`, `insetShape`, `centreOf`, `pointAlong`, `textWidth`,
 * `fitLabel`, `Box`/`overlaps`/`clearestSpot` — reads no rule and is
 * imported unchanged from `src/ui/dirtside/map/geometry`.
 */
export {
  centreOf,
  clearestSpot,
  decorRandom,
  fitLabel,
  hash,
  insetShape,
  nearbyFeatures,
  overlaps,
  pointAlong,
  pts,
  round,
  textWidth,
} from '../../dirtside/map/geometry'
export type { Box } from '../../dirtside/map/geometry'

/**
 * A single straight segment's cost in `movement.ts`'s own terms, sampled
 * coarser (0.5" not 0.25") and stopping the instant the answer to "does this
 * fit under budget" is known — the same trade `ui/dirtside/map/geometry.ts`'s
 * `reachCost` makes and for the same reason, see its own doc comment: this
 * ring only ever asks that one question, never the leg-by-leg breakdown
 * `pathCost` reports, so it can afford to stop looking once it has it.
 */
function reachCost(from: Point, to: Point, mobility: MobilityKind, features: readonly TerrainFeature[], budget: number): { blocked: boolean; factors: number } {
  const family = terrainFamilyOf(mobility)
  const step = 0.5
  const len = distance(from, to)
  const n = Math.max(1, Math.ceil(len / step))
  const segLen = len / n
  let factors = 0
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    const feature = featureAt(point, features)
    const terrain = feature?.terrain ?? 'open'
    const going = movementGoing(family, terrain)
    if (going === 'impassable') return { blocked: true, factors }
    factors += segLen * COST_PER_INCH[going]
    if (factors > budget + 1e-6) return { blocked: false, factors }
  }
  return { blocked: false, factors }
}

/**
 * How far a squad could get from `from` along each of `rays` straight lines
 * for `budget` inches: the reach ring the move ghost draws. Each ray is
 * found by halving on `reachCost` (above), so poor and difficult going bend
 * it exactly as a move would be charged (movement.ts's `pathCost`, p. 22).
 * `nearbyFeatures` keeps a city table's own repeated scan short (a hundred-
 * plus buildings, most nowhere near this squad) the same way Dirtside's
 * `reachPolygon` does — see its own doc comment.
 */
export function reachPolygon(from: Point, budget: number, mobility: MobilityKind, features: readonly TerrainFeature[], rays = 48): Point[] {
  if (budget <= 0.01) return []
  const nearby = nearbyFeatures(from, budget, features)
  const out: Point[] = []
  for (let r = 0; r < rays; r++) {
    const angle = (r / rays) * Math.PI * 2
    const dir = { x: Math.sin(angle), y: -Math.cos(angle) }
    const end = (len: number) => ({ x: from.x + dir.x * len, y: from.y + dir.y * len })
    const fits = (len: number) => {
      const cost = reachCost(from, end(len), mobility, nearby, budget)
      return !cost.blocked && cost.factors <= budget + 1e-6
    }
    let lo = 0
    let hi = budget
    if (fits(hi)) lo = hi
    else
      // 7 halvings, not 9: see Dirtside's own `reachPolygon` doc comment — the extra precision a visual
      // ring never shows, on the one loop run 48 times a call.
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    out.push(end(lo))
  }
  return out
}

/** Where a side may set up, as a band of the table's depth, read off `inDeploymentZone` itself (p. 14). */
export function deploymentBand(setup: GameSetup, side: SideId): { y0: number; y1: number } | null {
  const x = setup.table.width / 2
  let y0: number | null = null
  let y1: number | null = null
  for (let y = 0; y <= setup.table.depth + 1e-9; y += 0.25) {
    if (!inDeploymentZone(setup, side, { x, y })) continue
    if (y0 === null) y0 = y
    y1 = y
  }
  return y0 === null || y1 === null ? null : { y0, y1 }
}
