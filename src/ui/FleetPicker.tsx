import { useMemo, useState } from 'react'

import type { ShipDesign } from '../engine/types'
import { scenarioById, type Scenario } from '../data/scenarios'
import { allDesigns } from '../data/ships'

/**
 * The designs this repository ships as a fleet book (18.2).
 *
 * A hull built in the Shipyard is not one of them, which is what a tournament
 * means by *"no modifications, changes in weapons, etc."*
 */
const ROSTER_DESIGN_IDS = new Set(allDesigns().map((design) => design.id))
import {
  checkFleetTechBase,
  designProblems,
  techBaseLabel,
  type TechBaseChoice,
} from '../data/techBaseCheck'
import type { TechBase } from '../engine/techbase'
import { designCost, summariseFleet } from '../data/fleetList'
import { describeFault, validateDesign } from '../data/designPricing'
import {
  checkTournamentList,
  identicalForces,
  IDEAL_FLEET_POINTS_MAX,
  IDEAL_FLEET_POINTS_MIN,
  SMALLEST_INTERESTING_FLEET_POINTS,
  type CompositionFormat,
  type FleetBreakdown,
  type FleetClass,
} from '../engine/battles'

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
  /** The base a side that picked `custom` built (15.1, 15.8), by side id. */
  customTechBases?: Partial<Record<string, TechBase>>
  /** 18.3: price the fleet in Combat Points Value rather than printed points. */
  cpv?: boolean
  /** The picked fleet's sheets and roster on paper, under the side's name. */
  onPrint?: (title: string, designs: ShipDesign[]) => void
  /**
   * Systems the table has barred for this battle. The campaign rules bar three
   * outright and a tournament may bar a different set; either way a hull that
   * carries one is not a hull that may be picked.
   */
  bannedSystems?: readonly string[]
  /** The campaign faction each side flies under, and its clan where it has one. */
  factions?: Partial<Record<string, string>>
  clans?: Partial<Record<string, string>>
  onChange: (forces: Partial<Record<string, string[]>>) => void
  /** Pick for this side alone — a console in a match lobby picks its own. */
  onlySide?: string
}

/**
 * 13.4's three classes, which are what 18.2's proportions are taken of. A
 * `ShipGroup` also has 'station' for a starbase; a starbase is not a fleet.
 */
const GROUP_ORDER: FleetClass[] = ['escort', 'cruiser', 'capital']
const GROUP_LABEL: Record<string, string> = {
  escort: 'Escorts',
  cruiser: 'Cruisers',
  capital: 'Capitals',
}

