/**
 * Dirtside II — direct fire (pp. 28–32) and vehicle weapons against
 * infantry (p. 36).
 *
 * A shot is planned before it is rolled: `planShot` turns a firer, a target
 * and a range into the band, the dice, the validity and the exact odds, or
 * refuses with the page that says why. `fireShot` then rolls that plan on a
 * seeded stream. The screen shows the plan, the game rolls it, and the
 * tests check the plan against the book's own examples.
 */

import {
  type Chit,
  INFANTRY_KILL_TOTAL,
  type InfantryHit,
  chitLabel,
  drawChits,
  firefightValidity,
  resolveInfantryHit,
  resolveVehicleHit,
  type VehicleHit,
  validityLabel,
} from './chits'
import { type ChitValidity, type DieType, type RangeBand, firerDie, rangeBandsOf, singleBand, stepDie, targetDie, validityAgainstInfantry, validityOf } from './data/weapons'
import { effectiveSignature, sideArmour, weaponLabel } from './design'
import { type DiceStream, dieLabel, roll } from './dice'
import { type InfantryHitOdds, type ShotOdds, type VehicleHitOdds, infantryHitOdds, vehicleHitOdds, vehicleShotOdds } from './odds'
import type { DirectFireWeapon, InfantryPosition, InfantryTroops, TargetPosture, VehicleDesign } from './types'

// ---------------------------------------------------------------------------
// What is asked
// ---------------------------------------------------------------------------

export interface Firer {
  design: VehicleDesign
  weaponId: string
  /** Has moved, or will move, more than half its base movement this activation: one die step down (p. 28). */
  movingFast: boolean
  /** Carries a DMG marker: every band counts as the next one out, long is impossible (p. 30). */
  damaged: boolean
  /** Systems down: no combat actions until repaired (p. 30, p. 32). */
  systemsDown: boolean
}

export type Target =
  | { kind: 'vehicle'; design: VehicleDesign; aspect: 'front' | 'side'; posture: TargetPosture }
  | { kind: 'infantry'; troops: InfantryTroops; position: InfantryPosition }

/**
 * Which validity a vehicle weapon uses against infantry. The book prints
 * two: a colour per weapon (p. 29, and on the record card) and, in the
 * vehicle-weapons-against-infantry section, "the same as for infantry
 * firefights" (p. 36), which is by the target's cover (p. 33). They cannot
 * both apply, so the reading is a choice; 'weapon' is the default because
 * it is what the card in the player's hand says.
 */
export type InfantryValidityRule = 'weapon' | 'position'

export interface Shot {
  firer: Firer
  target: Target
  /** Inches from firer to target. */
  range: number
  infantryValidity?: InfantryValidityRule
}

export interface Refusal {
  ok: false
  reason: string
  page: string
}

const refuse = (reason: string, page: string): Refusal => ({ ok: false, reason, page })

/** The secondary die a posture gives the target (p. 29). */
export const SECONDARY_DIE: Record<TargetPosture, DieType | null> = {
  none: null,
  'turret-down': 12,
  'hull-down': 10,
  'dug-in': 10,
  evading: 8,
  'soft-cover': 6,
  'pop-up': 6,
}

export const POSTURE_LABELS: Record<TargetPosture, string> = {
  none: 'in the open',
  'turret-down': 'turret down',
  'hull-down': 'hull down',
  'dug-in': 'dug in',
  evading: 'evading',
  'soft-cover': 'in soft cover',
  'pop-up': 'popping up under opportunity fire',
}

export const POSITION_LABELS: Record<InfantryPosition, string> = {
  open: 'in the open',
  'soft-cover': 'in soft cover',
  'dug-in': 'dug in',
  urban: 'in an urban area',
}

export const TROOP_LABELS: Record<InfantryTroops, string> = { militia: 'Militia', line: 'Line', powered: 'Powered' }

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/**
 * The band a shot at `range` falls in for this weapon, after a damaged
 * firer's shift (p. 30); null beyond reach. A HEL's one 60" band is the
 * medium band for the die (p. 28).
 */
