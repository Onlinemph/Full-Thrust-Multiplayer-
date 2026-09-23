import { memo, useMemo } from 'react'

import type { Going } from '../../../dirtside/data/mobility'
import { LANDING_CLEARANCE, functional, inDeploymentZone, isOrganised } from '../../../dirtside/table/game'
import { bearing, distance, lineOfSight, onTable, pathCost, terrainAt } from '../../../dirtside/table/terrain'
import type { ElementState, GameState, Point, SideId, TerrainFeature } from '../../../dirtside/table/types'
import type { MoveBudget, TargetingOverlay } from '../TableMap'
import { INFANTRY_BASE, VEHICLE_BASE } from './counters'
import { patternUrl } from './defs'
import { pts, reachPolygon, splitByLegs } from './geometry'
import { CRAFT_PATH, Chip } from './marks'
import { ShapeEl, TERRAIN_NAMES } from './terrain'

/**
 * What the player is about to do, drawn before they do it: the weapon's
 * range bands and every enemy judged, the path of a move and what it costs,
 * the beaten zone of a strike, where a craft would land and whether it may,
 * where an element would deploy, and the tape measure. Nothing here decides
 * a rule: the verdicts come from the engine, and every click still goes
 * through it.
 */

const fmt = (n: number) => n.toFixed(1)
const inches = (n: number) => `${fmt(n)}"`

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

const BAND_NAMES = ['close', 'medium', 'long']

