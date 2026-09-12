/**
 * Full Thrust: Project Continuum — boarding actions, fleet morale, striking
 * the colors and civil wars (12.7 – 12.10).
 *
 * Phase 12 is the one phase where a ship can be taken rather than killed, and
 * 12.7's procedure is short enough to look obvious and sequenced tightly
 * enough to be got wrong. Three facts carry the whole section:
 *
 * - The crew's counter-attack is *not* simultaneous. *"Defending DCPs now
 *   attempt to kill enemy Boarding Parties or Marines … Remove any enemy
 *   Boarding Party or Marine casualties"* happens before step 2, so a boarder
 *   the damage control parties kill never rolls a die and never touches the
 *   hull. Only the Marine-against-Marine exchange in step 2 is simultaneous.
 * - Boarders cannot fight the crew. *"Attacking Boarding Parties or Marines
 *   cannot target and kill the ship's DCPs; they can only kill the crew by
 *   destroying hull boxes."* The defence is one-directional, and grinding the
 *   hull is the only answer to it.
 * - What a boarder does in step 3 was decided in step 1. A unit that engaged
 *   the defending Marines does no hull damage even if it survives and even if
 *   every defending Marine is already dead — the book's own worked example
 *   turns on exactly that.
 *
 * Boarders are *landed* elsewhere: Transporter Beams (5.9), Boarding Torpedoes
 * (5.18) and assault shuttles (8.15) fill the `boarders` list this module
 * reads. 12.7 also excludes one of them by name — Marines transported in to
 * kill a single system icon use 5.9's Commando Raid table instead, which lives
 * in `weapons/beams.ts` and never reaches here.
 *
 * Damage is *reported*, never applied: step 3 returns a hull damage total and
 * whether it takes the last box, and marking the SSD, running the threshold
 * checks it causes (13) and flagging the prize are the caller's.
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, sections
 * 12.7 – 12.10; the prose is in `docs/rules/boarding.md`.
 */

import { d6, rollD6, type Rng } from './dice'
import { distance } from './geometry'
import type { Phase, Point } from './types'

/** *"Resolve Boarding Combat during phase 12"* (12.7). */
export const BOARDING_PHASE: Phase = 'boarding'

// ---------------------------------------------------------------------------
// The numbers (12.7)
// ---------------------------------------------------------------------------

/**
 * *"three DCPs will kill it on a 4+"* (12.7), and the list stops there — as
 * does 10.4's repair action and the Quick Reference Sheet's *"max of three"*.
 */
export const MAX_DCPS_PER_TARGET = 3

/**
 * *"One Marine will kill another Boarding Party or Marine unit on a 4+"*, and
 * the same 4+ going the other way: *"They hit and kill defending Marines on a
 * die roll of 4+"* (12.7).
 */
export const MARINE_KILL_TARGET = 4

/** *"do one point of damage per DCP or Marine to the ship's hull boxes"* (12.7). */
export const HULL_DAMAGE_PER_BOARDER = 1

/** *"A single point of damage is sufficient to destroy the captured ship"* (12.7). */
export const CAPTURED_SHIP_DAMAGE_TO_DESTROY = 1

/**
 * The die a pool of defending DCPs must beat to kill one boarder (12.7):
 * *"One DCP will kill an enemy Boarding Party or Marine on a die roll of '6',
 * two DCPs will kill it on a 5 or 6, and three DCPs will kill it on a 4+."*
 *
 * One die per *target*, not per party — the parties pool onto a target the way
 * they pool onto a system in 10.4, and *"Each enemy Boarding Party or Marine
 * must be targeted separately"* is what stops one roll covering two invaders.
 *
 * A fourth party buys nothing. **[reading]** `validateBoardingPlan` reports it
 * as a plan error rather than letting it be silently swallowed, because a
 * party spent here is a party that cannot repair anything in phase 14.
 * Returns 7 for no parties: an unassigned boarder is never rolled for.
 */
export function dcpRepelTarget(parties: number): number {
  const assigned = Math.min(Math.max(0, Math.floor(parties)), MAX_DCPS_PER_TARGET)
  return assigned <= 0 ? 7 : 7 - assigned
}