export function bandAt(weapon: Pick<DirectFireWeapon, 'type' | 'class'>, range: number, damaged = false): RangeBand | null {
  const bands = rangeBandsOf(weapon.type, weapon.class)
  if (!bands) return null
  let band: RangeBand | null
  if (singleBand(weapon.type)) band = range <= bands.long ? 'medium' : null
  else band = range <= bands.close ? 'close' : range <= bands.medium ? 'medium' : range <= bands.long ? 'long' : null
  if (band && damaged) band = band === 'close' ? 'medium' : band === 'medium' ? 'long' : null
  return band
}

export interface VehicleShotPlan {
  ok: true
  kind: 'vehicle'
  weapon: DirectFireWeapon
  band: RangeBand
  firerDie: DieType
  targetPrimary: DieType
  targetSecondary: DieType | null
  /** Firer dice: one per barrel (p. 32). */
  dice: number
  /** Chits per hit: the weapon's class (p. 29). */
  chitsPerHit: number
  validity: ChitValidity
  armour: number
  hitOdds: VehicleHitOdds
  odds: ShotOdds
  notes: string[]
}

export interface InfantryShotPlan {
  ok: true
  kind: 'infantry'
  weapon: DirectFireWeapon
  band: RangeBand
  /** No roll: the hit is automatic (p. 36). One draw per barrel. */
  draws: number
  chitsPerDraw: number
  validity: ChitValidity
  killTotal: number
  hitOdds: InfantryHitOdds
  /** The chance the element is removed. */
  killed: number
  notes: string[]
}

export type ShotPlan = VehicleShotPlan | InfantryShotPlan

export function planShot(shot: Shot): ShotPlan | Refusal {
  const { firer, target } = shot
  const weapon = firer.design.weapons.find((w) => w.id === firer.weaponId)
  if (!weapon) return refuse('The firer has no such weapon.', 'p. 11')
  if (firer.systemsDown) return refuse('Systems down: the vehicle may make no combat action until it is repaired.', 'p. 30')
  const bands = rangeBandsOf(weapon.type, weapon.class)
  if (!bands) return refuse(`${weaponLabel(weapon)} is not a class the weapon is made in.`, 'p. 8')
  const nominal = bandAt(weapon, shot.range)
  if (!nominal) return refuse(`${weaponLabel(weapon)} reaches ${bands.long}"; the target is at ${shot.range}".`, 'p. 28')
  const band = bandAt(weapon, shot.range, firer.damaged)
  if (!band) return refuse('A damaged vehicle treats every band as the next one out, so a long-range shot is impossible.', 'p. 30')
  const notes: string[] = []
  if (firer.damaged) notes.push(`Damaged: ${nominal} range counts as ${band} (p. 30).`)

  if (target.kind === 'infantry') return planAgainstInfantry(shot, weapon, band, notes)

  const fireControl = firer.design.fireControl
  if (!fireControl) return refuse('No fire control fitted: there is no die to roll the shot with.', 'p. 28')
  const base = firerDie(fireControl, band)
  const die = stepDie(base, firer.movingFast ? -1 : 0)
  if (!die) return refuse(`Moving more than half its base movement takes the ${dieLabel(base)} off the end of the dice scale.`, 'p. 28')
  if (firer.movingFast) notes.push(`Moving over half its base movement: ${dieLabel(base)} becomes ${dieLabel(die)} (p. 28).`)
  const signature = effectiveSignature(target.design)
  const targetPrimary = targetDie(signature)
  const targetSecondary = SECONDARY_DIE[target.posture]
  if (targetSecondary) notes.push(`Target ${POSTURE_LABELS[target.posture]}: a second ${dieLabel(targetSecondary)}, the higher counts (p. 29).`)
  const armour = target.aspect === 'front' ? target.design.armour : sideArmour(target.design)
  const special = target.design.armourSpecial
  const validity = validityOf(weapon.type, band, { ablative: special === 'ablative', reactive: special === 'reactive' })
  if (special !== 'none' && validity !== validityOf(weapon.type, band)) notes.push(`${special === 'ablative' ? 'Ablative' : 'Reactive'} armour: ${validityLabel(validity)} (p. 29).`)
  const hitOdds = vehicleHitOdds(weapon.class, validity, armour)
  const odds = vehicleShotOdds(weapon.barrels, die, targetPrimary, targetSecondary, hitOdds)
  return { ok: true, kind: 'vehicle', weapon, band, firerDie: die, targetPrimary, targetSecondary, dice: weapon.barrels, chitsPerHit: weapon.class, validity, armour, hitOdds, odds, notes }
}

