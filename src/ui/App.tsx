import { useState } from 'react'

import { PHASE_LABELS, type Phase } from '../engine/types'
import { logFor, phaseNumber, shipById, shipMovementOrder } from '../engine/game'
import { scenarioById } from '../data/scenarios'
import { MapView } from './MapView'
import { OnlinePanel } from './OnlinePanel'
import { Scoreboard } from './Scoreboard'
import { SetupPanel } from './SetupPanel'
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
  const [viewingSide, setViewingSide] = useState<string | null>(null)
  const [showOnline, setShowOnline] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const selected = selectedId ? shipById(game, selectedId) : undefined
  const table = scenario?.table ?? { width: 72, height: 48 }
  const log = viewingSide ? logFor(game, viewingSide) : game.log

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

        <button onClick={() => setShowSetup(true)}>New battle</button>
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
        />

        <aside className="app-side">
          <PhaseControls phase={game.phase} />

          {scenario ? <Scoreboard game={game} ladder={scenario.victory} /> : null}

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
