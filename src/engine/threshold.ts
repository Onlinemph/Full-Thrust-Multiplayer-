/**
 * Full Thrust: Project Continuum — threshold points (4.11), the optional
 * Core Systems block (10.3) and damage control (10.4).
 *
 * A threshold point is the moment a ship's accumulated damage reaches the end
 * of a row of hull boxes; at that moment every system still alive rolls a D6
 * to see whether it survives. `game.ts` owns the hull track and therefore
 * knows *when* a row has been crossed (`markHullBoxes`, `pendingThresholdCheck`);
 * this module owns what happens next — the dice, the main drive's special
 * ladder, the Core Systems' knock-on effects, and the repair rolls that undo
 * some of it in phase 14.
 *
 * The arithmetic of the check itself lives in `dice.ts` (`thresholdTarget`,
 * `thresholdCheck`, `damageControlRoll`), so this module never re-derives a
 * target number.
 *
 * Sections 10.3 and 10.4 are missing from the rulebook text extract; the Core
 * Systems and damage control rules below come from the Full Thrust XD quick
 * reference, cross-checked against 2.4, 5.13 and 7.9. The full written-out
 * rules, and every place a reading had to be chosen, are in
 * `docs/rules/threshold.md`.
 */

import { d6, damageControlRoll, thresholdCheck, thresholdTarget, type Rng } from './dice'
import {
  activeShips,
  destroySystem,
  isSystemDestroyed,
  pendingThresholdCheck,
  pushLog,
  resolvePendingThreshold,
  type GameState,
  type OngoingEffect,
  type ShipState,
} from './game'
import type { SystemKind } from './types'

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * The id the main drive is crossed off under (4.11). `game.ts`'s
 * `destroySystem` already reserves the string `'drive'` for the drive's
 * one-halves-two-disables ladder, so it is fixed here rather than invented.
 */
export const DRIVE_SYSTEM_ID = 'drive'

/**
 * The FTL drive's id when a design carries FTL without listing an explicit
 * `ftl-drive` system box (2.4: "the bottom row of the SSD are the symbols for
 * the FTL and main drive").
 */
export const FTL_SYSTEM_ID = 'ftl'

/** The three Core Systems as they are crossed off the SSD (10.3). */
export const CORE_SYSTEM_IDS = {
  bridge: 'core:bridge',
  lifeSupport: 'core:life-support',
  powerCore: 'core:power-core',
} as const

/** Which Core System a check or event is about (10.3). */
export type CoreSystem = 'bridge' | 'life-support' | 'power-core'

/**
 * `OngoingEffect.source` values this module writes, so other modules can find
 * its effects without string-matching prose. `game.ts` retires an effect at
 * the start of the turn after `expiresAfterTurn`, which is how the bridge's
 * countdown runs down without anyone ticking it.
 */
export const THRESHOLD_EFFECT_SOURCES = {
  /** Out of control after a bridge hit (10.3). */
  outOfControl: 'bridge',
  /** Life support failing; the ship is still crewed until it expires (10.3). */
  lifeSupportCountdown: 'life-support',
  /** Life support has failed — the crew is gone (10.3). */
  lifeSupportFailed: 'life-support-failed',
  /**
   * 11.10: *"Ships exiting a jump point function as if they have taken a
   * bridge critical hit until the next turn."* A second way to lose control,
   * with nothing to do with the bridge — which is why the out-of-control
   * questions below ask about a set of sources rather than one.
   */
  jumpPoint: 'jump-point',
} as const

/** Everything that takes a ship out of control (10.3, 11.10). */
const OUT_OF_CONTROL_SOURCES: readonly string[] = [
  THRESHOLD_EFFECT_SOURCES.outOfControl,
  THRESHOLD_EFFECT_SOURCES.jumpPoint,
]

/**
 * Systems whose SSD symbol carries more than one damage box, each of which
 * rolls its own threshold die.
 *
 * Only the Cloaking Field does today, and 7.21 spells it out: "A Cloaking
 * Field has two 'damage points' or boxes … When making threshold checks roll
 * for BOTH damage boxes". Everything absent from this table has one box.
 */
export const SYSTEM_DAMAGE_BOXES: Partial<Record<SystemKind, number>> = {
  'cloaking-field': 2,
}

/**
 * Standing DRM on a system's own threshold check, by kind (7.9).
 *
 * 7.9 is the only statement of the Core Systems modifier anywhere in the text:
 * an Antimatter Suicide Charge is "well armored and protected against
 * accidental detonation, and thus get a -1 DRM whenever they take threshold
 * tests (like Core Systems)". Failure is on a high roll (4.11), so −1 protects.
 */
export const CORE_SYSTEM_DRM = -1

const SYSTEM_DRM: Partial<Record<SystemKind, number>> = {
  'antimatter-charge': CORE_SYSTEM_DRM,
}

/**
 * Flawed Design's threshold modifier (13.13), as a modifier on the die.
 *
 * 13.13 is not in the text extract; `types.ts` records the trait as "−1 DRM on
 * threshold checks". Read as −1 on the *die* that would make a flawed ship's
 * systems harder to knock out — a flaw that improves the ship, next to a −20%
 * points rebate. Read as −1 on the *target number* (5+ at the first threshold
 * point instead of 6) it costs the ship exactly what it is being rebated for,
 * and −1 on the target is arithmetically +1 on the die.
 */
