import { memo } from 'react'

import { isInIntegrity, minEnclosingCircle } from '../../../stargrunt/table/cover'
import { QUALITY_DIE, type Confidence, type FigureState, type GameState, type Quality, type UnitState } from '../../../stargrunt/types'
import { textWidth } from '../../dirtside/map/geometry'

/**
 * A squad on the table: every figure as a small base in its side's colour
 * with a glyph for its kit, and one pennant a squad carrying its code,
 * quality, leadership, confidence and suppression. The Dirtside ground
 * (`map/board.tsx`, `map/terrain.tsx`) and camera (`map/useTableView.ts`)
 * are reused unchanged (`05-reuse-map.md` §3); this file is Stargrunt's own
 * new layer, the figure having no Dirtside analogue.
 */

export const FIGURE_R = 0.22

/** Least confident first, so a fold to "the worst present" (unused here) reads the same direction as `CONFIDENCE_LEVELS`. */
export const CONFIDENCE_LABELS: Record<Confidence, string> = { CO: 'Confident', ST: 'Steady', SH: 'Shaken', BR: 'Broken', RO: 'Routed' }
export const QUALITY_LABELS: Record<Quality, string> = { untrained: 'Untrained', green: 'Green', regular: 'Regular', veteran: 'Veteran', elite: 'Elite' }

function roleGlyph(f: FigureState, isLeader: boolean) {
  if (isLeader)
    return (
      <path
        d="M0,-0.13 L0.04,-0.04 L0.14,-0.04 L0.06,0.02 L0.09,0.12 L0,0.06 L-0.09,0.12 L-0.06,0.02 L-0.14,-0.04 L-0.04,-0.04 Z"
        className="sg-glyph"
      />
    )
  if (f.role === 'medic') return <path d="M-0.09,0 H0.09 M0,-0.09 V0.09" className="sg-glyph sg-glyph-medic" strokeWidth={0.05} stroke="currentColor" />
  if (f.supportWeapon) return <rect x={-0.02} y={-0.19} width={0.04} height={0.26} rx={0.02} className="sg-glyph" transform="rotate(20)" />
  if (f.role === 'observer') return <path d="M-0.1,0.07 A0.12,0.12 0 0 1 0.1,0.07" className="sg-glyph" fill="none" stroke="currentColor" strokeWidth={0.045} />
  if (f.role === 'comms') return <path d="M-0.09,0.09 Q0,-0.14 0.09,0.09" className="sg-glyph" fill="none" stroke="currentColor" strokeWidth={0.045} />
  if (f.role === 'sniper') return <circle r={0.05} className="sg-glyph" fill="none" stroke="currentColor" strokeWidth={0.035} />
  return null
}

export interface FigureMarkProps {
  figure: FigureState
  isLeader: boolean
  selected: boolean
  active: boolean
  target: boolean
  dim: boolean
}

/** One trooper's base, seen from above: a small round base in its side's colour with a glyph for its kit. */
export const FigureMark = memo(function FigureMark({ figure: f, isLeader, selected, active, target, dim }: FigureMarkProps) {
  const dead = f.status === 'dead'
  const wounded = f.status === 'wounded'
  const stabilised = f.status === 'stabilised'
  const cls = ['sg-figure', `is-${f.sideId}`, dead ? 'is-dead' : '', wounded ? 'is-wounded' : '', stabilised ? 'is-stabilised' : '', selected ? 'is-selected' : '', active ? 'is-active' : '', target ? 'is-target' : '', dim ? 'is-dim' : ''].filter(Boolean).join(' ')
  if (dead) {
    return (
      <g className={cls} transform={`translate(${f.position.x} ${f.position.y})`}>
        <title>{`${f.name} — dead`}</title>
        <path d="M-0.12,-0.12 L0.12,0.12 M-0.12,0.12 L0.12,-0.12" className="sg-dead-x" />
      </g>
    )
  }
  const label = `${f.name}${isLeader ? ' (leader)' : ''} — ${wounded ? 'wounded' : stabilised ? 'stabilised, out of the fight' : 'fit'}${f.supportWeapon ? `, ${f.supportWeapon}` : ''}`
  return (
    <g className={cls} data-figure={f.id} transform={`translate(${f.position.x} ${f.position.y})`}>
      <title>{label}</title>
      {active ? <circle r={FIGURE_R + 0.16} className="sg-halo" /> : null}
      <circle r={FIGURE_R} className="sg-figure-base" />
      <g className="sg-figure-glyph">{roleGlyph(f, isLeader)}</g>
      {wounded ? <circle r={FIGURE_R + 0.07} className="sg-wound-ring" /> : null}
      {stabilised ? <path d="M-0.14,0.14 L0.14,0.14 M-0.1,0.19 L0.1,0.19" className="sg-stab-mark" /> : null}
      {selected ? <circle r={FIGURE_R + 0.12} className="sg-select-ring" /> : null}
      {target ? <circle r={FIGURE_R + 0.2} className="sg-target-ring" /> : null}
    </g>
  )
})

export interface SquadPennantProps {
  unit: UnitState
  code: string
  at: { x: number; y: number }
  active: boolean
  selected: boolean
  hovered: boolean
  organised: boolean
  /** 1/pixels-per-inch: the pennant is drawn in a `scale(k)` group so its text stays one screen size at any zoom (Dirtside's own `map/marks.tsx` `Pennant` does the same). */
  k: number
}

const PENNANT_STAFF = 15
const PENNANT_H = 16