/** The firer's range bands as rings, every enemy ringed legal or refused, and the hovered shot's line with its odds or reason. */
export function Targeting({ state, targeting, hoverId, k }: { state: GameState; targeting: TargetingOverlay; hoverId: string | null; k: number }) {
  const firer = state.elements[targeting.firerId]
  const hovered = hoverId ? state.elements[hoverId] : null
  const verdict = hovered ? targeting.verdicts[hovered.id] : undefined
  const sight = useMemo(() => (firer && hovered && verdict && !verdict.ok ? lineOfSight(firer.position, hovered.position, state.setup.table.terrain) : null), [firer, hovered, verdict, state.setup.table.terrain])
  if (!firer) return null
  // A weapon with one band (a HEL's 60") is given as three equal ones.
  const bands = (targeting.bands ?? []).filter((r, i, all) => r > 0 && all.indexOf(r) === i)
  const single = bands.length === 1
  const { width, depth } = state.setup.table
  const f = firer.position
  /** Where a ring's label goes: at twelve o'clock, or wherever the ring is still on the table. */
  const labelAt = (r: number): Point => [0, 180, 90, 270, 45, 315, 135, 225].map((deg) => ({ x: f.x + Math.sin((deg * Math.PI) / 180) * r, y: f.y - Math.cos((deg * Math.PI) / 180) * r })).find((p) => p.x > 1 && p.x < width - 1 && p.y > 0.5 && p.y < depth - 0.5) ?? { x: f.x, y: f.y - r }
  return (
    <g className="dst-targeting" pointerEvents="none">
      {bands.map((r, i) => (i === 0 ? <circle key={`b${i}`} cx={f.x} cy={f.y} r={r} className={`dst-band is-close${single ? ' is-only' : ''}`} /> : null))}
      {bands.map((r, i) => (i > 0 ? <circle key={`r${i}`} cx={f.x} cy={f.y} r={r} className={`dst-band is-${BAND_NAMES[i] ?? 'long'}`} /> : null))}
      {bands.map((r, i) => {
        const at = labelAt(r)
        return <Chip key={`l${i}`} x={at.x} y={at.y} k={k} text={single ? `reach ${inches(r)}` : `${BAND_NAMES[i] ?? 'band'} ${inches(r)}`} tone="plain" size={9} />
      })}
      {Object.entries(targeting.verdicts).map(([id, v]) => {
        const e = state.elements[id]
        if (!e || e.destroyed || e.aboard) return null
        return <circle key={id} cx={e.position.x} cy={e.position.y} r={e.vehicle ? 0.92 : 0.7} className={`dst-verdict ${v.ok ? 'is-ok' : 'is-refused'}`} />
      })}
      {hovered && verdict ? (
        <>
          {sight?.blockedBy ? <ShapeEl shape={sight.blockedBy.shape} className="dst-blocker" /> : null}
          <line x1={firer.position.x} y1={firer.position.y} x2={hovered.position.x} y2={hovered.position.y} className={`dst-sightline ${verdict.ok ? 'is-ok' : 'is-refused'}`} />
          <Chip
            x={(firer.position.x + hovered.position.x) / 2}
            y={(firer.position.y + hovered.position.y) / 2}
            k={k}
            tone={verdict.ok ? 'damage' : 'warn'}
            text={verdict.ok ? `${inches(verdict.range ?? distance(firer.position, hovered.position))}${verdict.odds ? ` · ${verdict.odds}` : ''}` : `${inches(distance(firer.position, hovered.position))} · ${verdict.reason ?? 'no shot'}`}
          />
        </>
      ) : null}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

const GOING_CLASS: Record<Going, string> = { easy: 'is-easy', normal: 'is-normal', poor: 'is-poor', difficult: 'is-difficult', impassable: 'is-blocked' }

export interface MovePlotProps {
  from: Point
  plot: Point[]
  budget: MoveBudget | null
  /** Straight-line inches left, when no budget is given: drawn as a plain ring. */
  reach: number | null
  features: readonly TerrainFeature[]
}

/** The plotted path, coloured stretch by stretch by the going it crosses, and the reach left from its last waypoint. */
export const MovePlot = memo(function MovePlot({ from, plot, budget, reach, features }: MovePlotProps) {
  const path = useMemo(() => [from, ...plot], [from, plot])
  const cost = useMemo(() => (budget && plot.length > 0 ? pathCost(path, budget.family, features, { amphibious: budget.amphibious, travel: budget.travel }) : null), [budget, plot.length, path, features])
  const last = path[path.length - 1]!
  const leftAfter = budget ? budget.left - (cost?.factors ?? 0) : null
  const polygon = useMemo(() => (budget && leftAfter !== null && leftAfter > 0.05 ? reachPolygon(last, leftAfter, budget.family, features, { amphibious: budget.amphibious, travel: budget.travel }) : []), [budget, leftAfter, last, features])
  const runs = useMemo(() => {
    if (!cost) return null
    const walked = cost.blockedAt ? [...path.slice(0, 1)] : path
    if (cost.blockedAt) {
      // Up to where it stopped: walk the path until the cost's length is used.
      let left = cost.length
      for (let i = 1; i < path.length && left > 1e-6; i++) {
        const d = distance(path[i - 1]!, path[i]!)
        if (d <= left) walked.push(path[i]!)
        else walked.push({ x: path[i - 1]!.x + ((path[i]!.x - path[i - 1]!.x) * left) / d, y: path[i - 1]!.y + ((path[i]!.y - path[i - 1]!.y) * left) / d })
        left -= d
      }
    }
    return splitByLegs(walked, cost.legs)
  }, [cost, path])
  return (
    <g className="dst-move" pointerEvents="none">
      {polygon.length > 2 ? <polygon points={pts(polygon)} className="dst-reach-area" /> : null}
      {!budget && reach !== null && reach > 0 ? <circle cx={last.x} cy={last.y} r={reach} className="dst-reach-area" /> : null}
      {plot.length > 0 ? (
        <>
          <polyline points={pts(path)} className="dst-path-casing" />
          {cost?.blockedAt ? <polyline points={pts(path)} className="dst-path is-blocked" /> : null}
          {runs ? runs.map((r, i) => <polyline key={i} points={pts(r.points)} className={`dst-path ${GOING_CLASS[r.going]}`} />) : <polyline points={pts(path)} className="dst-path is-normal" />}
          {cost?.blockedAt ? (
            <>
              <path d={`M${cost.blockedAt.x - 0.3},${cost.blockedAt.y - 0.3} l0.6,0.6 m0,-0.6 l-0.6,0.6`} className="dst-path-stop" />
            </>
          ) : null}
          {plot.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.18} className="dst-waypoint" />
          ))}
        </>
      ) : null}
    </g>
  )
})

