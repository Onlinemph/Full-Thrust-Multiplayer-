import { memo } from 'react'

import type { GameState, MobilityKind, Point } from '../../../stargrunt/types'
import { reachPolygon } from './geometry'

/**
 * Presentation-only overlays with no Dirtside analogue: the ghost of a
 * squad's move before it is confirmed, and the line-of-sight/range/odds
 * reticle for a target under consideration. `map/overlays.tsx`'s
 * `AimPreview`/`Tape` patterns are generic enough to import unchanged where
 * TABLE wants them (not needed here); `MovePlot`/`MoveGhost` are Dirtside's
 * own vehicle-move budget and are not reused (`05-reuse-map.md` §4).
 */

export const pts = (points: readonly Point[]) => points.map((p) => `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`).join(' ')

export interface MoveGhostProps {
  state: GameState
  mobility: MobilityKind
  /** Each figure's position before the move. */
  from: Point[]
  /** The translation every figure takes, ending at the pointer. */
  to: Point
  origin: Point
  mode: 'normal' | 'combat' | 'travel'
  inches: number | null
  fits: boolean
}

/** The squad's move as one group: a reach ring around its centre, and a ghost base at each figure's destination. */
export const MoveGhost = memo(function MoveGhost({ state, mobility, from, to, origin, mode, inches, fits }: MoveGhostProps) {
  const dx = to.x - origin.x
  const dy = to.y - origin.y
  const ring = inches !== null ? reachPolygon(origin, inches, mobility, state.setup.table.terrain) : null
  return (
    <g className={`sg-move-ghost${fits ? '' : ' is-over'}`} pointerEvents="none">
      {ring ? <polygon points={pts(ring)} className="sg-reach-ring" /> : null}
      <line x1={origin.x} y1={origin.y} x2={to.x} y2={to.y} className="sg-move-line" />
      {from.map((p, i) => (
        <circle key={i} cx={p.x + dx} cy={p.y + dy} r={0.22} className="sg-move-ghost-base" />
      ))}
      <text x={to.x} y={to.y - 0.35} className="sg-move-label">
        {mode === 'combat' ? `combat move — up to ${inches ?? '?'}″ (rolls a die, doubled)` : `${inches?.toFixed(1) ?? '?'}″ ${mode}`}
      </text>
    </g>
  )
})

export interface AssaultGhostProps {
  from: Point[]
  targetAt: Point
}

/** A close assault's combat move: a line from each attacking figure toward the target unit, contact always made. */
export const AssaultGhost = memo(function AssaultGhost({ from, targetAt }: AssaultGhostProps) {
  return (
    <g className="sg-assault-ghost" pointerEvents="none">
      {from.map((p, i) => (
        <line key={i} x1={p.x} y1={p.y} x2={targetAt.x} y2={targetAt.y} className="sg-assault-line" />
      ))}
      <circle cx={targetAt.x} cy={targetAt.y} r={0.5} className="sg-assault-target" />
    </g>
  )
})

export interface TargetVerdict {
  ok: boolean
  reason?: string
  odds?: string
  range?: number
}

/** A line from the firer to a considered target, coloured by whether the shot can be made, with the odds along it. */
export const FireLine = memo(function FireLine({ from, to, verdict }: { from: Point; to: Point; verdict: TargetVerdict }) {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  return (
    <g className={`sg-fireline ${verdict.ok ? 'is-ok' : 'is-refused'}`} pointerEvents="none">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <text x={mid.x} y={mid.y - 0.15}>
        {verdict.ok ? (verdict.odds ?? '') : (verdict.reason ?? 'no shot')}
      </text>
    </g>
  )
})
