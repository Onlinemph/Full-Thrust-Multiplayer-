import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { type MobilityFamily, type TerrainType, goingOf, mobilityFamily } from '../../dirtside/data/mobility'
import { distance, onTable, terrainAt, woodAt } from '../../dirtside/table/terrain'
import type { ElementState, GameState, Point, SideId } from '../../dirtside/table/types'
import { Board, BoardMarks, DeploymentZones } from './map/board'
import { Counter } from './map/counters'
import { MapDefs } from './map/defs'
import { Legend } from './map/Legend'
import { Chip, CraftMarks, Earthworks, IntegrityLinks, Objectives, Orbital, RecentMarks, Tags } from './map/marks'
import { AimPreview, DeployGhost, LandingPreview, MoveGhost, MovePlot, PendingLandings, Tape, Targeting } from './map/overlays'
import { TERRAIN_NAMES, TerrainLabels, TerrainLayer, TerrainOutline } from './map/terrain'
import { unitCodes } from './unitCodes'

/**
 * The table: terrain, objectives and the counters, in inches. Pan by
 * dragging, zoom with the wheel or the toolbar, click a counter to pick it,
 * click the ground to say where. Everything drawn is something a player
 * would see on a real table, plus the markers the rules put beside a model
 * and a preview of what the player is about to do.
 */
export interface TableMapProps {
  state: GameState
  selectedId: string | null
  onSelectElement: (id: string) => void
  onClickTable: (point: Point) => void
  /** Waypoints being plotted for a move, after the element's position. */
  plot: Point[]
  plotFrom: Point | null
  /** Inches of straight movement left, drawn as a ring. */
  reach: number | null
  /** Elements in the volley being built. */
  targets: string[]
  /** The element that just moved, when the other side is offered fire. */
  highlight: string | null
  /** Whose objective values to show; null shows none. */
  viewer: SideId | null
  /** Craft placed to come down this activation, with the 12" they must keep from enemies in sight (p. 43). */
  pendingLandings?: Array<{ at: Point; label: string }>

  // ---- Presentation props: all optional, all drawn by the map, none decides a rule.

  /** The side whose turn it is: the table frame takes its colour. */
  toAct?: SideId | null
  /** A unit to draw linked, hovered here or in the roster. */
  hoverUnitId?: string | null
  /** The pointer is over one of a unit's counters, or over none. */
  onHoverUnit?: (unitId: string | null) => void
  /** Fire being planned: each enemy element's verdict for the chosen firer and weapon, and the weapon's range bands in inches. */
  targeting?: TargetingOverlay | null
  /** A move being plotted: what the ghost path to the pointer costs, measured from the last waypoint. */
  moveBudget?: MoveBudget | null
  /** What just happened, drawn fading: the last moves and shots, most recent last. */
  recent?: RecentMark[]
  /** An orbital aim being chosen: the beaten zone follows the pointer. */
  aimPreview?: { radius: number } | null
  /** A craft being placed: its 12" clearance follows the pointer. */
  landingPreview?: { label: string } | null
  /** The pointer's shape for the mode the screen is in. */
  cursor?: 'default' | 'crosshair' | 'place' | 'move'
  /** A preview of the table: no clicks, no panning. */
  readOnly?: boolean
}

export interface TargetVerdict {
  ok: boolean
  /** Why not, in plain words, when the shot cannot be made. */
  reason?: string
  /** The odds line, when it can: "hit 63% · knocked out 51%". */
  odds?: string
  /** Range to the target in inches. */
  range?: number
}

export interface TargetingOverlay {
  firerId: string
  verdicts: Record<string, TargetVerdict>
  /** Close, medium and long reach of the weapon in inches, if it has bands. */
  bands?: number[]
}

export interface MoveBudget {
  family: MobilityFamily
  amphibious: boolean
  travel: boolean
  /** Movement factors left before the plotted path. */
  left: number
}

export type RecentMark =
  | { kind: 'move'; side: SideId; path: Point[] }
  | { kind: 'fire'; side: SideId; from: Point; to: Point; result: 'miss' | 'hit' | 'kill' }

/** A view of the table in inches: its top-left corner and width; the height follows the pane's shape. */
interface View {
  x: number
  y: number
  w: number
}

/** Room around the table for the rulers and the margin labels, in inches. */
const MARGIN = { left: 1.45, right: 1.45, top: 1.5, bottom: 0.75 }
/** A preview has no rulers or margin lettering: just the frame. */
const PREVIEW_MARGIN = { left: 0.6, right: 0.6, top: 0.6, bottom: 0.6 }
type Margin = typeof MARGIN
const LEGEND_KEY = 'ftpc.dirtside.mapkey.v1'

