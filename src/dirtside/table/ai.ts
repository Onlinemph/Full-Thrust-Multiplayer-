/**
 * Dirtside II — the computer at the table. Not clever, but it plays to the
 * scenario: an attacker goes for the objectives it does not hold, a defender
 * stays in its prepared positions and takes back what it has lost, every
 * element shoots at what it can hit, units at the edge of breaking are
 * rallied, and fire is called down from orbit on the thickest enemy ground
 * clear of friends. Every decision is an ordinary action through the one
 * door, so a computer's battle replays like anyone's.
 *
 * `aiAction` answers for one side, whenever that side is to act; `aiPlay`
 * plays a whole battle with the computer on both sides, which is what the
 * campaign does when the players let the computers fight a landing.
 */

import { mobilityFamily } from '../data/mobility'
import { type DiceStream, draw, newStream } from '../dice'
import { applyAction, canPass, commandUnitOf, createGame, elementsOf, functional, inRearArea, mobile, objectiveValues, strikesDue, unactivatedUnits } from './game'
import { restrictionsOf } from './confidence'
import { NUKE_EXCLUSION, STRIKE_RADIUS, attacksLeft, orbitalShips, overhead, protectedFromFallout } from './orbital'
import { baseMovement, planTableShot, teamFiresRanged, unitKind } from './tableFire'
import { distance, lineOfSight, onTable, pathCost } from './terrain'
import type { Action, ElementState, GameSetup, GameState, OrbitalAttack, Point, ShotOrder, SideId, UnitState, WeaponChoice } from './types'
import { otherSide } from './types'

function weaponsOf(el: ElementState): WeaponChoice[] {
  const out: WeaponChoice[] = []
  if (el.vehicle) {
    for (const w of [...el.vehicle.weapons].sort((a, b) => b.class - a.class)) out.push({ kind: 'direct', weaponId: w.id })
    out.push({ kind: 'apsw' })
  }
  if (el.infantry && teamFiresRanged(el)) {
    if (el.infantry.team === 'rifle') out.push({ kind: 'iavr' })
    out.push(el.infantry.team === 'apsw' ? { kind: 'apsw' } : { kind: 'rifles' })
  }
  return out
}

const near = (a: Point, b: Point) => distance(a, b)

/** The best shot each element of the unit has now: the nearest target a weapon can reach, heaviest weapon first. */
function volleyFor(state: GameState, unit: UnitState, targets: readonly ElementState[], opportunity: boolean): ShotOrder[] {
  const shots: ShotOrder[] = []
  const activation = opportunity ? null : state.activation
  for (const el of elementsOf(state, unit)) {
    if (!functional(el) || el.systemsDown) continue
    const record = activation?.elements[el.id] ?? null
    if (record?.fired || record?.travel) continue
    const nearest = targets.filter(functional).sort((a, b) => near(a.position, el.position) - near(b.position, el.position)).slice(0, 5)
    let chosen: ShotOrder | null = null
    for (const target of nearest) {
      for (const weapon of weaponsOf(el)) {
        const order: ShotOrder = { elementId: el.id, weapon, targetId: target.id }
        if (planTableShot(state, order, { activation: record, opportunity }).ok) {
          chosen = order
          break
        }
      }
      if (chosen) break
    }
    if (chosen) shots.push(chosen)
  }
  return shots
}

function enemiesOf(state: GameState, side: SideId): ElementState[] {
  return Object.values(state.elements).filter((e) => e.sideId !== side && functional(e))
}

function defends(state: GameState, side: SideId): boolean {
  return state.setup.battle === 'attack-defence' && side !== (state.setup.attacker ?? 'north')
}

/** Where an element of the side wants to be. */
function goalFor(state: GameState, side: SideId, el: ElementState, unit: UnitState): Point | null {
  const restrictions = restrictionsOf(unit.confidence, unitKind(state, unit))
  if (restrictions.mustWithdraw) return { x: el.position.x, y: side === 'north' ? 0.5 : state.setup.table.depth - 0.5 }
  const objectives = state.setup.table.objectives
  const lost = objectives.filter((o) => state.objectives[o.id]?.heldBy !== side)
  if (defends(state, side)) {
    if (el.dugIn) return null
    const retake = lost.sort((a, b) => near(a.position, el.position) - near(b.position, el.position))[0]
    if (retake) return retake.position
    // Holding: an element within 5" of an objective it holds stays where it was posted.
    const mine = [...objectives].sort((a, b) => near(a.position, el.position) - near(b.position, el.position))[0]
    return mine && near(mine.position, el.position) > 5 ? mine.position : null
  }
  const target = lost.sort((a, b) => near(a.position, el.position) - near(b.position, el.position))[0]
  if (target) return target.position
  const enemy = enemiesOf(state, side).sort((a, b) => near(a.position, el.position) - near(b.position, el.position))[0]
  return enemy?.position ?? null
}

