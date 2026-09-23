import { useEffect, useRef, useState } from 'react'

import { NUKE_EXCLUSION, STRIKE_RADIUS } from '../../dirtside/table/orbital'
import { distance } from '../../dirtside/table/terrain'
import type { ElementState, GameState, Point, SideId } from '../../dirtside/table/types'

/**
 * The table: terrain, objectives and the counters, in inches. Pan by
 * dragging, zoom with the wheel, click a counter to pick it, click the
 * ground to say where. Everything drawn is something a player would see
 * on a real table, plus the markers the rules put beside a model.
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
}


export function TableMap({ state, selectedId, onSelectElement, onClickTable, plot, plotFrom, reach, targets, highlight, viewer }: TableMapProps) {
  const { width, depth } = state.setup.table
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ x: -1, y: -1, w: width + 2, h: depth + 2 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; hit: string | null } | null>(null)

  useEffect(() => {
    setView({ x: -1, y: -1, w: width + 2, h: depth + 2 })
  }, [width, depth])

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const at = toTable(el, event.clientX, event.clientY)
      setView((v) => {
        const factor = event.deltaY < 0 ? 1 / 1.15 : 1.15
        const w = Math.min(width * 2, Math.max(6, v.w * factor))
        const h = (w * v.h) / v.w
        return { x: at.x - ((at.x - v.x) * w) / v.w, y: at.y - ((at.y - v.y) * h) / v.h, w, h }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [width])

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    // Pointer capture makes the SVG the target of the release, so the counter under the press is read now.
    const hit = (event.target as Element).closest('[data-element]')?.getAttribute('data-element') ?? null
    drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, moved: false, hit }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (Math.hypot(dx, dy) > 4) d.moved = true
    if (!d.moved) return
    const box = event.currentTarget.getBoundingClientRect()
    const perPx = view.w / box.width
    setView((v) => ({ ...v, x: d.vx - dx * perPx, y: d.vy - dy * perPx }))
  }
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    if (d.hit) {
      onSelectElement(d.hit)
      return
    }
    const at = toTable(event.currentTarget, event.clientX, event.clientY)
    onClickTable({ x: Math.round(at.x * 4) / 4, y: Math.round(at.y * 4) / 4 })
  }

  const activeUnit = state.activation?.unitId ?? null
  const elements = Object.values(state.elements)
  const dead = elements.filter((e) => e.destroyed)
  const live = elements.filter((e) => !e.destroyed)

  return (
    <svg
      ref={svg}
      className="dst-map"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{ width: '100%', height: '100%' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="img"
      aria-label="The table"
    >
      <rect x={0} y={0} width={width} height={depth} className="dst-ground" />
      {/* The thirds of p. 17. */}
      <line x1={0} x2={width} y1={depth / 3} y2={depth / 3} className="dst-third" />
      <line x1={0} x2={width} y1={(2 * depth) / 3} y2={(2 * depth) / 3} className="dst-third" />
      {state.phase === 'deployment' ? (
        <>
          <rect x={0} y={0} width={width} height={6} className="dst-zone is-north" />
          <rect x={0} y={depth - 6} width={width} height={6} className="dst-zone is-south" />
        </>
      ) : null}
      {state.setup.table.terrain.map((f) => {
        const s = f.shape
        const cls = `dst-terrain is-${f.terrain}`
        if (s.kind === 'circle') return <circle key={f.id} cx={s.centre.x} cy={s.centre.y} r={s.radius} className={cls}><title>{f.label ?? f.terrain}</title></circle>
        if (s.kind === 'rect') return <rect key={f.id} x={s.x} y={s.y} width={s.width} height={s.height} className={cls}><title>{f.label ?? f.terrain}</title></rect>
        return <polyline key={f.id} points={s.points.map((p) => `${p.x},${p.y}`).join(' ')} className={cls} strokeWidth={s.width} fill="none"><title>{f.label ?? f.terrain}</title></polyline>
      })}
      {state.setup.table.objectives.map((o) => {
        const held = state.objectives[o.id]?.heldBy ?? null
        const known = viewer !== null && (o.drawnBy === viewer || held === viewer)
        return (
          <g key={o.id} transform={`translate(${o.position.x} ${o.position.y})`} className={`dst-objective${held ? ` is-${held}` : ''}`}>
            <polygon points="0,-0.8 0.8,0 0,0.8 -0.8,0" />
            <text y={0.25} textAnchor="middle" className="dst-objective-label">{known ? o.value : o.id}</text>
            <title>{`Objective ${o.id}${known ? `, value ${o.value}` : ''}${held ? `, held by ${state.sides[held].name}` : ''}`}</title>
          </g>
        )
      })}
      {/* Ground zero of every orbital strike (More Thrust p. 17), and the impact markers of fire still to arrive (p. 38). */}
      {(state.orbit?.nukes ?? []).map((n, i) => (
        <g key={`nuke-${i}`} transform={`translate(${n.x} ${n.y})`} className="dst-nuke">
          <circle r={NUKE_EXCLUSION} className="dst-nuke-zone" />
          <circle r={0.45} className="dst-nuke-marker" />
          <text y={0.2} textAnchor="middle" className="dst-nuke-label">☢</text>
          <title>{`Ground zero of an orbital strike: unprotected troops and vehicles keep ${NUKE_EXCLUSION}" away`}</title>
        </g>
      ))}
      {(state.orbit?.strikes ?? []).map((st) => (
        <g key={st.id} transform={`translate(${st.aim.x} ${st.aim.y})`} className={`dst-strike is-${st.side}`}>
          <circle r={STRIKE_RADIUS[st.attack]} className="dst-strike-zone" />
          <path d="M-0.7,0 L0.7,0 M0,-0.7 L0,0.7" className="dst-strike-cross" />
          <circle r={0.35} className="dst-strike-cross" />
          <title>{`Impact marker: ${st.attack === 'pbm' ? 'ortillery' : 'a converged sheaf'} called by ${state.elements[st.calledBy]?.name ?? 'an observer'}, arriving after the next enemy activation; it may stray up to 7"`}</title>
        </g>
      ))}
      {plotFrom && reach !== null ? <circle cx={plotFrom.x} cy={plotFrom.y} r={Math.max(0, reach)} className="dst-reach" /> : null}
      {plotFrom && plot.length > 0 ? (
        <>
          <polyline points={[plotFrom, ...plot].map((p) => `${p.x},${p.y}`).join(' ')} className="dst-plot" />
          {plot.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={0.25} className="dst-plot-point" />)}
        </>
      ) : null}
      {dead.map((e) => <Counter key={e.id} element={e} state={state} selected={false} active={false} target={false} highlight={false} />)}
      {live.map((e) => (
        <Counter key={e.id} element={e} state={state} selected={e.id === selectedId} active={e.unitId === activeUnit} target={targets.includes(e.id)} highlight={e.id === highlight} />
      ))}
    </svg>
  )
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

