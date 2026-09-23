import { memo, type ReactNode } from 'react'

import { INTEGRITY, OBJECTIVE_REACH, mobile } from '../../../dirtside/table/game'
import { NUKE_EXCLUSION, STRIKE_RADIUS } from '../../../dirtside/table/orbital'
import { unitKind } from '../../../dirtside/table/tableFire'
import { distance } from '../../../dirtside/table/terrain'
import type { ActivationState, CraftState, ElementState, GameState, InterfaceCraft, Objective, OrbitState, Point, SideId, UnitState } from '../../../dirtside/table/types'
import type { RecentMark } from '../TableMap'
import { patternUrl } from './defs'
import { pts, textWidth } from './geometry'

/**
 * What the rules put beside the models: earthworks for posture and cover,
 * each unit's command pennant, the pips under a counter, unit integrity
 * links, the tracks and tracers of what just happened, objective markers,
 * fire called from orbit and the craft that came down. Text and chips are
 * drawn at a fixed screen size (scaled by k, inches per pixel), the rest in
 * inches like the models.
 */

// ---------------------------------------------------------------------------
// Chips: fixed-size labels on the table
// ---------------------------------------------------------------------------

export type Tone = 'plain' | 'ok' | 'warn' | 'damage' | 'north' | 'south' | 'ordnance' | 'dim'

