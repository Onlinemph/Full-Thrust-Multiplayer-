import { useState } from 'react'

import { PHASE_LABELS, type Arc, type Phase } from '../engine/types'
import { logFor, phaseNumber, shipById, shipMovementOrder } from '../engine/game'
import { scenarioById } from '../data/scenarios'
import { battleEnd, BattleResult } from './BattleResult'
import { CombatPanel } from './CombatPanel'
import { FlightPanel } from './FlightPanel'
import { MapView } from './MapView'
import { OnlinePanel } from './OnlinePanel'
import { ReplayBar } from './ReplayBar'
import { Scoreboard } from './Scoreboard'
import { SetupPanel } from './SetupPanel'
import { ShipLibrary } from './ShipLibrary'
import { Shipyard } from './Shipyard'
import { KEY_HELP, useKeyboard } from './useKeyboard'
import { OrderPanel } from './OrderPanel'
import { Ssd } from './Ssd'
import {
  canUndo,
  currentGame,
  currentSetup,
  dispatch,
  exportGame,
  loadGame,
  undo,
  useGame,
} from './store'

/**
 * The battle screen: a plotting surface, the selected ship's form, and the
 * controls for whatever phase the turn is in.
 *
 * Full Thrust runs on a fixed fifteen-phase sequence (2.6) and almost every
 * decision a player makes belongs to exactly one of them, so the phase is the
 * organising idea here: the right-hand column shows the controls for the
 * current phase and nothing else.
 */