// ---------------------------------------------------------------------------
// Who is on the deck (12.7)
// ---------------------------------------------------------------------------

/**
 * Which kind of counter a boarder is (12.7, 13.13).
 *
 * It changes no number in this module — **[reading]**, see `docs/rules/
 * boarding.md`: step 2 puts *"Attacking Boarding Parties and Marines"* into
 * one exchange and offers one score for it, 4+. It is carried because 12.7
 * distinguishes the two everywhere else, and because the alternative reading
 * would need it.
 */
export type BoardingUnitKind = 'marine' | 'boarding-party'

/**
 * A group of enemy boarders aboard a ship, as `game.ts` records them.
 *
 * Structurally the same as `ShipState.boarders`' element type, with `kind`
 * added as optional so the two stay assignable in both directions: this module
 * may not edit `game.ts`, and the engine's `BoardingParty` does not say
 * whether a party is Marines or DCPs pressed into the role.
 */
export interface BoardingForce {
  side: string
  /** Counters in the group. *"the term DCPs and Boarding Parties are used
   *  interchangeably"* (12.7), so this is a count of either. */
  parties: number
  /** The turn they landed — 12.7 exempts them from threshold checks that turn. */
  landedTurn: number
  kind?: BoardingUnitKind
}

/**
 * One attacking counter, flattened out of the `boarders` groups.
 *
 * 12.7 allocates and kills one counter at a time — *"Each enemy Boarding Party
 * or Marine must be targeted separately"* — so the group is not the unit of
 * play and cannot be the unit of allocation. Ids are derived from the group's
 * index in the ship's list and are stable for the length of one phase 12.
 */
export interface BoardingUnit {
  id: string
  side: string
  kind: BoardingUnitKind
  /** Index into the ship's `boarders` list this counter came from. */
  groupIndex: number
  landedTurn: number
}

/**
 * The counters an attacker has on this deck (12.7).
 *
 * Parties belonging to the ship's own side are not boarders and are skipped:
 * 12.7 is written about *"invading"* parties throughout. **[reading]** Where
 * two mutually hostile sides have parties aboard, all of them are attackers in
 * the same resolution and none of them fight each other — the section supplies
 * no procedure for a three-cornered action.
 */
export function boardingUnits(
  boarders: readonly BoardingForce[],
  opts: { ownerSide?: string } = {},
): BoardingUnit[] {
  const units: BoardingUnit[] = []
  boarders.forEach((force, groupIndex) => {
    if (opts.ownerSide !== undefined && force.side === opts.ownerSide) return
    const count = Math.max(0, Math.floor(force.parties))
    for (let n = 1; n <= count; n++) {
      units.push({
        id: `boarder:${groupIndex}:${n}`,
        side: force.side,
        kind: force.kind ?? 'marine',
        groupIndex,
        landedTurn: force.landedTurn,
      })
    }
  })
  return units
}

/**
 * The boarded ship, as phase 12 needs to see it.
 *
 * `damageControlParties` is what is *available*: 12.7's counter-attack is
 * *"a damage control action"*, and the Quick Reference Sheet's phase 14 is
 * *"Damage Control assignments for DC parties not used to repel boarders"*, so
 * parties already committed to a repair are not on this number and the ones
 * spent here come back as `dcpsCommitted`.
 */
export interface BoardedShip {
  side: string
  /** Hull boxes not yet crossed off — capture is decided against this (12.7). */
  hullRemaining: number
  /** DCPs still able to act this turn (10.4). */
  damageControlParties: number
  /** Marines embarked and alive (13.13). */
  marines: number
}

// ---------------------------------------------------------------------------
// The plan (12.7 step 1)
// ---------------------------------------------------------------------------

/** Defending DCPs pooled onto one attacking counter (12.7 step 1). */
export interface DcpAssignment {
  targetId: string
  parties: number
}

/** Defending Marines put onto one attacking counter (12.7 step 1). */
export interface MarineAssignment {
  targetId: string
  marines: number
}

/**
 * Both allocations of step 1, made before any die is rolled (12.7):
 * *"First allocate attacking Boarding Parties and Marines to attack defending
 * Marines or attempt to damage the ship's hull boxes. Secondly allocate
 * defending DCP and Marines to a particular enemy Boarding Party or Marine."*
 *
 * A counter left out of `engageMarines` is going for the hull, which is the
 * other half of the attacker's only choice.
 */
