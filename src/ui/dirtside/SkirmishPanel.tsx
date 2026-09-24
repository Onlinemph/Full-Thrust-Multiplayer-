import { useMemo, useState } from 'react'

import { motorPoolDesigns } from '../../dirtside/library'
import { priceDesign, priceInfantry } from '../../dirtside/pricing'
import { recordCardOf } from '../../dirtside/recordCard'
import { QUALITY_DIE } from '../../dirtside/table/confidence'
import { createGame, inDeploymentZone } from '../../dirtside/table/game'
import { validateSetup } from '../../dirtside/table/setupCheck'
import { defaultForces, skirmishSetup, type UnitSpec } from '../../dirtside/table/skirmish'
import type { GameSetup, GameState, Leadership, Quality, SideId } from '../../dirtside/table/types'
import type { InfantryTeam, InfantryTroops, VehicleDesign } from '../../dirtside/types'
import { loadDirtsideBattle, newDirtsideBattle } from './dirtsideStore'
import { TableMap } from './TableMap'
import { unitCodes } from './unitCodes'

/**
 * A skirmish to put on the table: two forces of vehicles off the Motor
 * Pool shelf and infantry platoons, a seeded spread of terrain, the
 * objectives and the turn limit. The book's own battle is the default;
 * a first game against the computer is one click away. Each unit is a
 * card with its points, each side says who plays it, and the table is
 * drawn as it will be dealt, so the seed means something.
 */
export interface SkirmishPanelProps {
  onClose: () => void
  onStart: () => void
}

type TeamCounts = Record<InfantryTeam, number>

interface Row {
  key: number
  name: string
  kind: 'vehicle' | 'infantry'
  designId: string
  count: number
  troops: InfantryTroops
  teams: TeamCounts
  quality: Quality
  leadership: Leadership
  command: boolean
}

type Shelf = readonly VehicleDesign[]
type Terrain = 'none' | 'light' | 'dense'
type PresetId = 'first' | 'book' | 'custom'

let rowKey = 0

/** The team types in the order a platoon lists them: riflemen first, so a default platoon keeps its element ids. */
const TEAMS: InfantryTeam[] = ['rifle', 'apsw', 'assault', 'observer', 'anti-armour', 'air-defence', 'engineer']

const TEAM_NAMES: Record<InfantryTeam, string> = { rifle: 'Rifle', apsw: 'APSW', assault: 'Assault', observer: 'Observer', 'anti-armour': 'Anti-armour', 'air-defence': 'Air defence', engineer: 'Engineer' }

const TEAM_HINTS: Record<InfantryTeam, string> = {
  rifle: 'Riflemen: the platoon\'s backbone (p. 13)',
  apsw: 'An anti-personnel support weapon: a machine-gun team (p. 13)',
  assault: 'Close-assault specialists (p. 13)',
  observer: 'A forward observer who calls in artillery (p. 13)',
  'anti-armour': 'A team with a light guided missile against vehicles (p. 13)',
  'air-defence': 'A team with a missile launcher against aircraft (p. 13)',
  engineer: 'Engineers: obstacles, bridges and demolition (p. 13)',
}

const TROOP_NAMES: Record<InfantryTroops, string> = { militia: 'Militia', line: 'Line', powered: 'Powered' }
const QUALITY_NAMES: Record<Quality, string> = { green: 'Green', regular: 'Regular', veteran: 'Veteran' }
const LEADER_NAMES: Record<Leadership, string> = { 1: '1 · best', 2: '2', 3: '3 · poor' }
const TERRAIN_NAMES: Record<Terrain, string> = { none: 'open plain', light: 'light terrain', dense: 'dense terrain' }

const noTeams = (): TeamCounts => ({ rifle: 0, apsw: 0, assault: 0, observer: 0, 'anti-armour': 0, 'air-defence': 0, engineer: 0 })

function countTeams(list: readonly InfantryTeam[]): TeamCounts {
  const out = noTeams()
  for (const t of list) out[t] += 1
  return out
}

const teamList = (teams: TeamCounts): InfantryTeam[] => TEAMS.flatMap((t) => Array<InfantryTeam>(teams[t]).fill(t))

