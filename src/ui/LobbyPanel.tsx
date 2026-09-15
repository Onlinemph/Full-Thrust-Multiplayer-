import { useState } from 'react'

import { scenarioById } from '../data/scenarios'
import { designById } from '../data/ships'
import { designCost } from '../data/fleetList'
import { hangUp, useNet } from './link'
import { FleetPicker } from './FleetPicker'
import { SetupForm } from './SetupPanel'
import {
  currentMatchRole,
  currentMatchSide,
  currentSetup,
  lobbyAllReady,
  lobbyPick,
  lobbySetup,
  setMatchSide,
  startMatch,
  useGame,
  useLobby,
} from './store'

/**
 * The lobby: a match before its battle.
 *
 * Two players at a real table settle the optional rules and lay out their
 * fleets before the first order is written, and that is the shape of this.
 * The host has the setup form and every change goes to the guest as it is
 * made; the guest reads the same form and cannot press anything on it. Each
 * console has the fleet picker for its own side and a Ready button, and the
 * host starts the battle once both have pressed it. A change to the rules
 * takes everyone's Ready back: what they agreed to is no longer on the table.
 */
export function LobbyPanel() {
  const game = useGame()
  const lobby = useLobby()
  const net = useNet()
  const setup = currentSetup()
  const role = currentMatchRole()
  const mySide = currentMatchSide()
  const scenario = scenarioById(setup.scenarioId)
  const [armed, setArmed] = useState(false)

  if (lobby === null) return null
  const host = role === 'host'
  const sides = scenario?.sides ?? game.sides.map((s) => ({ id: s.id, name: s.name }))
  const allReady = lobbyAllReady()
  const notReady = sides.filter((s) => lobby.picks[s.id]?.ready !== true).map((s) => s.name)

  return (
    <div className="modal-backdrop">
      <div className="modal is-wide lobby-modal" onClick={(event) => event.stopPropagation()}>
        <div className="lobby-head">
          <h2 style={{ margin: 0 }}>Match lobby</h2>
          {net.code ? (
            <div className="match-code" aria-label="Match code">
              <span>Code</span>
              <b className="num">{net.code}</b>
            </div>
          ) : null}
          <span style={{ color: 'var(--ink-dim)' }}>
            {net.phase !== 'connected'
              ? 'Opening the channel…'
              : net.peers > 1
                ? `${net.peers} consoles at the table`
                : 'Waiting for the other player to join'}
          </span>
          <span className="spacer" />
          <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
            You command
            <select
              aria-label="Your side"
              value={mySide ?? ''}
              onChange={(event) => setMatchSide(event.target.value || null)}
            >
              {sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => hangUp(null)}>Leave the match</button>
        </div>

        <div className="lobby">
          <div className="lobby-rules">
            <h3 style={{ marginTop: 0 }}>{host ? 'The rules' : 'The rules, as the host set them'}</h3>
            <p style={{ color: 'var(--ink-dim)' }}>
              {host
                ? 'Every change here reaches the other console as you make it, and takes their Ready back.'
                : 'The host settles the scenario and the optional rules. Ask if you want one changed.'}
            </p>
            <SetupForm
              draft={setup}
              setDraft={(update) => lobbySetup(update(currentSetup()))}
              readOnly={!host}
              showFleets={false}
              showAi={false}
            />
          </div>

          <div className="lobby-sides">
            {sides.map((side) => {
              const pick = lobby.picks[side.id]
              const mine = side.id === mySide
              const ready = pick?.ready === true
              const ids = pick?.forceIds ?? null
              const named =
                ids?.map((id) => ({ id, design: designById(id) })) ?? null
              return (
                <section key={side.id} className={`lobby-side${mine ? ' is-mine' : ''}`}>
                  <h3>
                    <span style={{ color: `var(--side-${side.id})` }}>{side.name}</span>
                    <span className="rule-detail">{mine ? 'you' : 'the other console'}</span>
                    <span className="spacer" />
                    <span className={ready ? 'lobby-ready' : 'lobby-waiting'}>
                      {ready ? 'Ready' : 'Not ready'}
                    </span>
                  </h3>
                  {mine ? (
                    <>
                      <FleetPicker
                        scenarioId={setup.scenarioId}
                        onlySide={side.id}
                        forces={ids === null ? {} : { [side.id]: ids }}
                        techBases={setup.techBases ?? {}}
                        customTechBases={setup.customTechBases ?? {}}
                        cpv={Boolean(setup.cpv)}
                        bannedSystems={setup.bannedSystems}
                        factions={setup.factions ?? {}}
                        clans={setup.clans ?? {}}
                        onChange={(forces) =>
                          lobbyPick(side.id, { forceIds: forces[side.id] ?? [], ready: false })
                        }
                      />
                      <div className="panel-row">
                        <span style={{ color: 'var(--ink-dim)' }}>
                          {ready
                            ? 'Waiting on the other side, and on the host to start.'
                            : 'Happy with the fleet and the rules? Say so.'}
                        </span>
                        <span className="spacer" />
                        <button
                          className={ready ? undefined : 'primary'}
                          onClick={() => lobbyPick(side.id, { forceIds: ids, ready: !ready })}
                        >
                          {ready ? 'Not ready after all' : 'Ready'}
                        </button>
                      </div>
                    </>
                  ) : named === null ? (
                    <p className="rule-detail">
                      The scenario&rsquo;s own force
                      {scenario
                        ? `: ${scenario.sides.find((s) => s.id === side.id)?.force.length ?? 0} ships`
                        : ''}
                      .
                    </p>
                  ) : (
                    <div className="lobby-picked">
                      {named.length === 0 ? <span className="rule-detail">No ships picked yet.</span> : null}
                      {named.map(({ id, design }, index) => (
                        <span key={`${id}-${index}`} className="picked">
                          {design?.name ?? id}{' '}
                          <span className="num">{design ? designCost(design, Boolean(setup.cpv)) : '?'}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>

        <div className="panel-row">
          {host ? (
            <>
              <span style={{ color: allReady ? 'var(--screens)' : 'var(--ink-dim)' }}>
                {allReady
                  ? 'Both sides are ready.'
                  : `Still to say ready: ${notReady.join(', ')}.`}
              </span>
              <span className="spacer" />
              <button
                className="primary"
                title={
                  allReady
                    ? 'Build the battle from these fleets and rules, at turn 1'
                    : armed
                      ? 'Start without waiting for them'
                      : 'Both sides have not said ready; click twice to start anyway'
                }
                onClick={() => {
                  if (allReady || armed) {
                    startMatch()
                    setArmed(false)
                  } else {
                    setArmed(true)
                  }
                }}
              >
                {allReady ? 'Start battle' : armed ? 'Start anyway' : 'Start battle'}
              </button>
            </>
          ) : (
            <span style={{ color: 'var(--ink-dim)' }}>
              The host starts the battle once both sides are ready.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