/** The rubber band from the last waypoint to the pointer: what that leg would cost, and the model where it would stand. */
export function MoveGhost({ state, element, from, plot, budget, pointer, k }: { state: GameState; element: ElementState; from: Point; plot: Point[]; budget: MoveBudget; pointer: Point; k: number }) {
  const features = state.setup.table.terrain
  const last = plot.length > 0 ? plot[plot.length - 1]! : from
  if (distance(last, pointer) < 0.3) return null
  const cost = pathCost([from, ...plot, pointer], budget.family, features, { amphibious: budget.amphibious, travel: budget.travel })
  const left = budget.left - cost.factors
  const blocked = !!cost.blockedAt
  const ok = !blocked && left >= -1e-6
  const leg = distance(last, pointer)
  const unit = state.units[element.unitId]
  const organised = unit ? isOrganised(state, unit, { [element.id]: pointer }) : true
  const base = element.vehicle ? VEHICLE_BASE : INFANTRY_BASE
  const face = bearing(last, pointer)
  let text: string
  if (blocked) text = `${inches(leg)} · ${TERRAIN_NAMES[cost.blockedBy ?? 'open'].toLowerCase()}: no way through`
  else if (left < -1e-6) text = `${inches(leg)} · ${fmt(-left)} over`
  else text = `${inches(leg)} · ${fmt(left)} left`
  return (
    <g className={`dst-ghost ${ok ? 'is-ok' : 'is-over'}`} pointerEvents="none">
      <line x1={last.x} y1={last.y} x2={blocked ? cost.blockedAt!.x : pointer.x} y2={blocked ? cost.blockedAt!.y : pointer.y} className="dst-ghost-leg" />
      {blocked ? <line x1={cost.blockedAt!.x} y1={cost.blockedAt!.y} x2={pointer.x} y2={pointer.y} className="dst-ghost-leg is-blocked" /> : null}
      <g transform={`translate(${pointer.x} ${pointer.y}) rotate(${face})`}>
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={element.vehicle ? 0.12 : 0.18} className={`dst-ghost-base is-${element.sideId}${organised ? '' : ' is-scattered'}`} />
        {element.vehicle ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" className={`dst-ghost-nose is-${element.sideId}`} /> : null}
      </g>
      <Chip x={pointer.x} y={pointer.y + (element.vehicle ? 0.9 : 0.6)} dy={10} k={k} text={text} tone={ok ? 'ok' : 'warn'} />
      {!organised && ok ? <Chip x={pointer.x} y={pointer.y + (element.vehicle ? 0.9 : 0.6)} dy={30} k={k} text="leaves the unit scattered (p. 23)" tone="warn" size={9} /> : null}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Placement previews
// ---------------------------------------------------------------------------

/** An orbital aim following the pointer: its beaten zone and how far it may stray (p. 40). */
export function AimPreview({ at, radius, pid, k }: { at: Point; radius: number; pid: string; k: number }) {
  return (
    <g className="dst-aim-preview" transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
      <circle r={7} className="dst-strike-stray" />
      <circle r={radius} style={{ fill: patternUrl(pid, 'hatch-ordnance') }} />
      <circle r={radius} className="dst-strike-rim" />
      <path d="M-0.8,0 H-0.3 M0.3,0 H0.8 M0,-0.8 V-0.3 M0,0.3 V0.8" className="dst-strike-reticle" />
      <Chip x={0} y={radius + 0.2} dy={9} k={k} text={`${inches(radius * 2)} BEATEN ZONE · MAY STRAY 7"`} tone="ordnance" size={9} />
    </g>
  )
}

/**
 * A craft being placed: its 12" clearance following the pointer, white where
 * it may come down and red where an enemy in sight is too close or the
 * ground will not take it (p. 43). The engine still judges the landing.
 */
export function LandingPreview({ state, at, label, side, k }: { state: GameState; at: Point; label: string; side: SideId | null; k: number }) {
  const features = state.setup.table.terrain
  let problem: string | null = null
  let culprit: ElementState | null = null
  if (!onTable(at, state.setup.table)) problem = 'off the table'
  else {
    const ground = terrainAt(at, features)
    if (ground === 'open-water' || ground === 'river') problem = `cannot set down in ${TERRAIN_NAMES[ground].toLowerCase()}`
    else if (side) {
      culprit = Object.values(state.elements).find((e) => e.sideId !== side && functional(e) && distance(e.position, at) < LANDING_CLEARANCE - 1e-9 && lineOfSight(e.position, at, features).clear) ?? null
      if (culprit) problem = `${culprit.name} is ${inches(distance(culprit.position, at))} away and can see it`
    }
  }
  const craft = state.setup.craft?.find((c) => c.name === label)
  return (
    <g className={`dst-landing-preview${problem ? ' is-refused' : ''}`} pointerEvents="none">
      <circle cx={at.x} cy={at.y} r={LANDING_CLEARANCE} className="dst-landing-ring" />
      {culprit ? <line x1={at.x} y1={at.y} x2={culprit.position.x} y2={culprit.position.y} className="dst-landing-culprit" /> : null}
      <path d={CRAFT_PATH[craft?.kind ?? 'dropship']} transform={`translate(${at.x} ${at.y})`} className="dst-landing-ghost" />
      <Chip x={at.x} y={at.y + 1.3} dy={9} k={k} text={problem ? `${label}: ${problem}` : `${label} lands here`} tone={problem ? 'damage' : 'plain'} size={9.5} />
    </g>
  )
}

/** Craft already placed to come down this activation, with the 12" they keep (p. 43). */
export function PendingLandings({ landings, state, k }: { landings: Array<{ at: Point; label: string }>; state: GameState; k: number }) {
  return (
    <g className="dst-landing-pending" pointerEvents="none">
      {landings.map((l, i) => {
        const craft = state.setup.craft?.find((c) => c.name === l.label)
        return (
          <g key={i} transform={`translate(${l.at.x} ${l.at.y})`}>
            <circle r={LANDING_CLEARANCE} className="dst-landing-ring is-placed" />
            <path d={CRAFT_PATH[craft?.kind ?? 'dropship']} className="dst-landing-ghost is-placed" />
            <Chip x={0} y={1.3} dy={9} k={k} text={`${l.label} lands here`} tone="plain" size={9.5} />
          </g>
        )
      })}
    </g>
  )
}

/** Where the selected element would stand if deployed at the pointer, red outside its side's zone (p. 17). */
export function DeployGhost({ state, element, at }: { state: GameState; element: ElementState; at: Point }) {
  const ok = inDeploymentZone(state.setup, element.sideId, at)
  const base = element.vehicle ? VEHICLE_BASE : INFANTRY_BASE
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${element.sideId === 'north' ? 180 : 0})`} className={`dst-deploy-ghost${ok ? '' : ' is-refused'}`} pointerEvents="none">
      <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={element.vehicle ? 0.12 : 0.18} />
      {element.vehicle ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" /> : null}
    </g>
  )
}

/** The tape: a line with its length, as a player would lay one on the table. */
export function Tape({ from, to, k }: { from: Point; to: Point; k: number }) {
  const d = distance(from, to)
  return (
    <g className="dst-tape" pointerEvents="none">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="dst-tape-casing" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="dst-tape-line" />
      <circle cx={from.x} cy={from.y} r={0.15} className="dst-tape-end" />
      <circle cx={to.x} cy={to.y} r={0.15} className="dst-tape-end" />
      <Chip x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} k={k} text={inches(d)} tone="plain" />
    </g>
  )
}
