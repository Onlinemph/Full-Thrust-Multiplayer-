import { type CSSProperties, memo, type ReactNode, useMemo } from 'react'

import type { TerrainType } from '../../../dirtside/data/mobility'
import { WOOD_EDGE, insideShape } from '../../../dirtside/table/terrain'
import type { Point, Shape, TerrainFeature } from '../../../dirtside/table/types'
import { FURROWS, patternUrl } from './defs'
import { centreOf, decorRandom, hash, insetShape, interiorLabelPoint, pts, round, textWidth } from './geometry'

/**
 * The ground as a printed wargame map: every terrain type the engine knows
 * drawn with a base colour, a texture, an edge a player can read (a canopy
 * rim, contour steps, a hedgerow, a shoreline) and its name. Roads and
 * rivers are drawn at their real width, which is the band the going applies to.
 */

/** Plain names for the terrain types, for labels, the legend and the readout. */
export const TERRAIN_NAMES: Record<TerrainType, string> = {
  road: 'Road',
  open: 'Open ground',
  'light-scrub': 'Light scrub',
  rough: 'Rough ground',
  cultivated: 'Fields',
  urban: 'Built-up area',
  hills: 'Hill',
  mountains: 'Mountain',
  swamp: 'Swamp',
  'open-water': 'Open water',
  river: 'River',
  'light-woods': 'Light woods',
  'dense-woods': 'Dense woods',
  ford: 'Ford',
  building: 'Building',
  rubble: 'Rubble',
  wall: 'Wall',
  hedge: 'Hedge',
}

/** What a terrain type does besides slowing movement, in plain words (p. 20, p. 26). */
export const TERRAIN_NOTES: Partial<Record<TerrainType, string>> = {
  'light-woods': `blocks sight; its first ${WOOD_EDGE}" is the edge: soft cover, sees out`,
  'dense-woods': `blocks sight; its first ${WOOD_EDGE}" is the edge: soft cover, sees out`,
  hills: 'blocks sight; high ground sees over woods and towns',
  mountains: 'blocks sight; high ground sees over woods and towns',
  urban: 'blocks sight; cover for infantry',
  road: 'fast going along it',
  river: 'slow to cross except at a ford',
  ford: 'the crossing point of a river',
  'open-water': 'impassable to most, easy for hover and grav',
  building: 'blocks sight; cover by contact',
  rubble: 'no longer blocks sight; still cover by contact',
  wall: 'cover from the side it faces the shot',
  hedge: 'cover from the side it faces the shot',
}

const fill = (name: string): CSSProperties => ({ fill: `var(--dst-${name})` })
const line = (name: string, width: number, dash?: string): CSSProperties => ({ stroke: `var(--dst-${name})`, strokeWidth: width, strokeDasharray: dash, fill: 'none' })

/** A circle or rectangle as an SVG shape with the given style. */
export function ShapeEl({ shape, style, className, dx = 0, dy = 0, rx }: { shape: Shape; style?: CSSProperties; className?: string; dx?: number; dy?: number; rx?: number }) {
  if (shape.kind === 'circle') return <circle cx={shape.centre.x + dx} cy={shape.centre.y + dy} r={shape.radius} style={style} className={className} />
  if (shape.kind === 'rect') return <rect x={shape.x + dx} y={shape.y + dy} width={shape.width} height={shape.height} rx={rx} style={style} className={className} />
  if (shape.kind === 'polygon') return <polygon points={pts(shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })))} style={style} className={className} />
  return <polyline points={pts(shape.points)} style={{ fill: 'none', strokeWidth: shape.width, strokeLinecap: 'round', strokeLinejoin: 'round', ...style }} className={className} />
}

const SHADOW: CSSProperties = { fill: 'var(--dst-shadow)' }

function Shadow({ shape }: { shape: Shape }) {
  return <ShapeEl shape={shape} dx={0.12} dy={0.18} style={SHADOW} />
}

