import { memo, useEffect, useMemo, useRef, useState } from 'react'

import type { Going } from '../../../dirtside/data/mobility'
import { INTEGRITY, LANDING_CLEARANCE, applyAction, functional, inDeploymentZone, isOrganised } from '../../../dirtside/table/game'
import { unitKind } from '../../../dirtside/table/tableFire'
import { bearing, distance, lineOfSight, onTable, pathCost, terrainAt } from '../../../dirtside/table/terrain'
import type { ElementState, GameState, Point, Refusal, SideId, TerrainFeature } from '../../../dirtside/table/types'
import type { MoveBudget, TargetingOverlay } from '../TableMap'
import { INFANTRY_BASE, VEHICLE_BASE } from './counters'
import { patternUrl } from './defs'
import { type Box, clearestSpot, overlaps, pts, reachPolygon, splitByLegs, textWidth } from './geometry'
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

/** The kill chance from an odds line ("Hit 55% · KO 36%" gives "KO 36%"): short enough to sit under every target at once. */
const lastOdds = (odds: string) => odds.split(' · ').pop() ?? odds

/**
 * The firer's range bands as rings, every enemy ringed legal (bright, with
 * its kill chance under it) or refused (faint and dashed), and the hovered
 * shot's line with its full odds or the reason it cannot be made. A
 * feature that blocks the line is outlined, not filled.
 */
