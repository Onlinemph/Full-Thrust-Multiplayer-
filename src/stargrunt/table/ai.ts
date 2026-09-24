/**
 * Stargrunt II — the computer at the table. Not clever, but it plays like a
 * squad leader: it keeps its units together, moves the ones with nowhere
 * useful to shoot from toward cover and the objectives it does not hold,
 * fires whichever weapon has not gone this turn at whatever it can hit best,
 * shakes off suppression and disorganisation before anything else, rallies
 * and reorganises its wounded, closes for a close assault only when the
 * numbers are good, and never sends the engine an action it would refuse.
 *
 * `aiAction` answers for one side, whenever that side is to act; `aiPlay`
 * plays a whole battle with the computer on both sides, following the same
 * shape as `src/dirtside/table/ai.ts`.
 */

import { assaultOdds } from '../assault'
import { draw, newStream, type DiceStream } from '../dice'
import {
  distance,
  figureCoverGrade,
  isInIntegrity,
  lineOfFire,
  terrainCoverGrade,
  unitCentre,
  unitCoverGrade,
  unitVisible,
  woodPostureOf,
  type CoverGrade,
} from './cover'
import {
  actionsLeft,
  alive,
  applyAction,
  canBeHit,
  canPass,
  createGame,
  figuresOf,
  fit,
  nearestEnemyDistance,
  planFire,
  planMove,
  unactivatedUnits,
  unitsOf,
} from './game'
import { normalMoveInches } from './movement'
import { otherSide, type Action, type FigureMove, type FigureState, type FireWith, type GameSetup, type GameState, type Point, type SideId, type UnitState } from '../types'
import type { Shape } from '../../dirtside/table/types'

// ---------------------------------------------------------------------------
// A unit's place, cover and cohesion — small readers built on cover.ts/game.ts
// ---------------------------------------------------------------------------

function centreOf(state: GameState, unit: UnitState): Point {
  return unitCentre(figuresOf(state, unit).filter(alive).map((f) => f.position))
}

function coverOf(state: GameState, unit: UnitState): CoverGrade {
  const figs = figuresOf(state, unit).filter(alive)
  return unitCoverGrade(figs.map((f) => figureCoverGrade(f.position, state.setup.table.terrain)))
}

/** In integrity (p. 11): the AI's own reading of `isInIntegrity`, since the engine keeps this check private. */
function organised(state: GameState, unit: UnitState): boolean {
  return isInIntegrity(figuresOf(state, unit).filter(alive).map((f) => f.position))
}

function isPowerArmoured(f: FigureState): boolean {
  return f.armour === 'light-power' || f.armour === 'heavy-power'
}

function clampToTable(state: GameState, p: Point): Point {
  const { width, depth } = state.setup.table
  return { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(depth, p.y)) }
}

function shapeCentre(shape: Shape): Point {
  if (shape.kind === 'circle') return shape.centre
  if (shape.kind === 'rect') return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
  let x = 0
  let y = 0
  for (const p of shape.points) {
    x += p.x
    y += p.y
  }
  return { x: x / shape.points.length, y: y / shape.points.length }
}

/** The nearest terrain feature that grants any cover (p. 12–13), by its shape's centre — a cheap stand-in for a full search of every point in the feature. */
function nearestCoverPoint(state: GameState, from: Point): Point | null {
  let best: { point: Point; dist: number } | null = null
  for (const feature of state.setup.table.terrain) {
    if (terrainCoverGrade(feature.terrain) === 'open') continue
    const point = shapeCentre(feature.shape)
    const dist = distance(from, point)
    if (!best || dist < best.dist) best = { point, dist }
  }
  return best?.point ?? null
}

/** A clear line of fire to the target's centre, or (p. 11–12) at least half its figures in view. */
function canSeeTarget(state: GameState, unit: UnitState, target: UnitState): boolean {
  const from = centreOf(state, unit)
  const to = centreOf(state, target)
  if (woodPostureOf(to, state.setup.table.terrain) === 'within') return false
  if (lineOfFire(from, to, state.setup.table.terrain).clear) return true
  const visible = figuresOf(state, target)
    .filter(alive)
    .map((f) => lineOfFire(from, f.position, state.setup.table.terrain).clear)
  return unitVisible(visible)
}

