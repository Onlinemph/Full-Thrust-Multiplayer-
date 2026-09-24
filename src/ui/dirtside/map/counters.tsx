import { memo } from 'react'

import { CONFIDENCE_LABELS } from '../../../dirtside/table/confidence'
import type { ElementState, UnitState } from '../../../dirtside/table/types'
import type { InfantryElement } from '../../../dirtside/types'
import { patternUrl } from './defs'
import { type Silhouette, infantryLabel, silhouetteOf } from './geometry'

/**
 * A counter is a model on its base, seen from above: the base in its
 * side's colour, long along the way it faces, with a silhouette in ink that
 * says what it is (tracks and a turret, a carrier's hull, a hover skirt, a
 * walker's legs, three helmets for a team) and a notch and barrel at the
 * front. Everything in the group is centred on the element's point, so the
 * drives and the eye find it at the same place.
 */

/** The vehicle base, front at -y: long along the facing. */
export const VEHICLE_BASE = { x: -0.45, y: -0.65, w: 0.9, h: 1.3 }
export const INFANTRY_BASE = { x: -0.45, y: -0.3, w: 0.9, h: 0.6 }

export type Verdict = 'ok' | 'refused' | null

export interface CounterProps {
  element: ElementState
  unit: UnitState
  code: string
  pid: string
  selected: boolean
  active: boolean
  target: boolean
  highlight: boolean
  verdict: Verdict
  /** Another unit is hovered: this one steps back. */
  dim: boolean
  hovered: boolean
  /** An element of the active unit with nothing left to do this activation. */
  done: boolean
}

const Ink = 'var(--dst-ink)'

/** The running gear and body of a vehicle, in local inches, front at -y. */
export function VehicleSilhouette({ look }: { look: Silhouette }) {
  const gear = (() => {
    switch (look.gear) {
      case 'tracks':
        return (
          <g fill={Ink}>
            <rect x={-0.37} y={-0.55} width={0.15} height={1.08} rx={0.04} />
            <rect x={0.22} y={-0.55} width={0.15} height={1.08} rx={0.04} />
          </g>
        )
      case 'wheels':
        return (
          <g fill={Ink}>
            {[-0.42, -0.1, 0.22].map((y) => (
              <g key={y}>
                <rect x={-0.4} y={y} width={0.12} height={0.22} rx={0.04} />
                <rect x={0.28} y={y} width={0.12} height={0.22} rx={0.04} />
              </g>
            ))}
          </g>
        )
      case 'skirt':
        return (
          <g fill="none" stroke={Ink}>
            <rect x={-0.35} y={-0.53} width={0.7} height={1.08} rx={0.3} strokeWidth={0.06} />
            <circle cy={0.38} r={0.12} strokeWidth={0.05} />
          </g>
        )
      case 'grav':
        return (
          <g>
            <polygon points="0,-0.58 0.32,-0.2 0.32,0.52 -0.32,0.52 -0.32,-0.2" fill="none" stroke={Ink} strokeWidth={0.06} />
            <circle cx={-0.16} cy={0.42} r={0.06} fill={Ink} />
            <circle cx={0.16} cy={0.42} r={0.06} fill={Ink} />
          </g>
        )
      case 'legs':
        return (
          <g fill={Ink}>
            <rect x={-0.4} y={-0.36} width={0.13} height={0.78} rx={0.05} />
            <rect x={0.27} y={-0.36} width={0.13} height={0.78} rx={0.05} />
            <rect x={-0.44} y={0.36} width={0.2} height={0.1} rx={0.03} />
            <rect x={0.24} y={0.36} width={0.2} height={0.1} rx={0.03} />
          </g>
        )
      case 'rotor':
        return (
          <g>
            <circle r={0.42} fill="none" stroke={Ink} strokeWidth={0.05} strokeDasharray="0.12 0.08" />
            <rect x={-0.04} y={0.1} width={0.08} height={0.5} fill={Ink} />
          </g>
        )
      case 'wings':
        return <polygon points="0,-0.6 0.42,0.5 0,0.3 -0.42,0.5" fill="none" stroke={Ink} strokeWidth={0.06} />
      case 'hull':
        return <path d="M0,-0.6 Q0.34,-0.2 0.3,0.52 H-0.3 Q-0.34,-0.2 0,-0.6 Z" fill="none" stroke={Ink} strokeWidth={0.06} />
    }
  })()
  const body = (() => {
    switch (look.body) {
      case 'turret':
        return (
          <g fill={Ink}>
            <circle cy={0.08} r={0.2} />
            <rect x={-0.035} y={-0.86} width={0.07} height={0.9} />
          </g>
        )
      case 'carrier':
        return (
          <g fill="none" stroke={Ink} strokeWidth={0.05}>
            <rect x={-0.2} y={-0.45} width={0.4} height={0.85} />
            <line x1={-0.2} x2={0.2} y1={0.3} y2={0.3} />
          </g>
        )
      case 'ifv':
        return (
          <g>
            <rect x={-0.2} y={-0.45} width={0.4} height={0.85} fill="none" stroke={Ink} strokeWidth={0.05} />
            <line x1={-0.2} x2={0.2} y1={0.3} y2={0.3} stroke={Ink} strokeWidth={0.05} />
            <circle cy={-0.18} r={0.11} fill={Ink} />
            <rect x={-0.025} y={-0.66} width={0.05} height={0.48} fill={Ink} />
          </g>
        )
      case 'artillery':
        return (
          <g fill={Ink}>
            <rect x={-0.18} y={0.02} width={0.36} height={0.42} rx={0.04} />
            <rect x={-0.04} y={-1.0} width={0.08} height={1.1} />
            <circle cy={0.24} r={0.08} fill="var(--dst-paper)" />
          </g>
        )
      case 'air-defence':
        return (
          <g stroke={Ink} fill="none" strokeWidth={0.07} strokeLinecap="round">
            <path d="M-0.22,0.2 A0.26,0.26 0 0 1 0.22,0.2" />
            <path d="M-0.08,0 L-0.12,-0.5 M0.08,0 L0.12,-0.5" strokeWidth={0.05} />
          </g>
        )
      default:
        return <rect x={-0.16} y={-0.3} width={0.32} height={0.6} rx={0.06} fill={Ink} />
    }
  })()
  return (
    <>
      {gear}
      {body}
    </>
  )
}

