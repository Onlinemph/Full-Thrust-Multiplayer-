import { useEffect, useState } from 'react'

import { PHASE_LABELS, type Arc, type Course, type Phase } from '../engine/types'
import {
  currentThrust,
  logFor,
  phaseNumber,
  shipById,
  shipMovementOrder,
  shipsAwaitingDeployment,
  shipsAwaitingThreshold,
  type GameState,
  type ShipState,
  type TerrainKind,
} from '../engine/game'
import {
  defendingSide,
  deployingSide,
  optional,
  phaseDebt,
  pointDefenceMounts,
  pointDefenceOrder,
  shipsAwaitingFtlEntry,
  shipsAwaitingMovement,
  shipsAwaitingOrders,
  tableIsCrowded,
  type PhaseDebt,
} from '../engine/actions'
import { BEAM_RANGE_BAND } from '../engine/geometry'
import { BATTLE_TYPE_LABELS } from '../engine/battles'
import { scenarioById } from '../data/scenarios'
import { battleEnd, BattleResult } from './BattleResult'
import { CombatPanel } from './CombatPanel'
import { DamageControlPanel } from './DamageControlPanel'
import { FlightPanel } from './FlightPanel'
import { GatePanel } from './GatePanel'
import { MainMenu } from './MainMenu'
import { MapView } from './MapView'
import { useNet } from './net'
import { OnlinePanel } from './OnlinePanel'
import { ReplayBar } from './ReplayBar'
import { Scoreboard } from './Scoreboard'
import { SquadronPanel } from './SquadronPanel'
import { SetupPanel } from './SetupPanel'
import { ShipLibrary } from './ShipLibrary'
import { Shipyard } from './Shipyard'
import { KEY_HELP, useKeyboard } from './useKeyboard'
import { OrderPanel } from './OrderPanel'
import { OrdnancePanel, type AimingMount } from './OrdnancePanel'
import { VectorOrderPanel } from './VectorOrderPanel'
import { Ssd } from './Ssd'
import {
  canUndo,
  commandedSides,
  commands,
  currentGame,
  currentSetup,
  dispatch,
  exportGame,
  journalLength,
  loadGame,
  undo,
  useGame,
  clearRefusal,
  useRefusal,
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
  const [chosenSide, setChosenSide] = useState<string | null>(null)
  /* One player's console looks through that player's eyes and nobody else's.
     The open table and the other fleet's view are courtesies of two people
     sharing one screen; against the computer or a remote opponent they are a
     way of reading cards the rules keep face down, so they are not on offer. */
  const commanded = commandedSides()
  const viewingSide =
    commanded === null
      ? chosenSide
      : chosenSide !== null && commanded.includes(chosenSide)
        ? chosenSide
        : (commanded[0] ?? null)
  const canCommand = (ship: ShipState): boolean => commands(ship.side)
  const [showOnline, setShowOnline] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [litArcs, setLitArcs] = useState<readonly Arc[] | undefined>(undefined)
  // Dismissed once, the result stays dismissed: a player who closes it to look
  // at the wreckage should not have it thrown back at them every phase.
  const [resultSeen, setResultSeen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showYard, setShowYard] = useState(false)
  /* The front of the house. The app opens on it rather than on whatever
     battle was last on the table; a connected remote match goes straight to
     the table, since the other console is waiting. */
  const [screen, setScreen] = useState<'menu' | 'battle'>('menu')
  const net = useNet()
  useEffect(() => {
    if (net.phase === 'connected') setScreen('battle')
  }, [net.phase])
  /* 2.6: a phase with optional work left — ships that have not fired — is
     ended by asking twice. The first click arms the button and says what the
     second one will skip; the arming is dropped the moment the phase changes. */
  const [armedSkip, setArmedSkip] = useState<string | null>(null)
  /* 18.1 lets a player deploy "with any desired course and an initial
     velocity", so both are chosen before the click that puts the ship down. */
  const [deployFacing, setDeployFacing] = useState<Course>(12)
  const [deployVelocity, setDeployVelocity] = useState(6)
  /* 6.3 and 6.8 both aim at a point, so a launcher is taken in hand and then
     the table is clicked — the same two steps as moving a fighter group. */
  const [aiming, setAiming] = useState<AimingMount | null>(null)
  /* 3.9 and 17.7 both place a returning ship "before orders", at an edge, so
     the ship is picked from a list and then the edge is clicked. */
  const [returning, setReturning] = useState<string | null>(null)
  /* 18.1's feature is placed the same way a ship is: pick it up, click the
     table. Held here because the map takes the click and the panel offers it. */
  const [placingTerrain, setPlacingTerrain] = useState<TerrainKind | null>(null)

  const selected = selectedId ? shipById(game, selectedId) : undefined
  const table = game.table
  const awaiting = shipsAwaitingDeployment(game)
  const placingSide = deployingSide(game)
  // A click on bare table places the selected ship, but only while it is that
  // side's turn and only for a ship that has not been placed.
  const deployWith =
    game.deployment !== null &&
    selected !== undefined &&
    placingSide === selected.side &&
    awaiting.some((ship) => ship.id === selected.id)
      ? { facing: deployFacing, velocity: deployVelocity }
      : null
  const log = viewingSide ? logFor(game, viewingSide) : game.log
  const end = battleEnd(game, scenario)

  const debt = phaseDebt(game)
  const phaseKey = `${game.turn}:${game.phase}`
  const endPhase = () => {
    if (debt.required.length > 0) {
      // The engine refuses it too; going through dispatch is what puts the
      // reason on screen.
      dispatch({ type: 'advance-phase' })
      return
    }
    if (debt.optional.length > 0 && armedSkip !== phaseKey) {
      setArmedSkip(phaseKey)
      return
    }
    setArmedSkip(null)
    dispatch({ type: 'advance-phase' })
  }

  /* The one button. In most phases what stands between the table and the next
     phase is a single resolution this console can run — move the ships, roll
     the thresholds, resolve the point defence — so the button that ends the
     phase offers that first, and Enter does whatever the button says. A turn
     with nothing to decide is then Enter, Enter, Enter. */
  const primary = primaryAction(game, debt, armedSkip === phaseKey, endPhase, canCommand)

  /**
   * The next of our ships still without orders, after `fromId` in table order,
   * so that writing orders is click, order, click, order down the line rather
   * than a hunt across the table for whoever is left.
   */
  const selectNextOwing = (fromId: string | null): void => {
    const live = currentGame()
    const owed = shipsAwaitingOrders(live).filter(canCommand)
    if (owed.length === 0) return
    const order = live.ships.map((ship) => ship.id)
    const from = fromId === null ? -1 : order.indexOf(fromId)
    const after = owed.find((ship) => order.indexOf(ship.id) > from) ?? owed[0]
    setSelectedId(after.id)
  }

  /** 3.5: straight ahead at the same speed, written as the blank sheet means it. */
  const holdCourse = (ship: ShipState): void => {
    const live = currentGame()
    if (optional(live).movementSystem === 'vector') {
      if (dispatch({ type: 'plot-vector-orders', shipId: ship.id, orders: [] }).refused) return
    } else {
      const order = ship.order
      if (order?.turn) dispatch({ type: 'plot-turn', shipId: ship.id, direction: null, points: 0 })
      if (order?.secondTurn) {
        dispatch({ type: 'plot-second-turn', shipId: ship.id, direction: null, points: 0 })
      }
      if (order === null || order.accel !== 0) {
        if (dispatch({ type: 'plot-accel', shipId: ship.id, accel: 0 }).refused) return
      }
    }
    selectNextOwing(ship.id)
  }

  /* Phase 1 opens on the first of our ships still to write for, so the turn
     starts with a compass on the table rather than a hunt for a counter. Only
     when nothing is selected: a player looking at an enemy sheet keeps it. */
  useEffect(() => {
    if (screen === 'battle' && game.phase === 'orders' && selectedId === null) selectNextOwing(null)
    // Runs when the phase changes, and not when the selection does.
  }, [phaseKey, screen])

  useKeyboard({
    game,
    selectedId,
    onSelect: setSelectedId,
    canCommand,
    suspended: screen !== 'battle' || showOnline || showSetup || showLibrary || showYard,
    onPrimary: primary.disabled ? endPhase : primary.run,
  })

  const modals = (
    <>
      {showOnline ? <OnlinePanel onClose={() => setShowOnline(false)} /> : null}
      {showSetup ? (
        <SetupPanel onClose={() => setShowSetup(false)} onStarted={() => setScreen('battle')} />
      ) : null}
      {showLibrary ? <ShipLibrary onClose={() => setShowLibrary(false)} /> : null}
      {showYard ? <Shipyard onClose={() => setShowYard(false)} /> : null}
    </>
  )

  if (screen === 'menu') {
    const underway = journalLength() > 0 || game.turn > 1
    return (
      <>
        <MainMenu
          continueLabel={
            underway
              ? `${scenario?.name ?? game.scenario} · turn ${game.turn}, ${PHASE_LABELS[game.phase].toLowerCase()}`
              : null
          }
          onContinue={() => setScreen('battle')}
          onNewBattle={() => {
            setResultSeen(false)
            setShowSetup(true)
          }}
          onRemotePlay={() => setShowOnline(true)}
          onLibrary={() => setShowLibrary(true)}
          onShipyard={() => setShowYard(true)}
          onLoadFile={(text) => {
            const error = loadGame(text)
            if (error) window.alert(error)
            else setScreen('battle')
          }}
        />
        {modals}
      </>
    )
  }

  return (
    <div className="app">
      <RefusalNotice />
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

        {commanded !== null && commanded.length === 1 ? (
          <span className="commanding">
            Commanding{' '}
            <b style={{ color: `var(--side-${viewingSide})` }}>
              {game.sides.find((side) => side.id === viewingSide)?.name ?? viewingSide}
            </b>
          </span>
        ) : (
          <label>
            Viewing{' '}
            <select
              value={viewingSide ?? ''}
              onChange={(event) => setChosenSide(event.target.value || null)}
            >
              {commanded === null ? <option value="">Open table</option> : null}
              {game.sides
                .filter((side) => commanded === null || commanded.includes(side.id))
                .map((side) => (
                  <option key={side.id} value={side.id}>
                    {side.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        <button onClick={() => setScreen('menu')}>Menu</button>
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
        <button
          className={`primary end-phase${primary.armed ? ' is-armed' : ''}`}
          disabled={primary.disabled}
          title={primary.disabled ? debt.required.join('\n') : undefined}
          onClick={primary.run}
        >
          {primary.label}
        </button>
      </header>

      <main className="app-body">
        <MapView
          game={game}
          table={table}
          selectedId={selectedId}
          onSelect={setSelectedId}
          viewingSide={viewingSide}
          canCommand={canCommand}
          onHoldCourse={holdCourse}
          onNextShip={selectNextOwing}
          litArcs={litArcs}
          selectedFlightId={selectedFlightId}
          onSelectFlight={setSelectedFlightId}
          deployWith={deployWith}
          placingTerrain={
            placingTerrain && defendingSide(game)
              ? {
                  sideId: defendingSide(game) as string,
                  kind: placingTerrain,
                  // 17.1's planets are the biggest thing a table carries; a
                  // dust cloud is scenery. Both are 18.1's "similar feature".
                  radius: placingTerrain === 'planet' ? 8 : 5,
                }
              : null
          }
          onTerrainPlaced={() => setPlacingTerrain(null)}
          aimWith={
            game.phase === 'launch-missiles' || (game.phase === 'ship-fire' && aiming?.kind === 'spinal')
              ? aiming
              : null
          }
          onAimed={() => setAiming(null)}
        />

        <aside className="app-side">
          <ReplayBar onPreview={setPreviewing} />

          <PhaseDebtNotice debt={debt} armed={armedSkip === phaseKey} />

          {previewing ? (
            <div className="panel">
              <h3>Replaying</h3>
              <p style={{ color: 'var(--ink-dim)' }}>
                An earlier moment of this battle, rebuilt from the journal — the same seed, so the
                same dice. Slide back to now to keep playing.
              </p>
            </div>
          ) : game.deployment && awaiting.length > 0 ? (
            <DeploymentPanel
              game={game}
              awaiting={awaiting}
              placingSide={placingSide}
              selectedId={selectedId}
              onSelect={setSelectedId}
              facing={deployFacing}
              onFacing={setDeployFacing}
              velocity={deployVelocity}
              onVelocity={setDeployVelocity}
            />
          ) : game.phase === 'ship-fire' && selected ? (
            <CombatPanel
              game={game}
              ship={selected}
              onHoverWeapon={setLitArcs}
              aiming={aiming}
              onAim={setAiming}
            />
          ) : (
            <PhaseControls
              phase={game.phase}
              game={game}
              viewingSide={viewingSide}
              selectedId={selectedId}
              onSelect={setSelectedId}
              aiming={aiming}
              onAim={setAiming}
              returning={returning}
              onReturn={setReturning}
              placingTerrain={placingTerrain}
              onPlaceTerrain={setPlacingTerrain}
            />
          )}

          {optional(game).movingTable ? <MovingTablePanel game={game} /> : null}

          {scenario ? <Scoreboard game={game} ladder={scenario.victory} /> : null}

          <GatePanel game={game} viewingSide={viewingSide} />

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
                {/* Christening a hull. Cosmetic, but journalled like anything
                    else, so the name survives a save and a replay — which is
                    the only reason it is an action rather than local state. */}
                {viewingSide === null || selected.side === viewingSide ? (
                  <div className="panel-row">
                    <input
                      aria-label="Ship name"
                      className="ship-name-field"
                      defaultValue={selected.name}
                      key={selected.id}
                      maxLength={40}
                      onBlur={(event) => {
                        const name = event.target.value.trim()
                        if (name && name !== selected.name) {
                          dispatch({ type: 'rename-ship', shipId: selected.id, name })
                        }
                      }}
                    />
                  </div>
                ) : null}
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
                    armourBurntOut: selected.armourBurntOut,
                    destroyed: selected.destroyedSystems,
                    fired: new Set(selected.weaponsFired.keys()),
                    // `currentThrust` and not a copy of its arithmetic: the
                    // copy that was here knew about drive hits and not about
                    // ongoing effects, so an EMP'd ship printed a thrust
                    // rating on its own sheet that the engine would not honour.
                    thrust: currentThrust(selected),
                  }}
                />
              </div>

              {/* 12.12 swaps out the movement order, not the phase. The
                  vector sheet replaces the turn and thrust controls; the
                  declarations written beside them — cloaks, mines, an armed
                  Nova Cannon, a charging Wave Gun, a detonate order, a turret
                  facing — are other sections' rules and stay. */}
              {optional(game).movementSystem === 'vector' ? (
                <VectorOrderPanel
                  ship={selected}
                  editable={
                    game.phase === 'orders' &&
                    canCommand(selected) &&
                    !awaiting.some((ship) => ship.id === selected.id)
                  }
                />
              ) : null}
              <OrderPanel
                game={game}
                ship={selected}
                editable={
                  game.phase === 'orders' &&
                  canCommand(selected) &&
                  !awaiting.some((ship) => ship.id === selected.id)
                }
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

      {modals}
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
 * What the phase still owes, in the rules' own words (2.6).
 *
 * Shown rather than only refused: a disabled End phase button with no
 * explanation is a locked door, and the whole point of gating the sequence is
 * that a player in an online match knows what the other console is waiting
 * on.
 */
function PhaseDebtNotice({ debt, armed }: { debt: PhaseDebt; armed: boolean }) {
  if (debt.required.length === 0 && debt.optional.length === 0) return null
  const required = debt.required.length > 0
  return (
    <div className={`phase-debt ${required ? 'is-required' : 'is-optional'}`}>
      <h4>
        {required
          ? 'Before the phase can end'
          : armed
            ? 'End phase anyway will skip'
            : 'Still to do, if you mean to'}
      </h4>
      <ul>
        {(required ? debt.required : debt.optional).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The moving table, and what hangs off it (16.4, 16.5).
 *
 * Both rules are about the playing area rather than about any one ship, so
 * they belong in a panel of their own rather than under a phase: 16.4 slides
 * the board whenever the action has drifted, and 16.5 is rolled the moment a
 * fleet's last hull is clear of the edge.
 */
function MovingTablePanel({ game }: { game: GameState }) {
  const crowding = tableIsCrowded(game, BEAM_RANGE_BAND)
  const running = game.sides.filter((side) => {
    const mine = game.ships.filter((ship) => ship.side === side.id && !ship.destroyed)
    return mine.length > 0 && mine.every((ship) => ship.offTable)
  })

  return (
    <div className="panel">
      <h3>Moving table</h3>
      <p style={{ color: 'var(--ink-dim)' }}>
        {crowding
          ? `The whole action has drifted into the ${crowding} edge. Slide the board back and every
             range, bearing and arc stays exactly as it is.`
          : 'Slide the board when the action drifts into a corner. Every range is unchanged by it.'}
      </p>
      <div className="panel-row">
        {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
          <button
            key={edge}
            className={edge === crowding ? 'primary' : undefined}
            onClick={() =>
              dispatch({ type: 'shift-table', crowding: edge, distance: BEAM_RANGE_BAND })
            }
          >
            {edge}
          </button>
        ))}
      </div>

      {running.map((side) => (
        <button
          key={side.id}
          className="primary"
          onClick={() => dispatch({ type: 'resolve-disengagement', sideId: side.id })}
        >
          {side.name} disengages (16.5)
        </button>
      ))}
    </div>
  )
}

/**
 * Putting the fleets on the table (18.1).
 *
 * It replaces the phase controls rather than sitting beside them, because
 * until every ship is placed there is nothing else to do: `advance-phase`
 * refuses while a deployment is owed, and a ship with no station has no course
 * to plot from.
 */
function DeploymentPanel({
  game,
  awaiting,
  placingSide,
  selectedId,
  onSelect,
  facing,
  onFacing,
  velocity,
  onVelocity,
}: {
  game: GameState
  awaiting: readonly ShipState[]
  placingSide: string | null
  selectedId: string | null
  onSelect: (shipId: string) => void
  facing: Course
  onFacing: (facing: Course) => void
  velocity: number
  onVelocity: (velocity: number) => void
}) {
  const deployment = game.deployment
  if (!deployment) return null
  const rolled = deployment.order.length > 0
  const sideName = (id: string) => game.sides.find((s) => s.id === id)?.name ?? id
  const mine = awaiting.filter((ship) => ship.side === placingSide)
  const zone = placingSide ? deployment.zones[placingSide] : undefined

  return (
    <div className="panel">
      <h3>Deploy · {BATTLE_TYPE_LABELS[deployment.battleType]}</h3>

      {!rolled ? (
        <>
          <p style={{ color: 'var(--ink-dim)' }}>
            Both fleets roll. The lower roll sets up first, and from there you alternate
            {deployment.batch > 1 ? `, ${deployment.batch} ships at a time` : ', a ship at a time'}.
          </p>
          <button className="primary" onClick={() => dispatch({ type: 'roll-deployment-order' })}>
            Roll for who places first
          </button>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--ink-dim)' }}>
            {placingSide ? <b>{sideName(placingSide)}</b> : null} to place. Pick a ship, set its
            course and speed, then click inside the shaded zone.
          </p>
          {zone ? <p style={{ color: 'var(--ink-faint)' }}>{zone.note}</p> : null}

          <div className="picked-list">
            {mine.map((ship) => (
              <button
                key={ship.id}
                className={`design-chip${ship.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => onSelect(ship.id)}
              >
                {ship.name}
              </button>
            ))}
          </div>

          <div className="panel-row">
            <span>Course</span>
            <span className="spacer" />
            <select
              aria-label="Deployment course"
              value={facing}
              onChange={(event) => onFacing(Number(event.target.value) as Course)}
            >
              {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as Course[])
                .filter((course) => !zone?.courses || zone.courses.includes(course))
                .map((course) => (
                  <option key={course} value={course}>
                    {course} o&rsquo;clock
                  </option>
                ))}
            </select>
          </div>

          <div className="panel-row">
            <span>Velocity</span>
            <span className="spacer" />
            <button onClick={() => onVelocity(Math.max(0, velocity - 1))}>−</button>
            <span className="num">{velocity}</span>
            <button onClick={() => onVelocity(velocity + 1)}>+</button>
          </div>

          <p style={{ color: 'var(--ink-faint)' }}>
            {awaiting.length} still to place.
          </p>
        </>
      )}
    </div>
  )
}

/**
 * What the current phase asks of the player. Every phase in 2.6 has a different
 * question, and showing all of them at once is how a fifteen-phase turn becomes
 * unplayable.
 */
function PhaseControls({
  phase,
  game,
  viewingSide,
  selectedId,
  onSelect,
  aiming,
  onAim,
  returning,
  onReturn,
  placingTerrain,
  onPlaceTerrain,
}: {
  phase: Phase
  game: GameState
  viewingSide: string | null
  selectedId: string | null
  onSelect: (shipId: string | null) => void
  aiming: AimingMount | null
  onAim: (mount: AimingMount | null) => void
  returning: string | null
  onReturn: (shipId: string | null) => void
  placingTerrain: TerrainKind | null
  onPlaceTerrain: (kind: TerrainKind | null) => void
}) {
  switch (phase) {
    case 'orders': {
      // 3.9 and 17.7: "ships will always re-enter play from the same side" and
      // "the ship can enter again by being placed before orders on the opposite
      // edge". Both happen here, and neither ship is on the plot to be clicked,
      // so they are listed.
      const due = game.ships.filter(
        (ship) =>
          ship.offTable &&
          !ship.destroyed &&
          !ship.landed &&
          ship.reentryTurn !== null &&
          game.turn >= ship.reentryTurn,
      )
      const unordered = shipsAwaitingOrders(game).filter(
        (ship) => viewingSide === null || ship.side === viewingSide,
      )
      // 3.5: "no change" is an order too, and the commonest one. Written as a
      // plotted acceleration of nothing, which is what a blank sheet means.
      const holdCourse = (shipId: string) =>
        optional(game).movementSystem === 'vector'
          ? dispatch({ type: 'plot-vector-orders', shipId, orders: [] })
          : dispatch({ type: 'plot-accel', shipId, accel: 0 })
      return (
        <div className="panel">
          <h3>Phase 1 · Write orders</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every ship gets a course change and a thrust order, written before anything moves.
            Select a ship on the plot. The phase cannot end until every ship has one — holding
            course is an order too.
          </p>
          {unordered.length > 0 ? (
            <div className="panel-block">
              {unordered.map((ship) => (
                <div
                  className={`panel-row is-pickable${ship.id === selectedId ? ' is-selected' : ''}`}
                  key={ship.id}
                  onClick={() => onSelect(ship.id)}
                >
                  {/* Named in the side's colour: on an open table both fleets
                      can have a "Heavy Cruiser 1", and the colour is what
                      tells a hot-seat player whose it is. */}
                  <span style={{ color: `var(--side-${ship.side})` }}>{ship.name}</span>
                  <span className="spacer" />
                  <span style={{ color: 'var(--ink-faint)' }}>no orders</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      holdCourse(ship.id)
                    }}
                  >
                    Hold course
                  </button>
                </div>
              ))}
              {unordered.length > 1 ? (
                <button onClick={() => unordered.forEach((ship) => holdCourse(ship.id))}>
                  Hold course, all {unordered.length}
                </button>
              ) : null}
            </div>
          ) : null}
          {due.map((ship) => (
            <div className="panel-row" key={ship.id}>
              <span>{ship.name}</span>
              <span className="spacer" />
              <button
                className={returning === ship.id ? 'primary' : undefined}
                onClick={() => onReturn(returning === ship.id ? null : ship.id)}
              >
                {returning === ship.id ? 'Click an edge…' : 'Bring back'}
              </button>
            </div>
          ))}

          {/* 3.7: "Squadrons are formed or broken at the start of the game
              turn, before writing movement orders." */}
          <SquadronPanel game={game} side={viewingSide} />

          {/* 18.1: "The defender can also place a planet or similar terrain
              feature." One feature, at deployment, and only in an
              offensive/defensive battle — so the control appears exactly when
              the rule does. */}
          {terrainDue(game) ? (
            <div className="panel-row">
              <span>Defender&rsquo;s feature</span>
              <span className="spacer" />
              {(['planet', 'planetoid', 'asteroid-field', 'dust-cloud'] as const).map((kind) => (
                <button
                  key={kind}
                  className={placingTerrain === kind ? 'primary' : undefined}
                  onClick={() => onPlaceTerrain(placingTerrain === kind ? null : kind)}
                >
                  {kind.replace('-', ' ')}
                </button>
              ))}
              <span style={{ color: 'var(--ink-dim)' }}>
                {placingTerrain ? 'click the table' : 'one feature, at deployment (18.1)'}
              </span>
            </div>
          ) : null}
        </div>
      )
    }
    case 'initiative': {
      // 2.6: the roll settles who has initiative, and the order it produces is
      // what every later phase alternates through. A table that re-rolls a tie
      // by hand, or agrees an order, needs somewhere to write the answer down.
      const order = game.initiative?.order ?? []
      return (
        <div className="panel">
          <h3>Phase 2 · Initiative</h3>
          <button className="primary" onClick={() => dispatch({ type: 'roll-initiative' })}>
            Roll initiative
          </button>
          {order.length > 1 ? (
            <div className="panel-row">
              <span>
                Order: {order.map((id) => game.sides.find((s) => s.id === id)?.name ?? id).join(' → ')}
              </span>
              <span className="spacer" />
              <button
                onClick={() =>
                  dispatch({ type: 'set-initiative-order', order: [...order].reverse() })
                }
              >
                Swap
              </button>
              <span style={{ color: 'var(--ink-dim)' }}>
                for a tie settled at the table rather than on the dice (2.6)
              </span>
            </div>
          ) : null}
        </div>
      )
    }
    case 'move-ships': {
      // 11.5: "The FTL entry is the ship's movement for that turn." An inbound
      // hull is not on the plot to be clicked, so it is listed here, and it
      // arrives before anybody flies.
      const inbound = shipsAwaitingFtlEntry(game)
      return (
        <div className="panel">
          <h3>Phase 5 · Move ships</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Ships move in initiative order, the side with initiative moving last.
          </p>
          {inbound.map((ship) => (
            <div className="panel-row" key={ship.id}>
              <span>{ship.name}</span>
              <span className="spacer" />
              <span style={{ color: 'var(--ink-dim)' }}>
                inbound, {ship.ftlArrival?.entryPoint.x}/{ship.ftlArrival?.entryPoint.y}
              </span>
              <button
                disabled={viewingSide !== null && ship.side !== viewingSide}
                onClick={() => bringOutOfFtl(ship.id)}
              >
                Drop out
              </button>
            </div>
          ))}
          <button className="primary" onClick={() => moveEveryone()}>
            Move all ships
          </button>
        </div>
      )
    }
    case 'launch-missiles':
      return (
        <OrdnancePanel game={game} side={viewingSide} aiming={aiming} onAim={onAim} />
      )
    case 'point-defence': {
      // Left to itself the engine puts every mount on the nearest thing it
      // can reach. `assign-point-defence` is for the times a player would not:
      // holding a scattergun for the salvo one turn behind, or putting
      // everything on the heavy missile rather than splitting.
      const markers = game.ordnance.filter((marker) => marker.missiles > 0)
      const defenders = game.ships
        .filter(
          (ship) =>
            !ship.destroyed &&
            !ship.offTable &&
            (viewingSide === null || ship.side === viewingSide) &&
            markers.some((marker) => marker.side !== ship.side),
        )
        .map((ship) => ({ ship, mounts: pointDefenceMounts(game, ship) }))
        .filter(({ mounts }) => mounts.length > 0)
      return (
        <div className="panel">
          <h3>Phase 9 · Point defence</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every mount that can reach an incoming marker engages it. A gun fired here has fired
            for the turn — a beam spent on missiles is a beam that does not fire at ships.
          </p>
          {markers.length > 0
            ? defenders.map(({ ship, mounts }) => (
                <div className="panel-block" key={ship.id}>
                  <div className="panel-row">
                    <b>{ship.name}</b>
                  </div>
                  {mounts.map((mount) => (
                    <div className="panel-row" key={mount.id}>
                      <label>
                        {mount.label}{' '}
                        <select
                          aria-label={`${ship.name} ${mount.label}`}
                          value={pointDefenceOrder(game, mount.id) ?? ''}
                          onChange={(event) =>
                            dispatch({
                              type: 'assign-point-defence',
                              shipId: ship.id,
                              systemId: mount.id,
                              targetId: event.target.value,
                            })
                          }
                        >
                          <option value="">nearest it can reach</option>
                          {markers
                            .filter((marker) => marker.side !== ship.side)
                            .map((marker) => (
                              <option key={marker.id} value={marker.id}>
                                {marker.kind} × {marker.missiles}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              ))
            : null}
          <button className="primary" onClick={() => dispatch({ type: 'resolve-point-defence' })}>
            Resolve point defence
          </button>
        </div>
      )
    }
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
    case 'threshold': {
      // Listing them is the point: a sweep that resolves eight ships at once
      // buries the one roll a player wanted to watch, and 4.11 is the roll
      // that decides which of their ship's systems it keeps.
      const owing = shipsAwaitingThreshold(game)
      return (
        <div className="panel">
          <h3>Phase 13 · Threshold checks</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every ship that crossed a hull row this turn rolls one die per surviving system: a 6
            at the first threshold, 5 or better at the second, 4 or better at the third.
          </p>
          {owing.map((ship) => (
            <div className="panel-row" key={ship.id}>
              <span>{ship.name}</span>
              <span className="spacer" />
              <span className="num">
                {ship.pendingThresholdRows} row{ship.pendingThresholdRows === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => dispatch({ type: 'threshold-check', shipId: ship.id })}
              >
                Roll
              </button>
            </div>
          ))}
          {owing.length === 0 ? (
            <p style={{ color: 'var(--ink-faint)' }}>Nobody crossed a row this turn.</p>
          ) : null}
          <button className="primary" onClick={() => dispatch({ type: 'threshold-sweep' })}>
            Roll threshold checks
          </button>
        </div>
      )
    }
    case 'damage-control':
      return <DamageControlPanel game={game} viewingSide={viewingSide} />
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
    case 'boarding':
      return (
        <div className="panel">
          <h3>Phase 12 · Boarding</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            The crew fights back. Each party aboard is targeted separately: one damage control
            party kills it on a 6, two on a 5 or 6, three on a 4 or better, and a Marine on a 4 or
            better. Everything is simultaneous, so a party killed here still got its blow in.
            Whatever survives does a point of damage a counter straight to the hull, and a ship
            whose last box goes this way is captured rather than destroyed.
          </p>
          <button className="primary" onClick={() => dispatch({ type: 'resolve-boarding' })}>
            Resolve boarding actions
          </button>
        </div>
      )
    case 'reactor-explosions':
      return (
        <div className="panel">
          <h3>Phase 15 · Reactor explosions</h3>
          <p style={{ color: 'var(--ink-dim)' }}>
            Every ship with a breached power core rolls a die. On a 5 or 6 the core lets go and
            the ship is gone; anything else and it holds for one more turn.
          </p>
          <button
            className="primary"
            onClick={() => dispatch({ type: 'resolve-reactor-explosions' })}
          >
            Roll for breached cores
          </button>
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
/** 18.1's one feature, and whether the defender still owes it. */
function terrainDue(game: GameState): boolean {
  return (
    game.turn === 1 &&
    game.deployment !== null &&
    game.deployment.battleType === 'offensive-defensive' &&
    !game.deployment.terrainPlaced &&
    defendingSide(game) !== null
  )
}

function moveEveryone(): void {
  // 11.5's arrival is a move, and it can land on top of somebody, so the
  // inbound hulls come out first and the rest of the table flies around them.
  for (const ship of shipsAwaitingFtlEntry(currentGame())) {
    if (commands(ship.side)) bringOutOfFtl(ship.id)
  }
  // Read the live game rather than the render's snapshot: each dispatch below
  // mutates it, and the movement order depends on what has already moved.
  // Only the ships this console commands, and only the ones still to move —
  // the computer flies its own the moment the phase opens.
  const live = currentGame()
  const pending = new Set(shipsAwaitingMovement(live).map((ship) => ship.id))
  for (const ship of shipMovementOrder(live)) {
    if (!pending.has(ship.id) || !commands(ship.side)) continue
    dispatch({ type: 'move-ship', shipId: ship.id })
  }
  // Markers fly in the same phase the ships do (2.6 phase 5).
  dispatch({ type: 'move-ordnance' })
}

/** What the phase's one button does, and what it says. */
interface PrimaryAction {
  label: string
  run: () => void
  disabled: boolean
  /** "End phase anyway": the second click on a phase with optional work left. */
  armed: boolean
}

/**
 * The resolution the phase is waiting on, if there is one this console can
 * run; otherwise ending the phase.
 *
 * Every required item `phaseDebt` names is settled by one action, and the
 * button that would otherwise sit disabled saying so may as well do it. The
 * exception is phase 1: what it waits on is the player's own judgement, ship
 * by ship, and a button that wrote ten orders at once would be writing them
 * wrong.
 */
function primaryAction(
  game: GameState,
  debt: PhaseDebt,
  armed: boolean,
  endPhase: () => void,
  canCommand: (ship: ShipState) => boolean,
): PrimaryAction {
  const owed = debt.required.length > 0
  const run = (label: string, action: () => void): PrimaryAction => ({
    label,
    run: action,
    disabled: false,
    armed: false,
  })
  switch (game.phase) {
    case 'move-ships': {
      const mine = [...shipsAwaitingFtlEntry(game), ...shipsAwaitingMovement(game)].filter(canCommand)
      if (mine.length > 0) return run('Move ships', moveEveryone)
      break
    }
    case 'threshold':
      if (shipsAwaitingThreshold(game).length > 0) {
        return run('Roll threshold checks', () => dispatch({ type: 'threshold-sweep' }))
      }
      break
    case 'point-defence':
      if (owed) return run('Resolve point defence', () => dispatch({ type: 'resolve-point-defence' }))
      break
    case 'ordnance-vs-ships':
      if (owed) {
        return run('Resolve ordnance attacks', () => dispatch({ type: 'resolve-ordnance-attacks' }))
      }
      break
    case 'boarding':
      if (owed) return run('Resolve boarding', () => dispatch({ type: 'resolve-boarding' }))
      break
    case 'damage-control':
      if (owed) return run('Roll repairs', () => dispatch({ type: 'resolve-damage-control' }))
      break
    case 'reactor-explosions':
      if (owed) {
        return run('Roll for breached cores', () => dispatch({ type: 'resolve-reactor-explosions' }))
      }
      break
    default:
      break
  }
  return {
    label: armed ? 'End phase anyway' : 'End phase',
    run: endPhase,
    disabled: owed,
    armed,
  }
}

/**
 * Drop a ship out of hyperspace where its orders said (11.5).
 *
 * The scatter and the danger roll happen inside the action; all the button
 * knows is which ship and what was written down.
 */
function bringOutOfFtl(shipId: string): void {
  const ship = currentGame().ships.find((candidate) => candidate.id === shipId)
  if (!ship?.ftlArrival) return
  dispatch({
    type: 'enter-from-ftl',
    shipId,
    entryPoint: ship.ftlArrival.entryPoint,
    course: ship.ftlArrival.course,
    velocity: ship.ftlArrival.velocity,
  })
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

/**
 * What the rules just said no to.
 *
 * `applyAction` answers every bad order with a sentence naming the rule that
 * refused it, `dispatch` has always returned that sentence, and until now every
 * caller in the UI threw it away — so a button that could not do what it said
 * simply did nothing and the player was left guessing. One notice at the top of
 * the screen catches all of them, because every click goes through `dispatch`.
 */
function RefusalNotice() {
  const refusal = useRefusal()
  if (!refusal) return null
  return (
    <div className="refusal-notice" role="status" key={refusal.seq}>
      <span>{refusal.text}</span>
      <button aria-label="Dismiss" onClick={() => clearRefusal()}>
        ×
      </button>
    </div>
  )
}
