import { type Going, type MobilityFamily, mobilityFamily } from '../../../dirtside/data/mobility'
import { inDeploymentZone } from '../../../dirtside/table/game'
import { distance, pathCost } from '../../../dirtside/table/terrain'
import type { GameSetup, Point, Shape, SideId, TerrainFeature } from '../../../dirtside/table/types'
import type { InfantryElement, VehicleDesign } from '../../../dirtside/types'

/**
 * The table map's arithmetic: nothing here decides a rule. Shapes inset for
 * contour lines, polylines cut where the going changes, how far a vehicle
 * could get in a straight line for what it has left, and which silhouette a
 * design is drawn with.
 */

export const pts = (points: readonly Point[]) => points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
export const round = (n: number) => Math.round(n * 1000) / 1000

/** A stable number from a feature id, so a field's furrows and a town's blocks stay put between renders. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small seeded generator for decoration only (never for a rule). */
export function decorRandom(seed: number): () => number {
  let s = seed || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A shape shrunk by `by` inches, or null once nothing is left of it. */
export function insetShape(shape: Shape, by: number): Shape | null {
  if (shape.kind === 'circle') return shape.radius - by > 0.05 ? { ...shape, radius: shape.radius - by } : null
  if (shape.kind === 'rect') return shape.width - 2 * by > 0.1 && shape.height - 2 * by > 0.1 ? { kind: 'rect', x: shape.x + by, y: shape.y + by, width: shape.width - 2 * by, height: shape.height - 2 * by } : null
  return null
}

/** The middle of a feature, where its name goes. */
export function centreOf(shape: Shape): Point {
  if (shape.kind === 'circle') return shape.centre
  if (shape.kind === 'rect') return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
  const i = Math.floor((shape.points.length - 1) / 2)
  const a = shape.points[i]!
  const b = shape.points[Math.min(i + 1, shape.points.length - 1)]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** The point `at` inches along a polyline. */
export function pointAlong(points: readonly Point[], at: number): Point {
  let left = at
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const d = distance(a, b)
    if (left <= d || i === points.length - 1) {
      const t = d < 1e-9 ? 0 : Math.min(1, left / d)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    left -= d
  }
  return points[0] ?? { x: 0, y: 0 }
}

/**
 * A polyline cut into runs of the same going, from the legs a path cost
 * reports in path order: what the move plot colours stretch by stretch.
 */
export function splitByLegs(points: readonly Point[], legs: ReadonlyArray<{ going: Going; length: number }>): Array<{ going: Going; points: Point[] }> {
  const out: Array<{ going: Going; points: Point[] }> = []
  if (points.length < 2) return out
  // Cumulative distance of every vertex.
  const at: number[] = [0]
  for (let i = 1; i < points.length; i++) at.push(at[i - 1]! + distance(points[i - 1]!, points[i]!))
  let start = 0
  for (const leg of legs) {
    const end = start + leg.length
    const run: Point[] = [pointAlong(points, start)]
    for (let i = 1; i < points.length - 1; i++) if (at[i]! > start + 1e-6 && at[i]! < end - 1e-6) run.push(points[i]!)
    run.push(pointAlong(points, end))
    const last = out[out.length - 1]
    if (last && last.going === leg.going) last.points.push(...run.slice(1))
    else out.push({ going: leg.going, points: run })
    start = end
  }
  return out
}

/**
 * How far a vehicle could get from `from` along each of `rays` straight
 * lines for `budget` movement factors: the reach the move plot draws. Each
 * ray is found by halving on the real path cost, so woods, roads and water
 * bend it exactly as a move would be charged.
 */
export function reachPolygon(from: Point, budget: number, family: MobilityFamily, features: readonly TerrainFeature[], opts: { amphibious?: boolean; travel?: boolean } = {}, rays = 48): Point[] {
  if (budget <= 0.01) return []
  const longest = budget * (opts.travel ? 2 : 1)
  const out: Point[] = []
  for (let r = 0; r < rays; r++) {
    const angle = (r / rays) * Math.PI * 2
    const dir = { x: Math.sin(angle), y: -Math.cos(angle) }
    const end = (len: number) => ({ x: from.x + dir.x * len, y: from.y + dir.y * len })
    const fits = (len: number) => {
      const cost = pathCost([from, end(len)], family, features, opts)
      return !cost.blockedAt && cost.factors <= budget + 1e-6
    }
    let lo = 0
    let hi = longest
    if (fits(hi)) lo = hi
    else
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    out.push(end(lo))
  }
  return out
}

/** Where a side may set up, as a band of the table's depth, read off the deployment rule itself (p. 17). */
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

// ---------------------------------------------------------------------------
// Lettering
// ---------------------------------------------------------------------------

let measure: CanvasRenderingContext2D | null | undefined
const widths = new Map<string, number>()

/**
 * The width in pixels of a line of map lettering, measured in the font the
 * page actually has, so a chip's box fits its words; an estimate erring wide
 * where there is no page to measure in.
 */
export function textWidth(text: string, size: number, opts: { bold?: boolean; display?: boolean; spacing?: number } = {}): number {
  const bold = opts.bold ?? true
  const key = `${text}|${size}|${bold ? 1 : 0}|${opts.display ? 1 : 0}|${opts.spacing ?? 0}`
  const known = widths.get(key)
  if (known !== undefined) return known
  if (measure === undefined) {
    try {
      measure = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      measure = null
    }
  }
  let w: number
  if (measure) {
    const family = getComputedStyle(document.documentElement).getPropertyValue(opts.display ? '--font-display' : '--font-body').trim() || 'sans-serif'
    measure.font = `${bold ? 700 : 400} ${size}px ${family}`
    w = measure.measureText(text).width
  } else {
    w = [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0.35 : /[A-Z0-9%]/.test(ch) ? 0.75 : /[il.,·:'"|]/.test(ch) ? 0.34 : 0.64), 0) * size
  }
  w += (opts.spacing ?? 0) * size * text.length
  widths.set(key, w)
  return w
}

// ---------------------------------------------------------------------------
// Silhouettes
// ---------------------------------------------------------------------------

/** What carries the model: the running gear drawn under its body. */
export type Gear = 'tracks' | 'wheels' | 'skirt' | 'grav' | 'legs' | 'rotor' | 'wings' | 'hull'
/** What sits on top: the part that tells a tank from a carrier from a gun. */
export type Body = 'turret' | 'carrier' | 'ifv' | 'artillery' | 'air-defence' | 'plain'

export interface Silhouette {
  gear: Gear
  body: Body
  /** A family name for the legend and the tooltip: "tank", "carrier", "hover tank". */
  label: string
}

/** Which silhouette a vehicle design is drawn with, from its mobility, weapons, transport and artillery. */
export function silhouetteOf(design: VehicleDesign): Silhouette {
  const m = design.mobility
  let gear: Gear
  if (m === 'vtol') gear = 'rotor'
  else if (m === 'aerospace') gear = 'wings'
  else if (m === 'boat' || m === 'hydrofoil') gear = 'hull'
  else {
    const family = mobilityFamily(m)
    gear = family === 'tracked' ? 'tracks' : family === 'gev' ? 'skirt' : family === 'grav' ? 'grav' : family === 'walker' ? 'legs' : 'wheels'
  }
  const armed = design.weapons.length > 0 || design.missiles.length > 0
  const carries = design.transport.lineTeams + design.transport.poweredTeams > 0
  let body: Body
  if (design.artillery) body = 'artillery'
  else if (!armed && (design.ads || design.lad > 0)) body = 'air-defence'
  else if (carries) body = design.weapons.length > 0 ? 'ifv' : 'carrier'
  else if (design.weapons.length > 0) body = 'turret'
  else if (design.ads || design.lad > 0) body = 'air-defence'
  else body = 'plain'
  const gearWord: Record<Gear, string> = { tracks: '', wheels: 'wheeled ', skirt: 'hover ', grav: 'grav ', legs: 'walker ', rotor: 'VTOL ', wings: 'aerospace ', hull: 'boat ' }
  const bodyWord: Record<Body, string> = { turret: 'tank', carrier: 'carrier', ifv: 'fighting carrier', artillery: 'artillery', 'air-defence': 'air defence', plain: 'vehicle' }
  const label = gear === 'legs' ? (body === 'carrier' ? 'transport walker' : 'combat walker') : gear === 'rotor' || gear === 'wings' ? `${gearWord[gear]}${body === 'turret' ? 'gunship' : bodyWord[body]}`.trim() : `${gearWord[gear]}${bodyWord[body]}`
  return { gear, body, label }
}

/** A plain name for an infantry element: "line rifle team", "powered anti-armour team". */
export function infantryLabel(inf: InfantryElement): string {
  const team = { rifle: 'rifle', apsw: 'support weapon', assault: 'assault', observer: 'observer', 'anti-armour': 'anti-armour', 'air-defence': 'air-defence', engineer: 'engineer' }[inf.team]
  return `${inf.cavalry ? 'mounted ' : ''}${inf.troops} ${team} team`
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export interface Block {
  x: number
  y: number
  w: number
  h: number
}

/** Rows of buildings with streets between, laid out inside an urban area from its id so they never shuffle. */
export function blocksIn(shape: Shape, id: string): Block[] {
  const rnd = decorRandom(hash(id))
  const box = shape.kind === 'rect' ? { x: shape.x, y: shape.y, w: shape.width, h: shape.height } : shape.kind === 'circle' ? { x: shape.centre.x - shape.radius, y: shape.centre.y - shape.radius, w: shape.radius * 2, h: shape.radius * 2 } : null
  if (!box) return []
  const inside = (b: Block) => shape.kind !== 'circle' || [b.x, b.x + b.w].every((x) => [b.y, b.y + b.h].every((y) => distance({ x, y }, shape.centre) <= shape.radius - 0.2))
  const out: Block[] = []
  const street = 0.4
  let y = box.y + street
  while (y < box.y + box.h - street - 0.6) {
    const h = Math.min(0.9 + rnd() * 0.9, box.y + box.h - street - y)
    let x = box.x + street
    while (x < box.x + box.w - street - 0.5) {
      const w = Math.min(0.8 + rnd() * 1.1, box.x + box.w - street - x)
      const b = { x, y, w, h }
      if (w > 0.45 && rnd() > 0.12 && inside(b)) out.push(b)
      x += w + (rnd() > 0.8 ? street * 1.6 : street * 0.7)
    }
    y += h + street
  }
  return out
}