function rowsFrom(specs: UnitSpec[], shelf: Shelf): Row[] {
  return specs.map((s) => ({
    key: (rowKey += 1),
    name: s.name,
    kind: s.vehicle ? 'vehicle' : 'infantry',
    designId: s.vehicle ? shelf.find((d) => d.name === s.vehicle!.name)?.id ?? shelf[0]!.id : shelf[0]!.id,
    count: s.count ?? 3,
    troops: s.infantry?.troops ?? 'line',
    teams: countTeams(s.infantry?.teams ?? ['rifle', 'rifle', 'rifle', 'apsw']),
    quality: s.quality,
    leadership: s.leadership,
    command: !!s.commandUnit,
  }))
}

function newRow(shelf: Shelf, n: number, patch: Partial<Row> = {}): Row {
  return { key: (rowKey += 1), name: `Unit ${n}`, kind: 'vehicle', designId: shelf[0]!.id, count: 3, troops: 'line', teams: countTeams(['rifle', 'rifle', 'rifle', 'apsw']), quality: 'regular', leadership: 2, command: false, ...patch }
}

function designOf(shelf: Shelf, id: string): VehicleDesign {
  return shelf.find((d) => d.id === id) ?? shelf[0]!
}

/** Points of one unit as it would take the table (p. 53). */
function rowPoints(row: Row, shelf: Shelf): number {
  if (row.kind === 'vehicle') return Math.max(1, Math.min(8, row.count)) * priceDesign(designOf(shelf, row.designId)).total
  return teamList(row.teams).reduce((sum, team) => sum + priceInfantry({ troops: row.troops, team }), 0)
}

const rowElements = (row: Row) => (row.kind === 'vehicle' ? Math.max(1, Math.min(8, row.count)) : Math.max(1, teamList(row.teams).length))

function specsOf(rows: Row[], shelf: Shelf): UnitSpec[] {
  return rows.map((r) => {
    const spec: UnitSpec = { name: r.name, quality: r.quality, leadership: r.leadership }
    if (r.command) spec.commandUnit = true
    if (r.kind === 'vehicle') {
      spec.vehicle = structuredClone(designOf(shelf, r.designId))
      spec.count = Math.max(1, Math.min(8, r.count))
    } else {
      const teams = teamList(r.teams)
      spec.infantry = { troops: r.troops, teams: teams.length ? teams : ['rifle'] }
    }
    return spec
  })
}

const fmt = (n: number) => n.toLocaleString('en-GB')