function fitView(width: number, depth: number, aspect: number, m: Margin): View {
  const bw = width + m.left + m.right
  const bh = depth + m.top + m.bottom
  if (bw / bh >= aspect) {
    const h = bw / aspect
    return { x: -m.left, y: -m.top - (h - bh) / 2, w: bw }
  }
  const w = bh * aspect
  return { x: -m.left - (w - bw) / 2, y: -m.top, w }
}

function toTable(el: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = el.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = el.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function readStoredKey(): { open: boolean; symbols: boolean } {
  try {
    const raw = localStorage.getItem(LEGEND_KEY)
    if (raw) {
      const v = JSON.parse(raw) as { open?: unknown; symbols?: unknown }
      return { open: v.open !== false, symbols: v.symbols === true }
    }
  } catch {
    // No storage: the key starts open.
  }
  return { open: true, symbols: false }
}

const GOING_NOTE = { easy: 'easy going', normal: 'normal going', poor: 'poor going (2 per inch)', difficult: 'difficult going (3 per inch)', impassable: 'no entry' } as const

/** The cursor readout: where the pointer is, what the ground is and does, and what it means for the selected element. */
function describePoint(state: GameState, at: Point, selected: ElementState | null): string {
  const features = state.setup.table.terrain
  const parts = [`(${at.x.toFixed(1)}", ${at.y.toFixed(1)}")`]
  const terrain = terrainAt(at, features)
  const wood = woodAt(at, features)
  parts.push(wood ? `${TERRAIN_NAMES[wood.feature.terrain]}, ${wood.where === 'edge' ? 'edge: soft cover, sees out' : 'within: neither sees nor is seen'}` : TERRAIN_NAMES[terrain])
  if (selected && !selected.destroyed) {
    parts.push(`${distance(selected.position, at).toFixed(1)}" from ${selected.name}`)
    const family = selected.vehicle ? mobilityFamily(selected.vehicle.mobility) : 'infantry'
    const wades = !!selected.vehicle?.amphibious || selected.infantry?.troops === 'powered'
    parts.push(GOING_NOTE[goingOf(family, terrain, wades)])
  }
  return parts.join(' · ')
}

export function TableMap(props: TableMapProps) {
  const { state, selectedId, onSelectElement, onClickTable, plot, plotFrom, reach, targets, highlight, viewer, pendingLandings, toAct, hoverUnitId, onHoverUnit, targeting, moveBudget, recent, aimPreview, landingPreview, cursor, readOnly = false } = props
  const { width: W, depth: D } = state.setup.table
  const features = state.setup.table.terrain
  const pid = `dstm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)

  // ---- The view: fitted to the pane until the player zooms or pans.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [chosen, setChosen] = useState<View | null>(null)
  const margin = readOnly ? PREVIEW_MARGIN : MARGIN
  const aspect = size.w > 0 && size.h > 0 ? size.w / size.h : (W + margin.left + margin.right) / (D + margin.top + margin.bottom)
  const view = chosen ?? fitView(W, D, aspect, margin)
  const viewH = view.w / aspect
  const pxPerInch = size.w > 0 ? size.w / view.w : 20
  const k = 1 / pxPerInch
  const viewRef = useRef({ view, viewH, aspect })
  viewRef.current = { view, viewH, aspect }

  useEffect(() => setChosen(null), [W, D])

  useEffect(() => {
    const el = svg.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box && box.width > 0 && box.height > 0) setSize((s) => (Math.abs(s.w - box.width) < 0.5 && Math.abs(s.h - box.height) < 0.5 ? s : { w: box.width, h: box.height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Keep at least a quarter of the table in sight. */
  const clamp = useCallback(
    (v: View): View => {
      const h = v.w / viewRef.current.aspect
      return { w: v.w, x: Math.min((3 * W) / 4, Math.max(W / 4 - v.w, v.x)), y: Math.min((3 * D) / 4, Math.max(D / 4 - h, v.y)) }
    },
    [W, D],
  )

  const zoomAt = useCallback(
    (factor: number, at: Point | null) => {
      const { view: v, viewH: h } = viewRef.current
      const centre = at ?? { x: v.x + v.w / 2, y: v.y + h / 2 }
      const w = Math.min(W * 2, Math.max(6, v.w * factor))
      const nh = w / viewRef.current.aspect
      setChosen(clamp({ x: centre.x - ((centre.x - v.x) * w) / v.w, y: centre.y - ((centre.y - v.y) * nh) / h, w }))
    },
    [W, clamp],
  )

  useEffect(() => {
    const el = svg.current
    if (!el || readOnly) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.deltaY < 0 ? 1 / 1.15 : 1.15, toTable(el, event.clientX, event.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, readOnly])

  // ---- The pointer: where it is on the table, and which counter it is over.
  const [pointer, setPointer] = useState<Point | null>(null)
  const [hoverEl, setHoverEl] = useState<string | null>(null)
  const [localHoverUnit, setLocalHoverUnit] = useState<string | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const [tape, setTape] = useState<{ from: Point; to: Point } | null>(null)
  const [hoverType, setHoverType] = useState<TerrainType | null>(null)
  const [key, setKey] = useState(readStoredKey)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; hit: string | null; tape: boolean } | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const storeKey = (next: { open: boolean; symbols: boolean }) => {
    setKey(next)
    try {
      localStorage.setItem(LEGEND_KEY, JSON.stringify(next))
    } catch {
      // No storage: the choice lasts until the page is left.
    }
  }

  const trackPointer = (clientX: number, clientY: number) => {
    pending.current = { x: clientX, y: clientY }
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const p = pending.current
      const el = svg.current
      if (!p || !el) return
      const at = toTable(el, p.x, p.y)
      const snapped = { x: Math.round(at.x * 20) / 20, y: Math.round(at.y * 20) / 20 }
      setPointer((old) => (old && old.x === snapped.x && old.y === snapped.y ? old : snapped))
      const d = drag.current
      if (d?.tape) setTape((t) => (t ? { ...t, to: snapped } : t))
    })
  }

  const hoverUnit = hoverUnitId !== undefined ? hoverUnitId : localHoverUnit
  const setHovered = (id: string | null) => {
    if (id === hoverEl) return
    setHoverEl(id)
    const unitId = id ? (state.elements[id]?.unitId ?? null) : null
    const before = hoverEl ? (state.elements[hoverEl]?.unitId ?? null) : null
    if (unitId !== before) {
      setLocalHoverUnit(unitId)
      onHoverUnit?.(unitId)
    }
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const at = toTable(event.currentTarget, event.clientX, event.clientY)
    // Pointer capture makes the SVG the target of the release, so the counter under the press is read now.
    const hit = (event.target as Element).closest('[data-element]')?.getAttribute('data-element') ?? null
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, moved: false, hit, tape: measuring }
    if (measuring) setTape({ from: at, to: at })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    trackPointer(event.clientX, event.clientY)
    const d = drag.current
    if (!d) {
      setHovered((event.target as Element).closest('[data-element]')?.getAttribute('data-element') ?? null)
      return
    }
    if (d.tape) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (Math.hypot(dx, dy) > 4) d.moved = true
    if (!d.moved) return
    const perPx = view.w / event.currentTarget.getBoundingClientRect().width
    setChosen(clamp({ w: view.w, x: d.vx - dx * perPx, y: d.vy - dy * perPx }))
  }
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    const at = toTable(event.currentTarget, event.clientX, event.clientY)
    if (d.tape) {
      setTape((t) => (t ? { ...t, to: at } : t))
      return
    }
    if (d.hit) {
      onSelectElement(d.hit)
      return
    }
    onClickTable({ x: Math.round(at.x * 4) / 4, y: Math.round(at.y * 4) / 4 })
  }
  const onPointerLeave = () => {
    if (drag.current) return
    setPointer(null)
    setHovered(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return
    const tag = (event.target as HTMLElement).tagName
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    const step = view.w * 0.1
    const handled = (() => {
      switch (event.key) {
        case '+':
        case '=':
          zoomAt(1 / 1.25, null)
          return true
        case '-':
        case '_':
          zoomAt(1.25, null)
          return true
        case '0':
          setChosen(null)
          return true
        case 'ArrowLeft':
          setChosen(clamp({ ...view, x: view.x - step }))
          return true
        case 'ArrowRight':
          setChosen(clamp({ ...view, x: view.x + step }))
          return true
        case 'ArrowUp':
          setChosen(clamp({ ...view, y: view.y - step }))
          return true
        case 'ArrowDown':
          setChosen(clamp({ ...view, y: view.y + step }))
          return true
        case 'Escape':
          if (!measuring) return false
          setMeasuring(false)
          setTape(null)
          return true
        default:
          return false
      }
    })()
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  // ---- What the layers draw from.
  const sideNames = useMemo(() => ({ north: state.sides.north.name, south: state.sides.south.name }), [state.sides.north.name, state.sides.south.name])
  const codes = useMemo(() => unitCodes(state), [state.setup, state.units])
  const { live, dead } = useMemo(() => {
    const all = Object.values(state.elements)
    // Elements aboard a craft are off the table until they come out (p. 43).
    return { live: all.filter((e) => !e.destroyed && !e.aboard), dead: all.filter((e) => e.destroyed && !e.aboard) }
  }, [state.elements])
  const callers = useMemo(() => Object.fromEntries(Object.values(state.elements).map((e) => [e.id, e.name])), [state.elements])
  const ready = useMemo(() => ({ north: state.sides.north.ready, south: state.sides.south.ready }), [state.sides.north.ready, state.sides.south.ready])
  const targetSet = useMemo(() => new Set(targets), [targets])
  const objectivePoints = useMemo(() => state.setup.table.objectives.map((o) => o.position), [state.setup.table.objectives])

  const activation = state.activation
  const activeUnit = activation?.unitId ?? null
  const selected = selectedId ? (state.elements[selectedId] ?? null) : null
  const acting = toAct === undefined ? state.toAct : toAct
  const computer = !!acting && (state.setup.aiSides ?? []).includes(acting) && state.phase !== 'deployment'
  const onBoard = !!pointer && onTable(pointer, state.setup.table)
  const linkUnits = [activeUnit, selected && !selected.destroyed ? selected.unitId : null, hoverUnit].filter((u): u is string => !!u)
  const windowTrail = highlight ? activation?.elements[highlight] : undefined
  const highlighted = highlight ? state.elements[highlight] : undefined
  const deploying = state.phase === 'deployment' && !!selected && !selected.destroyed && !state.sides[selected.sideId].ready && !(state.setup.aiSides ?? []).includes(selected.sideId)

  const readout = !readOnly && pointer && onBoard ? describePoint(state, pointer, selected) : null
  const cursorClass = measuring ? 'cursor-measure' : `cursor-${cursor ?? 'default'}`
  const lod = pxPerInch >= 28 ? ' lod-near' : pxPerInch < 12 ? ' lod-far' : ''
  const style = { '--k': k } as CSSProperties

  const svgEl = (
    <svg
      ref={svg}
      className={`dst-mapsvg ${readOnly ? 'dst-map-preview' : 'dst-map'} ${cursorClass}${lod}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      style={style}
      onPointerDown={readOnly ? undefined : onPointerDown}
      onPointerMove={readOnly ? undefined : onPointerMove}
      onPointerUp={readOnly ? undefined : onPointerUp}
      onPointerLeave={readOnly ? undefined : onPointerLeave}
      role="img"
      aria-label={readOnly ? 'A preview of the table' : 'The table'}
    >
      <MapDefs pid={pid} />
      <Board setup={state.setup} pid={pid} toAct={state.phase === 'turn-start' || state.phase === 'ended' ? null : (acting ?? null)} computer={computer} sideNames={sideNames} />
      <TerrainLayer features={features} pid={pid} />
      <TerrainOutline features={features} type={hoverType} />
      {state.phase === 'deployment' ? <DeploymentZones setup={state.setup} pid={pid} sideNames={sideNames} ready={ready} /> : null}
      <BoardMarks setup={state.setup} sideNames={sideNames} />
      <TerrainLabels features={features} k={k} avoid={objectivePoints} />
      <Objectives objectives={state.setup.table.objectives} held={state.objectives} viewer={viewer} sideNames={sideNames} />
      {state.orbit ? <Orbital orbit={state.orbit} k={k} pid={pid} callers={callers} /> : null}
      {state.setup.craft?.length ? <CraftMarks craft={state.setup.craft} records={state.craft} k={k} /> : null}
      {recent?.length ? <RecentMarks recent={recent} only="move" /> : null}
      {highlighted && windowTrail && distance(windowTrail.startPosition, highlighted.position) > 0.2 ? (
        <g className="dst-window-trail" pointerEvents="none">
          <line x1={windowTrail.startPosition.x} y1={windowTrail.startPosition.y} x2={highlighted.position.x} y2={highlighted.position.y} />
          <circle cx={windowTrail.startPosition.x} cy={windowTrail.startPosition.y} r={0.18} />
        </g>
      ) : null}
      {plotFrom && !readOnly ? <MovePlot from={plotFrom} plot={plot} budget={moveBudget ?? null} reach={reach} features={features} /> : null}
      <Earthworks elements={live} units={state.units} prepared={state.prepared} depth={D} />
      {linkUnits.length > 0 && !readOnly ? <IntegrityLinks state={state} unitIds={linkUnits} /> : null}
      <g className="dst-counters">
        {dead.map((e) => (
          <Counter key={e.id} element={e} unit={state.units[e.unitId]!} code={codes[e.unitId] ?? ''} pid={pid} selected={false} active={false} target={false} highlight={false} verdict={null} dim={false} hovered={false} done={false} />
        ))}
        {live.map((e) => {
          const record = activation && e.unitId === activeUnit ? activation.elements[e.id] : undefined
          const v = targeting?.verdicts[e.id]
          return (
            <Counter
              key={e.id}
              element={e}
              unit={state.units[e.unitId]!}
              code={codes[e.unitId] ?? ''}
              pid={pid}
              selected={e.id === selectedId}
              active={e.unitId === activeUnit}
              target={targetSet.has(e.id)}
              highlight={e.id === highlight}
              verdict={v ? (v.ok ? 'ok' : 'refused') : null}
              dim={!!hoverUnit && e.unitId !== hoverUnit}
              hovered={!!hoverUnit && e.unitId === hoverUnit}
              done={!!record && record.moved && record.fired}
            />
          )
        })}
      </g>
      {recent?.length ? <RecentMarks recent={recent} only="fire" /> : null}
      {pendingLandings?.length ? <PendingLandings landings={pendingLandings} state={state} k={k} /> : null}
      <Tags elements={live} units={state.units} codes={codes} k={k} near={pxPerInch >= 28} activeUnitId={activeUnit} selectedId={selectedId} selectedUnitId={selected?.unitId ?? null} hoverUnitId={hoverUnit} activation={activation} />
      {highlighted ? <Chip x={highlighted.position.x} y={highlighted.position.y - 1.3} dy={-10} k={k} text="JUST MOVED · FIRE?" tone="warn" size={9} /> : null}
      {targeting && !readOnly ? <Targeting state={state} targeting={targeting} hoverId={hoverEl} k={k} /> : null}
      {!readOnly && onBoard && pointer ? (
        <>
          {moveBudget && plotFrom && selected && !hoverEl ? <MoveGhost state={state} element={selected} from={plotFrom} plot={plot} budget={moveBudget} pointer={pointer} k={k} /> : null}
          {aimPreview ? <AimPreview at={pointer} radius={aimPreview.radius} pid={pid} k={k} /> : null}
          {landingPreview ? <LandingPreview state={state} at={pointer} label={landingPreview.label} side={acting ?? null} k={k} /> : null}
          {deploying && !hoverEl && !measuring ? <DeployGhost state={state} element={selected!} at={pointer} /> : null}
        </>
      ) : null}
      {tape ? <Tape from={tape.from} to={tape.to} k={k} /> : null}
    </svg>
  )

  if (readOnly) return <div className="dst-mapwrap is-preview">{svgEl}</div>

  return (
    <div className="dst-mapwrap" onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="dst-maptools" role="toolbar" aria-label="Map">
        <button type="button" aria-label="Zoom out" title="Zoom out (−)" onClick={() => zoomAt(1.25, null)}>
          −
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomAt(1 / 1.25, null)}>
          +
        </button>
        <button type="button" aria-label="Fit table" title="Show the whole table (0)" onClick={() => setChosen(null)}>
          Fit
        </button>
        <span className="dst-maptools-gap" />
        <button
          type="button"
          className={measuring ? 'is-on' : undefined}
          aria-pressed={measuring}
          title="Press and drag on the table to measure; Esc to stop"
          onClick={() => {
            setMeasuring((m) => !m)
            setTape(null)
          }}
        >
          Measure
        </button>
        <button type="button" className={key.open ? 'is-on' : undefined} aria-pressed={key.open} title="The map key" onClick={() => storeKey({ ...key, open: !key.open })}>
          Legend
        </button>
        <span className="dst-readout num" aria-live="off">
          {measuring && tape ? `tape ${distance(tape.from, tape.to).toFixed(1)}"` : (readout ?? (measuring ? 'Press and drag to measure' : 'Drag to pan · wheel or + / − to zoom'))}
        </span>
      </div>
      {svgEl}
      {key.open ? <Legend features={features} pid={pid} selected={selected} showMarkers={key.symbols} onToggleMarkers={() => storeKey({ ...key, symbols: !key.symbols })} onHoverType={setHoverType} /> : null}
    </div>
  )
}

export { distance }
