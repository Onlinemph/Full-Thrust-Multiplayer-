/**
 * Stargrunt II — the ground, as Chapter 4 reads it (pp. 11–13): what cover a
 * terrain feature gives, a figure's and a unit's cover against a firer
 * (including the majority rule for mixed cover, p. 12, woods, p. 12, and
 * directional cover from a wall, a hedge, or a building's own wall, p.
 * 12–13), line of sight and line of fire between units (p. 11), range
 * measured the way the book measures it (p. 11–12), and unit integrity
 * (p. 11).
 *
 * Built on Dirtside's terrain geometry (`../../dirtside/table/terrain`),
 * reused unchanged: features, shapes, `distance`, `insideShape`, `woodAt`
 * and the high-ground/blocks-sight constants read no rule, only geometry.
 * `lineOfSight` is this file's own, not Dirtside's: Stargrunt has no sight
 * distance limit in normal conditions (p. 11), unlike Dirtside's 60"
 * sensor cap, so importing Dirtside's version unchanged would silently
 * import a limit this game does not have [reading, spec 01 §3.2]. It also
 * drops `'urban'` from what blocks sight and treats a `'building'` the way
 * Dirtside treats high ground: a figure standing inside one sees out and is
 * seen through its own walls, at the windows [reading], but a second
 * building on the line still blocks it — a town's own streets and yards
 * are open ground, since Stargrunt has no area-urban terrain type of its
 * own (p. 22) and reads a town as its individual pieces instead
 * (`featureAt(..., { pieces: true })`, exactly as this file's own
 * `terrainAt` and `figureCoverGrade` do below).
 *
 * Cover from a wall, a hedge, or a building's own wall is directional (p.
 * 12–13): it protects a figure only from a firer on the far side of the
 * nearest stretch of it, tested by whether the straight line from firer to
 * figure crosses that stretch within `WALL_HEDGE_REACH` of the figure —
 * the book's own worked diagram (Squad A, hard cover from one direction,
 * open from the other) and its artillery example (p. 47, a shielding
 * building and a one-sided wall) both turn on exactly this test, so
 * `figureCoverGrade` takes the firer's position as an optional third
 * argument; callers with no firer in mind (a unit checking its own
 * present cover, not cover against anyone in particular) simply omit it,
 * and get whatever cover the ground itself and any wood give, with no
 * directional wall/hedge/building-wall bonus layered on.
 */

import type { TerrainType } from '../../dirtside/data/mobility'
import {
  BLOCKS_SIGHT,
  HIGH_GROUND,
  WOOD_EDGE,
  distance,
  featureAt,
  insideShape,
  onHighGround,
  samplesAlong,
  woodAt,
} from '../../dirtside/table/terrain'
import type { Shape } from '../../dirtside/table/types'
import type { Point, TerrainFeature } from '../types'

export { distance, woodAt }

/** Stargrunt reads a town as its pieces (buildings, streets, rubble, walls, hedges), not the one enclosing area (p. 22, spec 02 §2.8.1): the terrain a point stands on is whichever piece covers it, or the enclosing feature (a wood, an isolated building, the town's own bare ground) when no piece does. */
export function terrainAt(point: Point, features: readonly TerrainFeature[]): TerrainType {
  return featureAt(point, features, { pieces: true })?.terrain ?? 'open'
}

// ---------------------------------------------------------------------------
// Cover and concealment (pp. 12–13)
// ---------------------------------------------------------------------------

export type CoverGrade = 'open' | 'soft' | 'hard'

/**
 * Least protective first, for the majority rule's even-split tiebreak
 * (p. 12) and for folding an unresolved split down to the weakest cover
 * present.
 */
const PROTECTION_ORDER: readonly CoverGrade[] = ['open', 'soft', 'hard']

