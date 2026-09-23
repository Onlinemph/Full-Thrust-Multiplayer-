import { type CSSProperties, Fragment, memo, type ReactNode, useMemo } from 'react'

import type { TerrainType } from '../../../dirtside/data/mobility'
import { WOOD_EDGE, insideShape } from '../../../dirtside/table/terrain'
import type { Point, Shape, TerrainFeature } from '../../../dirtside/table/types'
import { FURROWS, patternUrl } from './defs'
import { blocksIn, centreOf, hash, insetShape, pts, textWidth } from './geometry'

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
}

const fill = (name: string): CSSProperties => ({ fill: `var(--dst-${name})` })
const line = (name: string, width: number, dash?: string): CSSProperties => ({ stroke: `var(--dst-${name})`, strokeWidth: width, strokeDasharray: dash, fill: 'none' })

/** A circle or rectangle as an SVG shape with the given style. */
export function ShapeEl({ shape, style, className, dx = 0, dy = 0, rx }: { shape: Shape; style?: CSSProperties; className?: string; dx?: number; dy?: number; rx?: number }) {
  if (shape.kind === 'circle') return <circle cx={shape.centre.x + dx} cy={shape.centre.y + dy} r={shape.radius} style={style} className={className} />
  if (shape.kind === 'rect') return <rect x={shape.x + dx} y={shape.y + dy} width={shape.width} height={shape.height} rx={rx} style={style} className={className} />
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
      return (
        <>
          <Shadow shape={s} />
          <ShapeEl shape={s} style={{ ...fill('urban'), stroke: 'var(--dst-urban-edge)', strokeWidth: 0.1 }} />
          <g>
            {blocksIn(s, f.id).map((b, i) => (
              <Fragment key={i}>
                <rect x={b.x + 0.08} y={b.y + 0.1} width={b.w} height={b.h} style={SHADOW} />
                <rect x={b.x} y={b.y} width={b.w} height={b.h} style={{ ...fill('urban-roof'), stroke: '#3b3934', strokeWidth: 0.04 }} />
                <line x1={b.x + 0.06} x2={b.x + b.w - 0.06} y1={b.y + b.h / 2} y2={b.y + b.h / 2} stroke="rgba(59,57,52,.45)" strokeWidth={0.03} />
              </Fragment>
            ))}
          </g>
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