/** Contour steps inward every `step` inches, nudged north-west, each lighter than the last. */
function Contours({ shape, step, colours, lineColour }: { shape: Shape; step: number; colours: string[]; lineColour: string }) {
  const out: ReactNode[] = []
  for (let i = 1; i < 12; i++) {
    const inner = insetShape(shape, i * step)
    if (!inner) break
    if (inner.kind === 'circle' && inner.radius < 0.6) break
    const nudge = Math.min(0.15 * i, i * step - 0.1)
    out.push(<ShapeEl key={i} shape={inner} dx={-nudge * 0.8} dy={-nudge} rx={inner.kind === 'rect' ? Math.min(0.2 * i, 1.2) : undefined} style={{ fill: colours[Math.min(i - 1, colours.length - 1)], stroke: lineColour, strokeWidth: 0.05 }} />)
  }
  return <>{out}</>
}

// ---------------------------------------------------------------------------
// Buildings, rubble, and the park/plaza a settlement's own square becomes.
// A building or a ruin is drawn to its own scale (a fraction of its own
// footprint, not a fixed inch measure), so the same look reads right at a
// Dirtside platoon's half-inch cottage and a Stargrunt squad's seven-inch
// block alike (BRIEF-TERRAIN's two scales).
// ---------------------------------------------------------------------------

function bboxOf(points: readonly Point[]) {
  let x0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }
}

/**
 * A rectangular footprint's ridge: the line joining the midpoints of its two
 * short sides (so it runs the long way, as a real roof ridge does) and the
 * quad of one long half, for a shaded side. Null for anything but a plain
 * four-point rectangle — an L-shaped footprint (`lShapeLocal`'s six points)
 * reads as a flat roof instead, no ridge to find.
 */
function ridgeSplit(points: readonly Point[]): { line: [Point, Point]; shade: Point[] } | null {
  if (points.length !== 4) return null
  const [p0, p1, p2, p3] = points as [Point, Point, Point, Point]
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const len = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  if (len(p0, p1) >= len(p1, p2)) {
    const m12 = mid(p1, p2)
    const m30 = mid(p3, p0)
    return { line: [m30, m12], shade: [p0, p1, m12, m30] }
  }
  const m01 = mid(p0, p1)
  const m23 = mid(p2, p3)
  return { line: [m01, m23], shade: [m01, p1, p2, m23] }
}

/**
 * A building from above (Dirtside p. 46, Stargrunt p. 56): a drop shadow, a
 * sliver of wall under the eaves, a roof inset toward its own centre. A
 * plain rectangle gets a ridge line along its long axis and a shaded half;
 * an L-shaped footprint gets a flat roof with one rooftop detail instead.
 * Warm roofs for a building standing on its own or strung along a village
 * road (no `partOf`); cooler ones for a block inside a town or city — the
 * one distinction the data actually carries (BRIEF-TERRAIN's own model).
 */
