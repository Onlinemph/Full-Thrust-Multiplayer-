import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { figuresOf, liveUnits } from '../../stargrunt/table/game'
import { isInIntegrity, unitCentre } from '../../stargrunt/table/cover'
import { onTable } from '../../dirtside/table/terrain'
import type { TerrainType } from '../../dirtside/data/mobility'
import type { FigureState, GameState, MobilityKind, Point, SideId, UnitState } from '../../stargrunt/types'
import { Board, BoardMarks } from '../dirtside/map/board'
import { MapDefs } from '../dirtside/map/defs'
import { TerrainLabels, TerrainLayer, TerrainOutline } from '../dirtside/map/terrain'
import { type Margin, useTableView } from '../dirtside/map/useTableView'
import { DeploymentZones } from './map/board'
import { Legend } from './map/Legend'
import { FigureMark, IntegrityMarks, SquadPennant } from './map/figures'
import { AssaultGhost, FireLine, MoveGhost, type TargetVerdict } from './map/overlays'
import { unitCodes } from '../dirtside/unitCodes'

export type { TargetVerdict }

/**
 * The Stargrunt table: the Dirtside ground (`Board`, `TerrainLayer`,
 * `useTableView` — imported unchanged, `05-reuse-map.md` §3) with
 * Stargrunt's own marks on it — every figure a small base, a pennant per
 * squad, the move and assault ghosts, and line-of-sight/odds to a
 * considered target.
 */
export interface TableMapProps {
  state: GameState
  selectedUnitId: string | null
  onSelectUnit: (id: string) => void
  onClickTable: (point: Point) => void
  /** Deployment only (p. 14): a figure clicked on the map selects itself, not its squad. */
  selectedFigureId?: string | null
  onSelectFigure?: (id: string) => void
  toAct?: SideId | null
  viewer?: SideId | null
  hoverUnitId?: string | null
  onHoverUnit?: (id: string | null) => void
  /** A move being plotted for the selected (activated) squad, as one group translation. */
  moveGhost?: { mobility: MobilityKind; figureIds: string[]; mode: 'normal' | 'combat' | 'travel'; inches: number | null } | null
  /** A close assault's combat move: the attacking figures converging on the target unit. */
  assaultTargetUnitId?: string | null
  /** Fire being considered: the firing unit and each enemy unit's verdict. */
  targeting?: { firingUnitId: string; verdicts: Record<string, TargetVerdict> } | null
  cursor?: 'default' | 'crosshair' | 'move'
  readOnly?: boolean
}

const MARGIN: Margin = { left: 1.45, right: 1.45, top: 1.5, bottom: 0.75 }
const PREVIEW_MARGIN: Margin = { left: 0.6, right: 0.6, top: 0.6, bottom: 0.6 }
const LEGEND_KEY = 'ftpc.stargrunt.mapkey.v1'

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

/** Where the pennant flies for a squad: above its leader if fit, else the highest figure still standing. */
function pennantAt(unit: UnitState, figures: FigureState[]): Point {
  const leader = figures.find((f) => f.id === unit.leaderId && f.status !== 'dead')
  const anchor = leader ?? figures.find((f) => f.status !== 'dead') ?? figures[0]
  return anchor ? { x: anchor.position.x, y: anchor.position.y - 0.3 } : { x: 0, y: 0 }
}