/** A move towards the goal the element can afford, tried at full length and shorter, straight and angled. */
function moveFor(state: GameState, side: SideId, el: ElementState, goal: Point): Action | null {
  const record = state.activation!.elements[el.id]!
  const bmf = baseMovement(el)
  if (bmf <= 0) return null
  const allowance = el.damaged ? bmf / 2 : bmf
  const cap = (record.firedBeforeMoving ? Math.min(allowance, bmf / 2) : allowance) - record.factorsUsed
  if (cap < 0.5) return null
  const gap = near(el.position, goal)
  if (gap < 0.3) return null
  const family = el.vehicle ? mobilityFamily(el.vehicle.mobility) : 'infantry'
  const wades = !!el.vehicle?.amphibious || el.infantry?.troops === 'powered'
  const base = Math.atan2(goal.y - el.position.y, goal.x - el.position.x)
  for (const turn of [0, 0.5, -0.5, 1, -1]) {
    for (const share of [1, 0.75, 0.5, 0.3]) {
      const reach = Math.min(gap, cap) * share
      if (reach < 0.4) continue
      const to = { x: el.position.x + Math.cos(base + turn) * reach, y: el.position.y + Math.sin(base + turn) * reach }
      if (!onTable(to, state.setup.table)) continue
      const cost = pathCost([el.position, to], family, state.setup.table.terrain, { amphibious: wades })
      if (cost.blockedAt || cost.factors > cap + 1e-9) continue
      if (!protectedFromFallout(el) && (state.orbit?.nukes ?? []).some((n) => near(n, to) < NUKE_EXCLUSION + 0.2)) continue
      const action: Action = { kind: 'move', side, elementId: el.id, path: [to] }
      if (!('ok' in applyAction(state, action))) return action
    }
  }
  return null
}

/** The thickest enemy ground the side can see and aim at safely: no friend within the zone and the worst deviation (7"). */
function orbitalCall(state: GameState, side: SideId, unit: UnitState): Action | null {
  if (!state.orbit || !overhead(state, side)) return null
  const ship = orbitalShips(state, side).map((s) => ({ s, left: attacksLeft(state, s) })).find((x) => x.left.pbm > 0 || x.left.sheaf > 0)
  if (!ship) return null
  const attack: OrbitalAttack = ship.left.pbm > 0 ? 'pbm' : 'sheaf'
  const radius = STRIKE_RADIUS[attack]
  const callers = elementsOf(state, unit).filter((e) => functional(e) && !e.systemsDown && (unit.leaderElementId === e.id || e.infantry?.team === 'observer') && !state.activation!.elements[e.id]?.fired)
  if (callers.length === 0) return null
  const friends = Object.values(state.elements).filter((e) => e.sideId === side && functional(e))
  const enemies = enemiesOf(state, side)
  let best: { aim: Point; caller: ElementState; score: number } | null = null
  for (const aim of enemies.map((e) => e.position)) {
    if (friends.some((f) => near(f.position, aim) <= radius + 7)) continue
    const score = enemies.filter((e) => near(e.position, aim) <= radius).length
    if (best && score <= best.score) continue
    const caller = callers.find((c) => lineOfSight(c.position, aim, state.setup.table.terrain).clear)
    if (caller) best = { aim, caller, score }
  }
  if (!best) return null
  return { kind: 'call-orbital', side, elementId: best.caller.id, shipId: ship.s.id, attack, aim: { ...best.aim } }
}