export function FleetPicker({
  scenarioId,
  forces,
  techBases,
  customTechBases,
  cpv = true,
  onPrint,
  bannedSystems,
  factions,
  clans,
  onChange,
  onlySide,
}: FleetPickerProps) {
  const scenario = scenarioById(scenarioId)
  const [chosenSide, setSide] = useState(scenario?.sides[0]?.id ?? 'a')
  const side = onlySide ?? chosenSide
  // 18.2 names five kinds of battle and restricts the list differently for
  // each; `open` is the one with no restriction, which is what a scenario is.
  const [format, setFormat] = useState<CompositionFormat>('open')
  const designs = useMemo(() => allDesigns(), [])

  if (!scenario) return null

  // The budget is what the scenario's own force for this side costs — pick a
  // fleet worth what the designer intended and the battle stays fair. Both
  // sides of the sum are in whichever currency the table is playing in, and
  // both include what the hulls carry (18.2: "including their fighters").
  const picked = forces[side] ?? defaultPicks(scenario, side)
  const budget = budgetFor(scenario, side, designs, cpv)
  const pickedDesigns = picked
    .map((id) => byId(designs, id))
    .filter((d): d is ShipDesign => Boolean(d))
  const summary = summariseFleet(pickedDesigns, { format, cpv })
  const spent = summary.total

  const setPicks = (next: string[]) => onChange({ ...forces, [side]: next })

  // 15: what this side's tech base could not have built. Advisory, because the
  // roster predates the tech base and both example factions refuse armour.
  const techBase = techBases?.[side]
  const customBase = customTechBases?.[side]
  // The campaign supplement's own refusals, which are a separate question from
  // section 15's: a hull can be legal under a tech base and barred by the
  // faction flying it.
  const factionId = factions?.[side]
  const clanId = clans?.[side]
  // The two refusals a picker can act on: what the faction will not build, and
  // what this table has barred. Everything else `validateDesign` reports is
  // about how the hull was drawn, which is the shipyard's business, not this
  // panel's.
  const pickFaults = (target: ShipDesign) =>
    validateDesign(target, { factionId, clanId, bannedSystems }).filter(
      (fault) =>
        fault.kind === 'banned' ||
        ((fault.kind === 'faction-prohibition' || fault.kind === 'faction-design') &&
          factionId !== undefined),
    )
  const [tournament, setTournament] = useState(false)
  // 18.2: "only designs given in the Full Thrust Fleet Books" — this roster is
  // its own book, so what a tournament here can actually check is the second
  // half of the sentence, "with no modifications, changes in weapons, etc.":
  // a hull built in the Shipyard rather than taken off the shelf.
  const tournamentReport = checkTournamentList(
    picked.map((id, index) => {
      const found = byId(designs, id)
      return {
        id: `${side}-${index}`,
        designId: id,
        mass: found?.mass ?? 0,
        points: found ? designCost(found, cpv) : 0,
        modified: !ROSTER_DESIGN_IDS.has(id),
      }
    }),
  )
  // "Even more limiting is a fixed, identical force" — the stricter option,
  // reported rather than enforced because it is the table's choice.
  const mirrored = identicalForces(
    Object.entries(forces).map(([sideId, ids]) =>
      (ids ?? []).map((id, index) => {
        const found = byId(designs, id)
        return {
          id: `${sideId}-${index}`,
          designId: id,
          mass: found?.mass ?? 0,
          points: found ? designCost(found, cpv) : 0,
        }
      }),
    ),
  )
  const techReport = checkFleetTechBase(
    techBase,
    picked.map((id) => byId(designs, id)).filter((d): d is ShipDesign => Boolean(d)),
    customBase,
  )

  return (
    <section className="fleet-picker">
      <h3>Choose forces</h3>

      <div className="panel-row">
        {onlySide === undefined
          ? scenario.sides.map((s) => (
              <button
                key={s.id}
                className={s.id === side ? 'primary' : undefined}
                onClick={() => setSide(s.id)}
              >
                {s.name}
              </button>
            ))
          : <b>{scenario.sides.find((s) => s.id === side)?.name ?? side}</b>}
        <span className="spacer" />
        <span className={`num budget${spent > budget ? ' is-over' : ''}`}>
          {spent} / {budget} {cpv ? 'CPV' : 'points'}
        </span>
        {onPrint ? (
          <button
            disabled={pickedDesigns.length === 0}
            title="This fleet's sheets and roster, on paper"
            onClick={() =>
              onPrint(
                `${scenario.name} — ${scenario.sides.find((s) => s.id === side)?.name ?? side}`,
                pickedDesigns,
              )
            }
          >
            Print sheets
          </button>
        ) : null}
      </div>

      <div className="panel-row">
        <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
          Composition
          <select
            aria-label="Composition format"
            value={format}
            onChange={(event) => setFormat(event.target.value as CompositionFormat)}
          >
            {COMPOSITION_FORMATS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        <span style={{ color: sizeBandColour(summary.report.sizeBand) }}>
          {SIZE_BAND_LABEL[summary.report.sizeBand]}
        </span>
      </div>

      {/* 18.2's two tournament controls, which are a separate question from the
          composition format: "only designs given in the Full Thrust Fleet
          Books, with no modifications", and the stricter "a fixed, identical
          force" every player flies. */}
      <div className="panel-row">
        <label>
          <input
            type="checkbox"
            checked={tournament}
            onChange={(event) => setTournament(event.target.checked)}
          />{' '}
          Tournament list (18.2)
        </label>
        <span className="spacer" />
        {tournament ? (
          <span style={{ color: tournamentReport.legal ? 'var(--screens)' : 'var(--warn)' }}>
            {tournamentReport.legal
              ? mirrored
                ? 'legal, and both fleets are identical'
                : 'legal; the fleets are not identical'
              : `${tournamentReport.violations.length} entr${
                  tournamentReport.violations.length === 1 ? 'y' : 'ies'
                } a tournament would refuse`}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-dim)' }}>
            fleet-book designs only, and no modifications
          </span>
        )}
      </div>

      {tournament && tournamentReport.violations.length > 0 ? (
        <ul className="faults">
          {tournamentReport.violations.map((finding, i) => (
            <li key={`t${i}`}>
              <span className="rule-ref">{finding.rule}</span> {finding.detail}
            </li>
          ))}
        </ul>
      ) : null}

      <CompositionBar breakdown={summary.breakdown} />

      {summary.report.violations.length > 0 || summary.report.advisories.length > 0 ? (
        <ul className="faults">
          {summary.report.violations.map((finding, i) => (
            <li key={`v${i}`}>
              <span className="rule-ref">{finding.rule}</span> {finding.detail}
            </li>
          ))}
          {summary.report.advisories.map((finding, i) => (
            <li key={`a${i}`} style={{ color: 'var(--ink-dim)' }}>
              <span className="rule-ref">{finding.rule}</span> {finding.detail}
            </li>
          ))}
        </ul>
      ) : null}

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
              {design?.name ?? id}{' '}
              <span className="num">{design ? designCost(design, cpv) : 0}</span>
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
                const problems = [
                  ...designProblems(techBase, design, customBase),
                  ...pickFaults(design).map(describeFault),
                ]
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
                    <span className="num">{designCost(design, cpv)}</span>
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

const COMPOSITION_FORMATS: readonly { id: CompositionFormat; label: string }[] = [
  { id: 'open', label: 'Open — no restriction' },
  { id: 'patrol', label: 'Patrol — no capitals, cruisers under half' },
  { id: 'large-battle', label: 'Large battle — capitals under half' },
  { id: 'capital-escorted', label: 'Capitals escorted' },
  { id: 'fleet-action', label: 'Fleet action' },
]

const SIZE_BAND_LABEL: Record<string, string> = {
  'below-minimum': `under ${SMALLEST_INTERESTING_FLEET_POINTS} — thin for a battle`,
  small: 'small, but playable',
  ideal: `the ideal ${IDEAL_FLEET_POINTS_MIN}\u2013${IDEAL_FLEET_POINTS_MAX}`,
  large: 'large',
  'too-large': 'probably too large',
}

function sizeBandColour(band: string): string {
  if (band === 'ideal') return 'var(--screens)'
  if (band === 'too-large' || band === 'below-minimum') return 'var(--warn)'
  return 'var(--ink-dim)'
}

/**
 * How the points are split between hull groups (18.2).
 *
 * Shown as a bar rather than three numbers because the thing a player is
 * checking is a proportion — "am I all battleships?" — and a proportion is
 * read off a bar faster than off arithmetic. The classes are 13.4's, taken
 * from mass by `classifyByMass`, not from whatever the design calls itself:
 * 18.2's limits are about hulls and 13.4 lets a navy label them how it likes.
 */
function CompositionBar({ breakdown }: { breakdown: FleetBreakdown }) {
  if (breakdown.total === 0) return null
  return (
    <div className="composition" aria-label="Fleet composition by hull group">
      {GROUP_ORDER.map((group) => {
        const points = breakdown.points[group]
        if (points === 0) return null
        return (
          <span
            key={group}
            className={`composition-slice is-${group}`}
            style={{ flexGrow: points }}
            title={`${GROUP_LABEL[group]}: ${points}, ${Math.round(breakdown.share[group] * 100)}%`}
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

function budgetFor(
  scenario: Scenario,
  side: string,
  designs: readonly ShipDesign[],
  cpv: boolean,
): number {
  return defaultPicks(scenario, side).reduce((sum, id) => {
    const design = byId(designs, id)
    return sum + (design ? designCost(design, cpv) : 0)
  }, 0)
}
