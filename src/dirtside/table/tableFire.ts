/**
 * Dirtside II — a shot on the table: whether this element may shoot that
 * one from here, and what the shot is (pp. 18–20, 28–36).
 *
 * fire.ts already knows the dice and the chits. This module adds what the
 * table knows: line of sight, the angle of attack, the cover the target is
 * standing in, whether the firer has moved, whether the unit is fit to
 * fire — and the infantry's own weapons, which fire.ts does not cover.
 */

import { INFANTRY_KILL_TOTAL, type InfantryHit, type VehicleHit, firefightValidity, resolveInfantryHit, resolveVehicleHit, drawChits } from '../chits'
import { APSW_RANGE, IAVR_RANGE, type ChitValidity } from '../data/weapons'
import { INFANTRY_BMF, baseMovementOf } from '../data/mobility'
import type { DiceStream } from '../dice'
import { type InfantryShotPlan, type Shot, type VehicleShotPlan, fireShot, planShot } from '../fire'
import type { InfantryPosition, TargetPosture } from '../types'
import { restrictionsOf } from './confidence'
import { angleBetween, bearing, lineOfSight, terrainAt, woodAt } from './terrain'
import { type ActivationElement, type ElementState, type GameState, type Refusal, type ShotOrder, type UnitState, refuse } from './types'

/** Half-angle of the front arc: lines through opposite corners of the model (p. 32). */
export const FRONT_ARC = 45

export function baseMovement(element: ElementState): number {
  if (element.vehicle) return baseMovementOf(element.vehicle) ?? 0
  if (element.infantry) return element.infantry.cavalry ? INFANTRY_BMF.cavalry : INFANTRY_BMF[element.infantry.troops]
  return 0
}

/** Dismounted infantry or armour, for confidence purposes (p. 22). */
export function unitKind(state: GameState, unit: UnitState): 'infantry' | 'armour' {
  const live = unit.elementIds.map((id) => state.elements[id]!).filter((e) => !e.destroyed)
  return live.length > 0 && live.every((e) => e.infantry) ? 'infantry' : 'armour'
}

/** Whether the target is in the firer's front arc: within 45° of its facing. */
export function inFrontArc(firer: ElementState, target: ElementState): boolean {
  return angleBetween(firer.facing, bearing(firer.position, target.position)) <= FRONT_ARC
}

/** Which face of the target the shot strikes (p. 32): front within 45° of its facing, otherwise side (rear is the side value, p. 10). */
export function aspectOf(target: ElementState, firer: ElementState): 'front' | 'side' {
  return angleBetween(target.facing, bearing(target.position, firer.position)) <= FRONT_ARC ? 'front' : 'side'
}

/** The vehicle's posture as the target die table reads it (p. 29): the highest that applies. */
export function vehiclePosture(state: GameState, target: ElementState, unit: UnitState): TargetPosture {
  if (target.posture === 'turret-down') return 'turret-down'
  if (target.posture === 'hull-down') return 'hull-down'
  if (target.dugIn) return 'dug-in'
  if (unit.evasive) return 'evading'
  if (woodAt(target.position, state.setup.table.terrain)?.where === 'edge') return 'soft-cover'
  return 'none'
}

/** Where an infantry element stands, for chit validity (p. 33). */
export function infantryPosition(state: GameState, target: ElementState): InfantryPosition {
  if (target.dugIn) return 'dug-in'
  if (terrainAt(target.position, state.setup.table.terrain) === 'urban') return 'urban'
  if (woodAt(target.position, state.setup.table.terrain)?.where === 'edge') return 'soft-cover'
  return 'open'
}

export interface TablePlanBase {
  ok: true
  firer: ElementState
  target: ElementState
  range: number
  aspect: 'front' | 'side' | null
  notes: string[]
}

export type TableShotPlan =
  | (TablePlanBase & { kind: 'direct'; plan: VehicleShotPlan | InfantryShotPlan; shot: Shot })
  /** Rifles, an APSW, or an IAVR: no roll, a draw of chits (pp. 33–36). */
  | (TablePlanBase & { kind: 'chits'; weapon: 'rifles' | 'apsw' | 'iavr'; chits: number; validity: ChitValidity; against: 'infantry' | 'soft-vehicle' | 'vehicle'; killTotal: number | null; armour: number | null })

const APSW_CHITS = 3

