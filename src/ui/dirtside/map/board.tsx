import { memo } from 'react'

import type { ElementState, GameSetup, SideId, UnitState } from '../../../dirtside/table/types'
import { patternUrl } from './defs'
import { type Box, clearestSpot, deploymentBand, fitLabel, textWidth } from './geometry'

/**
 * The table itself: the dark surround it stands in, a wooden frame edged in
 * the colour of the side to act, grass with a faint 6" grid, rulers along
 * the frame, both baselines in their sides' colours, the thirds of p. 17
 * named in the margin, and where each side may deploy while it does.
 */

/**
 * `Board` and `BoardMarks` read only a table's width, depth and battle kind
 * — nothing about elements or a design. Typed to that narrow shape rather
 * than Dirtside's own `GameSetup` (which also carries `sides`, `craft`…),
 * so a second game's setup satisfies it too without a cast; Dirtside's own
 * `GameSetup` still has this shape and more, so every existing call is
 * unaffected (`05-reuse-map.md` §3: "Import unchanged").
 */
export interface TableDims {
  table: { width: number; depth: number }
  battle?: 'encounter' | 'attack-defence'
}

export interface BoardProps {
  setup: TableDims
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
      <g className="dst-edge-ruler" aria-hidden="true">
        {numbers.map((x) => (
          <text key={x} x={x} y={-0.95}>
            {x === W / 2 ? `${x}"` : x}
          </text>
        ))}
      </g>
    </g>
  )
})

/** The margin lettering's size and spacing (dirtsideMap.css), for fitting it to its third. */
const MARGIN_TYPE = { size: 8.5, spacing: 0.1 }

/** Baselines, thirds and their names: drawn over the terrain, under the counters. Each name fits its third of the edge, cut short or left out when it cannot. */
export const BoardMarks = memo(function BoardMarks({ setup, sideNames, k }: { setup: TableDims; sideNames: Record<SideId, string>; k: number }) {
  const { width: W, depth: D } = setup.table
  const encounter = setup.battle === 'encounter'
  const rearTitle = encounter ? 'In an encounter, declaring game end needs an objective held in the enemy rear area (p. 17)' : 'The thirds of the table (p. 17)'
  const room = D / 3 / k - 14
  const north = sideNames.north.toUpperCase()
  const south = sideNames.south.toUpperCase()
  const margin = { bold: false, spacing: MARGIN_TYPE.spacing }
  const bold = { bold: true, spacing: MARGIN_TYPE.spacing }
  const labels = {
    northRear: fitLabel(north, (n) => `${n} REAR AREA`, 'REAR AREA', room, MARGIN_TYPE.size, margin),
    main: fitLabel('', () => 'MAIN BATTLE AREA', 'BATTLE AREA', room, MARGIN_TYPE.size, margin),
    southRear: fitLabel(south, (n) => `${n} REAR AREA`, 'REAR AREA', room, MARGIN_TYPE.size, margin),
    northBase: fitLabel(north, (n) => `▲ ${n} BASELINE`, '▲ BASELINE', room, MARGIN_TYPE.size, bold),
    southBase: fitLabel(south, (n) => `${n} BASELINE ▼`, 'BASELINE ▼', room, MARGIN_TYPE.size, bold),
  }
  return (
    <g className="dst-board-marks">
      <line x1={0} x2={W} y1={D / 3} y2={D / 3} className="dst-third-line" />
      <line x1={0} x2={W} y1={(2 * D) / 3} y2={(2 * D) / 3} className="dst-third-line" />
      <rect x={0} y={-0.07} width={W} height={0.14} className="dst-baseline is-north" />
      <rect x={0} y={D - 0.07} width={W} height={0.14} className="dst-baseline is-south" />
      <g className="dst-margin-label">
        {labels.northRear ? (
          <text transform={`translate(-0.95 ${D / 6}) rotate(-90)`}>
            <title>{`${sideNames.north} rear area. ${rearTitle}`}</title>
            {labels.northRear}
          </text>
        ) : null}
        {labels.main ? (
          <text transform={`translate(-0.95 ${D / 2}) rotate(-90)`}>
            <title>The main battle area: the middle third (p. 17)</title>
            {labels.main}
          </text>
        ) : null}
        {labels.southRear ? (
          <text transform={`translate(-0.95 ${(5 * D) / 6}) rotate(-90)`}>
            <title>{`${sideNames.south} rear area. ${rearTitle}`}</title>
            {labels.southRear}
          </text>
        ) : null}
      </g>
      <g className="dst-baseline-label">
        {labels.northBase ? (
          <text transform={`translate(${W + 0.95} ${D / 6}) rotate(90)`} className="is-north">
            <title>{`${sideNames.north} baseline`}</title>
            {labels.northBase}
          </text>
        ) : null}
        {labels.southBase ? (
          <text transform={`translate(${W + 0.95} ${(5 * D) / 6}) rotate(90)`} className="is-south">
            <title>{`${sideNames.south} baseline`}</title>
            {labels.southBase}
          </text>
        ) : null}
      </g>
    </g>
  )
})