export interface BoardingPlan {
  /** Attacking counters that engage the defending Marines instead of the hull. */
  engageMarines?: readonly string[]
  dcps?: readonly DcpAssignment[]
  marines?: readonly MarineAssignment[]
}

/**
 * Check a plan against 12.7 and 10.4. Empty when the allocation is legal.
 *
 * What it does *not* report is bad tactics: allocating a Marine to a counter
 * the DCPs are also shooting at is legal and, by the reading below, likely to
 * waste the Marine — but that is the player's to judge, and the book's own
 * example keeps the two allocations on disjoint targets for that reason.
 */
export function validateBoardingPlan(
  ship: BoardedShip,
  boarders: readonly BoardingForce[],
  plan: BoardingPlan,
): string[] {
  const problems: string[] = []
  const units = boardingUnits(boarders, { ownerSide: ship.side })
  const ids = new Set(units.map((unit) => unit.id))

  const seenEngaged = new Set<string>()
  for (const id of plan.engageMarines ?? []) {
    if (!ids.has(id)) problems.push(`no boarding party ${id} is aboard (12.7)`)
    else if (seenEngaged.has(id)) problems.push(`${id} is allocated twice (12.7)`)
    seenEngaged.add(id)
  }

  const seenDcp = new Set<string>()
  let dcpTotal = 0
  for (const assignment of plan.dcps ?? []) {
    const parties = Math.floor(assignment.parties)
    if (!ids.has(assignment.targetId)) {
      problems.push(`no boarding party ${assignment.targetId} is aboard (12.7)`)
    }
    if (seenDcp.has(assignment.targetId)) {
      problems.push(`${assignment.targetId} is assigned DCPs twice; pool them into one entry (12.7)`)
    }
    seenDcp.add(assignment.targetId)
    if (parties < 0) problems.push(`a negative DCP assignment on ${assignment.targetId}`)
    if (parties > MAX_DCPS_PER_TARGET) {
      problems.push(
        `at most ${MAX_DCPS_PER_TARGET} DCPs may be assigned to one boarding party (12.7)`,
      )
    }
    dcpTotal += Math.max(0, parties)
  }
  if (dcpTotal > ship.damageControlParties) {
    problems.push(
      `${dcpTotal} DCPs assigned but only ${ship.damageControlParties} are available (10.4, 12.7)`,
    )
  }

  const seenMarine = new Set<string>()
  let marineTotal = 0
  for (const assignment of plan.marines ?? []) {
    const marines = Math.floor(assignment.marines)
    if (!ids.has(assignment.targetId)) {
      problems.push(`no boarding party ${assignment.targetId} is aboard (12.7)`)
    }
    if (seenMarine.has(assignment.targetId)) {
      problems.push(
        `${assignment.targetId} is assigned Marines twice; pool them into one entry (12.7)`,
      )
    }
    seenMarine.add(assignment.targetId)
    if (marines < 0) problems.push(`a negative Marine assignment on ${assignment.targetId}`)
    marineTotal += Math.max(0, marines)
  }
  if (marineTotal > ship.marines) {
    problems.push(`${marineTotal} Marines assigned but only ${ship.marines} are embarked (12.7)`)
  }

  return problems
}

// ---------------------------------------------------------------------------
// Resolution (12.7, phase 12)
// ---------------------------------------------------------------------------

/** Step 1: one die for a pool of DCPs against one boarder (12.7). */
export interface DcpRepelRoll {
  targetId: string
  /** Parties that actually went in, after the cap of three and what was aboard. */
  parties: number
  /** The score this pool needed: 6, 5 or 4 (12.7). */
  needed: number
  roll: number
  killed: boolean
}

/** Step 2, the defenders' half: *"inflicting kills on a die roll of 4+"* (12.7). */
export interface MarineDefenceRoll {
  targetId: string
  /** One die per defending Marine allocated to this boarder. */
  rolls: number[]
  killed: boolean
  /**
   * The boarder was already dead when the Marines came to fire, so no die was
   * thrown. **[reading]** — allocation is made once, in step 1, and step 1
   * removes its casualties before step 2.
   */
  wasted: boolean
}

