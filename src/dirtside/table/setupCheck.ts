/**
 * Dirtside II — what a setup must satisfy before it goes on the table
 * (p. 17): objective markers placed by the quotas, apart from each other,
 * and forces that can be played. Faults, not refusals: a scenario is a
 * thing to edit, so each fault names the page.
 */

import { inRearArea } from './game'
import { distance } from './terrain'
import type { GameSetup, SideId } from './types'

export interface SetupFault {
  page: string
  detail: string
}

export function validateSetup(setup: GameSetup): SetupFault[] {
  const faults: SetupFault[] = []
  const { table } = setup
  if (table.width < 12 || table.depth < 12) faults.push({ page: 'p. 17', detail: 'The table is too small to divide into thirds.' })
  for (const side of setup.sides) {
    if (side.units.length === 0) faults.push({ page: 'p. 18', detail: `${side.name} has no unit.` })
    for (const unit of side.units) {
      if (unit.elements.length === 0) faults.push({ page: 'p. 18', detail: `${unit.name} has no element.` })
      for (const el of unit.elements) if (!el.vehicle && !el.infantry) faults.push({ page: 'p. 8', detail: `${el.name ?? el.id} is neither a vehicle nor an infantry team.` })
    }
  }
  const ids = new Set<string>()
  for (const side of setup.sides) for (const unit of side.units) for (const el of unit.elements) {
    if (ids.has(el.id)) faults.push({ page: 'p. 18', detail: `Element id ${el.id} is used twice.` })
    ids.add(el.id)
  }
  // Objectives (p. 17).
  const objectives = table.objectives
  for (let i = 0; i < objectives.length; i++)
    for (let j = i + 1; j < objectives.length; j++)
      if (distance(objectives[i]!.position, objectives[j]!.position) < 6 - 1e-9 && objectives[i]!.drawnBy === objectives[j]!.drawnBy) faults.push({ page: 'p. 17', detail: `Objectives ${objectives[i]!.id} and ${objectives[j]!.id} are within 6" of each other.` })
  const inMain = (o: GameSetup['table']['objectives'][number]) => !inRearArea(setup, 'north', o.position) && !inRearArea(setup, 'south', o.position)
  if (setup.battle === 'encounter') {
    for (const side of ['north', 'south'] as SideId[]) {
      const mine = objectives.filter((o) => o.drawnBy === side)
      if (mine.length === 0) continue
      const rear = mine.filter((o) => inRearArea(setup, side, o.position)).length
      const main = mine.filter(inMain).length
      const needRear = Math.floor(mine.length / 2)
      if (rear < needRear) faults.push({ page: 'p. 17', detail: `${setup.sides.find((s) => s.id === side)?.name ?? side} must place at least ${needRear} of its ${mine.length} markers in its own rear area; ${rear} are there.` })
      if (rear + main < mine.length) faults.push({ page: 'p. 17', detail: `${setup.sides.find((s) => s.id === side)?.name ?? side} has a marker in the opponent's rear area; the rest go in the main battle area.` })
    }
  } else {
    const defender = setup.attacker === 'south' ? 'north' : 'south'
    if (objectives.length > 0) {
      const rear = objectives.filter((o) => inRearArea(setup, defender, o.position)).length
      const main = objectives.filter(inMain).length
      if (rear < 1) faults.push({ page: 'p. 17', detail: "At least one objective must be in the defender's rear area." })
      if (main < Math.floor(objectives.length / 2)) faults.push({ page: 'p. 17', detail: `At least ${Math.floor(objectives.length / 2)} of the ${objectives.length} objectives must be in the main battle area; ${main} are.` })
    }
  }
  return faults
}
