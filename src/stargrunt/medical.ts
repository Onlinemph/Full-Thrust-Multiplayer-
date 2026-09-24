/**
 * Stargrunt II — treating the wounded during a Reorganise action (p.36,
 * p.39): every current casualty in the unit may be checked in the one
 * action, with a medic or a specialised medical unit improving the odds.
 */

import { type DiceStream, rollDie } from './dice'

export type TreatmentOutcome = 'dead' | 'stabilised' | 'ok'

export interface TreatmentResult {
  roll: number
  bonus: number
  total: number
  outcome: TreatmentOutcome
}

/**
 * One wounded figure's treatment roll (p.36, p.39): D6, 1-2 dead (too far
 * gone), 3-5 stabilised (out of the fight but safe), 6 back in action.
 * +1 to the die if a medic is in the unit, +2 if a specialised medical
 * unit is attending (the two bonuses don't stack beyond the better one --
 * a unit either has a medic or a medical unit attending, per the book's
 * own phrasing).
 */
export function treatWoundedFigure(hasMedic: boolean, hasMedicalUnit: boolean, rng: DiceStream): TreatmentResult {
  const bonus = hasMedicalUnit ? 2 : hasMedic ? 1 : 0
  const roll = rollDie(6, rng)
  const total = roll + bonus
  const outcome: TreatmentOutcome = total <= 2 ? 'dead' : total <= 5 ? 'stabilised' : 'ok'
  return { roll, bonus, total, outcome }
}

/**
 * Every current casualty in the unit treated in one Reorganise action
 * (p.39: "ALL current casualties in the unit may be treated during one
 * reorganise action" -- not one roll per Reorganise, one per wounded
 * figure). Draws one die per figure id, in the order given.
 */
export function treatWounded(woundedFigureIds: readonly string[], hasMedic: boolean, hasMedicalUnit: boolean, rng: DiceStream): Record<string, TreatmentResult> {
  const results: Record<string, TreatmentResult> = {}
  for (const id of woundedFigureIds) results[id] = treatWoundedFigure(hasMedic, hasMedicalUnit, rng)
  return results
}