/** Three helmets for a team, one swapped for the team's glyph (p. 13). */
export function InfantrySilhouette({ inf }: { inf: InfantryElement }) {
  const dots = inf.team === 'rifle' ? [-0.22, 0, 0.22] : [-0.26, -0.04]
  const glyph = (() => {
    switch (inf.team) {
      case 'apsw':
        return <rect x={0.1} y={-0.15} width={0.26} height={0.08} fill={Ink} />
      case 'anti-armour':
        return <path d="M0.1,0.14 L0.22,-0.16 L0.34,0.14" fill="none" stroke={Ink} strokeWidth={0.06} strokeLinejoin="round" />
      case 'observer':
        return <path d="M0.1,0.14 L0.22,-0.14 L0.34,0.14 Z" fill="none" stroke={Ink} strokeWidth={0.05} />
      case 'air-defence':
        return <path d="M0.08,0.12 A0.14,0.14 0 0 1 0.36,0.12" fill="none" stroke={Ink} strokeWidth={0.06} />
      case 'engineer':
        return <path d="M0.1,0.14 V-0.12 H0.34 V0.14" fill="none" stroke={Ink} strokeWidth={0.06} />
      case 'assault':
        return <path d="M0.06,-0.13 L0.18,0 L0.06,0.13 M0.2,-0.13 L0.32,0 L0.2,0.13" fill="none" stroke={Ink} strokeWidth={0.06} />
      default:
        return null
    }
  })()
  return (
    <>
      {inf.troops === 'powered' ? <rect x={-0.38} y={-0.23} width={0.76} height={0.46} rx={0.12} fill="none" stroke={Ink} strokeWidth={0.05} /> : null}
      <g fill={Ink}>
        {dots.map((x, i) => (
          <circle key={i} cx={x} cy={inf.team === 'rifle' && i === 1 ? -0.08 : 0.06} r={0.1} />
        ))}
      </g>
      {glyph}
      {inf.cavalry ? <path d="M-0.3,0.2 h0.6" stroke={Ink} strokeWidth={0.04} strokeDasharray="0.06 0.05" /> : null}
    </>
  )
}

/** What a counter is, in words, for its tooltip. */
export function counterDescription(e: ElementState, unit: UnitState, code: string): string {
  const what = e.vehicle ? `${e.vehicle.role || silhouetteOf(e.vehicle).label}` : e.infantry ? infantryLabel(e.infantry) : 'element'
  const status: string[] = []
  if (e.destroyed) status.push(e.vehicle ? 'knocked out' : 'removed')
  else {
    if (e.damaged) status.push('damaged')
    if (e.immobilised) status.push('immobilised')
    if (e.systemsDown) status.push('systems down')
    if (e.dugIn) status.push('dug in')
    if (e.posture === 'hull-down') status.push('hull down')
    if (e.posture === 'turret-down') status.push('turret down')
    if (e.wood) status.push(e.wood === 'edge' ? 'on a wood edge' : 'within a wood')
    if (unit.evasive) status.push('evading')
    if (unit.underFire) status.push('under fire')
    if (unit.activated) status.push('activated this turn')
    if (unit.confidence !== 'CO') status.push(CONFIDENCE_LABELS[unit.confidence].toLowerCase())
  }
  return `${e.name} — ${code} ${unit.name}${unit.leaderElementId === e.id ? ' (leader)' : ''} · ${what}${status.length ? ` · ${status.join(', ')}` : ''}`
}

