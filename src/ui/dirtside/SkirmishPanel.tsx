import { useState } from 'react'

import { motorPoolDesigns } from '../../dirtside/library'
import { defaultForces, skirmishSetup, type UnitSpec } from '../../dirtside/table/skirmish'
import type { Leadership, Quality } from '../../dirtside/table/types'
import type { InfantryTeam, InfantryTroops } from '../../dirtside/types'
import { loadDirtsideBattle, newDirtsideBattle } from './dirtsideStore'

/**
 * A skirmish to put on the table: two forces of vehicles off the Motor
 * Pool shelf and infantry platoons, a seeded spread of terrain, the
 * objectives and the turn limit. The book's own vehicles are the default.
 */
export interface SkirmishPanelProps {
  onClose: () => void
  onStart: () => void
}

interface Row {
  key: number
  name: string
  kind: 'vehicle' | 'infantry'
  designId: string
  count: number
  troops: InfantryTroops
  teams: string
  quality: Quality
  leadership: Leadership
  command: boolean
}

let rowKey = 0

function rowsFrom(specs: UnitSpec[], shelf: readonly { id: string; name: string }[]): Row[] {
  return specs.map((s) => ({
    key: (rowKey += 1),
    name: s.name,
    kind: s.vehicle ? 'vehicle' : 'infantry',
    designId: s.vehicle ? shelf.find((d) => d.name === s.vehicle!.name)?.id ?? shelf[0]!.id : shelf[0]!.id,
    count: s.count ?? 3,
    troops: s.infantry?.troops ?? 'line',
    teams: s.infantry?.teams.join(', ') ?? 'rifle, rifle, rifle, apsw',
    quality: s.quality,
    leadership: s.leadership,
    command: !!s.commandUnit,
  }))
}

const TEAMS: InfantryTeam[] = ['rifle', 'apsw', 'assault', 'observer', 'anti-armour', 'air-defence', 'engineer']