/** Step 2, the attackers' half: *"Attacking … engage defending Marines"* (12.7). */
export interface BoardingAssaultRoll {
  unitId: string
  roll: number
  /** A 4+ that found a defending Marine still standing to kill. */
  killedMarine: boolean
}

/** What caused a threshold check, which decides whether boarders die in it (12.7). */
export type ThresholdCause = 'boarding' | 'weapons'

export interface BoardingCombatResult {
  /** Step 1, in the order the boarders are listed. */
  repelRolls: DcpRepelRoll[]
  /** Step 2, defenders; rolled before the attackers but resolved with them. */
  marineDefenceRolls: MarineDefenceRoll[]
  /** Step 2, attackers. */
  assaultRolls: BoardingAssaultRoll[]
  /** Attacking counters killed, in the order they fell. */
  attackersKilled: string[]
  /** Marines the ship lost in step 2. */
  defendingMarinesLost: number
  /** DCPs that spent this turn's damage control action repelling boarders. */
  dcpsCommitted: number
  /** Step 3: one point per surviving boarder that went for the hull (12.7). */
  hullDamage: number
  /** The step-3 damage took the last hull box: *"it is considered captured"* (12.7). */
  captured: boolean
  /** Tag for the threshold checks `hullDamage` causes: no boarder may die in them. */
  thresholdCause: ThresholdCause
  /** The `boarders` list afterwards. Groups wiped out are dropped. */
  survivors: BoardingForce[]
  log: string[]
}

/**
 * Resolve one boarded ship's phase 12 (12.7).
 *
 * The three steps run in the book's order, and the order is the rule:
 *
 * 1. The DCP pools roll; *"Remove any enemy Boarding Party or Marine
 *    casualties"* before anything else happens.
 * 2. The defending Marines and the boarders who engaged them exchange fire —
 *    *"Combat and kills inflicted are simultaneous"*, so both sides' dice are
 *    counted against the strengths they had entering the step, and a counter
 *    killed here still got its shot off.
 * 3. Whatever is left of the boarders who went for the hull *"do one point of
 *    damage per DCP or Marine to the ship's hull boxes"*.
 *
 * Dice are drawn in list order — step 1 over the boarders in order, then the
 * defending Marines in order, then the attackers in order — so a replay does
 * not depend on how the caller happened to sort its allocation arrays.
 *
 * Nothing passed in is mutated: the surviving boarders come back as a new
 * list, and the hull damage is reported for the caller to apply.
 */