function Building({ f }: { f: TerrainFeature }) {
  const s = f.shape
  if (s.kind !== 'polygon' || s.points.length < 4) return <ShapeEl shape={s} style={fill('building-wall')} />
  const box = bboxOf(s.points)
  const size = Math.max(0.15, Math.min(box.w, box.h))
  const rnd = decorRandom(hash(f.id))
  const cool = !!f.partOf
  const roofVars = cool ? ['roof-cool-1', 'roof-cool-2', 'roof-cool-3'] : ['roof-warm-1', 'roof-warm-2', 'roof-warm-3']
  const ridgeVar = cool ? 'roof-ridge-cool' : 'roof-ridge-warm'
  const roofVar = roofVars[Math.floor(rnd() * roofVars.length) % roofVars.length]!
  const centre = centreOf(s)
  const shrink = (frac: number, points: readonly Point[]) => points.map((p) => ({ x: centre.x + (p.x - centre.x) * (1 - frac), y: centre.y + (p.y - centre.y) * (1 - frac) }))
  const shadowPts = s.points.map((p) => ({ x: p.x + size * 0.1, y: p.y + size * 0.14 }))
  const roofPts = shrink(0.1, s.points)
  const ridge = ridgeSplit(s.points)
  return (
    <>
      <polygon points={pts(shadowPts)} style={SHADOW} />
      <polygon points={pts(s.points)} style={fill('building-wall')} />
      <polygon points={pts(roofPts)} style={{ ...fill(roofVar), stroke: `var(--dst-${ridgeVar})`, strokeWidth: size * 0.035 }} />
      {ridge ? (
        <>
          <polygon points={pts(shrink(0.1, ridge.shade))} fill="rgba(10,10,8,.18)" />
          <line
            x1={round(ridge.line[0]!.x + (centre.x - ridge.line[0]!.x) * 0.1)}
            y1={round(ridge.line[0]!.y + (centre.y - ridge.line[0]!.y) * 0.1)}
            x2={round(ridge.line[1]!.x + (centre.x - ridge.line[1]!.x) * 0.1)}
            y2={round(ridge.line[1]!.y + (centre.y - ridge.line[1]!.y) * 0.1)}
            stroke={`var(--dst-${ridgeVar})`}
            strokeWidth={size * 0.05}
            strokeLinecap="round"
            opacity={0.8}
          />
        </>
      ) : (
        <rect x={round(centre.x + (s.points[0]!.x - centre.x) * 0.35 - size * 0.06)} y={round(centre.y + (s.points[0]!.y - centre.y) * 0.35 - size * 0.06)} width={round(size * 0.12)} height={round(size * 0.12)} fill={`var(--dst-${ridgeVar})`} opacity={0.6} />
      )}
    </>
  )
}

/** What a destroyed building leaves (Dirtside p. 46, Stargrunt p. 57): a jagged outline, scattered debris, a stub or two of standing wall. */
function Ruin({ f }: { f: TerrainFeature }) {
  const s = f.shape
  if (s.kind !== 'polygon') return <ShapeEl shape={s} style={fill('rubble')} />
  const box = bboxOf(s.points)
  const size = Math.max(0.3, Math.min(box.w, box.h))
  const rnd = decorRandom(hash(f.id))
  const shadowPts = s.points.map((p) => ({ x: p.x + size * 0.05, y: p.y + size * 0.08 }))
  const debrisCount = Math.max(3, Math.round((box.w * box.h) / (size * 0.9)))
  const debris: ReactNode[] = []
  let guard = 0
  while (debris.length < debrisCount && guard++ < debrisCount * 8) {
    const x = box.x0 + rnd() * box.w
    const y = box.y0 + rnd() * box.h
    if (!insideShape({ x, y }, s)) continue
    const r = size * (0.06 + rnd() * 0.08)
    debris.push(<rect key={debris.length} x={round(x - r)} y={round(y - r * 0.7)} width={round(r * 2)} height={round(r * 1.4)} fill="var(--dst-rubble-dark)" opacity={0.85} transform={`rotate(${round(rnd() * 360)} ${round(x)} ${round(y)})`} />)
  }
  const stubs: ReactNode[] = []
  const stubCount = Math.max(1, Math.round(size / 1.6))
  for (let i = 0; i < stubCount; i++) {
    const x = box.x0 + rnd() * box.w
    const y = box.y0 + rnd() * box.h
    if (!insideShape({ x, y }, s)) continue
    const angle = rnd() * Math.PI * 2
    const len = size * (0.2 + rnd() * 0.18)
    stubs.push(<line key={i} x1={round(x - Math.cos(angle) * (len / 2))} y1={round(y - Math.sin(angle) * (len / 2))} x2={round(x + Math.cos(angle) * (len / 2))} y2={round(y + Math.sin(angle) * (len / 2))} stroke="var(--dst-rubble-stub)" strokeWidth={size * 0.14} strokeLinecap="round" />)
  }
  return (
    <>
      <polygon points={pts(shadowPts)} style={SHADOW} />
      <polygon points={pts(s.points)} style={{ fill: 'var(--dst-rubble)', stroke: 'var(--dst-rubble-dark)', strokeWidth: size * 0.04 }} />
      {stubs}
      {debris}
    </>
  )
}

