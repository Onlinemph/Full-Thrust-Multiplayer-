import { useEffect, useState } from 'react'

import { PHASE_GUIDE, battleSetup, colonyById, phasesForTurn, plotLeadOf, systemById, taskForceById } from '../campaign/campaign'
import { hexKey, systemAt } from '../campaign/map'
import { CAMPAIGN_PHASE_LABELS } from '../campaign/turn'
import type { CampaignMove, CampaignSetup, CampaignState, Hex, PendingBattle, PendingLanding, PlayerId, PlottedMove, TaskForce } from '../campaign/types'
import type { GameSetup } from '../data/savedGame'
import { aiPlay } from '../dirtside/table/ai'
import type { GameSetup as DirtsideSetup, SideId } from '../dirtside/table/types'
import { autoplay } from '../engine/playtest/autoplay'
import { CampaignMap, playerColour } from './CampaignMap'
import { HexPanel, PlayerPanel } from './CampaignPanels'
import { battleOnTable, campaignDispatch, currentCampaignSetup, exportCampaign, landingOnTable, loadCampaign, useCampaign } from './campaignStore'

/**
 * The campaign console: the star map on the left, the phase and the selected
 * hex on the right, the log underneath. The turn is the organising idea, as
 * on the battle screen: the panel says what the phase has done of its own
 * accord and what it asks of the players, and "End phase" is the one
 * primary action.
 *
 * Hot-seat: every human player plays from this console, choosing whose eyes
 * to look through; a computer player's fleets are fought by the computer at
 * the table and, in this reading, stay where they are between battles.
 */
export interface CampaignScreenProps {
  onMenu: () => void
  /** Open a pending battle on the battle table. */
  onFight: (setup: GameSetup, battle: PendingBattle) => void
  /** Go back to the battle already on the table. */
  onResume: () => void
  /** Open a fought battle's file on the table, to read how it went. */
  onReview: (savedGame: string) => void
  /** Open a landing on the Dirtside table. */
  onFightLanding: (setup: DirtsideSetup, landing: PendingLanding) => void
  /** Go back to the landing already on the Dirtside table. */
  onResumeLanding: () => void
  /** Open a fought landing's battle file on the Dirtside table. */
  onReviewLanding: (savedBattle: string) => void
}

/** A landing's battle as the table opens it: the computer at the helm of any side a computer player holds. */
export function landingTableSetup(landing: PendingLanding, setup: CampaignSetup): DirtsideSetup {
  const computer = (player: string) => !!setup.players.find((p) => p.id === player)?.computer
  const aiSides: SideId[] = [...(computer(landing.attacker) ? (['north'] as const) : []), ...(computer(landing.defender) ? (['south'] as const) : [])]
  return aiSides.length > 0 ? { ...landing.setup, aiSides } : landing.setup
}

interface Draft {
  taskForceId: string
  legs: PlottedMove[]
}