export function SkirmishPanel({ onClose, onStart }: SkirmishPanelProps) {
  const shelf = motorPoolDesigns()
  const forces = defaultForces()
  const [name, setName] = useState('Skirmish')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000))
  const [width, setWidth] = useState(48)
  const [depth, setDepth] = useState(36)
  const [terrain, setTerrain] = useState<'none' | 'light' | 'dense'>('light')
  const [objectives, setObjectives] = useState(3)
  const [turnLimit, setTurnLimit] = useState(8)
  const [northName, setNorthName] = useState('Northern force')
  const [southName, setSouthName] = useState('Southern force')
  const [north, setNorth] = useState<Row[]>(() => rowsFrom(forces.north, shelf))
  const [south, setSouth] = useState<Row[]>(() => rowsFrom(forces.south, shelf))
  const [error, setError] = useState<string | null>(null)

  const specsOf = (rows: Row[]): UnitSpec[] =>
    rows.map((r) => {
      const spec: UnitSpec = { name: r.name, quality: r.quality, leadership: r.leadership }
      if (r.command) spec.commandUnit = true
      if (r.kind === 'vehicle') {
        spec.vehicle = structuredClone(shelf.find((d) => d.id === r.designId) ?? shelf[0]!)
        spec.count = Math.max(1, Math.min(8, r.count))
      } else {
        const teams = r.teams
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter((t): t is InfantryTeam => (TEAMS as string[]).includes(t))
        spec.infantry = { troops: r.troops, teams: teams.length ? teams : ['rifle'] }
      }
      return spec
    })

  const start = () => {
    if (north.length === 0 || south.length === 0) {
      setError('Each side needs at least one unit.')
      return
    }
    const setup = skirmishSetup({ seed, name, width, depth, terrain, objectivesPerSide: objectives, turnLimit: turnLimit > 0 ? turnLimit : null, north: specsOf(north), south: specsOf(south), northName, southName })
    newDirtsideBattle(setup)
    onStart()
  }

  const forceEditor = (rows: Row[], setRows: (r: Row[]) => void, label: string, forceName: string, setForceName: (s: string) => void) => (
    <section className="yard-section dst-force-editor">
      <h3>
        {label} <span className="rule-ref">p. 21</span>
      </h3>
      <label className="code-field">
        Force name
        <input value={forceName} onChange={(e) => setForceName(e.target.value)} />
      </label>
      {rows.map((row) => (
        <div key={row.key} className="dst-unit-row">
          <input value={row.name} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, name: e.target.value } : r)))} aria-label="Unit name" />
          <select value={row.kind} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, kind: e.target.value as Row['kind'] } : r)))} aria-label="Unit kind">
            <option value="vehicle">Vehicles</option>
            <option value="infantry">Infantry</option>
          </select>
          {row.kind === 'vehicle' ? (
            <>
              <select value={row.designId} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, designId: e.target.value } : r)))} aria-label="Design">
                {shelf.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input type="number" min={1} max={8} value={row.count} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, count: Number(e.target.value) || 1 } : r)))} aria-label="Count" className="dst-count" />
            </>
          ) : (
            <>
              <select value={row.troops} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, troops: e.target.value as InfantryTroops } : r)))} aria-label="Troops">
                <option value="militia">Militia</option>
                <option value="line">Line</option>
                <option value="powered">Powered</option>
              </select>
              <input value={row.teams} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, teams: e.target.value } : r)))} aria-label="Teams" title="rifle, apsw, assault, observer, anti-armour, air-defence, engineer" />
            </>
          )}
          <select value={row.quality} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, quality: e.target.value as Quality } : r)))} aria-label="Quality">
            <option value="green">Green</option>
            <option value="regular">Regular</option>
            <option value="veteran">Veteran</option>
          </select>
          <select value={row.leadership} onChange={(e) => setRows(rows.map((r) => (r === row ? { ...r, leadership: Number(e.target.value) as Leadership } : r)))} aria-label="Leadership">
            <option value={1}>Leader 1</option>
            <option value={2}>Leader 2</option>
            <option value={3}>Leader 3</option>
          </select>
          <label title="The force's command unit (p. 24)">
            <input type="radio" name={`command-${label}`} checked={row.command} onChange={() => setRows(rows.map((r) => ({ ...r, command: r === row })))} /> HQ
          </label>
          <button onClick={() => setRows(rows.filter((r) => r !== row))} aria-label="Remove unit">
            ×
          </button>
        </div>
      ))}
      <button onClick={() => setRows([...rows, { key: (rowKey += 1), name: `Unit ${rows.length + 1}`, kind: 'vehicle', designId: shelf[0]!.id, count: 3, troops: 'line', teams: 'rifle, rifle, rifle, apsw', quality: 'regular', leadership: 2, command: rows.length === 0 }])}>
        Add a unit
      </button>
    </section>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide yard-modal dst-setup" onClick={(event) => event.stopPropagation()}>
        <div className="yard-head">
          <h2>Skirmish</h2>
          <span className="campaign-kicker">Dirtside II · encounter battle, p. 17</span>
          <span className="spacer" />
          <label className="file-button">
            Open a battle file
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const problem = loadDirtsideBattle(await file.text())
                event.target.value = ''
                if (problem) setError(problem)
                else onStart()
              }}
            />
          </label>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="yard">
          <div className="yard-controls">
            <section className="yard-section">
              <h3>
                The table <span className="rule-ref">p. 17, p. 25</span>
              </h3>
              <div className="yard-pair">
                <label className="code-field">
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="code-field">
                  Seed
                  <span className="dst-row">
                    <input type="number" value={seed} onChange={(e) => setSeed(Math.floor(Number(e.target.value)) || 0)} aria-label="Seed" />
                    <button onClick={() => setSeed(Math.floor(Math.random() * 100000))}>Roll</button>
                  </span>
                </label>
              </div>
              <div className="yard-pair">
                <label className="code-field">
                  Width (inches)
                  <input type="number" min={24} max={96} value={width} onChange={(e) => setWidth(Number(e.target.value) || 48)} />
                </label>
                <label className="code-field">
                  Depth (inches)
                  <input type="number" min={24} max={72} value={depth} onChange={(e) => setDepth(Number(e.target.value) || 36)} />
                </label>
              </div>
              <div className="yard-pair">
                <label className="code-field">
                  Terrain
                  <select value={terrain} onChange={(e) => setTerrain(e.target.value as typeof terrain)} aria-label="Terrain">
                    <option value="none">Open plain</option>
                    <option value="light">Light: woods, hills, rough, a road</option>
                    <option value="dense">Dense: more of everything and a village</option>
                  </select>
                </label>
                <label className="code-field">
                  Objectives per side
                  <input type="number" min={1} max={6} value={objectives} onChange={(e) => setObjectives(Number(e.target.value) || 3)} />
                </label>
                <label className="code-field">
                  Turn limit (0 for none)
                  <input type="number" min={0} max={30} value={turnLimit} onChange={(e) => setTurnLimit(Number(e.target.value) || 0)} />
                </label>
              </div>
            </section>
            {forceEditor(north, setNorth, 'North', northName, setNorthName)}
            {forceEditor(south, setSouth, 'South', southName, setSouthName)}
          </div>
          <aside className="yard-side">
            <div className="yard-sheet">
              <p>
                Both sides deploy within 6" of their own baseline and fight for the objective markers; the side with fewer units chooses who activates first each turn. Command markers are the units' quality and leadership; every unit starts confident.
              </p>
              <p className="campaign-dim">
                Vehicles come from the Motor Pool shelf, the book's eight and your own. Infantry platoons are lists of teams: rifle, apsw, assault, observer, anti-armour, air-defence, engineer.
              </p>
              {error ? <p className="faults">{error}</p> : null}
            </div>
            <div className="yard-actions">
              <button className="primary" onClick={start}>
                To the table
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
