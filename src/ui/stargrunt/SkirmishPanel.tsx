import { useMemo, useState } from 'react'

import { ESU, FORCES, NAC, NSL, standardPlatoon, type ForceTemplate } from '../../stargrunt/data/forces'
import { QUALITY_DIE } from '../../stargrunt/types'
import { placeObjectives, randomTerrain, TERRAIN_STYLES, type TerrainStyle } from '../../dirtside/table/skirmish'
import { newStream } from '../../stargrunt/dice'
import { createGame, inDeploymentZone } from '../../stargrunt/table/game'
import type { GameSetup, GameState, Leadership, Motivation, Quality, SideId, SideSetup, UnitSetup } from '../../stargrunt/types'
import { loadStargruntBattle, newStargruntBattle } from './stargruntStore'
import { TableMap } from './TableMap'

/**
 * A skirmish to put on the table: each side a chapter 25 force (p. 67–69),
 * a platoon or a trimmed handful of its squads, quality, leadership and
 * mission motivation, played by you or the computer, on a table with a
 * seeded spread of terrain and objectives. No points system (p. 10): there
 * is nothing here to balance a roster against, so the panel is a shelf of
 * TO&E templates and a scenario, not a shop (`05-reuse-map.md` §5).
 */
export interface SkirmishPanelProps {
  onClose: () => void
  onStart: () => void
}

const FORCE_LIST: readonly ForceTemplate[] = FORCES
const FORCE_BY_NAME = new Map(FORCE_LIST.map((f) => [f.nation, f]))

type PresetId = 'first' | 'platoons' | 'custom'

interface SideChoice {
  force: ForceTemplate
  quality: Quality
  leadership: Leadership
  motivation: Motivation
  squads: number
  includeHQ: boolean
  computer: boolean
  name: string
}

const QUALITY_LIST: Quality[] = ['untrained', 'green', 'regular', 'veteran', 'elite']
const QUALITY_NAMES: Record<Quality, string> = { untrained: 'Untrained', green: 'Green', regular: 'Regular', veteran: 'Veteran', elite: 'Elite' }
const MOTIVATION_NAMES: Record<Motivation, string> = { low: 'Low', medium: 'Medium', high: 'High' }
/** The six styles in plain words, exactly as BRIEF-TERRAIN gives them, for the select and the aside's summary line. */
const TERRAIN_OPTIONS: Record<TerrainStyle, string> = { none: 'Open', light: 'Rural, light', dense: 'Rural, dense', village: 'Village', town: 'Town', city: 'City' }
const TERRAIN_NAMES: Record<TerrainStyle, string> = { none: 'open', light: 'rural, light', dense: 'rural, dense', village: 'village', town: 'town', city: 'city' }
const TERRAIN_HINTS: Record<TerrainStyle, string> = {
  none: 'An open plain, nothing on it',
  light: 'Woods, hills, rough ground and a road',
  dense: 'More of everything, often a river, sometimes a hamlet',
  village: 'Buildings strung along a road, with gardens and a few fields',
  town: 'Streets and blocks of buildings round a square, rural ground around it',
  city: 'Built up across most of the table but the deployment strips',
}

function defaultChoice(force: ForceTemplate, computer: boolean): SideChoice {
  return { force, quality: 'regular', leadership: 2, motivation: 'medium', squads: force.squadCount, includeHQ: true, computer, name: `${force.nation} force` }
}

function sideSetup(side: SideId, c: SideChoice): SideSetup {
  // Each unit's own motivation is left unset, so it defaults to the side's (`createGame`, p. 19).
  const platoon = standardPlatoon(c.force, side, { quality: c.quality, hqLeadership: c.leadership, squadLeadership: c.leadership })
  const squads = platoon.slice(1, 1 + Math.max(1, Math.min(c.force.squadCount, c.squads)))
  const units: UnitSetup[] = c.includeHQ ? [platoon[0]!, ...squads] : squads
  return { id: side, name: c.name, motivation: c.motivation, units }
}