/** Vehicle weapons against infantry (p. 36): no roll, a fixed number of chits, and a shorter reach. */
function planAgainstInfantry(shot: Shot, weapon: DirectFireWeapon, band: RangeBand, notes: string[]): InfantryShotPlan | Refusal {
  const target = shot.target
  if (target.kind !== 'infantry') throw new Error('not an infantry target')
  let chitsPerDraw: number
  switch (weapon.type) {
    case 'hkp':
      return refuse('HKPs are not effective against infantry.', 'p. 36')
    case 'hel':
      if (shot.range > 36) return refuse(`A HEL reaches 36" against infantry; the target is at ${shot.range}".`, 'p. 36')
      chitsPerDraw = 2
      break
    case 'rfac':
    case 'mdc':
    case 'hvc':
      if (band === 'long') return refuse(`${weaponLabel(weapon)} reaches infantry only within its medium band.`, 'p. 36')
      chitsPerDraw = 2
      break
    case 'dffg':
      if (band === 'long') return refuse(`${weaponLabel(weapon)} reaches infantry only within its medium band.`, 'p. 36')
      chitsPerDraw = 3
      break
    case 'slam':
      if (band !== 'close') return refuse('A SLAM fires on infantry directly at close range only; beyond that they can only be caught as secondary targets.', 'p. 36')
      chitsPerDraw = weapon.class
      break
  }
  const rule = shot.infantryValidity ?? 'weapon'
  let validity: ChitValidity
  if (rule === 'weapon') {
    const own = validityAgainstInfantry(weapon.type)
    if (!own) return refuse(`${weaponLabel(weapon)} has no effect on infantry.`, 'p. 29')
    validity = own
    notes.push(`Validity by weapon: ${validityLabel(validity)} against infantry (p. 29).`)
  } else {
    validity = firefightValidity(target.position)
    notes.push(`Validity by cover, as for a firefight: ${validityLabel(validity)} ${POSITION_LABELS[target.position]} (p. 33, p. 36).`)
  }
  const killTotal = INFANTRY_KILL_TOTAL[target.troops]
  const hitOdds = infantryHitOdds(chitsPerDraw, validity, killTotal)
  const draws = weapon.barrels
  if (draws > 1) notes.push(`${draws} barrels: each is an automatic hit with its own draw (p. 32, p. 36).`)
  return { ok: true, kind: 'infantry', weapon, band, draws, chitsPerDraw, validity, killTotal, hitOdds, killed: 1 - (1 - hitOdds.killed) ** draws, notes }
}

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------

export interface ShotOutcome {
  knockedOut: boolean
  damaged: boolean
  immobilised: boolean
  systemsDown: boolean
  firerSystemsDown: boolean
}

export interface VehicleShotResult {
  kind: 'vehicle'
  plan: VehicleShotPlan
  firerRolls: number[]
  targetRolls: { primary: number; secondary: number | null; best: number }
  hits: number
  results: VehicleHit[]
  outcome: ShotOutcome
}

export interface InfantryShotResult {
  kind: 'infantry'
  plan: InfantryShotPlan
  results: InfantryHit[]
  killed: boolean
}

export type ShotResult = VehicleShotResult | InfantryShotResult

