import { memo } from 'react'

import { patternUrl } from '../../dirtside/map/defs'
import { type Box, clearestSpot, deploymentBand, textWidth } from './geometry'
import type { FigureState, GameSetup, SideId, UnitState } from '../../../stargrunt/types'

/**
 * Where each side may deploy (p. 14), drawn the same way Dirtside's own
 * `DeploymentZones` draws it — a shaded, hatched band with a label along
 * its inner edge. Not imported unchanged: Dirtside's component reaches,
 * through its own `./geometry`, into Dirtside's own `inDeploymentZone` in
 * `dirtside/table/game.ts`, so reusing it here would mean widening that
 * engine function's signature rather than a UI-level generalisation
 * (`05-reuse-map.md` §3 flags this as the one non-obvious case). This is
 * the Stargrunt version beside it, built from the same pure label-placement
 * helpers (`clearestSpot`/`fitLabel`/`textWidth`, imported unchanged) and
 * Stargrunt's own `deploymentBand` (`./geometry`, built on this engine's
 * own `inDeploymentZone`).
 */

const DEPLOY_TYPE = { size: 11, spacing: 0.08 }

export const DeploymentZones = memo(function DeploymentZones({
  setup,
  pid,
  sideNames,
  ready,
  figures,
  units,
  k,
}: {
  setup: GameSetup
  pid: string
  sideNames: Record<SideId, string>
  ready: Record<SideId, boolean>
  figures: FigureState[]
  units: Record<string, UnitState>
  k: number
}) {
  const W = setup.table.width
  const attacker = setup.battle === 'attack-defence' ? (setup.attacker ?? 'north') : null
  const obstacles: Box[] = setup.table.objectives.map((o) => ({ x0: o.position.x - 0.8, y0: o.position.y - 0.8, x1: o.position.x + 0.8, y1: o.position.y + 0.8 }))
  for (const f of figures) {
    obstacles.push({ x0: f.position.x - 0.4, y0: f.position.y - 0.4, x1: f.position.x + 0.4, y1: f.position.y + 0.4 })
    if (units[f.unitId]?.leaderId === f.id) obstacles.push({ x0: f.position.x + 0.1, y0: f.position.y - 0.5 - 40 * k, x1: f.position.x + 0.16 + 70 * k, y1: f.position.y - 0.34 })
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