function Brackets({ vehicle }: { vehicle: boolean }) {
  const x = 0.62
  const y = vehicle ? 0.84 : 0.46
  const l = 0.24
  return <path className="dst-select" d={`M${-x},${-y + l} V${-y} H${-x + l} M${x},${-y + l} V${-y} H${x - l} M${-x},${y - l} V${y} H${-x + l} M${x},${y - l} V${y} H${x - l}`} />
}

export const Counter = memo(function Counter({ element: e, unit, code, pid, selected, active, target, highlight, verdict, dim, hovered, done }: CounterProps) {
  const base = e.vehicle ? VEHICLE_BASE : INFANTRY_BASE
  const cls = [
    'dst-counter',
    `is-${e.sideId}`,
    e.vehicle ? 'is-vehicle' : 'is-infantry',
    e.destroyed ? 'is-destroyed' : '',
    selected ? 'is-selected' : '',
    active ? 'is-active' : '',
    target ? 'is-target' : '',
    highlight ? 'is-highlight' : '',
    unit.activated && !active ? 'is-spent' : '',
    verdict ? `is-${verdict}` : '',
    dim ? 'is-dim' : '',
    hovered ? 'is-hovered' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const rx = e.vehicle ? 0.12 : 0.18
  const title = counterDescription(e, unit, code)
  if (e.destroyed) {
    return (
      <g className={cls} data-element={e.id} transform={`translate(${e.position.x} ${e.position.y})`}>
        <title>{title}</title>
        <g transform={`rotate(${e.facing})`}>
          <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={rx} className="dst-wreck" />
          <path d={e.vehicle ? 'M-0.28,-0.42 L0.28,0.42 M-0.28,0.42 L0.28,-0.42' : 'M-0.28,-0.2 L0.28,0.2 M-0.28,0.2 L0.28,-0.2'} className="dst-wreck-x" />
        </g>
        {e.vehicle ? (
          <g className="dst-smoke">
            <circle cx={0.35} cy={-0.6} r={0.2} opacity={0.6} />
            <circle cx={0.62} cy={-0.9} r={0.14} opacity={0.45} />
          </g>
        ) : null}
      </g>
    )
  }
  return (
    <g className={cls} data-element={e.id} transform={`translate(${e.position.x} ${e.position.y})`}>
      <title>{title}</title>
      {active ? <circle r={e.vehicle ? 0.95 : 0.72} className={`dst-halo${done ? ' is-done' : ''}`} /> : null}
      {hovered && !active ? <circle r={e.vehicle ? 0.95 : 0.72} className="dst-hover-ring" /> : null}
      <g transform={`translate(0.07 0.1) rotate(${e.facing})`}>
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={rx} className="dst-counter-shadow" />
      </g>
      <g transform={`rotate(${e.facing})`}>
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={rx} className="dst-counter-base" />
        <g className="dst-silhouette" opacity={e.posture === 'turret-down' ? 0.4 : undefined}>
          {e.vehicle ? <VehicleSilhouette look={silhouetteOf(e.vehicle)} /> : e.infantry ? <InfantrySilhouette inf={e.infantry} /> : null}
        </g>
        {e.vehicle ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" className="dst-facing" /> : null}
        {e.systemsDown ? <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={rx} style={{ fill: patternUrl(pid, 'hatch-down') }} opacity={0.55} /> : null}
        {e.immobilised ? <rect x={base.x} y={e.vehicle ? 0.02 : -0.04} width={base.w} height={0.09} className="dst-damage-mark" /> : null}
        {e.damaged ? <polygon points={e.vehicle ? '-0.45,0.3 -0.45,0.65 -0.1,0.65' : '-0.45,0.02 -0.45,0.3 -0.17,0.3'} className="dst-damage-mark" /> : null}
        {selected ? <Brackets vehicle={!!e.vehicle} /> : null}
      </g>
      {highlight ? <circle r={1.3} className="dst-window-ring" /> : null}
      {target ? (
        <g className="dst-reticle">
          <circle r={0.95} />
          <path d="M0,-0.75 V-1.15 M0,0.75 V1.15 M-0.75,0 H-1.15 M0.75,0 H1.15" />
        </g>
      ) : null}
    </g>
  )
})