export function resolveBoardingCombat(
  ship: BoardedShip,
  boarders: readonly BoardingForce[],
  plan: BoardingPlan,
  rng: Rng,
): BoardingCombatResult {
  const units = boardingUnits(boarders, { ownerSide: ship.side })
  const ids = new Set(units.map((unit) => unit.id))
  const engaging = new Set((plan.engageMarines ?? []).filter((id) => ids.has(id)))

  // Allocation, capped by what the ship actually has. Walking the boarders in
  // list order rather than the plan's order keeps a partly-illegal plan from
  // depending on which entry the caller wrote first.
  const dcpByTarget = pooled(plan.dcps ?? [], (a) => a.parties, ids, MAX_DCPS_PER_TARGET)
  const marinesByTarget = pooled(plan.marines ?? [], (a) => a.marines, ids, Infinity)
  const dcpBudget = spendInOrder(units, dcpByTarget, Math.max(0, Math.floor(ship.damageControlParties)))
  const marineBudget = spendInOrder(units, marinesByTarget, Math.max(0, Math.floor(ship.marines)))

  const log: string[] = []
  const dead = new Set<string>()
  const attackersKilled: string[] = []

  // --- Step 1: the crew's damage control action, resolved first -----------
  const repelRolls: DcpRepelRoll[] = []
  let dcpsCommitted = 0
  for (const unit of units) {
    const parties = dcpBudget.get(unit.id) ?? 0
    if (parties <= 0) continue
    dcpsCommitted += parties
    const needed = dcpRepelTarget(parties)
    const roll = d6(rng)
    const killed = roll >= needed
    repelRolls.push({ targetId: unit.id, parties, needed, roll, killed })
    if (killed) {
      dead.add(unit.id)
      attackersKilled.push(unit.id)
    }
  }
  if (repelRolls.length > 0) {
    log.push(
      `step 1: ${dcpsCommitted} DCP(s) on ${repelRolls.length} boarder(s), ${repelRolls.filter((r) => r.killed).length} killed (12.7)`,
    )
  }

  // --- Step 2: the Marines, simultaneously --------------------------------
  const marineDefenceRolls: MarineDefenceRoll[] = []
  const killedInStep2: string[] = []
  for (const unit of units) {
    const marines = marineBudget.get(unit.id) ?? 0
    if (marines <= 0) continue
    if (dead.has(unit.id)) {
      // Its target died in step 1. No die is thrown: a roll that cannot have
      // an effect must not consume one, or replays drift.
      marineDefenceRolls.push({ targetId: unit.id, rolls: [], killed: false, wasted: true })
      continue
    }
    const rolls = rollD6(marines, rng)
    const killed = rolls.some((face) => face >= MARINE_KILL_TARGET)
    marineDefenceRolls.push({ targetId: unit.id, rolls, killed, wasted: false })
    if (killed) killedInStep2.push(unit.id)
  }

  const marinesPresent = Math.max(0, Math.floor(ship.marines))
  const assaultRolls: BoardingAssaultRoll[] = []
  let defendingMarinesLost = 0
  for (const unit of units) {
    if (!engaging.has(unit.id) || dead.has(unit.id)) continue
    const roll = d6(rng)
    // Simultaneous: a boarder shot dead by the Marines this step still fires,
    // and the Marines it kills are counted off the strength they started with.
    const killedMarine = roll >= MARINE_KILL_TARGET && defendingMarinesLost < marinesPresent
    if (killedMarine) defendingMarinesLost += 1
    assaultRolls.push({ unitId: unit.id, roll, killedMarine })
  }

  for (const id of killedInStep2) {
    if (dead.has(id)) continue
    dead.add(id)
    attackersKilled.push(id)
  }
  if (marineDefenceRolls.length > 0 || assaultRolls.length > 0) {
    log.push(
      `step 2: ${killedInStep2.length} boarder(s) and ${defendingMarinesLost} defending Marine(s) killed, simultaneously (12.7)`,
    )
  }

  // --- Step 3: what is left wrecks the ship -------------------------------
  let hullDamage = 0
  for (const unit of units) {
    if (dead.has(unit.id) || engaging.has(unit.id)) continue
    hullDamage += HULL_DAMAGE_PER_BOARDER
  }
  const hullRemaining = Math.max(0, Math.floor(ship.hullRemaining))
  const captured = hullDamage > 0 && hullDamage >= hullRemaining
  if (hullDamage > 0) {
    log.push(
      `step 3: ${hullDamage} hull box(es) destroyed by boarders${captured ? ' — the ship is captured (12.7)' : ' (12.7)'}`,
    )
  }

  return {
    repelRolls,
    marineDefenceRolls,
    assaultRolls,
    attackersKilled,
    defendingMarinesLost,
    dcpsCommitted,
    hullDamage,
    captured,
    thresholdCause: 'boarding',
    survivors: survivorsOf(boarders, ship.side, dead),
    log,
  }
}

/** Merge a plan's assignments into one figure per target, capped per target. */
function pooled<T extends { targetId: string }>(
  assignments: readonly T[],
  amount: (assignment: T) => number,
  ids: ReadonlySet<string>,
  cap: number,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const assignment of assignments) {
    if (!ids.has(assignment.targetId)) continue
    const wanted = Math.max(0, Math.floor(amount(assignment)))
    const already = out.get(assignment.targetId) ?? 0
    out.set(assignment.targetId, Math.min(cap, already + wanted))
  }
  return out
}

/** Hand out a defender's counters in boarder order until the ship runs out. */
function spendInOrder(
  units: readonly BoardingUnit[],
  wanted: ReadonlyMap<string, number>,
  budget: number,
): Map<string, number> {
  const out = new Map<string, number>()
  let left = budget
  for (const unit of units) {
    const ask = wanted.get(unit.id) ?? 0
    if (ask <= 0 || left <= 0) continue
    const given = Math.min(ask, left)
    out.set(unit.id, given)
    left -= given
  }
  return out
}