/** A settlement's open square: paved (a town's square, a city's plaza) with a scatter of park trees — the same feature either way (`generate.ts`'s `squareBlock`, label `'park'`). */
function ParkSquare({ shape, id, pid }: { shape: Shape; id: string; pid: string }) {
  if (shape.kind !== 'rect') return <ShapeEl shape={shape} style={fill('paving')} />
  const rnd = decorRandom(hash(id) ^ 0x5061726b)
  const count = Math.max(3, Math.round((shape.width * shape.height) / 3))
  const trees: ReactNode[] = []
  for (let i = 0; i < count; i++) {
    const x = shape.x + 0.3 + rnd() * Math.max(0.1, shape.width - 0.6)
    const y = shape.y + 0.3 + rnd() * Math.max(0.1, shape.height - 0.6)
    const r = 0.16 + rnd() * 0.15
    trees.push(<circle key={i} cx={round(x)} cy={round(y)} r={round(r)} fill="var(--dst-woods-l-tree)" stroke="var(--dst-woods-l-rim)" strokeWidth={0.03} opacity={0.92} />)
  }
  return (
    <>
      <ShapeEl shape={shape} style={{ fill: patternUrl(pid, 'paving'), stroke: '#8a7f68', strokeWidth: 0.08 }} />
      {trees}
    </>
  )
}