export function SkirmishPanel({ onClose, onStart }: SkirmishPanelProps) {
  const shelf = useMemo(() => motorPoolDesigns(), [])
  const [preset, setPreset] = useState<PresetId | null>('book')
  const [name, setName] = useState('Skirmish')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000))
  const [width, setWidth] = useState(48)
  const [depth, setDepth] = useState(36)
  const [terrain, setTerrain] = useState<Terrain>('light')
  const [objectives, setObjectives] = useState(3)
  const [turnLimit, setTurnLimit] = useState(8)
  const [northName, setNorthName] = useState('Northern force')
  const [southName, setSouthName] = useState('Southern force')
  const [north, setNorth] = useState<Row[]>(() => rowsFrom(defaultForces().north, shelf))
  const [south, setSouth] = useState<Row[]>(() => rowsFrom(defaultForces().south, shelf))
  const [computer, setComputer] = useState<Record<SideId, boolean>>({ north: false, south: false })
  const [error, setError] = useState<string | null>(null)

  /** Any hand edit leaves the preset behind. */
  const touched = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    setPreset(null)
    setError(null)
    fn(...args)
  }

  const applyPreset = (id: PresetId) => {
    setPreset(id)
    setError(null)
    if (id === 'first') {
      const mbt = shelf.find((d) => d.id === 'book-mbt') ?? shelf[0]!
      const force = (): Row[] => [
        newRow(shelf, 1, { name: 'Tank Platoon', designId: mbt.id, count: 3, command: true }),
        newRow(shelf, 2, { name: 'Rifle Platoon', kind: 'infantry', troops: 'line', teams: countTeams(['rifle', 'rifle', 'rifle', 'apsw']) }),
      ]
      setWidth(36)
      setDepth(24)
      setTerrain('light')
      setObjectives(2)
      setTurnLimit(6)
      setName('First battle')
      setNorth(force())
      setSouth(force())
      setComputer({ north: false, south: true })
    } else if (id === 'book') {
      setWidth(48)
      setDepth(36)
      setTerrain('light')
      setObjectives(3)
      setTurnLimit(8)
      setName('Skirmish')
      setNorth(rowsFrom(defaultForces().north, shelf))
      setSouth(rowsFrom(defaultForces().south, shelf))
      setComputer({ north: false, south: false })
    } else {
      const mbt = shelf.find((d) => d.id === 'book-mbt') ?? shelf[0]!
      setName('Skirmish')
      setNorth([newRow(shelf, 1, { name: '1st Platoon', designId: mbt.id, command: true })])
      setSouth([newRow(shelf, 1, { name: '1st Platoon', designId: mbt.id, command: true })])
    }
    setNorthName('Northern force')
    setSouthName('Southern force')
  }

  const buildSetup = (): GameSetup => {
    const setup = skirmishSetup({ seed, name, width, depth, terrain, objectivesPerSide: objectives, turnLimit: turnLimit > 0 ? turnLimit : null, north: specsOf(north, shelf), south: specsOf(south, shelf), northName, southName })
    const ai = (['north', 'south'] as SideId[]).filter((s) => computer[s])
    return ai.length > 0 ? { ...setup, aiSides: ai } : setup
  }

  /* The table as it will be dealt, redrawn only when the setup changes. */
  const preview = useMemo((): { state: GameState | null; faults: string[] } => {
    try {
      const setup = buildSetup()
      const state = createGame(setup)
      const faults = [...validateSetup(setup).map((f) => `${f.detail} (${f.page})`), ...crowded(state)]
      return { state, faults }
    } catch {
      return { state: null, faults: [] }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, name, width, depth, terrain, objectives, turnLimit, north, south, northName, southName, computer])
  const codes = useMemo(() => (preview.state ? unitCodes(preview.state) : {}), [preview.state])

  const totals = useMemo(() => {
    const of = (rows: Row[]) => ({ points: rows.reduce((s, r) => s + rowPoints(r, shelf), 0), units: rows.length, elements: rows.reduce((s, r) => s + rowElements(r), 0) })
    return { north: of(north), south: of(south) }
  }, [north, south, shelf])

  const start = () => {
    if (north.length === 0 || south.length === 0) {
      setError('Each side needs at least one unit.')
      return
    }
    const setup = buildSetup()
    const faults = [...validateSetup(setup).map((f) => `${f.detail} (${f.page})`), ...crowded(createGame(setup))]
    if (faults.length > 0) {
      setError(faults.join(' '))
      return
    }
    newDirtsideBattle(setup)
    onStart()
  }

  const humans = (['north', 'south'] as SideId[]).filter((s) => !computer[s])
  const whoPlays = humans.length === 2 ? 'You play both sides, taking turns at the one screen.' : humans.length === 1 ? `You play ${humans[0] === 'north' ? northName : southName}; the computer plays ${humans[0] === 'north' ? southName : northName}.` : 'The computer plays both sides: you watch.'
  const sum = totals.north.points + totals.south.points
  const northShare = sum > 0 ? (100 * totals.north.points) / sum : 50

  const forceEditor = (side: SideId, rows: Row[], setRowsRaw: (r: Row[]) => void, forceName: string, setForceName: (s: string) => void) => {
    const setRows = touched(setRowsRaw)
    const total = totals[side]
    const update = (row: Row, patch: Partial<Row>) => setRows(rows.map((r) => (r === row ? { ...r, ...patch } : r)))
    return (
      <div className={`dss-force is-${side}`}>
        <div className="dss-force-head">
          <div className="dss-force-title">
            <span className="dss-side-tag">{side === 'north' ? 'North' : 'South'}</span>
            <input type="text" value={forceName} onChange={(e) => touched(setForceName)(e.target.value)} aria-label={`${side === 'north' ? 'North' : 'South'} force name`} />
          </div>
          <div className="dss-force-meta">
            <span className="dss-label">Played by</span>
            <span className="dss-seg" role="group" aria-label={`${side === 'north' ? 'North' : 'South'} played by`}>
              <button className={!computer[side] ? 'is-on' : ''} aria-pressed={!computer[side]} onClick={() => touched(setComputer)({ ...computer, [side]: false })}>
                You
              </button>
              <button className={computer[side] ? 'is-on' : ''} aria-pressed={computer[side]} onClick={() => touched(setComputer)({ ...computer, [side]: true })}>
                The computer
              </button>
            </span>
            <span className="dss-force-total num">
              <b>{fmt(total.points)}</b> pts · {total.units} unit{total.units === 1 ? '' : 's'} · {total.elements} elements
            </span>
          </div>
        </div>
        {rows.map((row, index) => {
          const code = codes[`${side}-${index + 1}`] ?? `${side === 'north' ? 'N' : 'S'}${index + 1}`
          const design = designOf(shelf, row.designId)
          const card = row.kind === 'vehicle' ? recordCardOf(design) : null
          const each = row.kind === 'vehicle' ? priceDesign(design).total : 0
          const present = TEAMS.filter((t) => row.teams[t] > 0)
          const absent = TEAMS.filter((t) => row.teams[t] === 0)
          return (
            <div key={row.key} className={`dst-unit-row dss-unit${row.command ? ' is-hq' : ''}`}>
              <div className="dss-unit-top">
                <span className="dss-code" title="The unit's code on the table and in the roster">
                  {code}
                </span>
                <input type="text" value={row.name} onChange={(e) => update(row, { name: e.target.value })} aria-label="Unit name" />
                <span className="dss-points num" title={row.kind === 'vehicle' ? `${row.count} × ${each} points (p. 53)` : 'Points of its teams (p. 53)'}>
                  {fmt(rowPoints(row, shelf))} <small>pts</small>
                </span>
                <button className={`dss-hq${row.command ? ' is-on' : ''}`} aria-pressed={row.command} onClick={() => setRows(rows.map((r) => ({ ...r, command: r === row })))} title="The force's command unit: losing it shakes the whole force (p. 24)">
                  ★ HQ
                </button>
                <button className="dss-remove" onClick={() => setRows(rows.filter((r) => r !== row))} aria-label="Remove unit" title="Remove this unit">
                  ×
                </button>
              </div>
              <div className="dss-unit-line">
                <span className="dss-seg" role="group" aria-label="Unit kind">
                  <button className={row.kind === 'vehicle' ? 'is-on' : ''} aria-pressed={row.kind === 'vehicle'} onClick={() => update(row, { kind: 'vehicle' })}>
                    Vehicles
                  </button>
                  <button className={row.kind === 'infantry' ? 'is-on' : ''} aria-pressed={row.kind === 'infantry'} onClick={() => update(row, { kind: 'infantry' })}>
                    Infantry
                  </button>
                </span>
                {row.kind === 'vehicle' ? (
                  <select value={row.designId} onChange={(e) => update(row, { designId: e.target.value })} aria-label="Design" className="dss-grow">
                    {shelf.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {priceDesign(d).total} pts
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="dss-seg" role="group" aria-label="Troops">
                    {(['militia', 'line', 'powered'] as InfantryTroops[]).map((t) => (
                      <button key={t} className={row.troops === t ? 'is-on' : ''} aria-pressed={row.troops === t} onClick={() => update(row, { troops: t })} title={`${TROOP_NAMES[t]}: rifle teams at ${priceInfantry({ troops: t, team: 'rifle' })} pts`}>
                        {TROOP_NAMES[t]}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {row.kind === 'vehicle' && card ? (
                <div className="dss-unit-line">
                  <span className="dss-stepper" role="group" aria-label="How many">
                    <button onClick={() => update(row, { count: Math.max(1, row.count - 1) })} disabled={row.count <= 1} aria-label="One fewer">
                      −
                    </button>
                    <input type="number" min={1} max={8} value={row.count} onChange={(e) => update(row, { count: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} aria-label="Count" className="dst-count" />
                    <button onClick={() => update(row, { count: Math.min(8, row.count + 1) })} disabled={row.count >= 8} aria-label="One more">
                      +
                    </button>
                  </span>
                  <span className="dss-pips" aria-hidden>
                    {Array.from({ length: Math.max(1, Math.min(8, row.count)) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <span className="dss-stats">
                    <span title={`Front armour ${card.armourFront}, sides, top and rear ${card.armourSide}`}>
                      Armour <b>{card.armourFront}</b>/{card.armourSide}
                    </span>
                    <span title={card.mobility}>{card.baseMove === null ? card.mobility : <><b>{card.baseMove}″</b> {card.mobility.toLowerCase()}</>}</span>
                    {card.weapons.length > 0 || card.missiles.length > 0 ? <span>{[...card.weapons.map((w) => w.label), ...card.missiles.map((m) => m.label)].join(', ')}</span> : <span>unarmed</span>}
                  </span>
                </div>
              ) : (
                <div className="dss-unit-line dss-teams">
                  {present.map((t) => (
                    <span key={t} className="dss-team" title={`${TEAM_HINTS[t]} · ${priceInfantry({ troops: row.troops, team: t })} pts each`}>
                      <button onClick={() => update(row, { teams: { ...row.teams, [t]: row.teams[t] - 1 } })} aria-label={`One fewer ${TEAM_NAMES[t]} team`}>
                        −
                      </button>
                      <span>
                        {TEAM_NAMES[t]} <b className="num">×{row.teams[t]}</b>
                      </span>
                      <button onClick={() => update(row, { teams: { ...row.teams, [t]: Math.min(8, row.teams[t] + 1) } })} disabled={row.teams[t] >= 8} aria-label={`One more ${TEAM_NAMES[t]} team`}>
                        +
                      </button>
                    </span>
                  ))}
                  {absent.length > 0 ? (
                    <select value="" onChange={(e) => e.target.value && update(row, { teams: { ...row.teams, [e.target.value]: 1 } })} aria-label="Add a team" className="dss-add-team">
                      <option value="">+ team…</option>
                      {absent.map((t) => (
                        <option key={t} value={t} title={TEAM_HINTS[t]}>
                          {TEAM_NAMES[t]} · {priceInfantry({ troops: row.troops, team: t })} pts
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {present.length === 0 ? <span className="dss-dim">No teams: it will take the table as one rifle team.</span> : null}
                </div>
              )}
              <div className="dss-unit-line dss-grade">
                <span className="dss-pick">
                <span className="dss-label" title="Quality sets the die the unit rolls for confidence and reactions (p. 21)">
                  Quality
                </span>
                <span className="dss-seg" role="group" aria-label="Quality">
                  {(['green', 'regular', 'veteran'] as Quality[]).map((q) => (
                    <button key={q} className={row.quality === q ? 'is-on' : ''} aria-pressed={row.quality === q} onClick={() => update(row, { quality: q })}>
                      {QUALITY_NAMES[q]} <small>D{QUALITY_DIE[q]}</small>
                    </button>
                  ))}
                </span>
                </span>
                <span className="dss-pick">
                <span className="dss-label" title="Leadership: 1 is the best leader, 3 the poorest (p. 21)">
                  Leader
                </span>
                <span className="dss-seg" role="group" aria-label="Leadership">
                  {([1, 2, 3] as Leadership[]).map((l) => (
                    <button key={l} className={row.leadership === l ? 'is-on' : ''} aria-pressed={row.leadership === l} onClick={() => update(row, { leadership: l })} title={l === 1 ? '1 is the best leader' : l === 3 ? '3 is the poorest leader' : 'An average leader'}>
                      {LEADER_NAMES[l]}
                    </button>
                  ))}
                </span>
                </span>
              </div>
            </div>
          )
        })}
        {rows.length === 0 ? <p className="dss-empty">No units yet: this side needs at least one.</p> : null}
        <button className="dss-add" onClick={() => setRows([...rows, newRow(shelf, rows.length + 1, { command: rows.length === 0 })])}>
          + Add a unit
        </button>
      </div>
    )
  }

  const presets: Array<{ id: PresetId; title: string; blurb: string }> = [
    { id: 'first', title: 'First game', blurb: 'A small battle against the computer: a tank platoon and a rifle platoon a side on 36 × 24″, six turns. You play North.' },
    { id: 'book', title: 'The book’s battle', blurb: 'Eight units on 48 × 36″: tanks, MICVs and riflemen against DEIMOS heavies, scouts and militia. Eight turns, hot seat.' },
    { id: 'custom', title: 'Build your own', blurb: 'One tank platoon a side to start from. Add units, pick vehicles off the Motor Pool shelf, set their quality.' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide dst-setup dss" onClick={(event) => event.stopPropagation()}>
        <header className="dss-head">
          <h2>Skirmish</h2>
          <span className="dss-kicker" title="An encounter battle (p. 17)">
            Dirtside II · a stand-alone battle
          </span>
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
        </header>

        <div className="dss-body">
          <div className="dss-main">
            <div className="dss-intro">
              <div className="dss-explain">
                <h3>What is a skirmish?</h3>
                <ul>
                  <li>Two forces meet on an open table and fight over the objective markers.</li>
                  <li>Each turn the sides take it in turns to activate one unit: its vehicles and teams move, then shoot.</li>
                  <li>When the last turn ends, the side holding the most objective value wins.</li>
                </ul>
              </div>
              <div className="dss-presets" role="group" aria-label="Quick start">
                {presets.map((p) => (
                  <button key={p.id} className={`dss-preset${preset === p.id ? ' is-on' : ''}`} aria-pressed={preset === p.id} onClick={() => applyPreset(p.id)}>
                    <b>{p.title}</b>
                    <span>{p.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="dss-forces">
              {forceEditor('north', north, setNorth, northName, setNorthName)}
              {forceEditor('south', south, setSouth, southName, setSouthName)}
            </div>
          </div>

          <aside className="dss-aside">
            <div className="dss-aside-scroll">
              <div className="dss-table-head">
                <h3>The table</h3>
                <span className="dss-dim">
                  {width} × {depth}″ · {TERRAIN_NAMES[terrain]}
                </span>
              </div>
              <div className="dss-preview" style={{ aspectRatio: `${width + 2} / ${depth + 2}` }}>
                {preview.state ? (
                  <TableMap state={preview.state} selectedId={null} onSelectElement={noop} onClickTable={noop} plot={[]} plotFrom={null} reach={null} targets={[]} highlight={null} viewer={null} readOnly />
                ) : null}
              </div>
              <p className="dss-caption">North deploys along the top edge, South along the bottom. The markers are the objectives, drawn face down: each side learns only its own values.</p>
              <div className="dss-fields">
                <label className="dss-field is-wide">
                  <span>Seed: the same number deals the same table</span>
                  <span className="dss-inline">
                    <input type="number" value={seed} onChange={(e) => setSeed(Math.floor(Number(e.target.value)) || 0)} aria-label="Seed" />
                    <button onClick={() => setSeed(Math.floor(Math.random() * 100000))}>Deal again</button>
                  </span>
                </label>
                <label className="dss-field is-wide">
                  <span>Terrain</span>
                  <select value={terrain} onChange={(e) => touched(setTerrain)(e.target.value as Terrain)} aria-label="Terrain">
                    <option value="none">Open plain</option>
                    <option value="light">Light: woods, hills, rough, a road</option>
                    <option value="dense">Dense: more of everything and a village</option>
                  </select>
                </label>
                <label className="dss-field">
                  <span>Width (inches)</span>
                  <input type="number" min={24} max={96} value={width} onChange={(e) => touched(setWidth)(Number(e.target.value) || 48)} />
                </label>
                <label className="dss-field">
                  <span>Depth (inches)</span>
                  <input type="number" min={24} max={72} value={depth} onChange={(e) => touched(setDepth)(Number(e.target.value) || 36)} />
                </label>
                <label className="dss-field" title="Objective markers each side places (p. 17)">
                  <span>Objectives a side</span>
                  <input type="number" min={1} max={6} value={objectives} onChange={(e) => touched(setObjectives)(Number(e.target.value) || 3)} />
                </label>
                <label className="dss-field">
                  <span>Turns (0: no limit)</span>
                  <input type="number" min={0} max={30} value={turnLimit} onChange={(e) => touched(setTurnLimit)(Number(e.target.value) || 0)} />
                </label>
                <label className="dss-field is-wide">
                  <span>Battle name</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="dss-aside-foot">
              <div className="dss-balance" title="The two forces' points (p. 53)">
                <div className="dss-balance-labels num">
                  <span className="is-north">
                    North <b>{fmt(totals.north.points)}</b>
                  </span>
                  <span className="is-south">
                    <b>{fmt(totals.south.points)}</b> South
                  </span>
                </div>
                <div className="dss-balance-bar">
                  <i className="is-north" style={{ width: `${northShare}%` }} />
                  <i className="is-south" />
                </div>
              </div>
              <p className="dss-who">{whoPlays}</p>
              {error ? <p className="faults">{error}</p> : preview.faults.length > 0 ? <p className="faults">{preview.faults.join(' ')}</p> : null}
              <button className="primary dss-start" onClick={start}>
                To the table
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

const noop = () => {}

/** A fault for each side with more vehicles and teams than its deployment zone holds (p. 17). */
function crowded(state: GameState): string[] {
  const out: string[] = []
  for (const side of state.setup.sides) {
    const els = Object.values(state.elements).filter((e) => e.sideId === side.id)
    const outside = els.filter((e) => !inDeploymentZone(state.setup, side.id, e.position)).length
    if (outside > 0) out.push(`${side.name}'s ${els.length} vehicles and teams don't fit in its deployment zone: ${outside} would stand off the table. Take out a unit or widen the table (p. 17).`)
  }
  return out
}