/** Whether an infantry team may take part in ranged fire (p. 13, p. 33). */
export function teamFiresRanged(element: ElementState): boolean {
  return element.infantry?.team === 'rifle' || element.infantry?.team === 'apsw'
}

export function rifleRange(troops: 'militia' | 'line' | 'powered'): number {
  return { militia: 4, line: 6, powered: 8 }[troops]
}

/**
 * Plan a shot from the table. `activation` is the firer's record in the
 * current activation, or null for opportunity fire; `opportunity` marks
 * fire during the enemy's move (p. 20).
 */
export function planTableShot(state: GameState, order: ShotOrder, opts: { activation: ActivationElement | null; opportunity: boolean }): TableShotPlan | Refusal {
  const firer = state.elements[order.elementId]
  const target = state.elements[order.targetId]
  if (!firer) return refuse('No such firing element.', 'p. 18')
  if (!target) return refuse('No such target.', 'p. 28')
  if (firer.sideId === target.sideId) return refuse('That is a friendly element.', 'p. 28')
  if (firer.destroyed) return refuse(`${firer.name} is knocked out.`, 'p. 30')
  if (target.destroyed) return refuse(`${target.name} is already out of action.`, 'p. 28')
  const unit = state.units[firer.unitId]!
  const targetUnit = state.units[target.unitId]!
  if (unit.panic) return refuse(`${unit.name} is panicking and may do nothing until it spends an activation recovering.`, 'p. 23')
  if (unit.evasive) return refuse(`${unit.name} is evading and may not fire.`, 'p. 27')
  const restrictions = restrictionsOf(unit.confidence, unitKind(state, unit))
  if (opts.opportunity ? !restrictions.returnFire : restrictions.noFire) return refuse(`${unit.name} is ${unit.confidence === 'BR' ? 'broken' : 'routed'} and may not fire.`, 'p. 22')
  if (opts.activation?.fired) return refuse(`${firer.name} has already made its combat action this activation.`, 'p. 18')
  if (opts.activation?.travel) return refuse(`${firer.name} moved in travel mode and may not engage.`, 'p. 25')
  if (firer.systemsDown) return refuse(`${firer.name} is systems down and may make no combat action.`, 'p. 30')
  const sight = lineOfSight(firer.position, target.position, state.setup.table.terrain)
  if (!sight.clear) return refuse(`No line of sight: ${sight.reason}.`, 'p. 4')
  const range = sight.range
  const notes: string[] = []
  const movedFast = opts.activation ? opts.activation.factorsUsed > baseMovement(firer) / 2 : false

  const choice = order.weapon
  if (choice.kind === 'direct') {
    if (!firer.vehicle) return refuse('Only a vehicle carries direct-fire weapons.', 'p. 11')
    if (firer.posture === 'turret-down') return refuse(`${firer.name} is turret down and cannot see to shoot.`, 'p. 29')
    const weaponId = choice.weaponId
    const weapon = firer.vehicle.weapons.find((w) => w.id === weaponId)
    if (!weapon) return refuse('No such weapon on the vehicle.', 'p. 11')
    if (weapon.mount === 'fixed') {
      if (opts.opportunity) return refuse('A fixed mount cannot fire opportunity fire; it fires only before, or instead of, moving.', 'p. 20')
      if (opts.activation?.moved) return refuse('A fixed mount fires only before, or instead of, moving.', 'p. 18')
      if (!inFrontArc(firer, target)) return refuse('A fixed mount fires only into the front arc.', 'p. 11')
    }
    const shot: Shot =
      target.vehicle
        ? {
            firer: { design: firer.vehicle, weaponId: weapon.id, movingFast: movedFast, damaged: firer.damaged, systemsDown: firer.systemsDown },
            target: { kind: 'vehicle', design: target.vehicle, aspect: aspectOf(target, firer), posture: vehiclePosture(state, target, targetUnit) },
            range,
          }
        : {
            firer: { design: firer.vehicle, weaponId: weapon.id, movingFast: movedFast, damaged: firer.damaged, systemsDown: firer.systemsDown },
            target: { kind: 'infantry', troops: target.infantry!.troops, position: infantryPosition(state, target) },
            range,
          }
    const plan = planShot(shot)
    if (!plan.ok) return plan
    if (shot.target.kind === 'vehicle') notes.push(`${shot.target.aspect === 'front' ? 'Front' : 'Side'} armour, target ${shot.target.posture === 'none' ? 'in the open' : shot.target.posture}.`)
    return { ok: true, kind: 'direct', firer, target, range, aspect: shot.target.kind === 'vehicle' ? shot.target.aspect : null, plan, shot, notes: [...notes, ...plan.notes] }
  }

  // Chit weapons: rifles, an APSW, an IAVR.
  const troops = firer.infantry?.troops
  if (choice.kind === 'iavr') {
    if (!firer.infantry || firer.infantry.team !== 'rifle') return refuse('IAVRs are carried by rifle teams.', 'p. 36')
    if (!target.vehicle) return refuse('An IAVR is fired at a vehicle.', 'p. 36')
    if (range > IAVR_RANGE) return refuse(`An IAVR reaches ${IAVR_RANGE}"; the target is at ${range.toFixed(1)}".`, 'p. 36')
    const special = target.vehicle.armourSpecial
    const validity: ChitValidity = special === 'reactive' ? 'RED' : target.vehicle.apfc ? 'YELLOW' : 'R/Y'
    notes.push(`IAVR: 2 chits, ${special === 'reactive' ? 'red only against reactive armour' : target.vehicle.apfc ? 'yellow only against APFCs' : 'red and yellow'}; specials count (p. 36).`)
    return { ok: true, kind: 'chits', weapon: 'iavr', firer, target, range, aspect: aspectOf(target, firer), chits: 2, validity, against: 'vehicle', killTotal: null, armour: aspectOf(target, firer) === 'front' ? target.vehicle.armour : Math.max(0, target.vehicle.armour - 1), notes }
  }
  if (choice.kind === 'apsw') {
    const vehicleApsw = !!firer.vehicle
    const teamApsw = firer.infantry?.team === 'apsw'
    if (!vehicleApsw && !teamApsw) return refuse('Only a vehicle or an APSW team fires an APSW.', 'p. 35')
    if (range > APSW_RANGE) return refuse(`An APSW reaches ${APSW_RANGE}"; the target is at ${range.toFixed(1)}".`, 'p. 35')
  } else {
    if (!firer.infantry || !troops) return refuse('Only infantry fire personal arms.', 'p. 33')
    if (firer.infantry.team !== 'rifle') return refuse(`A ${firer.infantry.team} team has only close-defence weapons and may not fire in a firefight.`, 'p. 13')
    if (range > rifleRange(troops)) return refuse(`${troops} rifles reach ${rifleRange(troops)}"; the target is at ${range.toFixed(1)}".`, 'p. 33')
  }
  const chits = choice.kind === 'apsw' ? APSW_CHITS : troops === 'powered' ? 3 : 2
  if (target.infantry) {
    const position = infantryPosition(state, target)
    return { ok: true, kind: 'chits', weapon: choice.kind as 'rifles' | 'apsw', firer, target, range, aspect: null, chits, validity: firefightValidity(position), against: 'infantry', killTotal: INFANTRY_KILL_TOTAL[target.infantry.troops], armour: null, notes: [`${chits} chits, ${position.replace('-', ' ')} (p. 33).`] }
  }
  if (target.vehicle && target.vehicle.armour === 0) {
    notes.push('A soft-skinned vehicle is fired on as powered infantry: 5 points to kill, specials count (p. 36).')
    return { ok: true, kind: 'chits', weapon: choice.kind as 'rifles' | 'apsw', firer, target, range, aspect: aspectOf(target, firer), chits, validity: firefightValidity(infantryPosition(state, target)), against: 'soft-vehicle', killTotal: 5, armour: 4, notes }
  }
  return refuse('Infantry arms and APSWs have no effect on an armoured vehicle.', 'p. 36')
}

export interface ChitShotResult {
  kind: 'chits'
  plan: Extract<TableShotPlan, { kind: 'chits' }>
  vehicle: VehicleHit | null
  infantry: InfantryHit | null
}

/** Draw the chits of a rifles, APSW or IAVR shot and read them. */
export function resolveChitShot(plan: Extract<TableShotPlan, { kind: 'chits' }>, stream: DiceStream): ChitShotResult {
  const chits = drawChits(plan.chits, stream)
  if (plan.against === 'infantry') return { kind: 'chits', plan, vehicle: null, infantry: resolveInfantryHit(chits, plan.validity, plan.killTotal!) }
  return { kind: 'chits', plan, vehicle: resolveVehicleHit(chits, plan.validity, plan.armour!), infantry: null }
}

export { fireShot }