function Feature({ f, pid }: { f: TerrainFeature; pid: string }) {
  const s = f.shape
  switch (f.terrain) {
    case 'light-woods':
    case 'dense-woods': {
      const light = f.terrain === 'light-woods'
      const edge = insetShape(s, WOOD_EDGE)
      return (
        <>
          <Shadow shape={s} />
          <ShapeEl shape={s} style={{ ...line(light ? 'woods-l-rim' : 'woods-d-rim', light ? 0.86 : 0.96, light ? '0.01 0.6' : '0.01 0.55'), strokeLinecap: 'round' }} />
          <ShapeEl shape={s} style={{ ...fill(light ? 'woods-l' : 'woods-d'), stroke: light ? '#4b6b3e' : '#2f4a29', strokeWidth: light ? 0.7 : 0.8, strokeDasharray: light ? '0.01 0.6' : '0.01 0.55', strokeLinecap: 'round' }} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, light ? 'lwoods' : 'dwoods') }} />
          {edge && (edge.kind !== 'circle' || edge.radius > 0.5) ? <ShapeEl shape={edge} className="dst-wood-edge" /> : null}
        </>
      )
    }
    case 'hills':
      return (
        <>
          <Shadow shape={s} />
          <ShapeEl shape={s} rx={s.kind === 'rect' ? 0.4 : undefined} style={{ ...fill('hill'), stroke: '#5a4b2c', strokeWidth: 0.09 }} />
          <Contours shape={s} step={1} colours={['var(--dst-hill-step-1)', 'var(--dst-hill-step-2)', 'var(--dst-hill-step-3)', 'var(--dst-hill-step-4)']} lineColour="var(--dst-hill-line)" />
        </>
      )
    case 'mountains':
      return (
        <>
          <Shadow shape={s} />
          <ShapeEl shape={s} style={{ ...fill('mountain'), stroke: '#4a4236', strokeWidth: 0.1 }} />
          <Contours shape={s} step={0.7} colours={['var(--dst-mountain-step-1)', 'var(--dst-mountain-step-2)', 'var(--dst-mountain-step-3)', 'var(--dst-mountain-step-4)', 'var(--dst-mountain-step-5)']} lineColour="var(--dst-mountain-line)" />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'mountain') }} />
        </>
      )
    case 'rough':
      // A settlement's own open square, paved rather than rubble-and-scree (generate.ts's `squareBlock`, §7 of impact.md).
      if (f.label === 'park') return <ParkSquare shape={s} id={f.id} pid={pid} />
      return (
        <>
          <ShapeEl shape={s} style={fill('rough')} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'rough'), stroke: '#555240', strokeWidth: 0.07, strokeDasharray: '0.3 0.15' }} />
        </>
      )
    case 'light-scrub':
      return (
        <>
          <ShapeEl shape={s} style={fill('scrub')} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'scrub'), stroke: '#4f5a31', strokeWidth: 0.1, strokeDasharray: '0.01 0.28', strokeLinecap: 'round' }} />
        </>
      )
    case 'cultivated': {
      const deg = FURROWS[hash(f.id) % FURROWS.length]!
      return (
        <>
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, `furrow-${deg}`) }} />
          <ShapeEl shape={s} style={{ ...line('hedge', 0.3, '0.01 0.32'), strokeLinecap: 'round' }} />
        </>
      )
    }
    case 'urban':
      // The area's own ground: paving and yards. Its buildings, streets and rubble are real `partOf` features
      // drawn in their own turn below, not decoration invented here (BRIEF-TERRAIN's model; impact.md §7).
      return (
        <>
          <Shadow shape={s} />
          <ShapeEl shape={s} style={{ ...fill('urban'), stroke: 'var(--dst-urban-edge)', strokeWidth: 0.1 }} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'lot') }} />
        </>
      )
    case 'building':
      return <Building f={f} />
    case 'rubble':
      return <Ruin f={f} />
    case 'wall':
      if (s.kind !== 'path') return <ShapeEl shape={s} style={fill('wall-stone')} />
      return (
        <>
          <ShapeEl shape={s} style={{ stroke: 'var(--dst-rubble-dark)', strokeWidth: s.width + 0.05 }} />
          <ShapeEl shape={s} style={{ stroke: 'var(--dst-wall-stone)' }} />
          <polyline points={pts(s.points)} style={{ fill: 'none', stroke: 'rgba(255,255,255,.14)', strokeWidth: s.width * 0.3, strokeDasharray: `${round(s.width * 0.55)} ${round(s.width * 0.6)}`, strokeLinecap: 'round' }} />
        </>
      )
    case 'hedge':
      // Thicker and two-toned on purpose: a field's own edge already carries a thin decorative hedge line
      // (the 'cultivated' case above), so a real hedge — one Stargrunt actually reads for directional cover —
      // needs to stand out from that as a distinctly bushier line, not blend into the same thin dashes.
      if (s.kind !== 'path') return <ShapeEl shape={s} style={fill('hedge')} />
      return (
        <>
          <ShapeEl shape={s} style={{ stroke: 'var(--dst-hedge)', strokeWidth: s.width + 0.3, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
          <polyline points={pts(s.points)} style={{ fill: 'none', stroke: 'var(--dst-woods-l-tree)', strokeWidth: s.width + 0.06, strokeDasharray: `${round(s.width * 0.55)} ${round(s.width * 0.4)}`, strokeLinecap: 'round' }} />
        </>
      )
    case 'swamp':
      return (
        <>
          <ShapeEl shape={s} style={fill('swamp')} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'swamp'), stroke: '#34493a', strokeWidth: 0.08, strokeDasharray: '0.05 0.2', strokeLinecap: 'round' }} />
        </>
      )
    case 'open-water':
      return (
        <>
          <ShapeEl shape={s} style={{ fill: 'none', stroke: 'var(--dst-bank)', strokeWidth: 0.36 }} />
          <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'water') }} />
        </>
      )
    case 'river':
      if (s.kind !== 'path') return <ShapeEl shape={s} style={{ fill: patternUrl(pid, 'water'), stroke: 'var(--dst-bank)', strokeWidth: 0.18 }} />
      return (
        <>
          <ShapeEl shape={{ ...s, width: s.width + 0.3 }} style={{ stroke: 'var(--dst-bank)' }} />
          <ShapeEl shape={s} style={{ stroke: 'var(--dst-water)' }} />
          <polyline points={pts(s.points)} style={{ fill: 'none', stroke: 'rgba(220,240,255,.22)', strokeWidth: s.width * 0.3, strokeDasharray: '0.6 0.9', strokeLinecap: 'round', strokeLinejoin: 'round' }} />
        </>
      )
    case 'ford':
      if (s.kind !== 'path') return <ShapeEl shape={s} style={{ fill: '#9fb8c8' }} />
      return (
        <>
          <ShapeEl shape={s} style={{ stroke: '#9fb8c8' }} />
          <polyline points={pts(s.points)} style={{ fill: 'none', stroke: '#e0d8c0', strokeWidth: 0.22, strokeDasharray: '0.18 0.22', strokeLinecap: 'round' }} />
        </>
      )
    case 'road':
      if (s.kind !== 'path') return <ShapeEl shape={s} style={fill('road')} />
      return (
        <>
          <ShapeEl shape={{ ...s, width: s.width + 0.3 }} style={{ stroke: 'var(--dst-verge)', strokeLinecap: 'butt' }} />
          <ShapeEl shape={s} style={{ stroke: f.majorHighway ? 'var(--dst-tarmac)' : 'var(--dst-road)', strokeLinecap: 'butt' }} />
          <polyline points={pts(s.points)} style={{ fill: 'none', stroke: f.majorHighway ? 'var(--dst-paper)' : '#a48f63', strokeWidth: f.majorHighway ? 0.08 : 0.07, strokeDasharray: f.majorHighway ? '0.6 0.5' : '0.35 0.45', strokeLinejoin: 'round' }} />
        </>
      )
    default:
      return <ShapeEl shape={s} style={fill('ground')} />
  }
}