/**
 * Which cover grade standing on (in contact with) each terrain type gives
 * (p. 12–13): bushes/scrub/a wood's fringe are SOFT; rocks, a ridgeline or a
 * solid structure are HARD. The book names features, not terrain types, so
 * this is this engine's own reading of which of Stargrunt's eleven terrain
 * types (chapter 9, spec 02 §2.4.1) and which of Dirtside's imported extras
 * (mountains, a ford) stand in for them [reading]. Woods are handled
 * separately below, since edge and within differ (p. 12, spec 01 §3.5); so
 * are walls and hedges, since their cover is directional (p. 12–13, see
 * `figureCoverGrade`) rather than a blob a figure simply stands in.
 *
 * `urban` deliberately has no entry: it is the town's own enclosing area,
 * not a structure (Dirtside p. 46) — Stargrunt reads its pieces instead
 * (`terrainAt`, above), so a figure standing in a street or a yard between
 * buildings, on the `urban` ground itself, is in the open, exactly as p. 22's
 * silence on any town-wide cover bonus implies.
 */
const TERRAIN_COVER: Partial<Record<TerrainType, CoverGrade>> = {
  road: 'open',
  open: 'open',
  cultivated: 'open',
  swamp: 'open',
  'open-water': 'open',
  river: 'open',
  ford: 'open',
  'light-scrub': 'soft',
  rough: 'hard', // "rocks, gullies, thick scrub" (p. 22) reads as the rocks/boulders hard cover of p. 12–13
  hills: 'hard', // stands in for a hill crest or ridgeline (p. 12–13); "slopes" is Stargrunt's own name for this ground (p. 22)
  mountains: 'hard', // not one of Stargrunt's own eleven terrain types (spec 02 §2.4.1); folded into the same hard cover as hills/slopes [reading]
  building: 'hard', // "a solid structure" (p. 12–13), unconditional: inside its footprint, not merely behind one of its walls
  rubble: 'hard', // broken masonry reads as the same rocks/boulders hard cover as `rough` (Stargrunt p. 57, Dirtside p. 46)
}

/** The cover a terrain type gives a figure standing in contact with it, open ground if the type gives none. */
export function terrainCoverGrade(terrain: TerrainType): CoverGrade {
  return TERRAIN_COVER[terrain] ?? 'open'
}

export type WoodPosture = 'edge' | 'within' | null

/** Whether a point is on the edge of a wood, within one, or in neither (p. 12, spec 01 §3.5). */
export function woodPostureOf(point: Point, features: readonly TerrainFeature[]): WoodPosture {
  return woodAt(point, features)?.where ?? null
}

/** How close the point where the firer's line crosses a wall, a hedge, or a building's own wall must land to the figure for that figure to claim cover from it (p. 12–13's diagram and p. 47's artillery example both draw the cover as belonging to whichever side of the obstacle the figure stands hard against, not anywhere along its length). */
export const WALL_HEDGE_REACH = 1.5

/** A shape's own boundary as a list of edges: a wall/hedge's open polyline, or a closed rect/polygon's ring — a circle has none (it never stands in for a linear obstacle). */
function edgesOf(shape: Shape): Array<[Point, Point]> {
  switch (shape.kind) {
    case 'path': {
      const out: Array<[Point, Point]> = []
      for (let i = 1; i < shape.points.length; i++) out.push([shape.points[i - 1]!, shape.points[i]!])
      return out
    }
    case 'polygon': {
      const out: Array<[Point, Point]> = []
      for (let i = 0; i < shape.points.length; i++) out.push([shape.points[i]!, shape.points[(i + 1) % shape.points.length]!])
      return out
    }
    case 'rect': {
      const { x, y, width, height } = shape
      const pts = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
      return pts.map((p, i): [Point, Point] => [p, pts[(i + 1) % pts.length]!])
    }
    case 'circle':
      return []
  }
}

/** Where two segments cross, or null if they don't (parallel, or crossing outside either segment's own span). */
function segmentCrossing(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d1x = a2.x - a1.x
  const d1y = a2.y - a1.y
  const d2x = b2.x - b1.x
  const d2y = b2.y - b1.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a1.x + t * d1x, y: a1.y + t * d1y }
}