export const FLAWED_DESIGN_DRM = 1

// ---------------------------------------------------------------------------
// The systems a check rolls for (4.11, 2.4)
// ---------------------------------------------------------------------------

/** What kind of SSD symbol a checked system is. */
export type CheckableKind = 'drive' | 'weapon' | 'turret' | 'system' | 'ftl' | 'core'

/** One symbol on the SSD that owes a threshold die (4.11). */
export interface CheckableSystem {
  /** System id, weapon id, `DRIVE_SYSTEM_ID`, `FTL_SYSTEM_ID` or a core id. */
  id: string
  label: string
  kind: CheckableKind
  /** Damage boxes on the symbol; each rolls its own die (7.21). */
  boxes: number
  /** Boxes already crossed off. */
  boxesLost: number
  /** This system's own standing DRM — Core Systems are −1 (7.9). */
  drm: number
  /** Which Core System this is, for the ones that have knock-on effects. */
  core?: CoreSystem
}

/** How a multi-box symbol records a part-damaged box in `destroyedSystems`. */
function boxMarkerId(id: string, box: number): string {
  return `${id}#${box}`
}

/**
 * Boxes of a symbol already crossed off (7.21). Single-box systems are held as
 * the bare id, so that `isSystemDestroyed` in `game.ts` — which every other
 * module uses — keeps working untouched.
 */
export function systemBoxesLost(ship: ShipState, id: string, boxes: number): number {
  if (boxes <= 1) return isSystemDestroyed(ship, id) ? 1 : 0
  let lost = 0
  for (let box = 1; box <= boxes; box++) {
    if (ship.destroyedSystems.has(boxMarkerId(id, box))) lost += 1
  }
  return lost
}

/**
 * Cross one box of a symbol off (4.11, 7.21). The bare id is added only when
 * the last box goes, so a half-wrecked Cloaking Field still reads as present.
 */
function markBoxLost(ship: ShipState, id: string, boxes: number): void {
  if (boxes <= 1) {
    destroySystem(ship, id)
    return
  }
  const lost = systemBoxesLost(ship, id, boxes)
  if (lost >= boxes) return
  ship.destroyedSystems.add(boxMarkerId(id, lost + 1))
  if (lost + 1 >= boxes) ship.destroyedSystems.add(id)
}

/** Give back one box of a symbol — a damage control repair (10.4). */
function markBoxRepaired(ship: ShipState, id: string, boxes: number): void {
  if (boxes <= 1) {
    ship.destroyedSystems.delete(id)
    return
  }
  const lost = systemBoxesLost(ship, id, boxes)
  if (lost <= 0) return
  ship.destroyedSystems.delete(boxMarkerId(id, lost))
  // The bare id means "every box gone", so it comes off with the last one.
  ship.destroyedSystems.delete(id)
}

/**
 * Every symbol on the SSD that still owes a threshold die (4.11): "the player
 * must roll one D6 for each system on the ship not already destroyed".
 *
 * Order is SSD order — the order mounts and systems appear in the design — so
 * that a battle replays identically from its seed, and so that the book's own
 * advice holds: "If there are three Beam-3 symbols arranged left to right,
 * then roll three dice: the one that lands most to the left is for the
 * corresponding leftmost symbol". An arc-limited mount is therefore knocked
 * out by its own die and never by a sibling's.
 *
 * Armour is not here: 4.8 says "There is no threshold check roll … made at the
 * end of the row of armor". Nor is a one-shot mount whose ammunition is spent,
 * because 6.6 has already crossed it off — "Once fired, it is crossed off and
 * cannot be used again."
 */