function describe(f: TerrainFeature): string {
  const name = f.label && f.label.toLowerCase() !== TERRAIN_NAMES[f.terrain].toLowerCase() && f.label.toLowerCase() !== f.terrain.replace('-', ' ') ? `${f.label} (${TERRAIN_NAMES[f.terrain].toLowerCase()})` : TERRAIN_NAMES[f.terrain]
  const note = TERRAIN_NOTES[f.terrain]
  return note ? `${name}: ${note}` : name
}

/** Every feature, in the order the table lists them: later ones lie on top (p. 25). */
export const TerrainLayer = memo(function TerrainLayer({ features, pid }: { features: readonly TerrainFeature[]; pid: string }) {
  return (
    <g className="dst-terrain-layer">
      {features.map((f) => (
        <g key={f.id} className={`dst-feature is-${f.terrain}`}>
          <title>{describe(f)}</title>
          <Feature f={f} pid={pid} />
        </g>
      ))}
    </g>
  )
})

/** The area feature drawn on top at a point, ignoring roads and rivers laid across it. */
function topArea(p: Point, features: readonly TerrainFeature[]): TerrainFeature | null {
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]!
    if (f.shape.kind !== 'path' && insideShape(p, f.shape)) return f
  }
  return null
}

/** Where a feature's name may go: its middle first, then around it, so a wood half under a hill still gets named where it shows. */
function spots(shape: Shape): Point[] {
  const c = centreOf(shape)
  if (shape.kind === 'circle') {
    const out = [c]
    for (const f of [0.45, 0.65])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        out.push({ x: c.x + Math.sin(a) * shape.radius * f, y: c.y - Math.cos(a) * shape.radius * f })
      }
    return out
  }
  if (shape.kind === 'rect') {
    const out = [c]
    for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.25, 0.5, 0.75]) out.push({ x: shape.x + shape.width * fx, y: shape.y + shape.height * fy })
    return out
  }
  if (shape.kind === 'polygon') {
    // The centroid alone can land outside a lobed blob or between an L-shape's arms; the interior point
    // furthest from the boundary goes first, the centroid next, then a few points pulled in from its own
    // corners, so a label that collides with something else still has somewhere else to try (impact.md §7).
    const interior = interiorLabelPoint(shape)
    const out = [interior]
    if (Math.hypot(interior.x - c.x, interior.y - c.y) > 0.05) out.push(c)
    for (const p of shape.points) out.push({ x: c.x + (p.x - c.x) * 0.55, y: c.y + (p.y - c.y) * 0.55 })
    return out
  }
  return [c]
}