/** Rebuild the `boarders` list, dropping the counters that died. */
function survivorsOf(
  boarders: readonly BoardingForce[],
  ownerSide: string,
  dead: ReadonlySet<string>,
): BoardingForce[] {
  const out: BoardingForce[] = []
  boarders.forEach((force, groupIndex) => {
    const count = Math.max(0, Math.floor(force.parties))
    if (force.side === ownerSide) {
      if (count > 0) out.push({ ...force, parties: count })
      return
    }
    let alive = 0
    for (let n = 1; n <= count; n++) {
      if (!dead.has(`boarder:${groupIndex}:${n}`)) alive += 1
    }
    if (alive > 0) out.push({ ...force, parties: alive })
  })
  return out
}

// ---------------------------------------------------------------------------
// After the fight (12.7)
// ---------------------------------------------------------------------------

/**
 * May a threshold check kill this boarding party (12.7)?
 *
 * *"Marines and Boarding Parties cannot be killed in a threshold test caused
 * by boarding combat. Both Marines and Boarding Parties are vulnerable to
 * being killed in threshold tests caused by weapons fire against the ship. In
 * the case of attacking Boarding Parties and Marines, they cannot be lost to
 * threshold checks caused on the turn they boarded the ship."*
 *
 * So the hull boxes a boarding party destroys can never rebound on it, and a
 * party that landed this turn is untouchable however hard the ship is shot.
 * The ship's *own* Marines follow the same first rule without the second —
 * they did not land.
 */
export function boardersAtRiskInThreshold(
  force: Pick<BoardingForce, 'landedTurn'>,
  cause: ThresholdCause,
  turn: number,
): boolean {
  if (cause === 'boarding') return false
  return force.landedTurn < turn
}

/**
 * Is the fight for the ship still running (12.7)?
 *
 * *"If a ship jumps away into FTL with enemy boarders on board, the battle for
 * control of the ship continues. Resolve the boarding action until either all
 * the boarders are killed, or the ship has been captured."* Deliberately blind
 * to position and to whether the ship is still on the table: that is the whole
 * point of the rule.
 */
export function boardingContinues(
  ownerSide: string,
  boarders: readonly BoardingForce[],
  captured = false,
): boolean {
  if (captured) return false
  return boarders.some((force) => force.side !== ownerSide && Math.floor(force.parties) > 0)
}

/**
 * *"A single point of damage is sufficient to destroy the captured ship"*
 * (12.7) — which is how an empire denies the enemy its own prize.
 */
export function capturedShipDestroyed(damage: number): boolean {
  return damage >= CAPTURED_SHIP_DAMAGE_TO_DESTROY
}

// ---------------------------------------------------------------------------
// Fleet morale (12.8)
// ---------------------------------------------------------------------------

/**
 * *"the loss of 50% of a player's overall force (calculated in mass of ships
 * destroyed) would be enough to cause the commander to withdraw from battle"*
 * (12.8). A default, not a law: 12.8's next paragraph puts the level in the
 * scenario.
 */
export const FLEET_MORALE_WITHDRAWAL_FRACTION = 0.5

/** One hull in the force, weighed in mass — not points, and not hull boxes (12.8). */
export interface FleetMoraleShip {
  mass: number
  destroyed: boolean
  /** Taken by boarders (12.7); counted as lost by default. */
  captured?: boolean
  /** Left the table under 3.9; not counted as lost by default. */
  offTable?: boolean
}

export interface FleetMoraleOptions {
  /** Losses that break the fleet, as a fraction of its mass (12.8). */
  fraction?: number
  /** **[reading]** Captured hulls count as lost. */
  countCaptured?: boolean
  /** **[reading]** Ships that withdrew do not. */
  countOffTable?: boolean
}

export interface FleetMoraleReport {
  totalMass: number
  lostMass: number
  /** Lost mass over total mass, 0 for an empty force. */
  fraction: number
  threshold: number
  withdraw: boolean
}