export function checkableSystems(ship: ShipState): CheckableSystem[] {
  const design = ship.design
  const out: CheckableSystem[] = []

  // The drive is checked until it has taken its two hits; it is never crossed
  // off, so `destroyedSystems` says nothing about it (4.11).
  if (ship.driveHits < 2) {
    out.push({
      id: DRIVE_SYSTEM_ID,
      label: 'Main drive',
      kind: 'drive',
      boxes: 1,
      boxesLost: 0,
      drm: 0,
    })
  }

  for (const weapon of design.weapons) {
    if (isSystemDestroyed(ship, weapon.id)) continue
    // A magazine-fed or one-shot mount that is out of ammunition has already
    // been struck through (6.6), so it is not rolled for again.
    if (weapon.ammo !== undefined && weapon.ammo <= 0) continue
    out.push({
      id: weapon.id,
      label: weapon.label,
      kind: 'weapon',
      boxes: 1,
      boxesLost: 0,
      drm: 0,
    })
  }

  // 5.22: "A turret is a system that appears on the SSD with the weapons
  // within. If the turret is damaged due to a threshold test … it remains
  // stuck in its current facing until repaired." The turret and the weapons
  // inside it are separate symbols, so both roll.
  for (const turret of design.turrets) {
    if (isSystemDestroyed(ship, turret.id)) continue
    out.push({
      id: turret.id,
      label: `Turret ${turret.id}`,
      kind: 'turret',
      boxes: 1,
      boxesLost: 0,
      drm: 0,
    })
  }

  for (const system of design.systems) {
    const boxes = SYSTEM_DAMAGE_BOXES[system.kind] ?? 1
    const boxesLost = systemBoxesLost(ship, system.id, boxes)
    if (boxesLost >= boxes) continue
    out.push({
      id: system.id,
      label: system.label,
      kind: 'system',
      boxes,
      boxesLost,
      drm: SYSTEM_DRM[system.kind] ?? 0,
    })
  }

  // 2.4 puts an FTL symbol on the SSD of any ship that has one. A design that
  // lists its FTL as a system box is rolled for above; one that only sets
  // `ftl` gets the symbol here so it is not quietly immune.
  const hasFtlBox = design.systems.some((system) => system.kind === 'ftl-drive')
  if (design.ftl !== 'none' && !hasFtlBox && !isSystemDestroyed(ship, FTL_SYSTEM_ID)) {
    out.push({
      id: FTL_SYSTEM_ID,
      label: 'FTL drive',
      kind: 'ftl',
      boxes: 1,
      boxesLost: 0,
      drm: 0,
    })
  }

  const core = design.coreSystems
  if (core) {
    const entries: Array<{ fitted: boolean; id: string; label: string; core: CoreSystem }> = [
      { fitted: core.bridge, id: CORE_SYSTEM_IDS.bridge, label: 'Bridge', core: 'bridge' },
      {
        fitted: core.lifeSupport,
        id: CORE_SYSTEM_IDS.lifeSupport,
        label: 'Life support',
        core: 'life-support',
      },
      {
        fitted: core.powerCore,
        id: CORE_SYSTEM_IDS.powerCore,
        label: 'Power core',
        core: 'power-core',
      },
    ]
    for (const entry of entries) {
      if (!entry.fitted || isSystemDestroyed(ship, entry.id)) continue
      out.push({
        id: entry.id,
        label: entry.label,
        kind: 'core',
        boxes: 1,
        boxesLost: 0,
        // 7.9: Core Systems take threshold tests at −1 (failure is on a high
        // roll, so the minus protects them).
        drm: CORE_SYSTEM_DRM,
        core: entry.core,
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Core Systems (10.3)
// ---------------------------------------------------------------------------

/** Something a Core System did, for the log and the UI (10.3). */
export interface CoreSystemEvent {
  shipId: string
  system: CoreSystem
  /** The d6 the effect was rolled on, where there is one. */
  roll?: number
  /** Turns the effect lasts, where it is measured in turns. */
  turns?: number
  permanent?: boolean
  text: string
}

function addEffect(ship: ShipState, effect: OngoingEffect): void {
  ship.ongoing.push(effect)
}

function removeEffects(ship: ShipState, source: string): void {
  ship.ongoing = ship.ongoing.filter((effect) => effect.source !== source)
}

function findEffect(ship: ShipState, source: string): OngoingEffect | undefined {
  return ship.ongoing.find((effect) => effect.source === source)
}

/**
 * Whether an effect is still live on `turn`. `game.ts` retires effects at the
 * start of the turn after `expiresAfterTurn`; asking the question directly as
 * well means a caller that inspects state mid-turn, or a test that never
 * advances the clock, reads the same answer.
 */
function effectLiveOn(effect: OngoingEffect, turn: number | undefined): boolean {
  if (effect.expiresAfterTurn === null) return true
  if (turn === undefined) return true
  return effect.expiresAfterTurn >= turn
}

/**
 * Knock a Core System out and roll its consequence (10.3, XD quick reference).
 *
 * - Bridge: one d6. On 1–5 the ship is out of control for that many turns; on
 *   a 6 it is out of control permanently.
 * - Life support: one d6. Life support fails after that many turns.
 * - Power core: the core is breached. From now on it is rolled for at the end
 *   of every turn (phase 15) until it is repaired or the ship goes up.
 *
 * The countdowns start with the *next* turn: this is rolled in phase 13, and
 * the current turn's orders were written back in phase 1.
 */
export function knockOutCoreSystem(
  ship: ShipState,
  system: CoreSystem,
  turn: number,
  rng: Rng,
): CoreSystemEvent {
  switch (system) {
    case 'bridge': {
      ship.core.bridgeDestroyed = true
      destroySystem(ship, CORE_SYSTEM_IDS.bridge)
      const roll = d6(rng)
      const permanent = roll === 6
      // A fresh bridge hit replaces whatever the last one left behind: a ship
      // cannot be out of control twice over, and the longer sentence wins.
      const existing = findEffect(ship, THRESHOLD_EFFECT_SOURCES.outOfControl)
      const existingEnd = existing
        ? existing.expiresAfterTurn === null
          ? Number.POSITIVE_INFINITY
          : existing.expiresAfterTurn
        : Number.NEGATIVE_INFINITY
      const end = permanent ? Number.POSITIVE_INFINITY : turn + roll
      if (end >= existingEnd) {
        removeEffects(ship, THRESHOLD_EFFECT_SOURCES.outOfControl)
        addEffect(ship, {
          id: `${ship.id}:out-of-control:${turn}`,
          source: THRESHOLD_EFFECT_SOURCES.outOfControl,
          appliedTurn: turn,
          expiresAfterTurn: permanent ? null : turn + roll,
          // Nobody is left to give the ship orders, so it holds course and
          // velocity: taking away the whole printed rating is how that reads
          // to `currentThrust` without every other module learning the rule.
          thrustPenalty: ship.design.drive.thrust,
          note: permanent
            ? 'bridge destroyed — permanently out of control'
            : `bridge destroyed — out of control for ${roll} turns`,
        })
      }
      return {
        shipId: ship.id,
        system,
        roll,
        turns: permanent ? undefined : roll,
        permanent,
        text: permanent
          ? 'bridge destroyed: permanently out of control'
          : `bridge destroyed: out of control for ${roll} turns`,
      }
    }

    case 'life-support': {
      ship.core.lifeSupportDestroyed = true
      destroySystem(ship, CORE_SYSTEM_IDS.lifeSupport)
      const roll = d6(rng)
      removeEffects(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown)
      addEffect(ship, {
        id: `${ship.id}:life-support:${turn}`,
        source: THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown,
        appliedTurn: turn,
        // "Fails after that many turns": a 1 rolled in turn 4 means the crew
        // is lost in turn 5, so the countdown has to be gone by then.
        expiresAfterTurn: turn + roll - 1,
        note: `life support failing — crew lost in turn ${turn + roll}`,
      })
      return {
        shipId: ship.id,
        system,
        roll,
        turns: roll,
        text: `life support destroyed: fails in ${roll} turns`,
      }
    }

    case 'power-core': {
      ship.core.powerCoreDestroyed = true
      ship.core.reactorExplosionPending = true
      destroySystem(ship, CORE_SYSTEM_IDS.powerCore)
      return {
        shipId: ship.id,
        system,
        text: 'power core breached: roll for reactor explosion at the end of every turn',
      }
    }
  }
}

/** Whether the ship has nobody at the helm (10.3). */
/** Every live reason this ship is not steering (10.3, 11.10). */
function outOfControlEffects(ship: ShipState, turn?: number): OngoingEffect[] {
  return ship.ongoing.filter(
    (effect) => OUT_OF_CONTROL_SOURCES.includes(effect.source) && effectLiveOn(effect, turn),
  )
}

export function isOutOfControl(ship: ShipState, turn?: number): boolean {
  return outOfControlEffects(ship, turn).length > 0
}

/** Whether the loss of control is the permanent kind — a 6 on the bridge roll. */
export function isPermanentlyOutOfControl(ship: ShipState): boolean {
  return outOfControlEffects(ship).some((effect) => effect.expiresAfterTurn === null)
}

/**
 * Turns of lost control still to run, or `null` if permanent or in control.
 *
 * A ship with two reasons to be out of control — 11.10's disorientation on top
 * of 10.3's bridge hit — comes back when the longer of them runs out. Neither
 * cause shortens the other.
 */
export function outOfControlTurnsRemaining(ship: ShipState, turn: number): number | null {
  const live = outOfControlEffects(ship, turn)
  if (live.length === 0) return null
  if (live.some((effect) => effect.expiresAfterTurn === null)) return null
  const last = Math.max(...live.map((effect) => effect.expiresAfterTurn ?? turn))
  return last - turn + 1
}

/** The turn the crew is lost, or `null` when life support is intact (10.3). */
export function lifeSupportFailsOnTurn(ship: ShipState): number | null {
  const effect = findEffect(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown)
  if (!effect || effect.expiresAfterTurn === null) return null
  return effect.expiresAfterTurn + 1
}

/** Whether life support has already failed and the crew is gone (10.3). */
export function isDerelict(ship: ShipState): boolean {
  return findEffect(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportFailed) !== undefined
}

/**
 * Run the Core Systems clocks forward to `turn` (10.3).
 *
 * The only clock that does anything when it runs out is life support: the
 * ship becomes a derelict — no thrust, no weapons, and no damage control,
 * because there is nobody left to send. The bridge's countdown needs no help,
 * since a lapsed out-of-control effect simply stops applying; it is pruned
 * here so the ship's effect list does not grow for the rest of the battle.
 *
 * Called at the top of phase 13 for every surviving ship, damaged or not.
 */
export function advanceCoreSystems(ship: ShipState, turn: number): CoreSystemEvent[] {
  const events: CoreSystemEvent[] = []
  if (ship.destroyed) return events

  const control = findEffect(ship, THRESHOLD_EFFECT_SOURCES.outOfControl)
  if (control && !effectLiveOn(control, turn)) {
    removeEffects(ship, THRESHOLD_EFFECT_SOURCES.outOfControl)
    events.push({
      shipId: ship.id,
      system: 'bridge',
      text: 'control regained',
    })
  }

  if (ship.core.lifeSupportDestroyed && !isDerelict(ship)) {
    const countdown = findEffect(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown)
    // Two ways the countdown can be over: it is still on the ship and has run
    // past its last turn, or `game.ts` already retired it at a turn boundary.
    const expired = countdown === undefined || !effectLiveOn(countdown, turn)
    if (expired) {
      removeEffects(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown)
      addEffect(ship, {
        id: `${ship.id}:life-support-failed:${turn}`,
        source: THRESHOLD_EFFECT_SOURCES.lifeSupportFailed,
        appliedTurn: turn,
        expiresAfterTurn: null,
        thrustPenalty: ship.design.drive.thrust,
        weaponsOffline: ship.design.weapons.map((weapon) => weapon.id),
        note: 'life support failed — the ship is a derelict',
      })
      events.push({
        shipId: ship.id,
        system: 'life-support',
        text: 'life support failed: the crew is lost and the ship is a derelict',
      })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// The threshold sweep (4.11)
// ---------------------------------------------------------------------------

/** One system's threshold die (4.11). */
export interface SystemCheckResult {
  id: string
  label: string
  kind: CheckableKind
  /** Which box of a multi-box symbol this die was for, 1-based (7.21). */
  box: number
  /** The natural d6. */
  roll: number
  /** The die after the extra-row and standing modifiers (4.11, 7.9, 13.13). */
  modified: number
  /** Total modifier applied to the die. */
  drm: number
  destroyed: boolean
}

/** Everything one ship's threshold point did (4.11). */
export interface ThresholdSweepResult {
  shipId: string
  /** Which threshold point this is — 1 is the end of the first hull row. */
  rowsLost: number
  /** Extra rows crossed in the same attack; each adds 1 to every die (4.11). */
  extraRows: number
  /** The number a die must reach to knock a system out (4.11). */
  target: number
  checks: SystemCheckResult[]
  /** Ids crossed off by this sweep, in the order they were rolled. */
  destroyedIds: string[]
  /** Drive hits before and after — 1 halves thrust, 2 disables it (4.11). */
  driveHits: { before: number; after: number }
  /** Core System consequences rolled during this sweep (10.3). */
  coreEvents: CoreSystemEvent[]
}

/** How a threshold point is rolled (4.11, 10.3, 13.13). */
export interface ThresholdSweepOptions {
  /** The game turn, for the Core Systems' countdowns (10.3). */
  turn: number
  /** The optional Drive Damage rule, the boxed text after 4.11. */
  driveDamage?: boolean
  /** Override the Flawed Design modifier (13.13). Defaults to +1 on the die. */
  flawedDrm?: number
}

/**
 * Roll one ship's threshold point (4.11).
 *
 * Returns `null` when the ship owes no check — it is destroyed, or no row has
 * been crossed since the last one. `game.ts`'s `pendingThresholdCheck` decides
 * that, and gives the row number and the extra-row bonus: "make only one check
 * (for the last row destroyed) but add 1 to each die roll for each extra
 * threshold point passed in that attack".
 *
 * This is the *only* threshold entry point, and it is deliberately not tied to
 * a phase: 2.6 has missile and fighter damage check immediately in phase 10,
 * ship fire and boarding wait for phase 13, and a reactor explosion in phase 15
 * makes its neighbours "roll additional threshold checks" on the spot.
 */
export function rollThresholdChecks(
  ship: ShipState,
  rng: Rng,
  opts: ThresholdSweepOptions,
): ThresholdSweepResult | null {
  const owed = pendingThresholdCheck(ship)
  if (!owed) return null

  const { rowsLost, extraRows } = owed
  const target = thresholdTarget(rowsLost)
  const flawedDrm = ship.design.flawed ? (opts.flawedDrm ?? FLAWED_DESIGN_DRM) : 0
  const driveHitsBefore = ship.driveHits

  const checks: SystemCheckResult[] = []
  const destroyedIds: string[] = []
  const coreEvents: CoreSystemEvent[] = []

  for (const system of checkableSystems(ship)) {
    const drm = flawedDrm + system.drm
    // The optional Drive Damage rule: "make two threshold rolls for the drive
    // during phase 13 IF the ship lost two or more rows of hull boxes". Read
    // as two or more rows in *this* check — that is the case the old sequence
    // rolled twice for, and the case this rule exists to restore.
    const rolls =
      system.kind === 'drive' && opts.driveDamage === true && extraRows >= 1
        ? 2
        : system.boxes - system.boxesLost

    for (let roll = 0; roll < rolls; roll++) {
      const result = thresholdCheck(rowsLost, extraRows, rng, drm)
      const box = system.kind === 'drive' ? ship.driveHits + 1 : system.boxesLost + roll + 1
      checks.push({
        id: system.id,
        label: system.label,
        kind: system.kind,
        box,
        roll: result.roll,
        modified: result.modified,
        drm: extraRows + drm,
        destroyed: result.destroyed,
      })
      if (!result.destroyed) continue

      if (system.kind === 'drive') {
        // Never crossed off: `destroySystem` runs the drive's own ladder —
        // one hit halves the printed rating, two disable it, and a rating-1
        // drive is disabled by the first (4.11).
        destroySystem(ship, DRIVE_SYSTEM_ID)
        destroyedIds.push(DRIVE_SYSTEM_ID)
        continue
      }

      markBoxLost(ship, system.id, system.boxes)
      destroyedIds.push(system.id)
      if (system.core) coreEvents.push(knockOutCoreSystem(ship, system.core, opts.turn, rng))
    }
  }

  resolvePendingThreshold(ship)

  return {
    shipId: ship.id,
    rowsLost,
    extraRows,
    target,
    checks,
    destroyedIds,
    driveHits: { before: driveHitsBefore, after: ship.driveHits },
    coreEvents,
  }
}

/**
 * Roll one ship's threshold point against a live game and write it to the
 * battle log (4.11).
 *
 * This is what phases 10 and 15 call, where 2.6 asks for the check on the
 * spot: "Damage resulting from these attacks is applied immediately, including
 * threshold point checks if applicable", and, of a reactor explosion's
 * neighbours, "roll additional threshold checks for them". Phase 13 runs the
 * same function over the whole fleet.
 */
export function thresholdCheckForShip(
  state: GameState,
  ship: ShipState,
  opts: Omit<ThresholdSweepOptions, 'turn'> = {},
): ThresholdSweepResult | null {
  const result = rollThresholdChecks(ship, state.rng, { ...opts, turn: state.turn })
  if (!result) return null

  const lost = result.checks.filter((check) => check.destroyed)
  pushLog(state, {
    kind: 'threshold',
    shipId: ship.id,
    side: ship.side,
    dice: result.checks.map((check) => check.roll),
    text:
      `${ship.name}: threshold point ${result.rowsLost}` +
      (result.extraRows > 0 ? ` (+${result.extraRows} for extra rows)` : '') +
      `, systems lost on ${result.target}+ — ` +
      (lost.length === 0 ? 'nothing lost' : lost.map((check) => check.label).join(', ')),
  })
  for (const event of result.coreEvents) {
    pushLog(state, {
      kind: 'threshold',
      shipId: ship.id,
      side: ship.side,
      dice: event.roll === undefined ? undefined : [event.roll],
      text: `${ship.name}: ${event.text}`,
    })
  }

  return result
}

/**
 * Phase 13 (2.6): "All ships roll threshold checks from damage incurred in
 * phase 11 and 12 if required."
 *
 * Every surviving ship has its Core Systems clocks advanced first — a life
 * support countdown that has run out kills the crew now, whether or not the
 * ship took a scratch this turn — and then rolls for any rows it owes.
 */
export function thresholdPhase(
  state: GameState,
  opts: Omit<ThresholdSweepOptions, 'turn'> = {},
): ThresholdSweepResult[] {
  const results: ThresholdSweepResult[] = []

  for (const ship of activeShips(state)) {
    for (const event of advanceCoreSystems(ship, state.turn)) {
      pushLog(state, {
        kind: 'threshold',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name}: ${event.text}`,
      })
    }

    const result = thresholdCheckForShip(state, ship, opts)
    if (result) results.push(result)
  }

  return results
}

// ---------------------------------------------------------------------------
// Damage control (10.4, phase 14)
// ---------------------------------------------------------------------------

/** Why a repair could not even be attempted (10.4). */
export type RepairRefusal =
  | 'ship-destroyed'
  | 'no-crew'
  | 'not-damaged'
  | 'permanently-out-of-control'
  | 'unrepairable'
  | 'no-parties'

/** One damage control party's attempt on one system (10.4). */
export interface RepairAttempt {
  shipId: string
  systemId: string
  parties: number
  /** The d6, when one was rolled. */
  roll?: number
  repaired: boolean
  refused?: RepairRefusal
  text: string
}

/** How a damage control attempt is resolved (10.4). */
export interface RepairOptions {
  /** The game turn, for the log and for the Core Systems' clocks (10.3). */
  turn: number
  /**
   * Ids damage control may never fix. The rulebook scatters these through the
   * weapon rules rather than listing them — needle beam damage (5.13), a Pulse
   * Torpedo tube that blew itself up (5.14), an Antimatter Missile that
   * detonated on the rack (6.6) — so the modules that own those rules pass the
   * ids in rather than this module guessing at a list.
   */
  unrepairable?: ReadonlySet<string>
}

/** Boxes the symbol with this id carries (7.21). */
function boxesForId(ship: ShipState, systemId: string): number {
  const system = ship.design.systems.find((entry) => entry.id === systemId)
  if (!system) return 1
  return SYSTEM_DAMAGE_BOXES[system.kind] ?? 1
}

/** Whether there is anything to repair on this id (10.4). */
function isRepairTargetDamaged(ship: ShipState, systemId: string): boolean {
  if (systemId === DRIVE_SYSTEM_ID) return ship.driveHits > 0
  return systemBoxesLost(ship, systemId, boxesForId(ship, systemId)) > 0
}

/**
 * Put one repair back together after a successful roll (10.4). One success
 * takes back one box: one drive hit, one box of a Cloaking Field, or the whole
 * symbol of an ordinary system.
 */
function applyRepair(ship: ShipState, systemId: string): void {
  if (systemId === DRIVE_SYSTEM_ID) {
    // 3.6, of emergency thrust damage: "Damage to the main drive from ET may be
    // repaired normally by Damage Control Parties" — and threshold damage to
    // the drive is the same ladder, so a success climbs back one rung.
    ship.driveHits = Math.max(0, ship.driveHits - 1)
    return
  }

  markBoxRepaired(ship, systemId, boxesForId(ship, systemId))

  switch (systemId) {
    case CORE_SYSTEM_IDS.bridge:
      ship.core.bridgeDestroyed = false
      // A permanent loss of control is refused before the roll, so anything
      // that gets here is the temporary kind and lifts with the repair.
      removeEffects(ship, THRESHOLD_EFFECT_SOURCES.outOfControl)
      break
    case CORE_SYSTEM_IDS.lifeSupport:
      ship.core.lifeSupportDestroyed = false
      removeEffects(ship, THRESHOLD_EFFECT_SOURCES.lifeSupportCountdown)
      break
    case CORE_SYSTEM_IDS.powerCore:
      ship.core.powerCoreDestroyed = false
      // 7.9's parallel rule: the charge is rolled for only "if … not repaired
      // by the end of the turn", so a core mended in phase 14 is never rolled.
      ship.core.reactorExplosionPending = false
      break
    default:
      break
  }
}

/**
 * One damage control attempt (10.4): up to three parties may work on a single
 * system, and it is repaired on a d6 at or below the number of parties
 * assigned. `damageControlRoll` in `dice.ts` is the roll and caps the parties.
 */
export function repairSystem(
  ship: ShipState,
  systemId: string,
  parties: number,
  rng: Rng,
  opts: RepairOptions,
): RepairAttempt {
  const refuse = (refused: RepairRefusal, text: string): RepairAttempt => ({
    shipId: ship.id,
    systemId,
    parties,
    repaired: false,
    refused,
    text,
  })

  if (ship.destroyed) return refuse('ship-destroyed', 'the ship is gone')
  if (parties <= 0) return refuse('no-parties', 'no damage control parties assigned')
  // Life support has failed: there is no crew left to carry out repairs.
  if (isDerelict(ship)) return refuse('no-crew', 'no crew left to make repairs')
  if (opts.unrepairable?.has(systemId)) {
    return refuse('unrepairable', 'this damage cannot be repaired by damage control parties')
  }
  if (systemId === CORE_SYSTEM_IDS.bridge && isPermanentlyOutOfControl(ship)) {
    // The one thing the quick reference says damage control cannot fix.
    return refuse('permanently-out-of-control', 'the ship is permanently out of control')
  }
  if (!isRepairTargetDamaged(ship, systemId)) return refuse('not-damaged', 'nothing to repair')

  const { roll, repaired } = damageControlRoll(parties, rng)
  if (repaired) applyRepair(ship, systemId)

  return {
    shipId: ship.id,
    systemId,
    parties,
    roll,
    repaired,
    text: repaired
      ? `repaired ${systemId} with ${parties} damage control ${parties === 1 ? 'party' : 'parties'} (rolled ${roll})`
      : `failed to repair ${systemId} with ${parties} damage control ${parties === 1 ? 'party' : 'parties'} (rolled ${roll})`,
  }
}

/**
 * Phase 14 (2.6): "Damage control Phase. Make any Damage Control repair rolls."
 *
 * Resolves the assignments `assignDamageControl` collected during the phase and
 * then clears them, so the sweep is idempotent and the parties are free again
 * next turn.
 */
export function damageControlPhase(
  state: GameState,
  opts: Omit<RepairOptions, 'turn'> = {},
): RepairAttempt[] {
  const attempts: RepairAttempt[] = []

  for (const ship of activeShips(state)) {
    if (ship.damageControl.length === 0) continue
    for (const assignment of ship.damageControl) {
      const attempt = repairSystem(ship, assignment.systemId, assignment.parties, state.rng, {
        ...opts,
        // 5.13: what a needle beam took out stays out. The set has always been
        // supported here and was always empty.
        unrepairable: opts.unrepairable ?? ship.unrepairable,
        turn: state.turn,
      })
      attempts.push(attempt)
      pushLog(state, {
        kind: 'damage-control',
        shipId: ship.id,
        side: ship.side,
        dice: attempt.roll === undefined ? undefined : [attempt.roll],
        text: `${ship.name}: ${attempt.text}`,
      })
    }
    ship.damageControl = []
  }

  return attempts
}

// ---------------------------------------------------------------------------
// Reactor explosions (10.3, phase 15)
// ---------------------------------------------------------------------------

/** One ship's end-of-turn power core roll (10.3). */
/** Damage a reactor breach throws at one neighbour (10.3, optional). */
export interface ReactorBlastHit {
  /** Ship, fighter group, gunboat squadron or ordnance marker id. */
  targetId: string
  kind: 'ship' | 'flight' | 'gunboats' | 'ordnance'
  dice: number[]
  damage: number
}

export interface ReactorExplosionResult {
  shipId: string
  roll: number
  exploded: boolean
  /**
   * Everything inside 3 MU when the core let go, and what the blast rolled at
   * it. Reported rather than applied: how damage meets armour and screens is
   * `combat.ts`'s business, exactly as it is for a weapon (4.8, 4.9).
   */
  blast: ReactorBlastHit[]
}

/** *"1D6 damage for every 25 mass of the exploding ship"* (10.3). */
export const REACTOR_BLAST_RADIUS = 3
export const REACTOR_BLAST_MASS_PER_DIE = 25

export function reactorBlastDice(mass: number): number {
  return Math.max(1, Math.ceil(mass / REACTOR_BLAST_MASS_PER_DIE))
}

/**
 * Phase 15 (2.6): "Roll for Reactor explosions Phase."
 *
 * A breached power core is rolled for at the end of every turn and explodes on
 * a 5 or 6, destroying the ship; anything less and it is rolled again next
 * turn, until it is repaired or it goes up. 7.9's Antimatter Suicide Charge
 * states the same loop in the rulebook's own words — "Roll every turn until the
 * damage is repaired or an explosion occurs" — which is why a core repaired in
 * phase 14 is never rolled for here.
 *
 * The blast is 10.3's optional Reactor Breach rule: *"Every ship,
 * fighter/gunboat squadron and ordnance, in a 3 MU radius, will suffer 1D6
 * damage for every 25 mass of the exploding ship."* It is reported on the
 * result rather than applied here, because how it meets armour and screens is
 * the damage pipeline's business; the caller applies it and then rolls
 * `rollThresholdChecks` for anything it hurt, as phase 15 requires.
 */
export function reactorExplosionPhase(state: GameState): ReactorExplosionResult[] {
  const results: ReactorExplosionResult[] = []

  for (const ship of activeShips(state)) {
    if (!ship.core.reactorExplosionPending) continue
    const roll = d6(state.rng)
    const exploded = roll >= 5
    const blast: ReactorBlastHit[] = []
    results.push({ shipId: ship.id, roll, exploded, blast })

    if (exploded) {
      ship.destroyed = true
      ship.hullMarked = ship.design.hullBoxes
      ship.pendingThresholdRows = 0
      ship.core.reactorExplosionPending = false
      blast.push(...rollReactorBlast(state, ship, state.rng))
    }

    pushLog(state, {
      kind: exploded ? 'destroyed' : 'threshold',
      shipId: ship.id,
      side: ship.side,
      dice: [roll],
      text: exploded
        ? `${ship.name}: the power core explodes and the ship is destroyed (rolled ${roll})`
        : `${ship.name}: the breached power core holds for another turn (rolled ${roll})`,
    })
  }

  return results
}

/**
 * What a breaching core throws at its neighbours (10.3, optional).
 *
 * *"Every ship, fighter/gunboat squadron and ordnance, in a 3 MU radius, will
 * suffer 1D6 damage for every 25 mass of the exploding ship. This damage is
 * considered Semi-Armor Piercing and ignores Standard Screens."* Everything
 * within the radius is caught, friend included — the book's own example says
 * "every ship (friendly or enemy) within 3 MU".
 *
 * Small craft and ordnance markers are reported with their dice too. What a
 * point of blast does to a fighter group is not stated anywhere in section 10,
 * so the count is handed to the caller rather than turned into casualties
 * here: **[reading]** reporting a number nobody has to interpret is safer than
 * inventing a conversion the book never gives.
 */
function rollReactorBlast(state: GameState, source: ShipState, rng: Rng): ReactorBlastHit[] {
  const dice = reactorBlastDice(source.design.mass)
  const at = source.placement.position
  const hits: ReactorBlastHit[] = []

  const roll = (): { faces: number[]; total: number } => {
    const faces: number[] = []
    let total = 0
    for (let i = 0; i < dice; i++) {
      const face = d6(rng)
      faces.push(face)
      total += face
    }
    return { faces, total }
  }

  const near = (p: { x: number; y: number }): boolean =>
    Math.hypot(p.x - at.x, p.y - at.y) <= REACTOR_BLAST_RADIUS + 1e-9

  for (const other of state.ships) {
    if (other.id === source.id || other.destroyed || other.offTable) continue
    if (!near(other.placement.position)) continue
    const { faces, total } = roll()
    hits.push({ targetId: other.id, kind: 'ship', dice: faces, damage: total })
  }
  for (const group of state.fighterGroups) {
    if (group.status !== 'in-flight' || !near(group.position)) continue
    const { faces, total } = roll()
    hits.push({ targetId: group.id, kind: 'flight', dice: faces, damage: total })
  }
  for (const squadron of state.gunboatSquadrons) {
    if (squadron.status !== 'in-flight' || !near(squadron.position)) continue
    const { faces, total } = roll()
    hits.push({ targetId: squadron.id, kind: 'gunboats', dice: faces, damage: total })
  }
  for (const marker of state.ordnance) {
    if (!near(marker.position)) continue
    const { faces, total } = roll()
    hits.push({ targetId: marker.id, kind: 'ordnance', dice: faces, damage: total })
  }

  return hits
}