/** Whether the line from `firer` to `figure` crosses this shape's own boundary within `WALL_HEDGE_REACH` of the figure (p. 12–13): the directional test behind wall, hedge and building-wall cover alike. */
function shieldedBy(firer: Point, figure: Point, shape: Shape): boolean {
  for (const [a, b] of edgesOf(shape)) {
    const hit = segmentCrossing(firer, figure, a, b)
    if (!hit || distance(hit, figure) > WALL_HEDGE_REACH) continue
    // Strictly on opposite sides: a figure standing on the wall's own line is behind it from neither side.
    const side = (p: Point) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))
    const figureSide = side(figure)
    const firerSide = side(firer)
    if (figureSide !== 0 && firerSide !== 0 && figureSide !== firerSide) return true
  }
  return false
}

function strongerGrade(a: CoverGrade, b: CoverGrade): CoverGrade {
  return PROTECTION_ORDER.indexOf(a) >= PROTECTION_ORDER.indexOf(b) ? a : b
}

/**
 * A spot in the lee of a wall or a hedge (p. 12–13): on the nearest stretch
 * of it to `near` (where a unit heading for this cover is coming from),
 * pushed `WALL_HEDGE_REACH`'s own margin to the side away from `enemy` so
 * the directional test above actually grants cover once the unit gets
 * there. Null for a shape with no edges of its own to stand behind (a
 * circle), or a degenerate single-point path.
 */
export function leeOfObstacle(shape: Shape, near: Point, enemy: Point): Point | null {
  let best: { point: Point; normal: Point; dist: number } | null = null
  for (const [a, b] of edgesOf(shape)) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq < 1e-9) continue
    const t = Math.max(0, Math.min(1, ((near.x - a.x) * dx + (near.y - a.y) * dy) / lenSq))
    const point = { x: a.x + t * dx, y: a.y + t * dy }
    const dist = distance(near, point)
    if (!best || dist < best.dist) {
      const len = Math.sqrt(lenSq)
      best = { point, normal: { x: -dy / len, y: dx / len }, dist }
    }
  }
  if (!best) return null
  const towardEnemy = { x: enemy.x - best.point.x, y: enemy.y - best.point.y }
  const sign = best.normal.x * towardEnemy.x + best.normal.y * towardEnemy.y > 0 ? -1 : 1
  const margin = WALL_HEDGE_REACH * 0.6
  return { x: best.point.x + best.normal.x * sign * margin, y: best.point.y + best.normal.y * sign * margin }
}

/**
 * A figure's cover grade at a point (p. 12–13). A wood's edge is SOFT; a
 * figure WITHIN a wood cannot be fired on by direct fire or small arms at
 * all (spec 01 §3.5) rather than merely being well covered, so this
 * returns HARD there as the closest ordinary grade — callers that need the
 * wood's actual firing restriction should check `woodPostureOf` directly
 * rather than read it off this grade.
 *
 * With `firer` given, a wall gives HARD cover and a hedge SOFT, and a
 * building's own wall gives the same HARD cover to a figure standing in
 * contact just outside it (not only to one inside its footprint, which is
 * already unconditionally HARD via `terrainCoverGrade` above) — but only
 * against a firer on the far side of the nearest stretch of it (p. 12–13,
 * `shieldedBy`). Without a firer (a unit checking its own present cover,
 * not cover against anyone in particular), only the non-directional ground
 * cover applies.
 */
export function figureCoverGrade(point: Point, features: readonly TerrainFeature[], firer?: Point): CoverGrade {
  const wood = woodPostureOf(point, features)
  if (wood === 'edge') return 'soft'
  if (wood === 'within') return 'hard'
  let grade = terrainCoverGrade(terrainAt(point, features))
  if (!firer || grade === 'hard') return grade
  for (const feature of features) {
    if (feature.terrain === 'wall' && shieldedBy(firer, point, feature.shape)) grade = strongerGrade(grade, 'hard')
    else if (feature.terrain === 'hedge' && shieldedBy(firer, point, feature.shape)) grade = strongerGrade(grade, 'soft')
    else if (feature.terrain === 'building' && shieldedBy(firer, point, feature.shape)) grade = strongerGrade(grade, 'hard')
    if (grade === 'hard') break
  }
  return grade
}