interface PlacedLabel {
  id: string
  at: Point
  text: string
  big: boolean
}

/** Each area's name where the area shows and no other name is, at the lettering's size for this zoom. */
function placeLabels(features: readonly TerrainFeature[], k: number, avoid: readonly Point[]): PlacedLabel[] {
  // Objective markers keep their capture ring clear of lettering.
  const boxes: Array<{ x0: number; x1: number; y0: number; y1: number }> = avoid.map((p) => ({ x0: p.x - 1, x1: p.x + 1, y0: p.y - 1, y1: p.y + 1 }))
  const out: PlacedLabel[] = []
  for (const f of features) {
    if (f.shape.kind === 'path') continue
    // A town or city is named once, for its own enclosing area; its buildings and ruins carry no name of
    // their own — the icon reads as what it is, and a block of them would otherwise repeat "BUILDING" over
    // and over (BRIEF-TERRAIN: "Label the town once, not each building").
    if (f.terrain === 'building' || f.terrain === 'rubble') continue
    const big = f.terrain === 'urban'
    const text = (f.label ?? TERRAIN_NAMES[f.terrain]).toUpperCase()
    const size = big ? 12 : 10.5
    const w = (textWidth(text, size, { display: true, spacing: 0.12 }) + 6) * k
    const h = size * 1.4 * k
    const shows = (p: Point) => topArea(p, features) === f
    const free = (p: Point) => boxes.every((b) => p.x + w / 2 < b.x0 || p.x - w / 2 > b.x1 || p.y + h / 2 < b.y0 || p.y - h / 2 > b.y1)
    const candidates = spots(f.shape)
    const at =
      candidates.find((p) => shows(p) && shows({ x: p.x - w * 0.4, y: p.y }) && shows({ x: p.x + w * 0.4, y: p.y }) && free(p)) ??
      candidates.find((p) => shows(p) && free(p))
    if (!at) continue
    boxes.push({ x0: at.x - w / 2, x1: at.x + w / 2, y0: at.y - h / 2, y1: at.y + h / 2 })
    out.push({ id: f.id, at, text, big })
  }
  return out
}

/** The names of areas, above every feature and under the counters, so no road hides a label. */
export const TerrainLabels = memo(function TerrainLabels({ features, k, avoid }: { features: readonly TerrainFeature[]; k: number; avoid: readonly Point[] }) {
  const labels = useMemo(() => placeLabels(features, k, avoid), [features, k, avoid])
  return (
    <g className="dst-terrain-labels" aria-hidden="true">
      {labels.map((l) => (
        <text key={l.id} x={l.at.x} y={l.at.y} className={`dst-area-label${l.big ? ' is-big' : ''}`}>
          {l.text}
        </text>
      ))}
    </g>
  )
})

/** Features of the given type drawn with a light outline: what the legend points at. */
export function TerrainOutline({ features, type, className = 'dst-feature-outline' }: { features: readonly TerrainFeature[]; type: TerrainType | null; className?: string }) {
  if (!type) return null
  return (
    <g className={className}>
      {features.filter((f) => f.terrain === type).map((f) => (
        <ShapeEl key={f.id} shape={f.shape} style={f.shape.kind === 'path' ? { fill: 'none', strokeWidth: f.shape.width + 0.4, stroke: 'rgba(255,255,255,.35)' } : undefined} />
      ))}
    </g>
  )
}