export function App() {
  const game = useGame()
  const setup = currentSetup()
  const scenario = scenarioById(game.scenario)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /* A fighter group is picked separately from a ship: they are flown on the
     table, not from a ship's panel, and a carrier's own counter stays selected
     while its wing is out (8.5). */
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [viewingSide, setViewingSide] = useState<string | null>(null)
  const [showOnline, setShowOnline] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [litArcs, setLitArcs] = useState<readonly Arc[] | undefined>(undefined)
  // Dismissed once, the result stays dismissed: a player who closes it to look
  // at the wreckage should not have it thrown back at them every phase.
  const [resultSeen, setResultSeen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showYard, setShowYard] = useState(false)

  const selected = selectedId ? shipById(game, selectedId) : undefined
  const table = scenario?.table ?? { width: 72, height: 48 }
  const log = viewingSide ? logFor(game, viewingSide) : game.log
  const end = battleEnd(game, scenario)

  useKeyboard({ game, selectedId, onSelect: setSelectedId, suspended: showOnline || showSetup || showLibrary || showYard })

  return (
    <div className="app">
      <header className="app-bar">
        <h1>Full Thrust</h1>
        <span className="turn-readout num">
          TURN {game.turn}
          {scenario?.turnLimit ? ` / ${scenario.turnLimit}` : ''}
        </span>
        <span className="phase-readout">
          <b className="num">{phaseNumber(game.phase)}</b> {PHASE_LABELS[game.phase]}
        </span>

        <span className="spacer" />

        <label>
          Viewing{' '}
          <select
            value={viewingSide ?? ''}
            onChange={(event) => setViewingSide(event.target.value || null)}
          >
            <option value="">Open table</option>
            {game.sides.map((side) => (
              <option key={side.id} value={side.id}>
                {side.name}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            setResultSeen(false)
            setShowSetup(true)
          }}
        >
          New battle
        </button>
        <button onClick={() => setShowLibrary(true)}>Ships</button>
        <button onClick={() => setShowYard(true)}>Shipyard</button>
        <button onClick={() => setShowOnline(true)}>Remote play</button>
        <button disabled={!canUndo()} onClick={() => undo()}>
          Undo
        </button>
        <button onClick={() => download(exportGame())}>Save file</button>
        <label className="file-button">
          Load file
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const error = loadGame(await file.text())
              if (error) window.alert(error)
              event.target.value = ''
            }}
          />
        </label>
        <button className="primary" onClick={() => dispatch({ type: 'advance-phase' })}>
          End phase
        </button>
      </header>

      <main className="app-body">
        <MapView
          game={game}
          table={table}
          selectedId={selectedId}
          onSelect={setSelectedId}
          viewingSide={viewingSide}
          litArcs={litArcs}
          selectedFlightId={selectedFlightId}
          onSelectFlight={setSelectedFlightId}
        />

        <aside className="app-side">
          <ReplayBar onPreview={setPreviewing} />

          {previewing ? (
            <div className="panel">
              <h3>Replaying</h3>
              <p style={{ color: 'var(--ink-dim)' }}>
                An earlier moment of this battle, rebuilt from the journal — the same seed, so the
                same dice. Slide back to now to keep playing.
              </p>
            </div>
          ) : game.phase === 'ship-fire' && selected ? (
            <CombatPanel game={game} ship={selected} onHoverWeapon={setLitArcs} />
          ) : (
            <PhaseControls phase={game.phase} />
          )}

          {scenario ? <Scoreboard game={game} ladder={scenario.victory} /> : null}

          {game.fighterGroups.length > 0 || game.gunboatSquadrons.length > 0 ? (
            <FlightPanel
              game={game}
              ship={selected}
              selectedFlightId={selectedFlightId}
              onSelectFlight={setSelectedFlightId}
            />
          ) : null}

          {selected ? (
            <>
              <div className="panel">
                <Ssd
                  design={selected.design}
                  name={selected.name}
                  redacted={
                    viewingSide !== null &&
                    selected.side !== viewingSide &&
                    Boolean(setup.sensorRules)
                  }
                  damage={{
                    hullMarked: selected.hullMarked,
                    armourMarked: selected.armourMarked,
                    destroyed: selected.destroyedSystems,
                    fired: new Set(selected.weaponsFired.keys()),
                    thrust: Math.max(
                      0,
                      selected.driveHits >= 2
                        ? 0
                        : selected.driveHits === 1
                          ? Math.floor(selected.design.drive.thrust / 2)
                          : selected.design.drive.thrust,
                    ),
                  }}
                />
              </div>

              <OrderPanel
                ship={selected}
                editable={game.phase === 'orders'}
                emergencyThrustAllowed={Boolean(setup.emergencyThrust)}
              />
            </>
          ) : (
            <div className="panel">
              <h3>{scenario?.name ?? 'Battle'}</h3>
              <p style={{ color: 'var(--ink-dim)' }}>{scenario?.briefing}</p>
              <p style={{ color: 'var(--ink-dim)' }}>
                <b>Objective.</b> {scenario?.objective}
              </p>
              <p style={{ color: 'var(--ink-faint)' }}>Select a ship on the plot to give it orders.</p>
            </div>
          )}

          <details className="panel keys">
            <summary>Keyboard</summary>
            <dl>
              {KEY_HELP.map(([keys, does]) => (
                <div key={keys}>
                  <dt>{keys}</dt>
                  <dd>{does}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="panel log" style={{ flex: 1, minHeight: '8rem' }}>
            {log
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.seq} className={`log-entry is-${entry.kind}`}>
                  {entry.text}
                  {entry.dice?.length ? (
                    <span className="log-dice"> [{entry.dice.join(' ')}]</span>
                  ) : null}
                </div>
              ))}
          </div>
        </aside>
      </main>

      {showOnline ? <OnlinePanel onClose={() => setShowOnline(false)} /> : null}
      {showSetup ? <SetupPanel onClose={() => setShowSetup(false)} /> : null}
      {showLibrary ? <ShipLibrary onClose={() => setShowLibrary(false)} /> : null}
      {showYard ? <Shipyard onClose={() => setShowYard(false)} /> : null}
      {end.over && scenario && !resultSeen ? (
        <BattleResult
          game={game}
          scenario={scenario}
          end={end}
          onClose={() => setResultSeen(true)}
        />
      ) : null}
    </div>
  )
}

/**
 * What the current phase asks of the player. Every phase in 2.6 has a different
 * question, and showing all of them at once is how a fifteen-phase turn becomes
 * unplayable.
 */