/**
 * The unit's cover grade, by the majority rule (p. 12): whichever grade
 * more than half the figures are in; on an exact split (or, generalising
 * a three-way split the book never considers) the least protective grade
 * present, never a grade nobody without a majority is actually in.
 */
export function unitCoverGrade(figureGrades: readonly CoverGrade[]): CoverGrade {
  if (figureGrades.length === 0) return 'open'
  const counts: Record<CoverGrade, number> = { open: 0, soft: 0, hard: 0 }
  for (const grade of figureGrades) counts[grade] += 1
  for (const grade of PROTECTION_ORDER) if (counts[grade] * 2 > figureGrades.length) return grade
  for (const grade of PROTECTION_ORDER) if (counts[grade] > 0) return grade
  return 'open'
}

/**
 * Whether a unit counts as visible to a firer (p. 11–12): at least half its
 * figures in view is enough for the whole unit to be a legal target.
 */
export function unitVisible(figureVisible: readonly boolean[]): boolean {
  if (figureVisible.length === 0) return false
  return figureVisible.filter(Boolean).length * 2 >= figureVisible.length
}

// ---------------------------------------------------------------------------
// Line of sight, line of fire, range (p. 11–12)
// ---------------------------------------------------------------------------

export interface SightResult {
  clear: boolean
  blockedBy: TerrainFeature | null
  reason: string | null
  range: number
}

/** What blocks Stargrunt's own line of sight (p. 11): raised ground, woods and buildings, like Dirtside's own list, but never the enclosing `urban` area a town's pieces stand in — Stargrunt has no area-urban terrain type of its own (p. 22), so only the pieces (buildings) can block, not the ground they stand on. */
const SIGHT_BLOCKERS: readonly TerrainType[] = BLOCKS_SIGHT.filter((t) => t !== 'urban')

/**
 * Line of sight (p. 11): a straight line that touches no raised ground,
 * building or wood between the two points, with NO distance limit in
 * normal conditions [reading, spec 01 §3.2] — a scenario may impose one of
 * its own for weather/exotic environments (p. 57, out of this file's
 * scope), but the base engine does not. Line of fire is the identical
 * check (p. 11): a clear line of sight is what fire needs too, so this one
 * function serves both.
 */
export function lineOfSight(from: Point, to: Point, features: readonly TerrainFeature[]): SightResult {
  const range = distance(from, to)
  const fromWood = woodAt(from, features)
  const toWood = woodAt(to, features)
  if (fromWood?.where === 'within') return { clear: false, blockedBy: fromWood.feature, reason: 'the firer is within a wood', range }
  if (toWood?.where === 'within') return { clear: false, blockedBy: toWood.feature, reason: 'the target is within a wood', range }
  const fromHigh = onHighGround(from, features)
  const toHigh = onHighGround(to, features)
  const samples = samplesAlong(from, to, 0.2)
  for (const feature of features) {
    if (!SIGHT_BLOCKERS.includes(feature.terrain)) continue
    const high = HIGH_GROUND.includes(feature.terrain)
    // A figure inside a building sees out and is seen through its own walls, at the windows [reading] —
    // the whole line is that building's own case, exactly like standing on high ground, not merely its
    // first inch as a wood's edge allows; a *different* building on the line still blocks it below.
    const solid = feature.terrain === 'building'
    const fromIn = insideShape(from, feature.shape)
    const toIn = insideShape(to, feature.shape)
    if ((high || solid) && (fromIn || toIn)) continue
    if (!high && (fromHigh || toHigh)) continue
    for (const sample of samples) {
      if (!insideShape(sample, feature.shape)) continue
      if (fromIn && distance(sample, from) <= WOOD_EDGE) continue
      if (toIn && distance(sample, to) <= WOOD_EDGE) continue
      return { clear: false, blockedBy: feature, reason: `${feature.label ?? feature.terrain} in the way`, range }
    }
  }
  return { clear: true, blockedBy: null, reason: null, range }
}

