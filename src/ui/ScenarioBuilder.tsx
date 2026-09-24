import { useState } from 'react'

import { stationsFor } from '../data/customScenario'
import type { Scenario } from '../data/scenarios'
import type { TerrainFeature, TerrainKind } from '../engine/game'

/**
 * Drawing up a scenario of one's own (18).
 *
 * The shipped scenarios are code; this is the same data edited on the New
 * battle form. Everything the table needs is here — the situation as a
 * briefing, the table, the turn limit, the sides and what each may spend,
 * the rocks and clouds placed by clicking on a plan of the table, and 4.12's
 * ladder of what a hull is worth to the enemy. The fleets themselves are
 * picked with the fleet picker under it, and the deployment is the setup's
 * own choice (18.1), so neither is repeated here.
 */
export interface ScenarioBuilderProps {
  scenario: Scenario
  onChange: (scenario: Scenario) => void
  /** Keep it on this browser's shelf of scenarios. */
  onSave: () => void
  /** Take it off the shelf again. Absent while it has never been saved. */
  onDelete?: () => void
  /** The shelf already has this version. */
  saved: boolean
}

/** 17's features a designer places, with the radius each usually has. */
const TERRAIN: ReadonlyArray<{ kind: TerrainKind; label: string; radius: number }> = [
  { kind: 'planet', label: 'Planet', radius: 8 },
  { kind: 'planetoid', label: 'Planetoid', radius: 5 },
  { kind: 'asteroid-field', label: 'Asteroid field', radius: 6 },
  { kind: 'dust-cloud', label: 'Dust cloud', radius: 8 },
  { kind: 'nebula', label: 'Nebula', radius: 10 },
  { kind: 'debris', label: 'Battle debris', radius: 4 },
]

const TABLES: ReadonlyArray<{ label: string; width: number; height: number }> = [
  { label: "6′ × 4′", width: 72, height: 48 },
  { label: "8′ × 5′", width: 96, height: 60 },
  { label: "8′ × 6′", width: 96, height: 72 },
  { label: '10′ × 6′', width: 120, height: 72 },
]