/** A label in a dark box at a fixed pixel size, centred on (x, y) unless anchored to a side. */
export function Chip({ x, y, k, text, tone = 'plain', anchor = 'middle', size = 10.5, dy = 0 }: { x: number; y: number; k: number; text: string; tone?: Tone; anchor?: 'start' | 'middle' | 'end'; size?: number; dy?: number }) {
  const w = textWidth(text, size) + 12
  const h = size + 7
  const left = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0
  return (
    <g className={`dst-chip is-${tone}`} transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x={left} y={-h / 2 + dy} width={w} height={h} rx={3} />
      <text x={left + w / 2} y={dy + size * 0.36} style={{ fontSize: `${size}px` }}>
        {text}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Earthworks, under the counters
// ---------------------------------------------------------------------------

/** Berms, sandbags and evasive streaks in each counter's own frame, and the prepared positions left behind (p. 20). */
export const Earthworks = memo(function Earthworks({ elements, units, prepared, depth }: { elements: ElementState[]; units: Record<string, UnitState>; prepared: Point[]; depth: number }) {
  return (
    <g className="dst-earthworks" pointerEvents="none">
      {prepared.map((p, i) => {
        // Open towards the nearer baseline: the way a crew would have backed in.
        const rot = p.y < depth / 2 ? 180 : 0
        return (
          <g key={`prep-${i}`} transform={`translate(${p.x} ${p.y}) rotate(${rot})`} className="dst-prepared">
            <path d="M-0.53,0.53 A0.75,0.75 0 1 1 0.53,0.53" />
          </g>
        )
      })}
      {elements.map((e) => {
        const unit = units[e.unitId]
        const berm = e.posture !== 'none'
        const evasive = !!unit?.evasive
        if (!e.dugIn && !berm && !evasive) return null
        const v = !!e.vehicle
        return (
          <g key={e.id} transform={`translate(${e.position.x} ${e.position.y}) rotate(${e.facing})`}>
            {e.dugIn ? <rect x={v ? -0.62 : -0.62} y={v ? -0.82 : -0.46} width={1.24} height={v ? 1.64 : 0.92} rx={0.3} className="dst-sandbags" /> : null}
            {berm ? <path d={v ? 'M-0.62,-0.8 Q0,-1.25 0.62,-0.8' : 'M-0.6,-0.45 Q0,-0.8 0.6,-0.45'} className={`dst-berm${e.posture === 'turret-down' ? ' is-turret-down' : ''}`} /> : null}
            {evasive ? <path d={v ? 'M-0.25,0.8 v0.35 M0,0.8 v0.45 M0.25,0.8 v0.35' : 'M-0.25,0.45 v0.3 M0,0.45 v0.4 M0.25,0.45 v0.3'} className={`dst-evasive is-${e.sideId}`} /> : null}
          </g>
        )
      })}
    </g>
  )
})

// ---------------------------------------------------------------------------
// Pennants, element tags and pips, above the counters
// ---------------------------------------------------------------------------

const QUALITY_FILL = { green: '#6fbf5f', regular: '#6fa0ff', veteran: '#ff9f3f' } as const
const CONFIDENCE_WORD = { CO: null, ST: null, SH: 'SHAKEN', BR: 'BROKEN', RO: 'ROUTED' } as const

export interface TagsProps {
  elements: ElementState[]
  units: Record<string, UnitState>
  codes: Record<string, string>
  k: number
  /** Close enough to name every element and letter every pip. */
  near: boolean
  activeUnitId: string | null
  selectedId: string | null
  selectedUnitId: string | null
  hoverUnitId: string | null
  activation: ActivationState | null
}

interface PennantLayout {
  label: string
  lw: number
  flagW: number
  extras: Array<{ text: string; tone: string; w: number }>
  /** The whole pennant's width in pixels, chips included. */
  width: number
}

function pennantLayout(unit: UnitState, code: string, active: boolean): PennantLayout {
  const label = `${code}${unit.commandUnit ? '★' : ''}${unit.activated && !active ? ' ✓' : ''}`
  const lw = textWidth(label, 11) + 10
  const flagW = 17 + lw
  const extras: PennantLayout['extras'] = []
  const conf = CONFIDENCE_WORD[unit.confidence]
  if (conf) extras.push({ text: conf, tone: unit.confidence, w: 0 })
  if (unit.panic) extras.push({ text: 'PANIC', tone: 'RO', w: 0 })
  if (unit.evasive) extras.push({ text: 'EVADING', tone: 'info', w: 0 })
  for (const c of extras) c.w = textWidth(c.text, 9, { spacing: 0.04 }) + 8
  const width = flagW + (unit.underFire ? 20 : 0) + extras.reduce((sum, c) => sum + c.w + 3, 0)
  return { label, lw, flagW, extras, width }
}

/** How far a pennant stands off its leader, in pixels: on a tall staff, or close in when the row above would be covered. */
const STAFF = { tall: 20, short: 3 }
const FLAG_H = 17

/** Where a pennant's staff stands: the top right corner of the leader's base. */
const pennantOffset = (at: ElementState) => (at.vehicle ? { x: 0.36, y: -0.5 } : { x: 0.36, y: -0.22 })

/** A unit's command pennant beside its leader: quality and leadership, the unit's code, and its state (p. 18, p. 21). */
function Pennant({ unit, at, layout, staff, k, active, hovered }: { unit: UnitState; at: ElementState; layout: PennantLayout; staff: number; k: number; active: boolean; hovered: boolean }) {
  const { label, lw, flagW, extras } = layout
  const state = active ? 'is-active' : unit.activated ? 'is-spent' : ''
  const top = -staff - FLAG_H
  const mid = top + FLAG_H / 2
  let x = flagW + 3 + (unit.underFire ? 20 : 0)
  const off = pennantOffset(at)
  return (
    <g className={`dst-pennant is-${unit.sideId} ${state}${hovered ? ' is-hovered' : ''}`} transform={`translate(${at.position.x + off.x} ${at.position.y + off.y}) scale(${k})`}>
      {staff > 4 ? <line x1={0} y1={0} x2={0} y2={-staff} className="dst-pennant-staff" /> : null}
      <rect x={0} y={top} width={flagW} height={FLAG_H} className="dst-pennant-flag" />
      <rect x={1} y={top + 1} width={15} height={15} style={{ fill: QUALITY_FILL[unit.quality] }} className="dst-pennant-lead" />
      <text x={8.5} y={mid + 4} className="dst-pennant-lead-text">
        {unit.leadership}
      </text>
      <text x={17 + lw / 2} y={mid + 4} className="dst-pennant-code">
        {label}
      </text>
      {unit.underFire ? <path d={`M${flagW + 12},${mid - 8} l2.2,4.6 5,-1.6 -2.6,4.4 4.2,3 -5,0.8 0.4,5 -4.2,-2.8 -4.2,2.8 0.4,-5 -5,-0.8 4.2,-3 -2.6,-4.4 5,1.6 z`} className="dst-under-fire" /> : null}
      {extras.map((c) => {
        const cx = x
        x += c.w + 3
        return (
          <g key={c.text} className={`dst-pennant-chip is-${c.tone}`}>
            <rect x={cx} y={mid - 7} width={c.w} height={14} rx={2} />
            <text x={cx + c.w / 2} y={mid + 3.3}>
              {c.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function Pips({ e, k, near, record }: { e: ElementState; k: number; near: boolean; record: ActivationState['elements'][string] | null }) {
  const items: ReactNode[] = []
  let x = 0
  const add = (node: (cx: number) => ReactNode) => {
    items.push(node(x))
    x += 11
  }
  if (record) {
    add((cx) => <path key="m" d={`M${cx - 3.5},-3.5 L${cx + 4},0 L${cx - 3.5},3.5 Z`} className={`dst-pip-move${record.moved ? ' is-spent' : ''}`} />)
    add((cx) => <path key="f" d={`M${cx},-4.5 L${cx + 1.4},-1.4 L${cx + 4.5},0 L${cx + 1.4},1.4 L${cx},4.5 L${cx - 1.4},1.4 L${cx - 4.5},0 L${cx - 1.4},-1.4 Z`} className={`dst-pip-fire${record.fired ? ' is-spent' : ''}`} />)
  }
  const status: Array<{ letter: string; cls: string }> = []
  if (e.damaged) status.push({ letter: 'D', cls: 'is-damaged' })
  if (e.immobilised) status.push({ letter: 'I', cls: 'is-immobilised' })
  if (e.systemsDown) status.push({ letter: 'S', cls: 'is-systems' })
  for (const s of status)
    add((cx) => (
      <g key={s.letter} className={`dst-pip ${s.cls}`}>
        <circle cx={cx} r={near ? 5.5 : 4} />
        {near ? (
          <text x={cx} y={3}>
            {s.letter}
          </text>
        ) : null}
      </g>
    ))
  if (items.length === 0) return null
  const width = x - 11
  const below = e.vehicle ? 0.72 : 0.4
  return (
    <g transform={`translate(${e.position.x} ${e.position.y + below}) scale(${k}) translate(${-width / 2} 7)`} className="dst-pips">
      {items}
    </g>
  )
}

export const Tags = memo(function Tags({ elements, units, codes, k, near, activeUnitId, selectedId, selectedUnitId, hoverUnitId, activation }: TagsProps) {
  const leaders: Array<{ unit: UnitState; at: ElementState }> = []
  const byUnit = new Map<string, ElementState[]>()
  for (const e of elements) {
    const list = byUnit.get(e.unitId)
    if (list) list.push(e)
    else byUnit.set(e.unitId, [e])
  }
  for (const [unitId, list] of byUnit) {
    const unit = units[unitId]
    if (!unit) continue
    leaders.push({ unit, at: list.find((e) => e.id === unit.leaderElementId) ?? list[0]! })
  }
  return (
    <g className="dst-tags" pointerEvents="none">
      {elements.map((e) => (
        <Pips key={`p-${e.id}`} e={e} k={k} near={near} record={activation && activation.unitId === e.unitId ? (activation.elements[e.id] ?? null) : null} />
      ))}
      {elements.map((e) => {
        const named = near || e.unitId === activeUnitId || e.unitId === selectedUnitId || e.unitId === hoverUnitId
        if (!named) return null
        const unit = units[e.unitId]
        const index = unit ? unit.elementIds.indexOf(e.id) + 1 : 0
        const tag = `${codes[e.unitId] ?? ''}·${index}`
        // Named only where the name has room, except the element picked.
        const half = (textWidth(tag, 9) / 2 + 3) * k
        if (e.id !== selectedId && elements.some((o) => o !== e && Math.abs(o.position.x - e.position.x) < half * 2 && Math.abs(o.position.y - e.position.y) < 14 * k)) return null
        const hasPips = e.damaged || e.immobilised || e.systemsDown || e.unitId === activation?.unitId
        return (
          <text key={`t-${e.id}`} x={e.position.x} y={e.position.y + (e.vehicle ? 0.72 : 0.4)} className={`dst-element-tag is-${e.sideId}`} dy={`${(hasPips ? 23 : 9) * k}`}>
            {tag}
          </text>
        )
      })}
      {leaders.map(({ unit, at }) => {
        const active = unit.id === activeUnitId
        const layout = pennantLayout(unit, codes[unit.id] ?? '', active)
        // A tall staff unless it would plant the flag on the counters above.
        const off = pennantOffset(at)
        const x0 = at.position.x + off.x - 0.5
        const x1 = at.position.x + off.x + layout.width * k + 0.5
        const y1 = at.position.y + off.y
        const y0 = y1 - (STAFF.tall + FLAG_H) * k - 0.35
        const crowded = y0 < -0.2 || elements.some((e) => e !== at && e.position.x >= x0 && e.position.x <= x1 && e.position.y >= y0 && e.position.y <= y1)
        return <Pennant key={unit.id} unit={unit} at={at} layout={layout} staff={crowded ? STAFF.short : STAFF.tall} k={k} active={active} hovered={unit.id === hoverUnitId} />
      })}
    </g>
  )
})

// ---------------------------------------------------------------------------
// Unit integrity (p. 23)
// ---------------------------------------------------------------------------

/** Links between unit-mates within integrity distance, and a warning ring on any left without one. */
export function IntegrityLinks({ state, unitIds }: { state: GameState; unitIds: string[] }) {
  const out: ReactNode[] = []
  for (const unitId of new Set(unitIds)) {
    const unit = state.units[unitId]
    if (!unit) continue
    const members = unit.elementIds.map((id) => state.elements[id]!).filter((e) => e && mobile(e))
    if (members.length < 2) continue
    const limit = INTEGRITY[unitKind(state, unit)]
    for (let i = 0; i < members.length; i++) {
      let linked = false
      for (let j = 0; j < members.length; j++) {
        if (i === j) continue
        const a = members[i]!
        const b = members[j]!
        if (distance(a.position, b.position) > limit + 1e-9) continue
        linked = true
        if (j > i) out.push(<line key={`${a.id}-${b.id}`} x1={a.position.x} y1={a.position.y} x2={b.position.x} y2={b.position.y} className={`dst-link is-${unit.sideId}`} />)
      }
      if (!linked) out.push(<circle key={`lone-${members[i]!.id}`} cx={members[i]!.position.x} cy={members[i]!.position.y} r={1.05} className="dst-scattered" />)
    }
  }
  return (
    <g className="dst-links" pointerEvents="none">
      {out}
    </g>
  )
}

// ---------------------------------------------------------------------------
// What just happened
// ---------------------------------------------------------------------------

const markKey = (m: RecentMark) => (m.kind === 'move' ? `m${pts(m.path)}` : `f${m.from.x},${m.from.y}>${m.to.x},${m.to.y}:${m.result}`)

const SPIKES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8
  return `M${(Math.sin(a) * 0.85).toFixed(3)},${(-Math.cos(a) * 0.85).toFixed(3)} L${(Math.sin(a) * 1.3).toFixed(3)},${(-Math.cos(a) * 1.3).toFixed(3)}`
}).join(' ')

/**
 * The last moves as tracks (drawn under the counters) or the last shots as
 * tracers with a burst round what they hit (drawn over them), older ones fainter.
 */
export const RecentMarks = memo(function RecentMarks({ recent, only }: { recent: RecentMark[]; only: 'move' | 'fire' }) {
  const n = recent.length
  return (
    <g className="dst-recent" pointerEvents="none">
      {recent.map((m, i) => {
        if (m.kind !== only) return null
        const opacity = Math.max(0.3, 1 - (n - 1 - i) * 0.22)
        if (m.kind === 'move') {
          if (m.path.length < 2) return null
          const a = m.path[m.path.length - 2]!
          const b = m.path[m.path.length - 1]!
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
          return (
            <g key={markKey(m)} className={`dst-trail is-${m.side}`} style={{ opacity }}>
              <polyline points={pts(m.path)} className="dst-trail-casing" />
              <polyline points={pts(m.path)} className="dst-trail-line" />
              <circle cx={m.path[0]!.x} cy={m.path[0]!.y} r={0.16} className="dst-trail-start" />
              <path d="M-0.55,-0.32 L0,0 L-0.55,0.32" transform={`translate(${b.x} ${b.y}) rotate(${ang}) translate(-0.9 0)`} className="dst-trail-head" />
            </g>
          )
        }
        const d = distance(m.from, m.to)
        const t0 = d > 1.6 ? 0.75 / d : 0
        const t1 = d > 1.6 ? 1 - 0.95 / d : 1
        return (
          <g key={markKey(m)} className={`dst-tracer is-${m.side} is-${m.result}`} style={{ opacity }}>
            <line x1={m.from.x + (m.to.x - m.from.x) * t0} y1={m.from.y + (m.to.y - m.from.y) * t0} x2={m.from.x + (m.to.x - m.from.x) * t1} y2={m.from.y + (m.to.y - m.from.y) * t1} className="dst-tracer-line" />
            <g transform={`translate(${m.to.x} ${m.to.y})`}>{m.result === 'miss' ? <circle r={0.9} className="dst-tracer-miss" /> : <path d={SPIKES} className={`dst-tracer-burst is-${m.result}`} />}</g>
          </g>
        )
      })}
    </g>
  )
})

// ---------------------------------------------------------------------------
// Objectives (p. 17)
// ---------------------------------------------------------------------------

export const Objectives = memo(function Objectives({ objectives, held, viewer, sideNames }: { objectives: Objective[]; held: GameState['objectives']; viewer: SideId | null; sideNames: Record<SideId, string> }) {
  return (
    <g className="dst-objectives">
      {objectives.map((o) => {
        const holder = held[o.id]?.heldBy ?? null
        const known = viewer !== null && (o.drawnBy === viewer || holder === viewer)
        const title = `Objective placed by ${o.drawnBy ? sideNames[o.drawnBy] : 'the scenario'} · ${known ? `worth ${o.value}` : 'value hidden from you'}${holder ? ` · held by ${sideNames[holder]}` : ''} · move within ${OBJECTIVE_REACH}" to take it (p. 17)`
        return (
          <g key={o.id} transform={`translate(${o.position.x} ${o.position.y})`} className={`dst-objective-mark${holder ? ` is-held is-${holder}` : ''}`}>
            <title>{title}</title>
            <circle r={OBJECTIVE_REACH} className="dst-objective-reach" />
            {holder ? (
              <>
                <line y1={-0.5} y2={-1.5} className="dst-objective-staff" />
                <polygon points="0,-1.5 0.8,-1.3 0,-1.07" className="dst-objective-flag" />
              </>
            ) : null}
            {o.drawnBy ? <circle r={0.58} className={`dst-objective-owner is-${o.drawnBy}`} /> : null}
            <circle r={0.5} className="dst-objective-chit" />
            <text y={0.21} className="dst-objective-value">
              {known ? o.value : '?'}
            </text>
          </g>
        )
      })}
    </g>
  )
})

// ---------------------------------------------------------------------------
// Fire from orbit (Dirtside pp. 38–40, More Thrust p. 17)
// ---------------------------------------------------------------------------

export function Orbital({ orbit, k, pid, callers }: { orbit: OrbitState; k: number; pid: string; callers: Record<string, string> }) {
  return (
    <g className="dst-orbital" pointerEvents="none">
      {orbit.nukes.map((n, i) => (
        <g key={`nuke-${i}`} transform={`translate(${n.x} ${n.y})`} className="dst-nuke">
          <circle r={NUKE_EXCLUSION} style={{ fill: patternUrl(pid, 'hatch-fallout') }} />
          <circle r={NUKE_EXCLUSION} className="dst-fallout-ring" />
          <circle r={1.1} className="dst-crater-scorch" />
          <circle r={0.85} className="dst-crater-scorch is-inner" />
          <circle r={0.6} className="dst-crater" />
          <text y={0.21} className="dst-crater-label">
            ☢
          </text>
          <title>{`Ground zero of an orbital strike: unprotected troops and vehicles keep ${NUKE_EXCLUSION}" away`}</title>
          <Chip x={0} y={NUKE_EXCLUSION + 0.1} dy={9} k={k} text={`FALLOUT · KEEP ${NUKE_EXCLUSION}" AWAY`} tone="dim" size={9} />
        </g>
      ))}
      {orbit.strikes.map((st) => {
        const r = STRIKE_RADIUS[st.attack]
        return (
          <g key={st.id} transform={`translate(${st.aim.x} ${st.aim.y})`} className={`dst-strike-mark is-${st.side}`}>
            <title>{`Impact marker: ${st.attack === 'pbm' ? 'ortillery' : 'a converged sheaf'} called by ${callers[st.calledBy] ?? 'an observer'}, arriving after the next enemy activation; it may stray up to 7"`}</title>
            <circle r={7} className="dst-strike-stray" />
            <circle r={r} style={{ fill: patternUrl(pid, 'hatch-ordnance') }} />
            <circle r={r} className="dst-strike-rim" />
            <path d="M-0.8,0 H-0.3 M0.3,0 H0.8 M0,-0.8 V-0.3 M0,0.3 V0.8" className="dst-strike-reticle" />
            <circle r={0.3} className="dst-strike-reticle" />
            <Chip x={0} y={r + 0.2} dy={9} k={k} text={`${st.attack === 'pbm' ? 'ORTILLERY' : 'SHEAF'} · ${st.opponentActed ? 'DUE NOW' : 'AFTER NEXT ENEMY ACTIVATION'}`} tone="ordnance" size={9} />
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Interface craft (p. 43)
// ---------------------------------------------------------------------------

export const CRAFT_PATH = {
  dropship: 'M0,-1.3 L0.9,0.2 L0.6,1.0 L-0.6,1.0 L-0.9,0.2 Z',
  lander: 'M0,-0.9 L0.7,0.7 L-0.7,0.7 Z',
} as const

export function CraftShape({ kind, side }: { kind: InterfaceCraft['kind']; side: SideId | null }) {
  return (
    <>
      <path d={CRAFT_PATH[kind]} className="dst-craft-hull" />
      {side ? <rect x={kind === 'dropship' ? -0.72 : -0.42} y={kind === 'dropship' ? 0.35 : 0.2} width={kind === 'dropship' ? 1.44 : 0.84} height={0.22} className={`dst-craft-band is-${side}`} /> : null}
      <path d={kind === 'dropship' ? 'M0,-0.9 V0.7' : 'M0,-0.5 V0.5'} className="dst-craft-spine" />
    </>
  )
}

export function CraftMarks({ craft, records, k }: { craft: InterfaceCraft[]; records: Record<string, CraftState>; k: number }) {
  return (
    <g className="dst-craft-layer">
      {craft.map((c) => {
        const record = records[c.id]
        if (!record?.position || record.status === 'lost') return null
        const empty = record.status === 'empty'
        return (
          <g key={c.id} transform={`translate(${record.position.x} ${record.position.y})`} className={`dst-craft-mark is-${c.side}${empty ? ' is-empty' : ''}`}>
            <title>{`${c.name}: ${c.kind === 'dropship' ? 'dropship' : 'assault lander'}, ${empty ? 'unloaded' : 'on the ground, loaded'}`}</title>
            <path d={CRAFT_PATH[c.kind]} transform="translate(0.12 0.18)" className="dst-craft-shadow" />
            <CraftShape kind={c.kind} side={c.side} />
            <Chip x={0} y={c.kind === 'dropship' ? 1.1 : 0.8} dy={9} k={k} text={c.name.toUpperCase()} tone={c.side} size={9} />
          </g>
        )
      })}
    </g>
  )
}