/** A fault for a side with more figures than its deployment zone holds (p. 14). */
function crowded(state: GameState): string[] {
  const out: string[] = []
  for (const side of state.setup.sides) {
    const figs = Object.values(state.figures).filter((f) => f.sideId === side.id)
    const outside = figs.filter((f) => !inDeploymentZone(state.setup, side.id, f.position)).length
    if (outside > 0) out.push(`${side.name}'s ${figs.length} troopers don't all fit in its deployment zone: ${outside} would stand off the table. Take out a squad or widen the table (p. 14).`)
  }
  return out
}

export function SkirmishPanel({ onClose, onStart }: SkirmishPanelProps) {
  const [preset, setPreset] = useState<PresetId | null>('platoons')
  const [name, setName] = useState('Skirmish')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000))
  const [width, setWidth] = useState(48)
  const [depth, setDepth] = useState(36)
  const [terrain, setTerrain] = useState<TerrainStyle>('light')
  const [objectives, setObjectives] = useState(3)
  const [turnLimit, setTurnLimit] = useState(8)
  const [north, setNorth] = useState<SideChoice>(() => defaultChoice(NAC, false))
  const [south, setSouth] = useState<SideChoice>(() => defaultChoice(NSL, false))
  const [error, setError] = useState<string | null>(null)

  const touched = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    setPreset(null)
    setError(null)
    fn(...args)
  }

  const applyPreset = (id: PresetId) => {
    setPreset(id)
    setError(null)
    if (id === 'first') {
      setWidth(30)
      setDepth(24)
      setTerrain('light')
      setObjectives(2)
      setTurnLimit(6)
      setName('First contact')
      setNorth({ ...defaultChoice(NAC, false), squads: 1, includeHQ: false, name: 'Northern squad' })
      setSouth({ ...defaultChoice(NSL, true), squads: 1, includeHQ: false, name: 'Southern squad' })
    } else if (id === 'platoons') {
      setWidth(48)
      setDepth(36)
      setTerrain('light')
      setObjectives(3)
      setTurnLimit(8)
      setName('Skirmish')
      setNorth(defaultChoice(NAC, false))
      setSouth(defaultChoice(NSL, false))
    } else {
      setName('Skirmish')
      setNorth({ ...defaultChoice(NAC, false), squads: 1, includeHQ: true })
      setSouth({ ...defaultChoice(ESU, false), squads: 1, includeHQ: true })
    }
  }

  const buildSetup = (): GameSetup => {
    // XORed with a mark of its own, matching `defaultSkirmish`'s own reasoning, so a seed shared with
    // Dirtside or a plain Stargrunt default skirmish never deals identical terrain by coincidence.
    const stream = newStream((seed ^ 0x53_47_50_32) >>> 0)
    const sides: [SideSetup, SideSetup] = [sideSetup('north', north), sideSetup('south', south)]
    const setup: GameSetup = {
      name,
      seed,
      battle: 'encounter',
      // Squad scale (BRIEF-TERRAIN's two scales): this panel builds its own `GameSetup` rather than calling
      // `defaultSkirmish`, so it must pass the scale itself — `randomTerrain` defaults to Dirtside's platoon
      // scale, whose buildings (0.5–1.5″) would be far too small for a 25mm figure standing beside one.
      table: { width, depth, terrain: randomTerrain(stream, width, depth, terrain, { scale: 'squad' }), objectives: placeObjectives(stream, width, depth, objectives) },
      sides,
      turnLimit: turnLimit > 0 ? turnLimit : null,
    }
    const ai = (['north', 'south'] as SideId[]).filter((s) => (s === 'north' ? north : south).computer)
    return ai.length > 0 ? { ...setup, aiSides: ai } : setup
  }

  const preview = useMemo((): { state: GameState | null; faults: string[] } => {
    try {
      const setup = buildSetup()
      const state = createGame(setup)
      return { state, faults: crowded(state) }
    } catch {
      return { state: null, faults: [] }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, name, width, depth, terrain, objectives, turnLimit, north, south])

  const start = () => {
    const setup = buildSetup()
    const faults = crowded(createGame(setup))
    if (faults.length > 0) {
      setError(faults.join(' '))
      return
    }
    newStargruntBattle(setup)
    onStart()
  }

  const humans = (['north', 'south'] as const).filter((s) => !(s === 'north' ? north : south).computer)
  const whoPlays = humans.length === 2 ? 'You play both sides, taking turns at the one screen.' : humans.length === 1 ? `You play ${humans[0] === 'north' ? north.name : south.name}; the computer plays the other side.` : 'The computer plays both sides: you watch.'

  const sideEditor = (side: SideId, c: SideChoice, setC: (c: SideChoice) => void) => {
    const set = touched(setC)
    const figureCount = (c.includeHQ ? c.force.platoonCommand.figures.length : 0) + Array.from({ length: Math.max(1, Math.min(c.force.squadCount, c.squads)) }).reduce((n: number) => n + c.force.squad.figures.length, 0)
    return (
      <div className={`dss-force sg-side is-${side}`}>
        <div className="dss-force-head">
          <div className="dss-force-title">
            <span className="dss-side-tag">{side === 'north' ? 'North' : 'South'}</span>
            <input type="text" value={c.name} onChange={(e) => set({ ...c, name: e.target.value })} aria-label={`${side} force name`} />
          </div>
          <div className="dss-force-meta">
            <span className="dss-label">Played by</span>
            <span className="dss-seg" role="group" aria-label={`${side} played by`}>
              <button className={!c.computer ? 'is-on' : ''} aria-pressed={!c.computer} onClick={() => set({ ...c, computer: false })}>
                You
              </button>
              <button className={c.computer ? 'is-on' : ''} aria-pressed={c.computer} onClick={() => set({ ...c, computer: true })}>
                The computer
              </button>
            </span>
            <span className="dss-force-total num">{figureCount} troopers</span>
          </div>
        </div>
        <div className="dst-unit-row sg-force-row">
          <div className="dss-unit-line">
            <span className="dss-label">Force</span>
            <select value={c.force.nation} onChange={(e) => set({ ...c, force: FORCE_BY_NAME.get(e.target.value) ?? c.force, squads: FORCE_BY_NAME.get(e.target.value)?.squadCount ?? c.squads })} aria-label="Force" className="dss-grow">
              {FORCE_LIST.map((f) => (
                <option key={f.nation} value={f.nation}>
                  {f.nation} ({f.page})
                </option>
              ))}
            </select>
          </div>
          <div className="dss-unit-line">
            <label className="sg-check">
              <input type="checkbox" checked={c.includeHQ} onChange={(e) => set({ ...c, includeHQ: e.target.checked })} />
              Platoon Command Unit ({c.force.platoonCommand.figures.length})
            </label>
            <span className="dss-stepper" role="group" aria-label="Infantry Squads">
              <button onClick={() => set({ ...c, squads: Math.max(1, c.squads - 1) })} disabled={c.squads <= 1} aria-label="One fewer squad">
                −
              </button>
              <span className="dst-count">
                {c.squads} squad{c.squads === 1 ? '' : 's'}
              </span>
              <button onClick={() => set({ ...c, squads: Math.min(c.force.squadCount, c.squads + 1) })} disabled={c.squads >= c.force.squadCount} aria-label="One more squad">
                +
              </button>
            </span>
            <span className="campaign-dim">of {c.force.squadCount} ({c.force.squad.figures.length} each)</span>
          </div>
          <div className="dss-unit-line dss-grade">
            <span className="dss-pick">
              <span className="dss-label" title="Quality sets the die a squad tests confidence and reactions with (p. 9)">
                Quality
              </span>
              <span className="dss-seg" role="group" aria-label="Quality">
                {QUALITY_LIST.map((q) => (
                  <button key={q} className={c.quality === q ? 'is-on' : ''} aria-pressed={c.quality === q} onClick={() => set({ ...c, quality: q })}>
                    {QUALITY_NAMES[q]} <small>D{QUALITY_DIE[q]}</small>
                  </button>
                ))}
              </span>
            </span>
          </div>
          <div className="dss-unit-line dss-grade">
            <span className="dss-pick">
              <span className="dss-label" title="1 is the best leader, 3 the poorest (p. 9)">
                Leadership
              </span>
              <span className="dss-seg" role="group" aria-label="Leadership">
                {([1, 2, 3] as Leadership[]).map((l) => (
                  <button key={l} className={c.leadership === l ? 'is-on' : ''} aria-pressed={c.leadership === l} onClick={() => set({ ...c, leadership: l })}>
                    {l === 1 ? '1 · best' : l === 3 ? '3 · poor' : '2'}
                  </button>
                ))}
              </span>
            </span>
            <span className="dss-pick">
              <span className="dss-label" title="Mission motivation sets the confidence-threat column a squad tests against (p. 19)">
                Motivation
              </span>
              <span className="dss-seg" role="group" aria-label="Motivation">
                {(['low', 'medium', 'high'] as Motivation[]).map((m) => (
                  <button key={m} className={c.motivation === m ? 'is-on' : ''} aria-pressed={c.motivation === m} onClick={() => set({ ...c, motivation: m })}>
                    {MOTIVATION_NAMES[m]}
                  </button>
                ))}
              </span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  const presets: Array<{ id: PresetId; title: string; blurb: string }> = [
    { id: 'first', title: 'First game', blurb: 'One squad a side, no platoon HQ, on a 30 × 24″ table against the computer. Six turns.' },
    { id: 'platoons', title: 'Full platoons', blurb: 'A New Anglian platoon against a Neu Swabian one, chapter 25\'s own organisations, on 48 × 36″. Eight turns, hot seat.' },
    { id: 'custom', title: 'Build your own', blurb: 'Pick a force a side, how many squads, quality and leadership.' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide dst-setup dss sg-setup" onClick={(event) => event.stopPropagation()}>
        <header className="dss-head">
          <h2>Skirmish</h2>
          <span className="dss-kicker" title="An encounter battle (p. 14)">
            Stargrunt II · squad action
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
                const problem = loadStargruntBattle(await file.text())
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
                  <li>Two squad-level forces meet on an open table and fight over the objective markers.</li>
                  <li>Each turn the sides take it in turns to activate one squad: two actions each — move, fire, close assault and the rest.</li>
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
              {sideEditor('north', north, setNorth)}
              {sideEditor('south', south, setSouth)}
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
                {preview.state ? <TableMap state={preview.state} selectedUnitId={null} onSelectUnit={noop} onClickTable={noop} readOnly /> : null}
              </div>
              <p className="dss-caption">North deploys along the top edge, South along the bottom. Both sides can see the objectives' values (p. 17, reused) — there is nothing hidden about them in Stargrunt.</p>
              <div className="dss-fields">
                <label className="dss-field is-wide">
                  <span>Seed: the same number deals the same table</span>
                  <span className="dss-inline">
                    <input type="number" value={seed} onChange={(e) => touched(setSeed)(Math.floor(Number(e.target.value)) || 0)} aria-label="Seed" />
                    <button onClick={() => touched(setSeed)(Math.floor(Math.random() * 100000))}>Deal again</button>
                  </span>
                </label>
                <label className="dss-field is-wide">
                  <span>Terrain</span>
                  <select value={terrain} onChange={(e) => touched(setTerrain)(e.target.value as TerrainStyle)} aria-label="Terrain" title={TERRAIN_HINTS[terrain]}>
                    {TERRAIN_STYLES.map((t) => (
                      <option key={t} value={t} title={TERRAIN_HINTS[t]}>
                        {TERRAIN_OPTIONS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dss-field">
                  <span>Width (inches)</span>
                  <input type="number" min={18} max={72} value={width} onChange={(e) => touched(setWidth)(Number(e.target.value) || 48)} />
                </label>
                <label className="dss-field">
                  <span>Depth (inches)</span>
                  <input type="number" min={18} max={60} value={depth} onChange={(e) => touched(setDepth)(Number(e.target.value) || 36)} />
                </label>
                <label className="dss-field" title="Objective markers each side places (p. 17, reused)">
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