export function Targeting({ state, targeting, hoverId, pid, k }: { state: GameState; targeting: TargetingOverlay; hoverId: string | null; pid: string; k: number }) {
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
  // A ring's label goes where the ring is on the table and the label covers no model: twelve o'clock first, then round the ring.
  const models: Box[] = Object.values(state.elements)
    .filter((e) => !e.aboard)
    .map((e) => ({ x0: e.position.x - 0.8, y0: e.position.y - 0.8, x1: e.position.x + 0.8, y1: e.position.y + 0.8 }))
  const bandText = (r: number, i: number) => (single ? `reach ${inches(r)}` : `${BAND_NAMES[i] ?? 'band'} ${inches(r)}`)
  const labelAt = (r: number, text: string): Point => {
    const hw = ((textWidth(text, 9) + 12) / 2) * k
    const hh = 8 * k
    const spots = Array.from({ length: 24 }, (_, j) => {
      const deg = (j % 2 === 0 ? 1 : -1) * Math.ceil(j / 2) * 15
      const p = { x: f.x + Math.sin((deg * Math.PI) / 180) * r, y: f.y - Math.cos((deg * Math.PI) / 180) * r }
      return { p, box: { x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh } }
    }).filter(({ p }) => p.x > 1 && p.x < width - 1 && p.y > 0.5 && p.y < depth - 0.5)
    return clearestSpot(spots, models)?.p ?? { x: f.x, y: f.y - r }
  }
  // Each legal target's kill chance under it; where two would overlap, the second drops a row, and one that still has no room is left to the hover.
  const odds: Array<{ id: string; x: number; y: number; dy: number; text: string }> = []
  const placed: Box[] = []
  for (const [id, v] of Object.entries(targeting.verdicts)) {
    const e = state.elements[id]
    if (!e || e.destroyed || e.aboard || !v.ok || !v.odds) continue
    const text = lastOdds(v.odds)
    const hw = ((textWidth(text, 8.5) + 12) / 2) * k
    const hh = (15.5 / 2) * k
    const y = e.position.y + (e.vehicle ? 0.92 : 0.7)
    for (const dy of [9, 26]) {
      const box = { x0: e.position.x - hw, y0: y + dy * k - hh, x1: e.position.x + hw, y1: y + dy * k + hh }
      if (placed.some((b) => overlaps(b, box))) continue
      placed.push(box)
      odds.push({ id, x: e.position.x, y, dy, text })
      break
    }
  }
  return (
    <g className="dst-targeting" pointerEvents="none">
      {bands.map((r, i) => (i === 0 ? <circle key={`b${i}`} cx={f.x} cy={f.y} r={r} className={`dst-band is-close${single ? ' is-only' : ''}`} /> : null))}
      {bands.map((r, i) => (i > 0 ? <circle key={`r${i}`} cx={f.x} cy={f.y} r={r} className={`dst-band is-${BAND_NAMES[i] ?? 'long'}`} /> : null))}
      {bands.map((r, i) => {
        const text = bandText(r, i)
        const at = labelAt(r, text)
        return <Chip key={`l${i}`} x={at.x} y={at.y} k={k} text={text} tone="plain" size={9} />
      })}
      {Object.entries(targeting.verdicts).map(([id, v]) => {
        const e = state.elements[id]
        if (!e || e.destroyed || e.aboard) return null
        return <circle key={id} cx={e.position.x} cy={e.position.y} r={e.vehicle ? 0.92 : 0.7} className={`dst-verdict ${v.ok ? 'is-ok' : 'is-refused'}`} />
      })}
      {odds.map((o) => (o.id === hoverId ? null : <Chip key={`o${o.id}`} x={o.x} y={o.y} dy={o.dy} k={k} text={o.text} tone="ink" size={8.5} />))}
      {hovered && verdict ? (
        <>
          {sight?.blockedBy ? <ShapeEl shape={sight.blockedBy.shape} className="dst-blocker" style={{ fill: patternUrl(pid, 'hatch-sight') }} /> : null}
          <line x1={firer.position.x} y1={firer.position.y} x2={hovered.position.x} y2={hovered.position.y} className={`dst-sightline ${verdict.ok ? 'is-ok' : 'is-refused'}`} />
          <Chip
            x={(firer.position.x + hovered.position.x) / 2}
            y={(firer.position.y + hovered.position.y) / 2}
            k={k}
            tone={verdict.ok ? 'ink' : 'refused'}
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

const samePoints = (a: readonly Point[], b: readonly Point[]) => a === b || (a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y))
const sameBudget = (a: MoveBudget | null, b: MoveBudget | null) => a === b || (!!a && !!b && a.family === b.family && a.amphibious === b.amphibious && a.travel === b.travel && a.left === b.left)

/**
 * Whether the plot must be drawn again: compared by what the props say, not
 * by which object carries it, since the screen builds a fresh budget and a
 * fresh empty plot on every render and the reach area is costly to trace.
 */
const samePlot = (a: MovePlotProps, b: MovePlotProps) =>
  a.from.x === b.from.x && a.from.y === b.from.y && samePoints(a.plot, b.plot) && sameBudget(a.budget, b.budget) && a.reach === b.reach && a.features === b.features

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
}, samePlot)

/** How long the pointer must rest before the engine is asked about a move there, in ms. */
const PROBE_MS = 100

/**
 * The engine's word on moving to the pointer: null when it would allow it, a
 * refusal when not, undefined until the pointer has rested. The move is tried
 * on a copy of the state (applyAction never touches the one it is given), so
 * a reaction test it would roll is not rolled for real.
 */
function useMoveVerdict(state: GameState, element: ElementState, plot: Point[], pointer: Point, budget: MoveBudget): Refusal | null | undefined {
  const key = `${element.id}|${pts(plot)}|${pointer.x},${pointer.y}|${budget.travel ? 1 : 0}${budget.evasive ? 1 : 0}`
  const [answer, setAnswer] = useState<{ key: string; state: GameState; refusal: Refusal | null } | null>(null)
  const args = useRef({ state, element, plot, pointer, budget })
  args.current = { state, element, plot, pointer, budget }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const a = args.current
      const out = applyAction(a.state, { kind: 'move', side: a.element.sideId, elementId: a.element.id, path: [...a.plot, a.pointer], travel: a.budget.travel || undefined, evasive: a.budget.evasive || undefined })
      setAnswer({ key, state: a.state, refusal: 'ok' in out ? out : null })
    }, PROBE_MS)
    return () => window.clearTimeout(timer)
  }, [key, state])
  return answer && answer.key === key && answer.state === state ? answer.refusal : undefined
}

/** Words broken into lines of about so many characters, for a reason too long for one chip: a new line after each colon, and wherever a line runs long. */
function lines(text: string, width: number): string[] {
  const out: string[] = []
  for (const part of text.split(/(?<=:) /)) {
    let line = ''
    for (const word of part.split(' ')) {
      if (line && line.length + 1 + word.length > width) {
        out.push(line)
        line = word
      } else line = line ? `${line} ${word}` : word
    }
    if (line) out.push(line)
  }
  return out
}

/**
 * The rubber band from the last waypoint to the pointer: what that leg would
 * cost, and the model where it would stand. Green only when the element can
 * afford it and the engine, asked once the pointer rests, would allow it;
 * otherwise amber, with the engine's reason in words.
 */