export function TableMap(props: TableMapProps) {
  // `viewer` is accepted for symmetry with Dirtside's TableMap but unused: Stargrunt's objectives (p. 17,
  // reused) carry no hidden value, so nothing on this map depends on who is looking.
  const { state, selectedUnitId, onSelectUnit, onClickTable, selectedFigureId, onSelectFigure, toAct, hoverUnitId, onHoverUnit, moveGhost, assaultTargetUnitId, targeting, cursor, readOnly = false } = props
  const deployPhase = state.phase === 'deployment' && !!onSelectFigure
  const { width: W, depth: D } = state.setup.table
  const features = state.setup.table.terrain
  const pid = `sgm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const margin = readOnly ? PREVIEW_MARGIN : MARGIN
  const { frame, box: view, zoomAt, panTo, fit } = useTableView(svg, W, D, margin, readOnly)
  const pxPerInch = frame.ppi
  const k = 1 / pxPerInch

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

  const [pointer, setPointer] = useState<Point | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [localHoverUnit, setLocalHoverUnit] = useState<string | null>(null)
  const [hoverType, setHoverType] = useState<TerrainType | null>(null)
  const [key, setKey] = useState(readStoredKey)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; hit: string | null }>({ x: 0, y: 0, vx: 0, vy: 0, moved: false, hit: null })
  const dragging = useRef(false)
  const pending = useRef<{ x: number; y: number } | null>(null)
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const storeKey = useCallback((next: { open: boolean; symbols: boolean }) => {
    setKey(next)
    try {
      localStorage.setItem(LEGEND_KEY, JSON.stringify(next))
    } catch {
      // Lasts for this visit only.
    }
  }, [])

  const trackPointer = (clientX: number, clientY: number) => {
    pending.current = { x: clientX, y: clientY }
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      const p = pending.current
      const el = svg.current
      if (!p || !el) return
      const at = toTable(el, p.x, p.y)
      const snapped = { x: Math.round(at.x * 20) / 20, y: Math.round(at.y * 20) / 20 }
      setPointer((old) => (old && old.x === snapped.x && old.y === snapped.y ? old : snapped))
    })
  }

  const hoverUnit = hoverUnitId !== undefined ? hoverUnitId : localHoverUnit
  const setHovered = (id: string | null) => {
    if (id === hoverId) return
    setHoverId(id)
    const unitId = id ? (state.figures[id]?.unitId ?? id) : null
    setLocalHoverUnit(unitId)
    onHoverUnit?.(unitId)
  }

  /** During deployment a hit names the figure itself; otherwise its squad. */
  const hitOf = (event: { target: EventTarget | null }): string | null => {
    const hit = (event.target as Element).closest('[data-figure],[data-unit]')
    if (!hit) return null
    const figureId = hit.getAttribute('data-figure')
    if (deployPhase && figureId) return figureId
    return hit.getAttribute('data-unit') ?? (figureId ? (state.figures[figureId]?.unitId ?? null) : null)
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, vx: frame.x, vy: frame.y, moved: false, hit: hitOf(event) }
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    trackPointer(event.clientX, event.clientY)
    if (!dragging.current) {
      setHovered(hitOf(event))
      return
    }
    const d = drag.current
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (Math.hypot(dx, dy) > 4) d.moved = true
    if (!d.moved) return
    panTo(d.vx - dx / pxPerInch, d.vy - dy / pxPerInch)
  }
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    dragging.current = false
    if (!d.moved) {
      const at = toTable(event.currentTarget, event.clientX, event.clientY)
      if (d.hit && deployPhase) onSelectFigure!(d.hit)
      else if (d.hit) onSelectUnit(d.hit)
      else onClickTable({ x: Math.round(at.x * 4) / 4, y: Math.round(at.y * 4) / 4 })
    }
  }
  const onPointerLeave = () => {
    if (dragging.current) return
    setPointer(null)
    setHovered(null)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
          fit()
          return true
        case 'ArrowLeft':
          panTo(view.x - step, view.y)
          return true
        case 'ArrowRight':
          panTo(view.x + step, view.y)
          return true
        case 'ArrowUp':
          panTo(view.x, view.y - step)
          return true
        case 'ArrowDown':
          panTo(view.x, view.y + step)
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

  const sideNames = useMemo(() => ({ north: state.sides.north.name, south: state.sides.south.name }), [state.sides.north.name, state.sides.south.name])
  const codes = useMemo(() => unitCodes(state), [state.setup, state.units]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeUnitId = state.activation?.unitId ?? null
  const acting = toAct === undefined ? state.toAct : toAct
  const computer = !!acting && (state.setup.aiSides ?? []).includes(acting) && state.phase !== 'deployment'
  const allFigures = useMemo(() => Object.values(state.figures), [state.figures])
  const liveUnitsList = useMemo(() => [...liveUnits(state, 'north'), ...liveUnits(state, 'south')], [state])
  const deployingFigures = useMemo(() => (state.phase === 'deployment' ? allFigures : []), [allFigures, state.phase])
  const onBoard = !!pointer && onTable(pointer, state.setup.table)

  const targetSet = useMemo(() => (targeting ? new Set(Object.keys(targeting.verdicts)) : new Set<string>()), [targeting])
  const far = pxPerInch < 12
  const lod = pxPerInch >= 30 ? ' lod-near' : far ? ' lod-far' : ''
  const style = { '--k': k } as CSSProperties

  const svgEl = (
    <svg
      ref={svg}
      className={`dst-mapsvg sg-mapsvg ${readOnly ? 'dst-map-preview' : 'dst-map'} cursor-${cursor ?? 'default'}${lod}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
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
      {state.phase === 'deployment' ? <DeploymentZones setup={state.setup} pid={pid} sideNames={sideNames} ready={{ north: state.sides.north.ready, south: state.sides.south.ready }} figures={deployingFigures} units={state.units} k={k} /> : null}
      <BoardMarks setup={state.setup} sideNames={sideNames} k={k} />
      <TerrainLabels features={features} k={k} avoid={state.setup.table.objectives.map((o) => o.position)} />
      <g className="sg-objectives">
        {state.setup.table.objectives.map((o) => {
          const held = state.objectives[o.id]?.heldBy ?? null
          return (
            <g key={o.id} transform={`translate(${o.position.x} ${o.position.y})`} className={`dst-objective-mark${held ? ` is-held is-${held}` : ''}`}>
              <title>{`Objective, value ${o.value}${held ? `, held by ${sideNames[held]}` : ''} — move within 1" to take it (p. 17, reused)`}</title>
              <circle r={1} className="dst-objective-reach" />
              {held ? (
                <>
                  <line y1={-0.5} y2={-1.5} className="dst-objective-staff" />
                  <polygon points="0,-1.5 0.8,-1.3 0,-1.07" className="dst-objective-flag" />
                </>
              ) : null}
              <circle r={0.5} className="dst-objective-chit" />
              <text y={0.21} className="dst-objective-value">
                {o.value}
              </text>
            </g>
          )
        })}
      </g>
      {selectedUnitId ? <IntegrityMarks state={state} unitId={selectedUnitId} /> : null}
      <g className="sg-figures">
        {allFigures.map((f) => (
          <FigureMark
            key={f.id}
            figure={f}
            isLeader={state.units[f.unitId]?.leaderId === f.id}
            selected={deployPhase ? f.id === selectedFigureId : f.unitId === selectedUnitId}
            active={f.unitId === activeUnitId}
            target={targetSet.has(f.unitId)}
            dim={!!hoverUnit && f.unitId !== hoverUnit && f.unitId !== selectedUnitId}
          />
        ))}
      </g>
      {liveUnitsList.map((u) => {
        const figs = figuresOf(state, u)
        const at = pennantAt(u, figs)
        const organised = isInIntegrity(figs.filter((f) => f.status !== 'dead').map((f) => f.position))
        return (
          <SquadPennant
            key={u.id}
            unit={u}
            code={codes[u.id] ?? ''}
            at={at}
            active={u.id === activeUnitId}
            selected={u.id === selectedUnitId}
            hovered={u.id === hoverUnit}
            organised={organised}
            k={k}
          />
        )
      })}
      {moveGhost && selectedUnitId ? (() => {
        const figs = moveGhost.figureIds.map((id) => state.figures[id]).filter((f): f is FigureState => !!f)
        const origin = unitCentre(figs.map((f) => f.position))
        return onBoard && pointer ? <MoveGhost state={state} mobility={moveGhost.mobility} from={figs.map((f) => f.position)} to={pointer} origin={origin} mode={moveGhost.mode} inches={moveGhost.inches} fits /> : null
      })() : null}
      {assaultTargetUnitId && selectedUnitId ? (() => {
        const target = state.units[assaultTargetUnitId]
        if (!target) return null
        const targetAt = unitCentre(figuresOf(state, target).map((f) => f.position))
        const attacker = state.units[selectedUnitId]
        if (!attacker) return null
        return <AssaultGhost from={figuresOf(state, attacker).map((f) => f.position)} targetAt={targetAt} />
      })() : null}
      {targeting
        ? Object.entries(targeting.verdicts).map(([unitId, v]) => {
            const firer = state.units[targeting.firingUnitId]
            const target = state.units[unitId]
            if (!firer || !target) return null
            const from = unitCentre(figuresOf(state, firer).map((f) => f.position))
            const to = unitCentre(figuresOf(state, target).map((f) => f.position))
            return <FireLine key={unitId} from={from} to={to} verdict={v} />
          })
        : null}
    </svg>
  )

  if (readOnly) return <div className="dst-mapwrap sg-mapwrap is-preview">{svgEl}</div>

  return (
    <div className="dst-mapwrap sg-mapwrap" onKeyDown={onKeyDown} tabIndex={-1} ref={wrap}>
      <div className="dst-maptools" role="toolbar" aria-label="Map">
        <button type="button" aria-label="Zoom out" title="Zoom out (−)" onClick={() => zoomAt(1.25, null)}>
          −
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomAt(1 / 1.25, null)}>
          +
        </button>
        <button type="button" aria-label="Fit table" title="Show the whole table (0)" onClick={fit}>
          Fit
        </button>
        <span className="dst-maptools-gap" />
        <button type="button" className={key.open ? 'is-on' : undefined} aria-pressed={key.open} title="The map key" onClick={() => storeKey({ ...key, open: !key.open })}>
          Legend
        </button>
        <span className="dst-readout num" aria-live="off">
          {pointer && onBoard ? `(${pointer.x.toFixed(1)}", ${pointer.y.toFixed(1)}")` : 'Drag to pan · wheel or + / − to zoom'}
        </span>
      </div>
      {svgEl}
      {key.open ? <Legend features={features} pid={pid} showSymbols={key.symbols} onToggleSymbols={() => storeKey({ ...key, symbols: !key.symbols })} onHoverType={setHoverType} /> : null}
    </div>
  )
}