export function CampaignScreen({ onMenu, onFight, onResume, onReview, onFightLanding, onResumeLanding, onReviewLanding }: CampaignScreenProps) {
  const state = useCampaign()
  const setup = currentCampaignSetup()
  const humans = state ? state.players.filter((p) => !setup?.players.find((s) => s.id === p.id)?.computer) : []
  const [chosenViewer, setViewer] = useState<PlayerId | null>(null)
  const viewer = chosenViewer && state?.players.some((p) => p.id === chosenViewer) ? chosenViewer : (humans[0]?.id ?? state?.players[0]?.id ?? '')
  const [selected, setSelected] = useState<Hex | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<{ text: string; seq: number } | null>(null)
  const [seq, setSeq] = useState(0)

  useEffect(() => {
    if (!state || selected) return
    const home = state.players.find((p) => p.id === viewer)?.homeSystemId
    const system = home ? systemById(state, home) : undefined
    if (system) setSelected(system.hex)
  }, [state, viewer, selected])

  if (!state || !setup) return null

  const act = (move: CampaignMove): boolean => {
    const outcome = campaignDispatch(move)
    setSeq((n) => n + 1)
    setNotice(outcome.refused ? { text: outcome.refused, seq } : null)
    return outcome.refused === undefined
  }

  const phases = phasesForTurn(state.turn)
  const last = phases[phases.length - 1] === state.phase
  const openBattles = state.battles.filter((b) => !b.resolved)
  const openLandings = state.landings.filter((l) => !l.resolved)
  const endBlocked = (state.phase === 'combat' && openBattles.length > 0) || (state.phase === 'planetary' && openLandings.length > 0)
  const blockedBy = state.phase === 'combat' ? `${openBattles.length} battle${openBattles.length === 1 ? '' : 's'} still to fight` : `${openLandings.length} landing${openLandings.length === 1 ? '' : 's'} still to fight`
  const draftForce = draft ? taskForceById(state, draft.taskForceId) : undefined

  const selectHex = (hex: Hex) => {
    if (draft && draftForce) {
      const lead = plotLeadOf(state, draftForce)
      const from = draft.legs.length > 0 ? draft.legs[draft.legs.length - 1]!.to : draftForce.hex
      if (hexKey(from) === hexKey(hex)) return
      setDraft({ ...draft, legs: [...draft.legs, { turn: state.turn + lead + draft.legs.length, from, to: hex }] })
      return
    }
    setSelected(hex)
  }

  const fight = (battle: PendingBattle) => onFight(battleSetup(state, battle, setup), battle)
  const autoFight = (battle: PendingBattle) => {
    const saved = autoplay(battleSetup(state, battle, setup))
    act({ kind: 'resolve-battle', battle: battle.id, savedGame: JSON.stringify(saved) })
  }
  const fightLanding = (landing: PendingLanding) => onFightLanding(landingTableSetup(landing, setup), landing)
  const autoLanding = (landing: PendingLanding) => {
    const game = aiPlay(landing.setup, { seed: landing.seed })
    act({ kind: 'resolve-landing', landing: landing.id, savedBattle: JSON.stringify({ version: 1, setup: landing.setup, journal: game.journal }) })
  }
  const landingFile = (landing: PendingLanding): string | null => {
    const moves = JSON.parse(exportCampaign()).moves as Array<{ move: CampaignMove }>
    const entry = [...moves].reverse().find((m) => m.move.kind === 'resolve-landing' && m.move.landing === landing.id)
    return entry && entry.move.kind === 'resolve-landing' ? entry.move.savedBattle : null
  }
  const reviewOf = (battle: PendingBattle): string | null => {
    const moves = currentCampaignSetup() ? JSON.parse(exportCampaign()).moves as Array<{ move: CampaignMove }> : []
    const entry = [...moves].reverse().find((m) => m.move.kind === 'resolve-battle' && m.move.battle === battle.id)
    return entry && entry.move.kind === 'resolve-battle' ? entry.move.savedGame : null
  }

  return (
    <div className="app campaign-screen">
      {notice ? (
        <div className="refusal-notice" role="status" key={notice.seq}>
          <span>{notice.text}</span>
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      ) : null}
      <header className="app-bar">
        <h1>Full Thrust</h1>
        <span className="campaign-kicker">Campaign</span>
        <span className="turn-readout num">TURN {state.turn}</span>
        <span className="phase-readout">
          <b className="num">{phases.indexOf(state.phase) + 1}</b> {CAMPAIGN_PHASE_LABELS[state.phase]}
        </span>
        <span className="spacer" />
        <label>
          Playing as{' '}
          <select value={viewer} onChange={(e) => setViewer(e.target.value)}>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {setup.players.find((s) => s.id === p.id)?.computer ? ' (computer at the table)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button onClick={onMenu}>Menu</button>
        <button onClick={() => download(exportCampaign())}>Save file</button>
        <label className="file-button">
          Load file
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const error = loadCampaign(await file.text())
              if (error) window.alert(error)
              event.target.value = ''
            }}
          />
        </label>
        <button
          className="primary end-phase"
          disabled={endBlocked}
          title={endBlocked ? blockedBy : undefined}
          onClick={() => act({ kind: 'end-phase', player: null })}
        >
          {last ? `End turn ${state.turn}` : `End ${lower(CAMPAIGN_PHASE_LABELS[state.phase])}`}
        </button>
      </header>

      <main className="app-body campaign-body">
        <div className="campaign-chart">
          <CampaignMap
            state={state}
            viewer={viewer}
            selected={selected}
            onSelect={selectHex}
            drafting={draft && draftForce ? { taskForce: draftForce, legs: draft.legs } : null}
          />
          <Legend state={state} />
        </div>

        <aside className="app-side">
          <div className="side-scroll">
            {draft && draftForce ? (
              <div className="panel campaign-drafting">
                <h3>Plotting {draftForce.name}</h3>
                <p className="campaign-dim">
                  Click the map hex by hex: each click is one turn's leg, at most {draftForce.ftlRate} hexes (a cloud costs a whole turn), the first for turn{' '}
                  {state.turn + plotLeadOf(state, draftForce)}.
                </p>
                {draft.legs.length > 0 ? (
                  <ol className="campaign-legs">
                    {draft.legs.map((leg) => (
                      <li key={leg.turn}>
                        Turn {leg.turn}: {hexKey(leg.from)} → {systemAt(state.map, leg.to)?.name ?? hexKey(leg.to)}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <div className="campaign-inline">
                  <button
                    className="primary"
                    disabled={draft.legs.length === 0}
                    onClick={() => {
                      if (act({ kind: 'plot-move', player: viewer, taskForce: draftForce.id, legs: draft.legs })) setDraft(null)
                    }}
                  >
                    Write plot
                  </button>
                  <button disabled={draft.legs.length === 0} onClick={() => setDraft({ ...draft, legs: draft.legs.slice(0, -1) })}>
                    Undo leg
                  </button>
                  <button onClick={() => setDraft(null)}>Cancel</button>
                </div>
              </div>
            ) : null}

            <div className="panel campaign-phase">
              <h3>
                {CAMPAIGN_PHASE_LABELS[state.phase]}
                <span className="campaign-dim"> · turn {state.turn}{state.turn % 4 === 0 ? ', a production turn' : ''}</span>
              </h3>
              <p>{PHASE_GUIDE[state.phase]}</p>
              {state.phase === 'combat' ? (
                <BattleList
                  state={state}
                  viewer={viewer}
                  onTable={battleOnTable()}
                  onFight={fight}
                  onResume={onResume}
                  onAuto={autoFight}
                  onReview={(b) => {
                    const file = reviewOf(b)
                    if (file) onReview(file)
                  }}
                />
              ) : null}
              {state.phase === 'planetary' && state.landings.some((l) => l.id.startsWith(`landing-${state.turn}-`)) ? (
                <LandingList
                  state={state}
                  viewer={viewer}
                  onTable={landingOnTable()}
                  onFight={fightLanding}
                  onResume={onResumeLanding}
                  onAuto={autoLanding}
                  onReview={(l) => {
                    const file = landingFile(l)
                    if (file) onReviewLanding(file)
                  }}
                />
              ) : null}
            </div>

            {selected ? <HexPanel state={state} viewer={viewer} hex={selected} act={act} onPlot={(tf) => setDraft({ taskForceId: tf.id, legs: [] })} /> : null}

            <PlayerPanel state={state} viewer={viewer} act={act} />

            <Holdings state={state} viewer={viewer} onSelect={setSelected} />
          </div>
          <CampaignLog state={state} />
        </aside>
      </main>
    </div>
  )
}

/** This turn's landings: fight each on the Dirtside table, or let the computers fight it. */
function LandingList({
  state,
  viewer,
  onTable,
  onFight,
  onResume,
  onAuto,
  onReview,
}: {
  state: CampaignState
  viewer: PlayerId
  /** The landing already open on the Dirtside table, by id. */
  onTable: string | null
  onFight: (landing: PendingLanding) => void
  onResume: () => void
  onAuto: (landing: PendingLanding) => void
  onReview: (landing: PendingLanding) => void
}) {
  const name = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? id
  return (
    <ul className="campaign-battles">
      {state.landings
        .filter((l) => l.id.startsWith(`landing-${state.turn}-`))
        .map((landing) => {
          const colony = colonyById(state, landing.colonyId)
          const involved = landing.attacker === viewer || landing.defender === viewer
          const teams = Object.keys(landing.landed).length
          const ships = landing.setup.orbital?.[0]?.ships.length ?? 0
          return (
            <li key={landing.id}>
              <span>
                <b>{colony?.name ?? landing.colonyId}</b>: {name(landing.attacker)} lands {teams} Marine team{teams === 1 ? '' : 's'} against {name(landing.defender)}
                {ships > 0 ? <span className="campaign-dim"> · {ships} ship{ships === 1 ? '' : 's'} overhead</span> : null}
              </span>
              {landing.resolved ? (
                <span className="campaign-dim">
                  {' '}
                  · fought{landing.winner ? `, ${name(landing.winner)} had the better of it` : ', the garrison kept the ground'}{' '}
                  <button onClick={() => onReview(landing)}>Review</button>
                </span>
              ) : (
                <span className="campaign-inline">
                  {onTable === landing.id ? (
                    <button className="primary" onClick={onResume}>
                      Back to the table
                    </button>
                  ) : null}
                  <button
                    className={involved && onTable !== landing.id ? 'primary' : undefined}
                    onClick={() => {
                      if (onTable === landing.id && !window.confirm('Start this landing over, discarding the battle on the table?')) return
                      onFight(landing)
                    }}
                  >
                    {onTable === landing.id ? 'Start over' : 'Fight on the Dirtside table'}
                  </button>
                  <button onClick={() => onAuto(landing)}>Let the computers fight it</button>
                </span>
              )}
            </li>
          )
        })}
    </ul>
  )
}

function BattleList({
  state,
  viewer,
  onTable,
  onFight,
  onResume,
  onAuto,
  onReview,
}: {
  state: CampaignState
  viewer: PlayerId
  /** The pending battle already open on the battle table, by id. */
  onTable: string | null
  onFight: (battle: PendingBattle) => void
  onResume: () => void
  onAuto: (battle: PendingBattle) => void
  onReview: (battle: PendingBattle) => void
}) {
  const thisTurn = state.battles.filter((b) => b.id.startsWith(`battle-${state.turn}-`))
  if (thisTurn.length === 0) return <p className="campaign-dim">No fleets met this turn.</p>
  return (
    <ul className="campaign-battles">
      {thisTurn.map((battle) => {
        const system = battle.systemId ? systemById(state, battle.systemId) : undefined
        const names = battle.sides.map((side) => state.players.find((p) => p.id === side.playerId)?.name ?? side.playerId)
        const involved = battle.sides.some((side) => side.playerId === viewer)
        return (
          <li key={battle.id}>
            <span>
              <b>{system?.name ?? hexKey(battle.hex)}</b>: {names[0]}{' '}
              {battle.kind === 'pursuit' ? (battle.pursuer === 'intruder' ? 'pursues' : 'is pursued by') : 'meets'} {names[1]}
            </span>
            {battle.resolved ? (
              <span className="campaign-dim">
                {' '}
                · fought{battle.winner ? `, ${state.players.find((p) => p.id === battle.winner)?.name} had the better of it` : ', a draw'}{' '}
                <button onClick={() => onReview(battle)}>Review</button>
              </span>
            ) : (
              <span className="campaign-inline">
                {onTable === battle.id ? (
                  <button className="primary" onClick={onResume}>
                    Back to the table
                  </button>
                ) : null}
                <button
                  className={involved && onTable !== battle.id ? 'primary' : undefined}
                  onClick={() => {
                    if (onTable === battle.id && !window.confirm('Start this battle over, discarding the one on the table?')) return
                    onFight(battle)
                  }}
                >
                  {onTable === battle.id ? 'Start over' : 'Fight on the table'}
                </button>
                <button onClick={() => onAuto(battle)}>Let the computers fight it</button>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Holdings({ state, viewer, onSelect }: { state: CampaignState; viewer: PlayerId; onSelect: (hex: Hex) => void }) {
  const colonies = state.colonies.filter((c) => c.owner === viewer)
  const forces = state.taskForces.filter((tf) => tf.owner === viewer)
  const whereIs = (tf: TaskForce) => systemAt(state.map, tf.hex)?.name ?? hexKey(tf.hex)
  return (
    <div className="panel campaign-holdings">
      <h3>Colonies</h3>
      {colonies.map((colony) => {
        const system = systemById(state, colony.systemId)!
        return (
          <div key={colony.id} className="panel-row is-pickable" onClick={() => onSelect(system.hex)}>
            <span>
              {colony.name} <span className="campaign-dim">{system.name}</span>
            </span>
            <span className="spacer" />
            <span className="num">{colony.population.loyal + colony.population.subject}M · {colony.stockpileRp} RP</span>
          </div>
        )
      })}
      <h3>Task forces</h3>
      {forces.map((tf) => (
        <div key={tf.id} className="panel-row is-pickable" onClick={() => onSelect(tf.hex)}>
          <span>
            {tf.name} <span className="campaign-dim">{whereIs(tf)}</span>
          </span>
          <span className="spacer" />
          <span className="num">
            {tf.scout ? 'scout' : `${tf.ships.length} ship${tf.ships.length === 1 ? '' : 's'}`}
            {tf.transports > 0 ? ` · ${tf.transports} transports` : ''}
            {tf.plot.length > 0 ? ' · plotted' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function Legend({ state }: { state: CampaignState }) {
  return (
    <div className="campaign-legend">
      {state.players.map((p) => (
        <span key={p.id} style={{ color: playerColour(state, p.id) }}>
          ▲ {p.name}
        </span>
      ))}
      <span className="campaign-dim">◆ command post · ✕ battle · dashed track: plot</span>
    </div>
  )
}

function CampaignLog({ state }: { state: CampaignState }) {
  const entries = state.log.slice(-80)
  return (
    <div className="side-dock campaign-log-dock">
      <div className="side-dock-head">
        <b>Campaign log</b>
        <span className="campaign-dim num">{state.log.length}</span>
      </div>
      <div className="log campaign-log">
        {[...entries].reverse().map((entry) => (
          <div
            key={entry.seq}
            className={`log-entry${entry.kind === 'phase' ? ' is-phase' : entry.kind === 'battle' ? ' is-damage' : entry.kind === 'production' ? ' is-threshold' : ''}`}
          >
            <span className="campaign-dim num">T{entry.turn} </span>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A phase label as it reads mid-sentence: "FTL" keeps its capitals. */
function lower(label: string): string {
  return label.startsWith('FTL') ? label : label.charAt(0).toLowerCase() + label.slice(1)
}

function download(text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'full-thrust-campaign.json'
  link.click()
  URL.revokeObjectURL(url)
}