function PhaseControls({ phase }: { phase: Phase }) {
  switch (phase) {
    case 'orders':
      return (
        <div className="panel">
          <h3>Phase 1 · Write orders</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every ship gets a course change and a thrust order, written before anything moves.
            Select a ship on the plot.
          </p>
        </div>
      )
    case 'initiative':
      return (
        <div className="panel">
          <h3>Phase 2 · Initiative</h3>
          <button className="primary" onClick={() => dispatch({ type: 'roll-initiative' })}>
            Roll initiative
          </button>
        </div>
      )
    case 'move-ships':
      return (
        <div className="panel">
          <h3>Phase 5 · Move ships</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Ships move in initiative order, the side with initiative moving last.
          </p>
          <button className="primary" onClick={() => moveEveryone()}>
            Move all ships
          </button>
        </div>
      )
    case 'launch-missiles':
      return (
        <div className="panel">
          <h3>Phase 3 · Launch missiles</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            A missile is aimed at a point, not at a ship: it attacks whatever it finds within 6 MU
            of that point once everything has moved. The side with initiative launches last.
          </p>
        </div>
      )
    case 'point-defence':
      return (
        <div className="panel">
          <h3>Phase 9 · Point defence</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every mount that can reach an incoming marker engages it. A gun fired here has fired
            for the turn — a beam spent on missiles is a beam that does not fire at ships.
          </p>
          <button className="primary" onClick={() => dispatch({ type: 'resolve-point-defence' })}>
            Resolve point defence
          </button>
        </div>
      )
    case 'ordnance-vs-ships':
      return (
        <div className="panel">
          <h3>Phase 10 · Ordnance against ships</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every marker attacks whatever it has acquired. A marker that finds nothing flies on.
            Fighter attack runs are resolved here too, after point defence has had its say: pick a
            group and click an enemy ship within 6 MU.
          </p>
          <button
            className="primary"
            onClick={() => dispatch({ type: 'resolve-ordnance-attacks' })}
          >
            Resolve ordnance attacks
          </button>
        </div>
      )
    case 'threshold':
      return (
        <div className="panel">
          <h3>Phase 13 · Threshold checks</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every ship that crossed a hull row this turn rolls one die per surviving system: a 6
            at the first threshold, 5 or better at the second, 4 or better at the third.
          </p>
          <button className="primary" onClick={() => dispatch({ type: 'threshold-sweep' })}>
            Roll threshold checks
          </button>
        </div>
      )
    case 'damage-control':
      return (
        <div className="panel">
          <h3>Phase 14 · Damage control</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Up to three parties may work one system, and it is repaired on a die at or below the
            number assigned.
          </p>
          <button
            className="primary"
            onClick={() => dispatch({ type: 'resolve-damage-control' })}
          >
            Make repair rolls
          </button>
        </div>
      )
    case 'move-fighters':
      return (
        <div className="panel">
          <h3>Phase 4 · Move fighters</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            A group has no course and no written order: pick one and click where it should go, up
            to 24 MU, in any direction. It costs no endurance. A carrier launching this turn holds
            its course and velocity, and a group launching gets half a move.
          </p>
        </div>
      )
    case 'secondary-fighter-moves':
      return (
        <div className="panel">
          <h3>Phase 6 · Secondary fighter moves</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            The look a group gets after the ships have moved: up to 12 MU more, for one Combat
            Endurance Factor. A group already dogfighting has to stay where it is.
          </p>
        </div>
      )
    case 'fighter-vs-fighter':
      return (
        <div className="panel">
          <h3>Phase 8 · Fighters against fighters</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Pick a group, then click an enemy group within 6 MU of it and inside its front 180°.
            Dogfights are simultaneous — every fighter on both sides shoots, including the ones
            about to be hit.
          </p>
        </div>
      )
    case 'ship-fire':
      return (
        <div className="panel">
          <h3>Phase 11 · Ships fire</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Ships fire in initiative order, the side with initiative firing first, with threshold
            checks after each. Select a ship to give it targets.
          </p>
        </div>
      )
    default:
      return (
        <div className="panel">
          <h3>
            Phase {phaseNumber(phase)} · {PHASE_LABELS[phase]}
          </h3>
          <p style={{ color: 'var(--ink-faint)' }}>
            The controls for this phase arrive with its engine module.
          </p>
        </div>
      )
  }
}

/**
 * Move every ship that has not moved yet, in the order 2.6 sets.
 *
 * Each ship is a separate journalled action, so undo takes back one ship's move
 * rather than the whole phase.
 */
function moveEveryone(): void {
  // Read the live game rather than the render's snapshot: each dispatch below
  // mutates it, and the movement order depends on what has already moved.
  for (const ship of shipMovementOrder(currentGame())) {
    if (ship.destroyed || ship.offTable) continue
    dispatch({ type: 'move-ship', shipId: ship.id })
  }
  // Markers fly in the same phase the ships do (2.6 phase 5).
  dispatch({ type: 'move-ordnance' })
}

function download(text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'full-thrust-battle.json'
  link.click()
  URL.revokeObjectURL(url)
}