/**
 * Whether a fleet has lost enough to break (12.8).
 *
 * Mass, not points: a screen of escorts weighs what it displaces, not what it
 * cost, and 12.8 says so in parentheses precisely because the two differ.
 *
 * There is no die here. 12.8 is advice to a commander — *"it would be quite
 * likely that the admirals on either side would consider the preservation of
 * their own ships and crew to be quite a high priority"* — so this reports a
 * threshold crossing and leaves the withdrawal itself to 3.9 and the player.
 *
 * **[reading]** Captured hulls count towards the loss: 12.7 calls a captured
 * ship one "destroyed" by boarders and says *"the ship cannot be used in that
 * combat"*, so it is gone from the order of battle either way. Ships that have
 * left the table do not count, because counting a successful withdrawal as a
 * morale loss makes withdrawal self-reinforcing. Both are options for a
 * scenario that wants it otherwise.
 */
export function fleetMorale(
  ships: readonly FleetMoraleShip[],
  opts: FleetMoraleOptions = {},
): FleetMoraleReport {
  const threshold = opts.fraction ?? FLEET_MORALE_WITHDRAWAL_FRACTION
  const countCaptured = opts.countCaptured ?? true
  const countOffTable = opts.countOffTable ?? false

  let totalMass = 0
  let lostMass = 0
  for (const ship of ships) {
    const mass = Math.max(0, ship.mass)
    totalMass += mass
    const lost =
      ship.destroyed ||
      (countCaptured && ship.captured === true) ||
      (countOffTable && ship.offTable === true)
    if (lost) lostMass += mass
  }

  const fraction = totalMass > 0 ? lostMass / totalMass : 0
  // "would be enough" (12.8): exactly half is enough.
  return { totalMass, lostMass, fraction, threshold, withdraw: totalMass > 0 && fraction >= threshold }
}

// ---------------------------------------------------------------------------
// Striking the colors (12.9)
// ---------------------------------------------------------------------------

/**
 * Which ladder the surrender roll uses (12.9): the plain system score, or
 * *"as if for a Core System threshold check, in which case ships will never
 * surrender on the first row of damage"*.
 */
export type StrikeColorsMode = 'system' | 'core-system'

/**
 * The Core Systems modifier (7.9), restated here because the import boundary
 * keeps this module out of `threshold.ts`.
 *
 * **[reading]** It reproduces 12.9's stated consequence by arithmetic rather
 * than by fiat: against a first-row target of 6, a die of at most 6 − 1 = 5
 * can never strike. A rule that merely skipped the first row would match there
 * and nowhere else.
 */
export const CORE_SYSTEM_STRIKE_DRM = -1

/**
 * The score a captain strikes on (12.9): *"the normal scores for losing
 * systems at threshold points, i.e. 6 the first time, 5 or 6 the second,
 * etc."* — 4.11's ladder, restated by 12.9 itself.
 *
 * `rowsLost` is 1 at the first threshold point. Returns 7 for a ship that has
 * crossed no rows, which no die can reach.
 */
export function strikeColorsTarget(rowsLost: number): number {
  return Math.max(2, 7 - Math.floor(rowsLost))
}

export interface StrikeColorsOptions {
  /** Hull rows lost, 1 at the first threshold point (4.11, 12.9). */
  rowsLost: number
  /** Extra rows crossed in the same attack: +1 on the die each (4.11). */
  extraRows?: number
  mode?: StrikeColorsMode
  /** Anything else on the die — a Flawed Design's −1, say (13.13). */
  drm?: number
  /** The nearest enemy vessel's side: who the ship would be surrendering to. */
  captorSide?: string
  /** Sides this crew will not surrender to (12.9's Kra'Vak clause). */
  noQuarterWith?: readonly string[]
}

export interface StrikeColorsResult {
  /** The natural die, or null when no die was thrown (see `reason`). */
  rolled: number | null
  modified: number
  target: number
  struck: boolean
  surrenderTo: string | null
  reason: string
}