// ---------------------------------------------------------------------------
// Where a unit wants to be, and the move that gets it there
// ---------------------------------------------------------------------------

/**
 * Where the unit wants to end up: its own baseline if routed; nearby cover
 * whenever it is standing in the open and that cover is no further away than
 * wherever it would otherwise be headed (p. 12–13's protection is worth a
 * detour, not just a destination of last resort); a broken unit caught in
 * the open goes there outright; otherwise the nearest objective it does not
 * hold, or, with none left to take, the nearest enemy — null once it is
 * already where it wants to be.
 */
function goalFor(state: GameState, unit: UnitState): Point | null {
  const side = unit.sideId
  if (figuresOf(state, unit).filter(fit).length === 0) return null
  const pos = centreOf(state, unit)

  if (unit.confidence === 'RO') return clampToTable(state, { x: pos.x, y: side === 'north' ? 0 : state.setup.table.depth })

  const nearCover = coverOf(state, unit) === 'open' ? nearestCoverPoint(state, pos) : null
  if (unit.confidence === 'BR' && nearCover) return clampToTable(state, nearCover)

  const preferCover = (destination: Point) => (nearCover && distance(pos, nearCover) < distance(pos, destination) - 1e-9 ? nearCover : destination)

  const objectives = state.setup.table.objectives
  const lost = objectives.filter((o) => state.objectives[o.id]?.heldBy !== side)
  if (lost.length > 0) {
    const nearest = [...lost].sort((a, b) => distance(a.position, pos) - distance(b.position, pos))[0]!
    return clampToTable(state, preferCover(nearest.position))
  }

  if (nearCover) return clampToTable(state, nearCover)

  const enemies = unitsOf(state, otherSide(side)).filter((u) => figuresOf(state, u).some(alive))
  if (enemies.length === 0) return null
  const nearestEnemy = enemies.map((e) => centreOf(state, e)).sort((a, b) => distance(a, pos) - distance(b, pos))[0]!
  return clampToTable(state, preferCover(nearestEnemy))
}

/** 'normal' unless the goal is well beyond one normal move's reach (`planMove`) and no enemy is close, in which case 'travel' covers twice the ground at the cost of needing to reorganise before doing anything else. */
function chooseMoveMode(state: GameState, unit: UnitState, goal: Point): 'normal' | 'travel' {
  const figs = figuresOf(state, unit).filter(fit)
  if (figs.length === 0) return 'normal'
  const straggler = figs.reduce((a, b) => (distance(a.position, goal) > distance(b.position, goal) ? a : b))
  const plan = planMove(state, straggler.id, [goal], 'normal')
  if (plan.reaches) return 'normal'
  return !unit.inPosition && nearestEnemyDistance(state, unit.sideId, centreOf(state, unit)) > 20 ? 'travel' : 'normal'
}

/** Every fit figure declares the same destination; the engine's own `move` handler advances each one as far as the mode's allowance and the ground let it (p. 22), so a short allowance is a partial move, not a refusal. */
function moveCandidate(state: GameState, unit: UnitState, goal: Point, mode: 'normal' | 'travel'): Action | null {
  const figs = figuresOf(state, unit).filter(fit)
  if (figs.length === 0) return null
  const dest = clampToTable(state, goal)
  return { kind: 'move', side: unit.sideId, mode, moves: figs.map((f) => ({ figureId: f.id, path: [dest] })) }
}

/**
 * Pulls every figure still able to walk toward the whole unit's own centre —
 * including its wounded, who cannot move themselves but are still part of
 * what integrity (p. 11) is measured against — the simplest move that can
 * restore either shape: the 6" circle shrinks, and a chain that is merely
 * stretched reconnects.
 */