/** The action the computer takes for `side`, or null if it is not that side's to take. */
export function aiAction(state: GameState, side: SideId, stream: DiceStream): Action | null {
  if (state.result) return null
  if (state.phase === 'deployment') return state.sides[side].ready ? null : { kind: 'ready', side }
  if (state.toAct !== side) return null
  if (state.phase === 'turn-start') return { kind: 'choose-first', side, first: otherSide(side) }
  const activation = state.activation

  // An opportunity window on the enemy's move.
  if (activation?.window) {
    const moving = state.units[activation.unitId]!
    for (const unit of unactivatedUnits(state, side)) {
      if (unit.panic || unit.evasive) continue
      const shots = volleyFor(state, unit, elementsOf(state, moving), true)
      if (shots.length > 0) return { kind: 'opportunity-fire', side, unitId: unit.id, shots }
    }
    return { kind: 'decline-opportunity', side }
  }

  if (activation) {
    const unit = state.units[activation.unitId]!
    for (const el of elementsOf(state, unit)) if (functional(el) && el.systemsDown && !activation.repairTried.includes(el.id)) return { kind: 'repair', side, elementId: el.id }
    const call = orbitalCall(state, side, unit)
    if (call) return call
    const enemies = enemiesOf(state, side)
    const shots = volleyFor(state, unit, enemies, false)
    if (shots.length > 0) {
      const action: Action = { kind: 'fire', side, shots }
      if (!('ok' in applyAction(state, action))) return action
    }
    if (activation.moveTest !== 'failed') {
      for (const el of elementsOf(state, unit)) {
        if (!mobile(el) || activation.elements[el.id]!.moved) continue
        const goal = goalFor(state, side, el, unit)
        if (!goal) continue
        const move = moveFor(state, side, el, goal)
        if (move) return move
      }
    }
    return { kind: 'end-activation', side }
  }

  // Between activations.
  if (strikesDue(state, side).length > 0) return { kind: 'orbital-strike', side }
  const values = objectiveValues(state)
  const objectives = state.setup.table.objectives
  const mine = objectives.filter((o) => state.objectives[o.id]?.heldBy === side)
  const mayDeclare = !defends(state, side) && mine.length * 2 > objectives.length && (state.setup.battle !== 'encounter' || mine.some((o) => inRearArea(state.setup, otherSide(side), o.position)))
  if (mayDeclare && values[side] > values[otherSide(side)]) return { kind: 'declare-end', side }
  const units = unactivatedUnits(state, side)
  if (units.length === 0) return { kind: 'done', side }
  const command = commandUnitOf(state, side)
  if (command && !state.sides[side].commandLost) {
    const shaken = units.find((u) => u.id !== command.id && (u.confidence === 'BR' || u.confidence === 'RO'))
    if (shaken) return { kind: 'rally', side, unitId: shaken.id }
  }
  const enemies = enemiesOf(state, side)
  const withShots = units.find((u) => elementsOf(state, u).some((e) => functional(e) && enemies.some((t) => distance(t.position, e.position) < 30)))
  const pick = withShots ?? units[Math.floor(draw(stream) * units.length)]!
  if (canPass(state, side) && !withShots && draw(stream) < 0.2) return { kind: 'pass', side }
  return { kind: 'activate', side, unitId: pick.id }
}

export interface AiPlayOptions {
  seed: number
  maxActions?: number
}

/**
 * A battle played to its end with the computer on both sides. A refusal the
 * computer walks into is answered by ending the activation or the turn, so
 * the game always moves; the journal is ordinary actions and replays.
 */
export function aiPlay(setup: GameSetup, opts: AiPlayOptions): GameState {
  let state = createGame(setup)
  const stream = newStream(opts.seed)
  const maxActions = opts.maxActions ?? 5000
  for (let n = 0; n < maxActions && !state.result; n++) {
    const side: SideId | null = state.phase === 'deployment' ? (!state.sides.north.ready ? 'north' : 'south') : state.toAct
    if (!side) break
    const action = aiAction(state, side, stream)
    if (!action) break
    let next = applyAction(state, action)
    if ('ok' in next) {
      const fallback: Action = state.activation?.window ? { kind: 'decline-opportunity', side, forActivation: true } : state.activation ? { kind: 'end-activation', side } : strikesDue(state, side).length > 0 ? { kind: 'orbital-strike', side } : { kind: 'done', side }
      next = applyAction(state, fallback)
      if ('ok' in next) throw new Error(`the computer cannot move the battle on: ${next.reason} (${next.page}) after ${action.kind}`)
    }
    state = next
  }
  return state
}