/** The deployment label's size (dirtsideMap.css), for keeping it clear of the models. */
const DEPLOY_TYPE = { size: 11, spacing: 0.08 }

/**
 * Where each side may set up, while it is still deploying: from the
 * deployment rule, not assumed (p. 17). The zone's label goes along its
 * inner edge wherever it covers no model and no pennant: at the right, the
 * left or the middle, inside the zone or just outside it.
 */
export const DeploymentZones = memo(function DeploymentZones({ setup, pid, sideNames, ready, elements, units, k }: { setup: GameSetup; pid: string; sideNames: Record<SideId, string>; ready: Record<SideId, boolean>; elements: ElementState[]; units: Record<string, UnitState>; k: number }) {
  const W = setup.table.width
  const attacker = setup.battle === 'attack-defence' ? (setup.attacker ?? 'north') : null
  // What a label must not cover: every model, the pennant flying up and right of each unit's leader (see Tags), and the objectives.
  const obstacles: Box[] = setup.table.objectives.map((o) => ({ x0: o.position.x - 0.8, y0: o.position.y - 0.8, x1: o.position.x + 0.8, y1: o.position.y + 0.8 }))
  for (const e of elements) {
    obstacles.push({ x0: e.position.x - 0.7, y0: e.position.y - 0.7, x1: e.position.x + 0.7, y1: e.position.y + 0.7 })
    if (units[e.unitId]?.leaderElementId === e.id) obstacles.push({ x0: e.position.x + 0.3, y0: e.position.y - 0.5 - 40 * k, x1: e.position.x + 0.36 + 70 * k, y1: e.position.y - 0.4 })
  }
  return (
    <g className="dst-zones" pointerEvents="none">
      {(['north', 'south'] as SideId[]).map((side) => {
        if (ready[side]) return null
        const band = deploymentBand(setup, side)
        if (!band) return null
        const inner = side === 'north' ? band.y1 : band.y0
        const defender = attacker !== null && side !== attacker
        const text = defender ? `${sideNames[side].toUpperCase()} DEPLOYS ANYWHERE FROM HERE TO ITS BASELINE` : `${sideNames[side].toUpperCase()} DEPLOYS HERE · WITHIN ${Math.round(band.y1 - band.y0)}" OF ITS BASELINE`
        const w = textWidth(text, DEPLOY_TYPE.size, { spacing: DEPLOY_TYPE.spacing }) * k
        const h = 15 * k
        // Inside the zone first (towards its baseline), then just outside it.
        const inside = side === 'north' ? -1 : 1
        const spots = [inside, -inside].flatMap((dir) =>
          (['end', 'start', 'middle'] as const).map((anchor) => {
            const x = anchor === 'end' ? W - 0.5 : anchor === 'start' ? 0.5 : W / 2
            const x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2
            const y = inner + dir * 0.45
            const y0 = dir > 0 ? y : y - h
            return { x, y, anchor, below: dir > 0, box: { x0, y0, x1: x0 + w, y1: y0 + h } }
          }),
        )
        const spot = clearestSpot(spots, obstacles) ?? spots[0]!
        return (
          <g key={side} className={`dst-deploy is-${side}`}>
            <rect x={0} y={band.y0} width={W} height={band.y1 - band.y0} className="dst-deploy-wash" />
            <rect x={0} y={band.y0} width={W} height={band.y1 - band.y0} style={{ fill: patternUrl(pid, `hatch-${side}`) }} />
            <line x1={0} x2={W} y1={inner} y2={inner} className="dst-deploy-edge" />
            <text x={spot.x} y={spot.y} dominantBaseline={spot.below ? 'hanging' : 'auto'} textAnchor={spot.anchor} className="dst-deploy-label">
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
})