export function ScenarioBuilder({ scenario, onChange, onSave, onDelete, saved }: ScenarioBuilderProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const set = (patch: Partial<Scenario>) => onChange({ ...scenario, ...patch })
  const table = scenario.table
  const terrain = scenario.terrain ?? []
  const setTerrain = (list: TerrainFeature[]) => set({ terrain: list.length > 0 ? list : undefined })
  const number = (value: string, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  const add = (kind: TerrainKind) => {
    const preset = TERRAIN.find((t) => t.kind === kind)!
    const n = terrain.filter((f) => f.kind === kind).length + 1
    const id = nextId(terrain)
    // Each new feature lands on a different spot of a three-by-two grid
    // across the middle of the table, so two added in a row do not sit on
    // top of each other with their names run together.
    const slot = terrain.length
    const position = {
      x: Math.round((table.width * ((slot % 3) + 1)) / 4),
      y: Math.round((table.height * ((Math.floor(slot / 3) % 2) + 1)) / 3),
    }
    setTerrain([...terrain, { id, kind, position, radius: preset.radius, label: `${preset.label} ${n}` }])
    setPicked(id)
  }
  const update = (id: string, patch: Partial<TerrainFeature>) =>
    setTerrain(terrain.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const remove = (id: string) => {
    setTerrain(terrain.filter((f) => f.id !== id))
    if (picked === id) setPicked(null)
  }

  const ladder = scenario.victory
  const setLadder = (key: keyof Scenario['victory'], percent: string) =>
    set({ victory: { ...ladder, [key]: Math.max(0, number(percent, ladder[key] * 100)) / 100 } })

  return (
    <div className="scenario-builder">
      <div className="scenario-builder-body">
        <div className="scenario-builder-form">
          <label className="code-field">
            Name
            <input type="text" value={scenario.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="code-field">
            Briefing
            <textarea rows={3} value={scenario.briefing} onChange={(e) => set({ briefing: e.target.value })} />
          </label>
          <label className="code-field">
            Objective
            <input type="text" value={scenario.objective} onChange={(e) => set({ objective: e.target.value })} />
          </label>

          <div className="panel-row">
            <span>Table</span>
            {TABLES.map((preset) => (
              <button
                key={preset.label}
                className={preset.width === table.width && preset.height === table.height ? 'is-on' : undefined}
                title={`${preset.width} × ${preset.height} MU (2.1)`}
                onClick={() => set({ table: { width: preset.width, height: preset.height } })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="yard-pair">
            <label className="code-field">
              Width (MU)
              <input
                className="num"
                type="number"
                min={24}
                max={400}
                value={table.width}
                onChange={(e) => set({ table: { ...table, width: number(e.target.value, table.width) } })}
              />
            </label>
            <label className="code-field">
              Height (MU)
              <input
                className="num"
                type="number"
                min={24}
                max={400}
                value={table.height}
                onChange={(e) => set({ table: { ...table, height: number(e.target.value, table.height) } })}
              />
            </label>
            <label className="code-field">
              Turn limit
              <input
                className="num"
                type="number"
                min={0}
                max={40}
                value={scenario.turnLimit ?? 0}
                title="0 fights on until one fleet has nothing left (4.12)"
                onChange={(e) => {
                  const n = Math.round(number(e.target.value, 0))
                  set({ turnLimit: n > 0 ? n : undefined })
                }}
              />
            </label>
            <label className="code-field">
              Points a side
              <input
                className="num"
                type="number"
                min={0}
                step={50}
                value={scenario.budget ?? 0}
                title="What each fleet may cost, in the currency the table plays in (18.2)"
                onChange={(e) => set({ budget: Math.max(0, Math.round(number(e.target.value, 0))) })}
              />
            </label>
          </div>

          <div className="yard-pair">
            {scenario.sides.map((side) => (
              <label className="code-field" key={side.id}>
                Side {side.id.toUpperCase()}
                <input
                  type="text"
                  value={side.name}
                  onChange={(e) =>
                    set({
                      sides: scenario.sides.map((s) => (s.id === side.id ? { ...s, name: e.target.value } : s)),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="rule-detail">
            The fleets are picked below against the points a side. They start in two lines facing
            each other, the first side along the top edge; pick one of 18.1&rsquo;s battles under
            Deployment to place them by hand instead.
          </p>

          {terrain.length > 0 ? (
            <table className="cost-table scenario-terrain">
              <tbody>
                {terrain.map((feature) => (
                  <tr key={feature.id} className={picked === feature.id ? 'is-picked' : undefined}>
                    <td>
                      <input
                        type="text"
                        value={feature.label ?? ''}
                        aria-label="Feature name"
                        onChange={(e) => update(feature.id, { label: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={feature.kind}
                        aria-label="Feature kind"
                        onChange={(e) => update(feature.id, { kind: e.target.value as TerrainKind })}
                      >
                        {TERRAIN.map((preset) => (
                          <option key={preset.kind} value={preset.kind}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(['x', 'y'] as const).map((axis) => (
                      <td key={axis} className="num">
                        <input
                          className="num"
                          type="number"
                          aria-label={axis}
                          step={0.5}
                          value={feature.position[axis]}
                          onChange={(e) =>
                            update(feature.id, {
                              position: { ...feature.position, [axis]: number(e.target.value, feature.position[axis]) },
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="num">
                      <input
                        className="num"
                        type="number"
                        aria-label="Radius"
                        min={1}
                        step={0.5}
                        value={feature.radius}
                        onChange={(e) => update(feature.id, { radius: Math.max(0.5, number(e.target.value, feature.radius)) })}
                      />
                    </td>
                    <td>
                      <button onClick={() => remove(feature.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* 4.12: what a hull is worth to the enemy at each level of damage. */}
          <div className="yard-pair">
            {(
              [
                ['damaged', 'Damaged'],
                ['crippled', 'Crippled'],
                ['destroyed', 'Destroyed'],
                ['disengaged', 'Disengaged'],
              ] as const
            ).map(([key, label]) => (
              <label className="code-field" key={key}>
                {label} (% of value)
                <input
                  className="num"
                  type="number"
                  min={0}
                  max={200}
                  step={5}
                  value={Math.round(ladder[key] * 100)}
                  onChange={(e) => setLadder(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="panel-row">
            <button
              className={saved ? undefined : 'primary'}
              disabled={saved}
              title="Keep it on this browser's shelf, listed under the scenario menu"
              onClick={onSave}
            >
              {saved ? 'On the shelf' : 'Save to my scenarios'}
            </button>
            {onDelete ? <button onClick={onDelete}>Take off the shelf</button> : null}
            <span className="rule-detail">
              A battle file carries the scenario whole, so a saved battle opens anywhere.
            </span>
          </div>
        </div>

        <div className="scenario-builder-side">
          {/* 17: rocks and clouds, placed on a plan of the table. */}
          <div className="panel-row">
            <span>Terrain</span>
            <span className="spacer" />
          </div>
          <div className="panel-row scenario-terrain-add">
            {TERRAIN.map((preset) => (
              <button key={preset.kind} title={`Add a ${preset.label.toLowerCase()} (17)`} onClick={() => add(preset.kind)}>
                + {preset.label}
              </button>
            ))}
          </div>
          <svg
            className="scenario-preview"
            viewBox={`0 0 ${table.width} ${table.height}`}
            style={{ aspectRatio: `${table.width} / ${table.height}` }}
            role="img"
            aria-label={`A plan of the ${table.width} by ${table.height} MU table`}
            onClick={(event) => {
              if (picked === null) return
              const box = event.currentTarget.getBoundingClientRect()
              update(picked, {
                position: {
                  x: Math.round(((event.clientX - box.left) / box.width) * table.width * 2) / 2,
                  y: Math.round(((event.clientY - box.top) / box.height) * table.height * 2) / 2,
                },
              })
            }}
          >
            <rect className="scenario-table" x={0} y={0} width={table.width} height={table.height} />
            {scenario.sides.map((side, index) =>
              stationsFor(table, index, Math.max(1, side.force.length)).map((station, i) => (
                <circle
                  key={`${side.id}-${i}`}
                  className={`scenario-station side-${side.id}`}
                  cx={station.position.x}
                  cy={station.position.y}
                  r={side.force.length > 0 ? 0.9 : 0.5}
                />
              )),
            )}
            {terrain.map((feature) => (
              <g
                key={feature.id}
                className={`scenario-feature is-${feature.kind}${picked === feature.id ? ' is-picked' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setPicked(picked === feature.id ? null : feature.id)
                }}
              >
                <circle cx={feature.position.x} cy={feature.position.y} r={feature.radius} />
                <text x={feature.position.x} y={feature.position.y} textAnchor="middle" dominantBaseline="middle">
                  {feature.label ?? feature.kind}
                </text>
              </g>
            ))}
          </svg>
          {terrain.length > 0 ? (
            <p className="rule-detail">
              {picked ? 'Click the plan to move the picked feature.' : 'Click a feature to pick it up.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function nextId(features: readonly TerrainFeature[]): string {
  let n = features.length + 1
  while (features.some((f) => f.id === `t${n}`)) n += 1
  return `t${n}`
}