/**
 * The surrender roll of 12.9, made *"at the same time as any threshold
 * check"*.
 *
 * *"If the ship fails this roll then its captain decides to 'strike the
 * colors' and surrender to the nearest enemy vessel."* **[reading]** Failing
 * is rolling at or above the threshold score, because 12.9 defines the roll as
 * *"using the normal scores for losing systems at threshold points, i.e. 6 the
 * first time"* and 4.11 loses a system on a 6. Read the other way, five ships
 * in six would surrender the moment they crossed their first hull row.
 *
 * A crew that expects no quarter does not roll at all — *"it is very unlikely
 * that any human ship would even attempt to surrender to a Kra'Vak"* — which
 * also keeps a roll that cannot matter from consuming a die.
 */
export function strikeColorsCheck(opts: StrikeColorsOptions, rng: Rng): StrikeColorsResult {
  const target = strikeColorsTarget(opts.rowsLost)
  const captorSide = opts.captorSide ?? null

  if (captorSide !== null && (opts.noQuarterWith ?? []).includes(captorSide)) {
    return {
      rolled: null,
      modified: 0,
      target,
      struck: false,
      surrenderTo: null,
      reason: `this crew does not expect to survive capture by ${captorSide} (12.9)`,
    }
  }

  const drm = (opts.mode === 'core-system' ? CORE_SYSTEM_STRIKE_DRM : 0) + (opts.drm ?? 0)
  const rolled = d6(rng)
  const modified = rolled + (opts.extraRows ?? 0) + drm
  const struck = modified >= target
  return {
    rolled,
    modified,
    target,
    struck,
    surrenderTo: struck ? captorSide : null,
    reason: struck ? `struck the colors on ${modified} against ${target}+ (12.9)` : '',
  }
}

/** A ship a surrender could be offered to (12.9). */
export interface SurrenderCandidate {
  id: string
  side: string
  position: Point
}

/**
 * *"surrender to the nearest enemy vessel"* (12.9).
 *
 * Ties go to the earlier candidate, so the answer depends only on the caller's
 * ship order and never on a die. Returns null when there is no enemy left to
 * surrender to — a ship alone on the table keeps fighting whatever its captain
 * has decided.
 */
export function nearestEnemyVessel(
  from: Point,
  side: string,
  candidates: readonly SurrenderCandidate[],
): { id: string; side: string; distance: number } | null {
  let best: { id: string; side: string; distance: number } | null = null
  for (const candidate of candidates) {
    if (candidate.side === side) continue
    const range = distance(from, candidate.position)
    if (best === null || range < best.distance) {
      best = { id: candidate.id, side: candidate.side, distance: range }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Civil wars (12.10)
// ---------------------------------------------------------------------------

/**
 * *"all ships and squadrons roll a +1 on their direct fire weapons. The crews
 * of these ships are well aware of the enemy ships vulnerable areas."* (12.10)
 */
export const CIVIL_WAR_DIRECT_FIRE_DRM = 1

/**
 * Which kind of roll is being made, because 12.10's +1 is for one of them.
 *
 * **[reading]** Point defence does not get it even when the mount is a beam:
 * 7.12's point defence is its own table, thrown against fighters and ordnance,
 * where knowing *"the enemy ships vulnerable areas"* buys nothing. Nor do
 * fighter attacks (8.7) or ordnance (6), neither of which is a direct fire
 * weapon.
 */
export type CivilWarFireKind = 'direct-fire' | 'ordnance' | 'point-defence' | 'fighter'

/**
 * Is this a civil war (12.10)? *"If both fleets are composed of ships built by
 * the same navy"*.
 *
 * Takes the builder navy of every ship on each side. **[reading]** The
 * condition is a property of the pairing of the two fleets, not of a shot: one
 * foreign hull anywhere in either order of battle and nobody gets the bonus.
 * The alternative — comparing shooter and target navy shot by shot — would
 * hand the +1 to a fleet that is not fighting a civil war at all.
 */
export function isCivilWar(fleetA: readonly string[], fleetB: readonly string[]): boolean {
  if (fleetA.length === 0 || fleetB.length === 0) return false
  return new Set([...fleetA, ...fleetB]).size === 1
}

/**
 * The die roll modifier 12.10 grants, for the caller to add to its own dice —
 * this module reports, `combat.ts` applies.
 */
export function civilWarDrm(civilWar: boolean, kind: CivilWarFireKind): number {
  return civilWar && kind === 'direct-fire' ? CIVIL_WAR_DIRECT_FIRE_DRM : 0
}