function Counter({ element: e, state, selected, active, target, highlight }: { element: ElementState; state: GameState; selected: boolean; active: boolean; target: boolean; highlight: boolean }) {
  const unit = state.units[e.unitId]!
  const badges: string[] = []
  if (e.damaged) badges.push('DMG')
  if (e.immobilised) badges.push('IMM')
  if (e.systemsDown) badges.push('SD')
  if (e.dugIn) badges.push('DUG')
  if (e.posture === 'hull-down') badges.push('HD')
  if (e.posture === 'turret-down') badges.push('TD')
  if (unit.evasive) badges.push('EV')
  const cls = ['dst-counter', `is-${e.sideId}`, e.vehicle ? 'is-vehicle' : 'is-infantry', e.destroyed ? 'is-destroyed' : '', selected ? 'is-selected' : '', active ? 'is-active' : '', target ? 'is-target' : '', highlight ? 'is-highlight' : ''].filter(Boolean).join(' ')
  const title = `${e.name} (${unit.name})${e.destroyed ? ' — knocked out' : badges.length ? ` — ${badges.join(', ')}` : ''}`
  return (
    <g className={cls} data-element={e.id} transform={`translate(${e.position.x} ${e.position.y})`}>
      <title>{title}</title>
      <g transform={`rotate(${e.facing})`}>
        {e.vehicle ? (
          <>
            <rect x={-0.65} y={-0.45} width={1.3} height={0.9} rx={0.12} className="dst-body" />
            <polyline points="-0.3,-0.45 0,-0.75 0.3,-0.45" className="dst-nose" />
          </>
        ) : (
          <rect x={-0.4} y={-0.3} width={0.8} height={0.6} rx={0.3} className="dst-body" />
        )}
        {e.destroyed ? <path d="M-0.5,-0.4 L0.5,0.4 M-0.5,0.4 L0.5,-0.4" className="dst-ko" /> : null}
      </g>
      {selected ? <circle r={1.1} className="dst-ring" /> : null}
      {highlight ? <circle r={1.3} className="dst-ring is-highlight" /> : null}
      {target ? <circle r={1.0} className="dst-ring is-target" /> : null}
      {unit.underFire && !e.destroyed ? <circle cx={0.75} cy={-0.75} r={0.22} className="dst-underfire" /> : null}
      {badges.length > 0 && !e.destroyed ? (
        <text y={1.35} textAnchor="middle" className="dst-badges">
          {badges.join(' ')}
        </text>
      ) : null}
    </g>
  )
}

export { distance }
