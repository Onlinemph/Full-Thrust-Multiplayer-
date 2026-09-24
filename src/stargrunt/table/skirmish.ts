/**
 * Stargrunt II — a default skirmish for a first game: two forces of one
 * platoon each (a Platoon Command Unit plus three Infantry Squads) from
 * the chapter 25 templates, on a 48"x36" table with a seeded spread of
 * terrain and objectives placed as Dirtside places them (p. 14, p. 17 —
 * Stargrunt's own setting-up chapter gives no generic scoring primitive of
 * its own, spec 01 §4.2, so this reuses Dirtside's).
 *
 * No points system (p. 10): there is nothing here to balance a roster
 * against, so both sides simply get the same quality/leadership and the
 * same standard platoon shape.
 */

import { placeObjectives, randomTerrain } from '../../dirtside/table/skirmish'
import { NAC, NSL, sideFromForce } from '../data/forces'
import { newStream } from '../dice'
import type { GameSetup } from '../types'

export interface SkirmishOptions {
  seed: number
  name?: string
  width?: number
  depth?: number
  terrain?: 'none' | 'light' | 'dense'
  objectivesPerSide?: number
  turnLimit?: number | null
}

/**
 * Two platoons — New Anglian Confederation and Neu Swabian League, each a
 * Platoon Command Unit and three Infantry Squads (p. 67, p. 68) — meeting
 * as an Encounter (p. 14) on a 48"x36" table. The same seed always gives
 * the same terrain, objectives and roster.
 */
export function defaultSkirmish(opts: SkirmishOptions): GameSetup {
  const width = opts.width ?? 48
  const depth = opts.depth ?? 36
  // XORed with a mark of this game's own so the same seed does not lay out
  // identical terrain to a Dirtside battle by coincidence.
  const stream = newStream(opts.seed ^ 0x53_47_49_49)
  const platoonOptions = { quality: 'regular' as const, hqLeadership: 1 as const, squadLeadership: 2 as const }
  const north = sideFromForce(NAC, 'north', { ...platoonOptions, motivation: 'medium' })
  const south = sideFromForce(NSL, 'south', { ...platoonOptions, motivation: 'medium' })
  return {
    name: opts.name ?? `Skirmish ${opts.seed}`,
    seed: opts.seed,
    battle: 'encounter',
    table: {
      width,
      depth,
      terrain: randomTerrain(stream, width, depth, opts.terrain ?? 'light'),
      objectives: placeObjectives(stream, width, depth, opts.objectivesPerSide ?? 3),
    },
    sides: [north, south],
    turnLimit: opts.turnLimit === undefined ? 8 : opts.turnLimit,
  }
}
