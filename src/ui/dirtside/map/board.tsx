import { memo } from 'react'

import type { GameSetup, SideId } from '../../../dirtside/table/types'
import { patternUrl } from './defs'
import { deploymentBand } from './geometry'

/**
 * The table itself: the dark surround it stands in, a wooden frame edged in
 * the colour of the side to act, grass with a faint 6" grid, rulers along
 * the frame, both baselines in their sides' colours, the thirds of p. 17
 * named in the margin, and where each side may deploy while it does.
 */

export interface BoardProps {
  setup: GameSetup
  pid: string
  /** The side to act, for the frame's colour; null leaves it neutral. */
  toAct: SideId | null
  /** The computer is playing the side to act: the frame pulses. */
  computer: boolean
  sideNames: Record<SideId, string>
}

export const Board = memo(function Board({ setup, pid, toAct, computer, sideNames }: BoardProps) {
  const { width: W, depth: D } = setup.table
  const ticks: string[] = []
  for (let x = 0; x <= W + 1e-9; x += 1) ticks.push(`M${x},-0.32 v${x % 6 === 0 ? -0.42 : -0.2}`)
  for (let y = 0; y <= D + 1e-9; y += 1) ticks.push(`M-0.32,${y} h${y % 6 === 0 ? -0.42 : -0.2}`)
  const numbers: number[] = []
  for (let x = 6; x < W - 1e-9; x += 6) numbers.push(x)
  return (
    <g className="dst-board">
      <rect x={-W} y={-D} width={W * 3} height={D * 3} className="dst-surround" />
      <rect x={-0.32} y={-0.32} width={W + 0.64} height={D + 0.64} transform="translate(0.25 0.35)" fill="rgba(0,0,0,.5)" />
      <rect x={-0.32} y={-0.32} width={W + 0.64} height={D + 0.64} className={`dst-frame${toAct ? ` is-${toAct}` : ''}${computer ? ' is-computer' : ''}`}>
        <title>{toAct ? `${sideNames[toAct]} to act${computer ? ' (the computer)' : ''}` : 'The table'}</title>
      </rect>
      <rect x={0} y={0} width={W} height={D} style={{ fill: patternUrl(pid, 'grass') }} className="dst-ground-grass" />
      <rect x={0} y={0} width={W} height={D} style={{ fill: patternUrl(pid, 'grid') }} pointerEvents="none" />
      <path d={ticks.join(' ')} className="dst-ruler-ticks" />
      <g className="dst-ruler" aria-hidden="true">
        {numbers.map((x) => (
          <text key={x} x={x} y={-0.95}>
            {x === W / 2 ? `${x}"` : x}
          </text>
        ))}
      </g>
    </g>
  )
})

/** Baselines, thirds and their names: drawn over the terrain, under the counters. */
export const BoardMarks = memo(function BoardMarks({ setup, sideNames }: { setup: GameSetup; sideNames: Record<SideId, string> }) {
  const { width: W, depth: D } = setup.table
  const encounter = setup.battle === 'encounter'
  const rearTitle = encounter ? 'In an encounter, declaring game end needs an objective held in the enemy rear area (p. 17)' : 'The thirds of the table (p. 17)'
  return (
    <g className="dst-board-marks">
      <line x1={0} x2={W} y1={D / 3} y2={D / 3} className="dst-third-line" />
      <line x1={0} x2={W} y1={(2 * D) / 3} y2={(2 * D) / 3} className="dst-third-line" />
      <rect x={0} y={-0.07} width={W} height={0.14} className="dst-baseline is-north" />
      <rect x={0} y={D - 0.07} width={W} height={0.14} className="dst-baseline is-south" />
      <g className="dst-margin-label">
        <text transform={`translate(-0.95 ${D / 6}) rotate(-90)`}>
          <title>{rearTitle}</title>
          {sideNames.north.toUpperCase()} REAR AREA
        </text>
        <text transform={`translate(-0.95 ${D / 2}) rotate(-90)`}>
          <title>The main battle area: the middle third (p. 17)</title>
          MAIN BATTLE AREA
        </text>
        <text transform={`translate(-0.95 ${(5 * D) / 6}) rotate(-90)`}>
          <title>{rearTitle}</title>
          {sideNames.south.toUpperCase()} REAR AREA
        </text>
      </g>
      <g className="dst-baseline-label">
        <text transform={`translate(${W + 0.95} ${D / 6}) rotate(90)`} className="is-north">
          ▲ {sideNames.north.toUpperCase()} BASELINE
        </text>
        <text transform={`translate(${W + 0.95} ${(5 * D) / 6}) rotate(90)`} className="is-south">
          {sideNames.south.toUpperCase()} BASELINE ▼
        </text>
      </g>
    </g>
  )
})

/** Where each side may set up, while it is still deploying: from the deployment rule, not assumed (p. 17). */
export const DeploymentZones = memo(function DeploymentZones({ setup, pid, sideNames, ready }: { setup: GameSetup; pid: string; sideNames: Record<SideId, string>; ready: Record<SideId, boolean> }) {
  const W = setup.table.width
  const attacker = setup.battle === 'attack-defence' ? (setup.attacker ?? 'north') : null
  return (
    <g className="dst-zones" pointerEvents="none">
      {(['north', 'south'] as SideId[]).map((side) => {
        if (ready[side]) return null
        const band = deploymentBand(setup, side)
        if (!band) return null
        const inner = side === 'north' ? band.y1 : band.y0
        const defender = attacker !== null && side !== attacker
        const text = defender ? `${sideNames[side].toUpperCase()} DEPLOYS ANYWHERE FROM HERE TO ITS BASELINE` : `${sideNames[side].toUpperCase()} DEPLOYS HERE · WITHIN ${Math.round(band.y1 - band.y0)}" OF ITS BASELINE`
        return (
          <g key={side} className={`dst-deploy is-${side}`}>
            <rect x={0} y={band.y0} width={W} height={band.y1 - band.y0} className="dst-deploy-wash" />
            <rect x={0} y={band.y0} width={W} height={band.y1 - band.y0} style={{ fill: patternUrl(pid, `hatch-${side}`) }} />
            <line x1={0} x2={W} y1={inner} y2={inner} className="dst-deploy-edge" />
            <text x={W - 0.5} y={side === 'north' ? inner - 0.45 : inner + 0.45} dominantBaseline={side === 'north' ? 'auto' : 'hanging'} className="dst-deploy-label">
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
})
