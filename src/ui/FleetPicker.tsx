import { useMemo, useState } from 'react'

import type { ShipDesign, ShipGroup } from '../engine/types'
import { scenarioById, type Scenario } from '../data/scenarios'
import { allDesigns } from '../data/ships'
import {
  checkFleetTechBase,
  designProblems,
  techBaseLabel,
  type TechBaseChoice,
} from '../data/techBaseCheck'

/**
 * Choosing a force (18.2, 18.3).
 *
 * Full Thrust fleets are bought to a points total, so the budget is the only
 * number on screen that matters and it is kept in front of the player the whole
 * time. The rest is a ship list you add from.
 *
 * 18.2's tournament guidance also caps the shape of a fleet — a force should
 * not be all capitals — so the composition bar shows how the points are split
 * between escorts, cruisers and capitals as you build.
 */
export interface FleetPickerProps {
  scenarioId: string
  /** Current picks per side, by design id. Empty means the scenario's own. */
  forces: Partial<Record<string, string[]>>
  /** The tech base each side plays under (15). Absent means unrestricted. */
  techBases?: Partial<Record<string, TechBaseChoice>>
  onChange: (forces: Partial<Record<string, string[]>>) => void
}

const GROUP_ORDER: ShipGroup[] = ['escort', 'cruiser', 'capital']
const GROUP_LABEL: Record<string, string> = {
  escort: 'Escorts',
  cruiser: 'Cruisers',
  capital: 'Capitals',
}

export function FleetPicker({ scenarioId, forces, techBases, onChange }: FleetPickerProps) {
  const scenario = scenarioById(scenarioId)
  const [side, setSide] = useState(scenario?.sides[0]?.id ?? 'a')
  const designs = useMemo(() => allDesigns(), [])

  if (!scenario) return null

  // The budget is what the scenario's own force for this side costs — pick a
  // fleet worth what the designer intended and the battle stays fair.
  const budget = budgetFor(scenario, side, designs)
  const picked = forces[side] ?? defaultPicks(scenario, side)
  const spent = picked.reduce((sum, id) => sum + (byId(designs, id)?.points ?? 0), 0)

  const setPicks = (next: string[]) => onChange({ ...forces, [side]: next })

  // 15: what this side's tech base could not have built. Advisory, because the
  // roster predates the tech base and both example factions refuse armour.
  const techBase = techBases?.[side]
  const techReport = checkFleetTechBase(
    techBase,
    picked.map((id) => byId(designs, id)).filter((d): d is ShipDesign => Boolean(d)),
  )

  return (
    <section className="fleet-picker">
      <h3>Choose forces</h3>

      <div className="panel-row">
        {scenario.sides.map((s) => (
          <button
            key={s.id}
            className={s.id === side ? 'primary' : undefined}
            onClick={() => setSide(s.id)}
          >
            {s.name}
          </button>
        ))}
        <span className="spacer" />
        <span className={`num budget${spent > budget ? ' is-over' : ''}`}>
          {spent} / {budget} CPV
        </span>
      </div>

      <CompositionBar picked={picked} designs={designs} spent={spent} />

      {techReport.designs.length > 0 || techReport.baseErrors.length > 0 ? (
        <div className="tech-report">
          <b>{techBaseLabel(techBase)}</b> could not have built{' '}
          {techReport.designs.length === 1 ? 'one of these ships' : `${techReport.designs.length} of these ships`}
          :
          <ul>
            {techReport.baseErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
            {techReport.designs.map((entry) => (
              <li key={entry.designId}>
                <b>{entry.name}</b> — {entry.problems.length}{' '}
                {entry.problems.length === 1 ? 'component' : 'components'}, starting with{' '}
                {shortProblem(entry.problems[0])}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="picked-list">
        {picked.length === 0 ? <p>No ships. This side would have nothing to fight with.</p> : null}
        {picked.map((id, index) => {
          const design = byId(designs, id)
          return (
            <span key={`${id}-${index}`} className="picked">
              {design?.name ?? id} <span className="num">{design?.points ?? 0}</span>
              <button
                aria-label={`Remove ${design?.name ?? id}`}
                onClick={() => setPicks(picked.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>

      <div className="panel-row">
        <button onClick={() => setPicks(defaultPicks(scenario, side))}>
          Reset to the scenario&rsquo;s force
        </button>
        <span className="spacer" />
        <button onClick={() => setPicks([])}>Clear</button>
      </div>

      {GROUP_ORDER.map((group) => {
        const available = designs.filter((d) => d.group === group)
        if (available.length === 0) return null
        return (
          <div key={group}>
            <h4>{GROUP_LABEL[group]}</h4>
            <div className="design-list">
              {available.map((design) => {
                const problems = designProblems(techBase, design)
                return (
                  <button
                    key={design.id}
                    className={`design-chip${problems.length > 0 ? ' is-off-base' : ''}`}
                    title={
                      problems.length > 0
                        ? problems.join('\n')
                        : `${design.faction} · mass ${design.mass} · thrust ${design.drive.thrust}`
                    }
                    onClick={() => setPicks([...picked, design.id])}
                  >
                    {design.name}
                    <span className="num">{design.points}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/**
 * How the points are split between hull groups (18.2).
 *
 * Shown as a bar rather than three numbers because the thing a player is
 * checking is a proportion — "am I all battleships?" — and a proportion is
 * read off a bar faster than off arithmetic.
 */
function CompositionBar({
  picked,
  designs,
  spent,
}: {
  picked: readonly string[]
  designs: readonly ShipDesign[]
  spent: number
}) {
  if (spent === 0) return null
  const byGroup = new Map<string, number>()
  for (const id of picked) {
    const design = byId(designs, id)
    if (!design) continue
    byGroup.set(design.group, (byGroup.get(design.group) ?? 0) + design.points)
  }
  return (
    <div className="composition" aria-label="Fleet composition by hull group">
      {GROUP_ORDER.map((group) => {
        const points = byGroup.get(group) ?? 0
        if (points === 0) return null
        return (
          <span
            key={group}
            className={`composition-slice is-${group}`}
            style={{ flexGrow: points }}
            title={`${GROUP_LABEL[group]}: ${points} CPV, ${Math.round((points / spent) * 100)}%`}
          >
            {GROUP_LABEL[group]}
          </span>
        )
      })}
    </div>
  )
}

/** `validateDesignAgainstTechBase` prefixes each line with the ship's name. */
function shortProblem(problem: string): string {
  const colon = problem.indexOf(': ')
  return colon < 0 ? problem : problem.slice(colon + 2)
}

function byId(designs: readonly ShipDesign[], id: string): ShipDesign | undefined {
  return designs.find((d) => d.id === id)
}

function defaultPicks(scenario: Scenario, side: string): string[] {
  return scenario.sides.find((s) => s.id === side)?.force.map((entry) => entry.designId) ?? []
}

function budgetFor(scenario: Scenario, side: string, designs: readonly ShipDesign[]): number {
  return defaultPicks(scenario, side).reduce((sum, id) => sum + (byId(designs, id)?.points ?? 0), 0)
}