/** Roll a shot: the firer's dice, the target's, then a draw per hit, all from the stream in that order. */
export function fireShot(shot: Shot, stream: DiceStream): ShotResult | Refusal {
  const plan = planShot(shot)
  if (!plan.ok) return plan
  if (plan.kind === 'infantry') {
    const results = Array.from({ length: plan.draws }, () => resolveInfantryHit(drawChits(plan.chitsPerDraw, stream), plan.validity, plan.killTotal))
    return { kind: 'infantry', plan, results, killed: results.some((r) => r.killed) }
  }
  const firerRolls = Array.from({ length: plan.dice }, () => roll(plan.firerDie, stream))
  const primary = roll(plan.targetPrimary, stream)
  const secondary = plan.targetSecondary ? roll(plan.targetSecondary, stream) : null
  const best = Math.max(primary, secondary ?? 0)
  const hits = firerRolls.filter((r) => r > best).length
  const results = Array.from({ length: hits }, () => resolveVehicleHit(drawChits(plan.chitsPerHit, stream), plan.validity, plan.armour))
  const knockedOut = results.some((r) => r.knockedOut)
  const outcome: ShotOutcome = {
    knockedOut,
    damaged: !knockedOut && results.some((r) => r.damaged),
    immobilised: !knockedOut && results.some((r) => r.immobilised),
    systemsDown: !knockedOut && results.some((r) => r.systemsDown),
    firerSystemsDown: results.some((r) => r.firerSystemsDown),
  }
  return { kind: 'vehicle', plan, firerRolls, targetRolls: { primary, secondary, best }, hits, results, outcome }
}

// ---------------------------------------------------------------------------
// In words
// ---------------------------------------------------------------------------

const list = (chits: readonly Chit[]) => chits.map(chitLabel).join(', ')
const pointsText = (points: number) => (Number.isInteger(points) ? String(points) : points.toFixed(1))

export function describeVehicleHit(hit: VehicleHit): string {
  const drew = `Drew ${list(hit.chits)}: ${pointsText(hit.points)} valid against armour ${hit.armour}`
  if (hit.firerSystemsDown) return `${drew} — F: the shot never fired; the firer is systems down.`
  if (hit.boom) return `${drew} — BOOM: catastrophic kill.`
  if (hit.knockedOut) return `${drew} — knocked out.`
  const effects: string[] = []
  if (hit.damaged) effects.push('damaged')
  if (hit.immobilised) effects.push('immobilised')
  if (hit.systemsDown) effects.push('systems down')
  return `${drew} — ${effects.length ? effects.join(', ') : 'no effect'}.`
}

export function describeInfantryHit(hit: InfantryHit): string {
  return `Drew ${list(hit.chits)}: ${pointsText(hit.points)} valid against ${hit.killTotal} to kill — ${hit.killed ? 'element removed' : 'no effect'}.`
}

/** The shot as a log would print it, one line per roll and per draw. */
export function narrateShot(result: ShotResult): string[] {
  if (result.kind === 'infantry') {
    const { plan } = result
    return [`${weaponLabel(plan.weapon)} on infantry at ${plan.band} range: no roll, ${plan.chitsPerDraw} chits per draw, ${validityLabel(plan.validity)}.`, ...result.results.map(describeInfantryHit)]
  }
  const { plan, targetRolls } = result
  const targetDice = plan.targetSecondary ? `${dieLabel(plan.targetPrimary)} and ${dieLabel(plan.targetSecondary)}` : dieLabel(plan.targetPrimary)
  const targetText = targetRolls.secondary === null ? `${targetRolls.primary}` : `${targetRolls.primary} and ${targetRolls.secondary}, best ${targetRolls.best}`
  const lines = [
    `${weaponLabel(plan.weapon)} at ${plan.band} range: ${plan.dice > 1 ? `${plan.dice} × ` : ''}${dieLabel(plan.firerDie)} against ${targetDice}.`,
    `Firer rolled ${result.firerRolls.join(', ')}; target rolled ${targetText} — ${result.hits === 0 ? 'miss' : result.hits === 1 ? 'hit' : `${result.hits} hits`}.`,
  ]
  return [...lines, ...result.results.map(describeVehicleHit)]
}
