/**
 * A fleet against a tech base (section 15).
 *
 * `engine/techbase.ts` holds all of section 15 — the nine catalogues, the
 * prerequisite graph, the choice budget and `mayField` — and deliberately holds
 * no fleet type: a fleet is a list of designs and folding the results is the
 * caller's job, which is this file. It lives in `src/data` beside
 * `designPricing.ts` for the same reason that does: it is about what a player
 * may buy, not about what happens in a phase.
 *
 * **The base is a choice, not a faction.** The rulebook prints two example
 * tech bases at 15.2 and says outright that *"the examples presented here are
 * not strictly the same as any of the published Fleet Books. They are merely
 * presented here as examples."* The roster in this repository is not built to
 * either of them — it buys armour, which neither example faction bought — so a
 * side plays unrestricted unless the table picks a base for it. Picking one is
 * the interesting thing: it tells you what the fleet you assembled could not
 * actually have been built.
 */

import {
  EXAMPLE_FACTIONS,
  validateDesignAgainstTechBase,
  validateTechBase,
  type ExampleFactionId,
  type TechBase,
} from '../engine/techbase'
import type { ShipDesign } from '../engine/types'

/** What a side is playing under. `unrestricted` is every battle before now. */
export type TechBaseChoice = 'unrestricted' | ExampleFactionId

export interface TechBaseOption {
  id: TechBaseChoice
  label: string
  /** One line: what the base is, for the setup panel. */
  detail: string
}

export const TECH_BASE_OPTIONS: readonly TechBaseOption[] = [
  {
    id: 'unrestricted',
    label: 'No tech base',
    detail: 'Anything in the catalogue. How Full Thrust plays when nobody is counting choices.',
  },
  {
    id: 'new-anglian-confederation',
    label: '15.2 New Anglian Confederation',
    detail:
      'Beams to class 6, grasers, screens and advanced screens, salvo missile launchers, pulse ' +
      'torpedoes, submunition packs, and two kinds of fighter. Twelve choices.',
  },
  {
    id: 'eurasian-solar-union',
    label: '15.2 Eurasian Solar Union',
    detail:
      'Beams to class 3, a beam spinal mount, PDS, screens, and six fighter entries off the ' +
      'Fighter Package Deal. Eleven choices.',
  },
]

/** The base a choice names, or null for an unrestricted side. */
export function techBaseFor(choice: TechBaseChoice | undefined): TechBase | null {
  if (!choice || choice === 'unrestricted') return null
  return EXAMPLE_FACTIONS[choice].base
}

export function techBaseLabel(choice: TechBaseChoice | undefined): string {
  return TECH_BASE_OPTIONS.find((o) => o.id === (choice ?? 'unrestricted'))?.label ?? 'No tech base'
}

/**
 * What this design could not have been built by this base (15.1).
 *
 * Empty for an unrestricted side, and empty for a design the base covers.
 * Every string is one component and the section's own reason for refusing it.
 */
export function designProblems(
  choice: TechBaseChoice | undefined,
  design: ShipDesign,
): readonly string[] {
  const base = techBaseFor(choice)
  if (!base) return []
  return validateDesignAgainstTechBase(base, design)
}

/** Whether the base can field the design at all. */
export function canField(choice: TechBaseChoice | undefined, design: ShipDesign): boolean {
  return designProblems(choice, design).length === 0
}

export interface FleetTechReport {
  choice: TechBaseChoice
  baseName: string
  /** Errors in the base itself — a broken prerequisite, fighters and gunboats. */
  baseErrors: readonly string[]
  /** One entry per design that the base cannot field, in fleet order. */
  designs: readonly { designId: string; name: string; problems: readonly string[] }[]
  /** Total component refusals across the fleet. */
  problemCount: number
  legal: boolean
}

/**
 * Fold a fleet against a base.
 *
 * The same design appearing twice is reported once: a player reads this to
 * decide what to change, and three copies of the same cruiser produce three
 * copies of the same sentence.
 */
export function checkFleetTechBase(
  choice: TechBaseChoice | undefined,
  designs: readonly ShipDesign[],
): FleetTechReport {
  const picked: TechBaseChoice = choice ?? 'unrestricted'
  const base = techBaseFor(picked)
  if (!base) {
    return {
      choice: picked,
      baseName: techBaseLabel(picked),
      baseErrors: [],
      designs: [],
      problemCount: 0,
      legal: true,
    }
  }

  const report = validateTechBase(base)
  const seen = new Set<string>()
  const failures: { designId: string; name: string; problems: readonly string[] }[] = []
  let count = 0
  for (const design of designs) {
    if (seen.has(design.id)) continue
    seen.add(design.id)
    const problems = validateDesignAgainstTechBase(base, design)
    if (problems.length === 0) continue
    failures.push({ designId: design.id, name: design.name, problems })
    count += problems.length
  }

  return {
    choice: picked,
    baseName: base.name,
    baseErrors: report.errors,
    designs: failures,
    problemCount: count,
    legal: report.errors.length === 0 && failures.length === 0,
  }
}