/** Line of fire (p. 11) is the same clear-straight-line test as line of sight. */
export const lineOfFire = lineOfSight

/**
 * A group's approximate centre (p. 11–12): "normally the middle figure"; an
 * arithmetic mean is this engine's stand-in for that judgement call
 * [reading] — close enough for range/LOS purposes, and the book itself
 * says ties are for the players (or an umpire's die roll) to settle.
 */
export function unitCentre(positions: readonly Point[]): Point {
  if (positions.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of positions) {
    x += p.x
    y += p.y
  }
  return { x: x / positions.length, y: y / positions.length }
}

/** Range between two units (p. 11–12): the distance between their centres. */
export function rangeBetweenUnits(centreA: Point, centreB: Point): number {
  return distance(centreA, centreB)
}

// ---------------------------------------------------------------------------
// Unit integrity (p. 11, spec 01 §3.1)
// ---------------------------------------------------------------------------

function circleFromTwo(a: Point, b: Point): { centre: Point; radius: number } {
  const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return { centre, radius: distance(a, centre) }
}

function circleFromThree(a: Point, b: Point, c: Point): { centre: Point; radius: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-9) return null // collinear: no unique circumcircle
  const aSq = a.x * a.x + a.y * a.y
  const bSq = b.x * b.x + b.y * b.y
  const cSq = c.x * c.x + c.y * c.y
  const ux = (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d
  const uy = (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d
  const centre = { x: ux, y: uy }
  return { centre, radius: distance(a, centre) }
}

/**
 * The smallest circle enclosing every point, by brute force over every pair
 * and triple — a squad has a handful of figures, so the O(n³) search costs
 * nothing and needs no external geometry library.
 */
export function minEnclosingCircle(points: readonly Point[]): { centre: Point; radius: number } {
  if (points.length === 0) return { centre: { x: 0, y: 0 }, radius: 0 }
  if (points.length === 1) return { centre: points[0]!, radius: 0 }
  const within = (c: { centre: Point; radius: number }) => points.every((p) => distance(p, c.centre) <= c.radius + 1e-6)
  let best: { centre: Point; radius: number } | null = null
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const c = circleFromTwo(points[i]!, points[j]!)
      if (within(c) && (!best || c.radius < best.radius)) best = c
    }
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const c = circleFromThree(points[i]!, points[j]!, points[k]!)
        if (c && within(c) && (!best || c.radius < best.radius)) best = c
      }
    }
  }
  return best ?? { centre: points[0]!, radius: 0 }
}

function isChainConnected(positions: readonly Point[], radius: number): boolean {
  const n = positions.length
  const seen = new Array<boolean>(n).fill(false)
  const stack = [0]
  seen[0] = true
  let count = 1
  while (stack.length > 0) {
    const i = stack.pop()!
    for (let j = 0; j < n; j++) {
      if (seen[j]) continue
      if (distance(positions[i]!, positions[j]!) <= radius + 1e-6) {
        seen[j] = true
        count += 1
        stack.push(j)
      }
    }
  }
  return count === n
}

/**
 * A unit is in integrity (p. 11) iff EITHER all its figures fit inside a 6"
 * diameter circle, OR every figure is within 2" of at least one other
 * figure of the same unit — a connected chain, not a clique (the book's own
 * example is a 4-figure column with three consecutive 2" gaps).
 */
export function isInIntegrity(positions: readonly Point[]): boolean {
  if (positions.length < 2) return true
  const circle = minEnclosingCircle(positions)
  if (circle.radius * 2 <= 6 + 1e-6) return true
  return isChainConnected(positions, 2)
}