function regroupMoves(state: GameState, unit: UnitState): FigureMove[] | undefined {
  const figs = figuresOf(state, unit).filter(fit)
  if (figs.length === 0) return undefined
  const centre = clampToTable(state, unitCentre(figuresOf(state, unit).filter(alive).map((f) => f.position)))
  return figs.map((f) => ({ figureId: f.id, path: [centre] }))
}

// ---------------------------------------------------------------------------
// Fire — the best target for the weapons that have not fired, by planFire's odds
// ---------------------------------------------------------------------------

interface ScoredFire {
  action: Action
  score: number
}

/**
 * Every fire action this unit could still take this turn, best first by
 * `planFire`'s expected casualties (with a small nudge for a merely
 * suppressing shot), restricted to targets a clear line of fire can already
 * reach (p. 11–12) so a target `planFire` would score but the engine would
 * refuse for want of sight never gets tried.
 */
function fireCandidates(state: GameState, unit: UnitState): ScoredFire[] {
  if (unit.confidence === 'RO') return []
  if (unit.confidence === 'BR' && !unit.everHit && !unit.everSuppressed) return []
  const pos = centreOf(state, unit)
  const enemies = unitsOf(state, otherSide(unit.sideId))
    .filter((u) => figuresOf(state, u).some(canBeHit))
    .map((u) => ({ u, dist: distance(pos, centreOf(state, u)) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map((x) => x.u)
    .filter((u) => canSeeTarget(state, unit, u))
  if (enemies.length === 0) return []

  const supportFigs = figuresOf(state, unit).filter((f) => fit(f) && f.supportWeapon && !unit.firedThisTurn.includes(f.id))
  const canSmallArms = !unit.firedThisTurn.includes('small-arms') && figuresOf(state, unit).some(fit)
  const withOptions: FireWith[] = []
  if (canSmallArms) {
    withOptions.push({ kind: 'small-arms' })
    if (supportFigs.length > 0) withOptions.push({ kind: 'small-arms', supportFigureIds: supportFigs.map((f) => f.id) })
  }
  for (const sf of supportFigs) withOptions.push({ kind: 'support', figureId: sf.id })

  const out: ScoredFire[] = []
  for (const target of enemies) {
    for (const w of withOptions) {
      const plan = planFire(state, unit.id, target.id, w)
      if ('ok' in plan) continue // that weapon has already fired, or nobody is left to fire it
      if ('impossible' in plan.rangeDie) continue
      const score = plan.expectedCasualties * 3 + plan.pMajor + plan.pMinor * 0.3
      if (score <= 0) continue
      out.push({ action: { kind: 'fire', side: unit.sideId, targetUnitId: target.id, with: w }, score })
    }
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

// ---------------------------------------------------------------------------
// Close assault — only with both actions and good odds
// ---------------------------------------------------------------------------

/** The nearest enemy within a plausible charge, only when `assaultOdds` (p. 41) gives the attacker at least a 2:1 edge. */
function closeAssaultCandidate(state: GameState, unit: UnitState): Action | null {
  const figs = figuresOf(state, unit).filter(fit)
  if (figs.length === 0) return null
  const pos = unitCentre(figs.map((f) => f.position))
  const reach = Math.max(normalMoveInches(unit.mobility, 1) * 2, 8)
  const enemies = unitsOf(state, otherSide(unit.sideId)).filter((u) => figuresOf(state, u).some(fit))
  let best: { target: UnitState; odds: number; dist: number } | null = null
  for (const target of enemies) {
    const defFigs = figuresOf(state, target).filter(fit)
    const tpos = unitCentre(defFigs.map((f) => f.position))
    const dist = distance(pos, tpos)
    if (dist > reach) continue
    const odds = assaultOdds(figs.length, figs.filter(isPowerArmoured).length, defFigs.length, defFigs.filter(isPowerArmoured).length)
    if (odds < 2) continue
    if (!best || odds > best.odds || (odds === best.odds && dist < best.dist)) best = { target, odds, dist }
  }
  if (!best) return null
  const tpos = clampToTable(state, unitCentre(figuresOf(state, best.target).filter(fit).map((f) => f.position)))
  return { kind: 'close-assault', side: unit.sideId, targetUnitId: best.target.id, moves: figs.map((f) => ({ figureId: f.id, path: [tpos] })) }
}

// ---------------------------------------------------------------------------
// Command — rally and transfer
// ---------------------------------------------------------------------------

function subordinatesNeedingRally(state: GameState, unit: UnitState): UnitState[] {
  return unitsOf(state, unit.sideId).filter((u) => u.commanderId === unit.id && u.confidence !== 'CO' && figuresOf(state, u).some(alive))
}

function commandersWithRallyWork(state: GameState, units: readonly UnitState[]): UnitState | null {
  return units.find((u) => subordinatesNeedingRally(state, u).length > 0) ?? null
}

/** A subordinate that would rather act now than wait its turn: panicked, disorganised, or sitting on a fire opportunity — only offered once the commander has nothing better of its own to do. */
function transferTarget(state: GameState, unit: UnitState): UnitState | null {
  if (unit.transfersThisTurn >= 2) return null
  const subs = unitsOf(state, unit.sideId).filter((u) => u.commanderId === unit.id && figuresOf(state, u).some(alive))
  return subs.find((u) => !u.activated && (u.panic || !organised(state, u) || fireCandidates(state, u).length > 0)) ?? null
}

// ---------------------------------------------------------------------------
// One activation's plan, best action first
// ---------------------------------------------------------------------------

/**
 * Every action worth trying for the unit now activated, best first:
 * recovering from panic overrides everything else (p. 21); shaking off
 * suppression and restoring integrity come before anything that restriction
 * would refuse anyway (pp. 11, 18); a travel-formed unit only moves or
 * reorganises (p. 24); a close assault is tried first among ordinary actions
 * because it alone needs both (p. 41); otherwise the unit takes its best shot
 * and then advances rather than firing twice from the same spot whenever
 * there is still somewhere worth being (an unheld objective, better cover, a
 * second enemy) — a unit content to stand and fight (nothing left to reach)
 * fires with both actions instead. Then a subordinate to rally, settling into
 * position, tending the wounded, handing off the activation — `end-activation`
 * is always last, and always legal.
 */
function planActivation(state: GameState, unit: UnitState): Action[] {
  const side = unit.sideId

  if (unit.panic) return [{ kind: 'recover-panic', side }, { kind: 'end-activation', side }]

  if (unit.suppression > 0) return [{ kind: 'remove-suppression', side }, { kind: 'end-activation', side }]

  if (!organised(state, unit)) return [{ kind: 'reorganise', side, moves: regroupMoves(state, unit) }, { kind: 'end-activation', side }]

  if (unit.travelling) {
    const goal = goalFor(state, unit)
    const candidates: Action[] = []
    if (goal && distance(centreOf(state, unit), goal) >= 2) {
      const mv = moveCandidate(state, unit, goal, 'travel')
      if (mv) candidates.push(mv)
    }
    candidates.push({ kind: 'reorganise', side }, { kind: 'end-activation', side })
    return candidates
  }

  const candidates: Action[] = []
  const twoLeft = actionsLeft(state) === 2

  if (twoLeft && unit.confidence !== 'BR' && unit.confidence !== 'RO') {
    const assault = closeAssaultCandidate(state, unit)
    if (assault) candidates.push(assault)
  }

  const fires = fireCandidates(state, unit).map((c) => c.action)
  const goal = goalFor(state, unit)
  const pos = centreOf(state, unit)
  const moveAction = goal && distance(pos, goal) > 1 ? moveCandidate(state, unit, goal, chooseMoveMode(state, unit, goal)) : null

  if (twoLeft) {
    candidates.push(...fires)
    if (moveAction) candidates.push(moveAction)
  } else {
    if (moveAction) candidates.push(moveAction)
    candidates.push(...fires)
  }

  for (const sub of subordinatesNeedingRally(state, unit)) candidates.push({ kind: 'rally', side, targetUnitId: sub.id })

  if (!unit.inPosition && coverOf(state, unit) !== 'open') candidates.push({ kind: 'go-in-position', side })

  if (figuresOf(state, unit).some((f) => f.status === 'wounded')) candidates.push({ kind: 'reorganise', side })

  const receiver = transferTarget(state, unit)
  if (receiver) candidates.push({ kind: 'transfer', side, receiverUnitId: receiver.id })

  candidates.push({ kind: 'end-activation', side })
  return candidates
}

// ---------------------------------------------------------------------------
// Between activations — which squad goes next
// ---------------------------------------------------------------------------

function nearestThreatened(state: GameState, side: SideId, units: readonly UnitState[]): UnitState | null {
  const scored = units
    .map((u) => ({ u, dist: nearestEnemyDistance(state, side, centreOf(state, u)) }))
    .filter((x) => x.dist < 30)
    .sort((a, b) => a.dist - b.dist)
  return scored[0]?.u ?? null
}

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

/** The action the computer takes for `side`, or null if it is not that side's to take. Every candidate is checked against `applyAction` before it is returned, so this never hands the engine a refusal. */
export function aiAction(state: GameState, side: SideId, stream: DiceStream): Action | null {
  if (state.result) return null
  if (state.phase === 'deployment') return state.sides[side].ready ? null : { kind: 'ready', side }
  if (state.toAct !== side) return null
  if (state.phase === 'turn-start') return { kind: 'choose-first', side, first: otherSide(side) }

  if (state.activation) {
    const unit = state.units[state.activation.unitId]!
    for (const candidate of planActivation(state, unit)) {
      if (!('ok' in applyAction(state, candidate))) return candidate
    }
    return { kind: 'end-activation', side }
  }

  // Between activations: the engine only ever hands `toAct` to a side that has an
  // unactivated unit (`settleTurnFlow` checks `canActivate` first), so `units` here is never
  // empty in practice. The empty branch below still avoids `done`: `state.sides[side].done`
  // is never reset at the start of a turn (see the round's report), so using it would lock
  // this side out of activating for the rest of the battle, not just this turn.
  const units = unactivatedUnits(state, side)
  if (units.length === 0) return canPass(state, side) ? { kind: 'pass', side } : { kind: 'done', side }

  const rallyCommander = commandersWithRallyWork(state, units)
  const withShots = units.find((u) => fireCandidates(state, u).length > 0)
  const pick = rallyCommander ?? withShots ?? nearestThreatened(state, side, units) ?? units[Math.floor(draw(stream) * units.length)]!
  const urgent = !!rallyCommander || !!withShots
  if (canPass(state, side) && !urgent && draw(stream) < 0.25) return { kind: 'pass', side }

  const ordered = [pick, ...units.filter((u) => u.id !== pick.id)]
  for (const u of ordered) {
    const candidate: Action = { kind: 'activate', side, unitId: u.id }
    if (!('ok' in applyAction(state, candidate))) return candidate
  }
  return canPass(state, side) ? { kind: 'pass', side } : { kind: 'done', side }
}

export interface AiPlayOptions {
  seed: number
  maxActions?: number
}

/**
 * A battle played to its end with the computer on both sides. A refusal the
 * computer walks into (it should never issue one itself) is answered by
 * ending the activation, so the game always moves; the journal is ordinary
 * actions and replays.
 */
export function aiPlay(setup: GameSetup, opts: AiPlayOptions): GameState {
  let state = createGame(setup)
  const stream = newStream(opts.seed)
  const maxActions = opts.maxActions ?? 6000
  for (let n = 0; n < maxActions && !state.result; n++) {
    const side: SideId | null = state.phase === 'deployment' ? (!state.sides.north.ready ? 'north' : 'south') : state.toAct
    if (!side) break
    const action = aiAction(state, side, stream)
    if (!action) break
    let next = applyAction(state, action)
    if ('ok' in next) {
      const fallback: Action = state.activation ? { kind: 'end-activation', side } : canPass(state, side) ? { kind: 'pass', side } : { kind: 'done', side }
      next = applyAction(state, fallback)
      if ('ok' in next) throw new Error(`the computer cannot move the battle on: ${next.reason} (${next.page}) after ${action.kind}`)
    }
    state = next
  }
  return state
}