export function MoveGhost({ state, element, from, plot, budget, pointer, k }: { state: GameState; element: ElementState; from: Point; plot: Point[]; budget: MoveBudget; pointer: Point; k: number }) {
  const features = state.setup.table.terrain
  const last = plot.length > 0 ? plot[plot.length - 1]! : from
  const refusal = useMoveVerdict(state, element, plot, pointer, budget)
  if (distance(last, pointer) < 0.3) return null
  const cost = pathCost([from, ...plot, pointer], budget.family, features, { amphibious: budget.amphibious, travel: budget.travel })
  const left = budget.left - cost.factors
  const blocked = !!cost.blockedAt
  const affordable = !blocked && left >= -1e-6
  const refused = affordable && !!refusal
  const ok = affordable && !refused
  const leg = distance(last, pointer)
  const unit = state.units[element.unitId]
  const organised = unit ? isOrganised(state, unit, { [element.id]: pointer }) : true
  const base = element.vehicle ? VEHICLE_BASE : INFANTRY_BASE
  const face = bearing(last, pointer)
  let text: string
  if (blocked) text = `${inches(leg)} · ${TERRAIN_NAMES[cost.blockedBy ?? 'open'].toLowerCase()}: no way through`
  else if (left < -1e-6) text = `${inches(leg)} · ${fmt(-left)} over`
  else if (refused) text = `${inches(leg)} · not allowed (${refusal.page})`
  else text = `${inches(leg)} · ${fmt(left)} left`
  const below = pointer.y + (element.vehicle ? 0.9 : 0.6)
  return (
    <g className={`dst-ghost ${ok ? 'is-ok' : 'is-over'}`} pointerEvents="none">
      <line x1={last.x} y1={last.y} x2={blocked ? cost.blockedAt!.x : pointer.x} y2={blocked ? cost.blockedAt!.y : pointer.y} className="dst-ghost-leg" />
      {blocked ? <line x1={cost.blockedAt!.x} y1={cost.blockedAt!.y} x2={pointer.x} y2={pointer.y} className="dst-ghost-leg is-blocked" /> : null}
      <g transform={`translate(${pointer.x} ${pointer.y}) rotate(${face})`}>
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={element.vehicle ? 0.12 : 0.18} className={`dst-ghost-base is-${element.sideId}${organised ? '' : ' is-scattered'}`} />
        {element.vehicle ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" className={`dst-ghost-nose is-${element.sideId}`} /> : null}
      </g>
      <Chip x={pointer.x} y={below} dy={10} k={k} text={text} tone={ok ? 'ok' : 'warn'} />
      {refused ? lines(refusal.reason, 72).map((l, i) => <Chip key={i} x={pointer.x} y={below} dy={29 + i * 17} k={k} text={l} tone="warn" size={9} />) : null}
      {!organised && ok ? <Chip x={pointer.x} y={below} dy={30} k={k} text={`leaves the unit scattered: keep within ${INTEGRITY[unitKind(state, unit!)]}" of a unit-mate (p. 23)`} tone="warn" size={9} /> : null}
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
 * it may come down and amber, with the reason, where an enemy in sight is
 * too close or the ground will not take it (p. 43). The engine still judges
 * the landing.
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
      <Chip x={at.x} y={at.y + 1.3} dy={9} k={k} text={problem ? `${label}: ${problem}` : `${label} lands here`} tone={problem ? 'warn' : 'plain'} size={9.5} />
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

/**
 * Where the selected element would stand if deployed at the pointer: amber
 * outside its side's zone (p. 17), and a word when it would leave its unit
 * scattered, which the unit pays for later: a scattered unit may only move
 * to close up (p. 23).
 */
export function DeployGhost({ state, element, at, k }: { state: GameState; element: ElementState; at: Point; k: number }) {
  const ok = inDeploymentZone(state.setup, element.sideId, at)
  const unit = state.units[element.unitId]
  const organised = !unit || isOrganised(state, unit, { [element.id]: at })
  const base = element.vehicle ? VEHICLE_BASE : INFANTRY_BASE
  return (
    <g className={`dst-deploy-ghost${ok ? '' : ' is-refused'}${organised ? '' : ' is-scattered'}`} pointerEvents="none">
      <g transform={`translate(${at.x} ${at.y}) rotate(${element.sideId === 'north' ? 180 : 0})`} className="dst-deploy-model">
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={element.vehicle ? 0.12 : 0.18} />
        {element.vehicle ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" /> : null}
      </g>
      {!ok ? <Chip x={at.x} y={at.y + (element.vehicle ? 0.9 : 0.6)} dy={10} k={k} text="outside the deployment zone" tone="warn" size={9} /> : null}
      {ok && !organised && unit ? <Chip x={at.x} y={at.y + (element.vehicle ? 0.9 : 0.6)} dy={10} k={k} text={`too far from its unit: keep within ${INTEGRITY[unitKind(state, unit)]}" of a unit-mate (p. 23)`} tone="warn" size={9} /> : null}
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