/** Least confident first, so a fold to "the worst present" reads the same direction the checks read. */
const CHIP_LABEL: Record<Confidence, string> = { CO: 'CO', ST: 'ST', SH: 'SH', BR: 'BR', RO: 'RO' }

/**
 * The squad's pennant (p. 9's activation marker, read as a map tag): code,
 * quality die, leadership, confidence and up to three suppression pips
 * (p. 18), the in-position flag (p. 13), and a mark when it is out of
 * integrity (p. 11). Drawn in on-screen pixels inside a `scale(k)` group so
 * it is as legible zoomed out over the whole table as zoomed in on one
 * squad — the same technique as Dirtside's own unit pennant.
 */
export const SquadPennant = memo(function SquadPennant({ unit, code, at, active, selected, hovered, organised, k }: SquadPennantProps) {
  const cls = ['sg-pennant', `is-${unit.sideId}`, `conf-${unit.confidence}`, active ? 'is-active' : '', selected ? 'is-selected' : '', hovered ? 'is-hovered' : ''].filter(Boolean).join(' ')
  const leadText = `D${QUALITY_DIE[unit.quality]}·${unit.leadership}`
  const codeW = textWidth(code, 11) + 9
  const leadW = textWidth(leadText, 9.5) + 8
  const flagW = codeW + leadW
  const top = -PENNANT_STAFF - PENNANT_H
  const mid = top + PENNANT_H / 2
  const chips: Array<{ text: string; tone: string }> = [{ text: CHIP_LABEL[unit.confidence], tone: unit.confidence }]
  if (unit.suppression > 0) chips.push({ text: '●'.repeat(unit.suppression), tone: 'suppress' })
  if (unit.inPosition) chips.push({ text: 'IP', tone: 'ip' })
  if (!organised) chips.push({ text: 'DIS', tone: 'dis' })
  if (unit.panic) chips.push({ text: 'PANIC', tone: 'ro' })
  let x = flagW + 4
  const chipEls = chips.map((c) => {
    const w = textWidth(c.text, 9, { spacing: 0.04 }) + 8
    const cx = x
    x += w + 3
    return (
      <g key={c.text} className={`sg-pennant-chip is-${c.tone}`}>
        <rect x={cx} y={mid - 7} width={w} height={14} rx={2} />
        <text x={cx + w / 2} y={mid + 3.3}>
          {c.text}
        </text>
      </g>
    )
  })
  return (
    <g className={cls} data-unit={unit.id} transform={`translate(${at.x} ${at.y}) scale(${k})`}>
      <title>
        {unit.name} · {QUALITY_LABELS[unit.quality]} (D{QUALITY_DIE[unit.quality]}) · leader {unit.leadership} · {CONFIDENCE_LABELS[unit.confidence]}
        {unit.suppression ? ` · suppressed x${unit.suppression}` : ''}
        {unit.inPosition ? ' · in position' : ''}
        {!organised ? ' · disorganised' : ''}
        {unit.panic ? ' · panicked' : ''}
        {unit.travelling ? ' · travel-formed' : ''}
      </title>
      {/* A generous, invisible hit area: the pole and flag are thin, but the whole pennant should be an
          easy click target for picking the squad, the way a real pennant on a table is picked up by hand. */}
      <rect x={-4} y={top - 4} width={x + 4} height={PENNANT_H + PENNANT_STAFF + 8} fill="transparent" />
      <line x1={0} y1={0} x2={0} y2={-PENNANT_STAFF} className="sg-pennant-pole" />
      <rect x={0} y={top} width={flagW} height={PENNANT_H} rx={2} className="sg-pennant-flag" />
      <rect x={codeW} y={top + 1.5} width={leadW - 1.5} height={PENNANT_H - 3} rx={1.5} className="sg-pennant-lead" />
      <text x={codeW / 2} y={mid + 3.8} className="sg-pennant-code">
        {code}
      </text>
      <text x={codeW + (leadW - 1.5) / 2} y={mid + 3.3} className="sg-pennant-q">
        {leadText}
      </text>
      {chipEls}
    </g>
  )
})

/** The selected squad's integrity (p. 11): a dashed 6" circle when its figures fit inside one, else the 2" chain linking them. */
export const IntegrityMarks = memo(function IntegrityMarks({ state, unitId }: { state: GameState; unitId: string }) {
  const unit = state.units[unitId]
  if (!unit) return null
  const positions = unit.figureIds.map((id) => state.figures[id]).filter((f): f is FigureState => !!f && f.status !== 'dead').map((f) => f.position)
  if (positions.length < 2) return null
  const ok = isInIntegrity(positions)
  const circle = minEnclosingCircle(positions)
  const fits = circle.radius * 2 <= 6 + 1e-6
  const cls = `sg-integrity ${ok ? 'is-ok' : 'is-broken'}`
  if (fits) return <circle className={cls} cx={circle.centre.x} cy={circle.centre.y} r={3} />
  const links: Array<[number, number]> = []
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i]!.x - positions[j]!.x
      const dy = positions[i]!.y - positions[j]!.y
      if (Math.hypot(dx, dy) <= 2 + 1e-6) links.push([i, j])
    }
  return (
    <g className={cls}>
      {links.map(([i, j]) => (
        <line key={`${i}-${j}`} x1={positions[i]!.x} y1={positions[i]!.y} x2={positions[j]!.x} y2={positions[j]!.y} />
      ))}
    </g>
  )
})
