import { useState } from 'react'

import type { GameState, SideId } from '../engine/game'
import type { SquadronFormation } from '../engine/movement'
import { dispatch } from './store'

/**
 * 3.7's squadrons, formed and broken in phase 1.
 *
 * *"Squadrons are formed or broken at the start of the game turn, before
 * writing movement orders"*, which is this phase and no other — and forming
 * one is a fleet-level decision rather than a per-ship one, so it belongs in
 * the phase panel rather than beside a single hull's thrust pips.
 *
 * What the panel does not do is validate: the engine refuses a squadron that
 * is the wrong size or that mixes drive types, and the refusal quotes the rule
 * it broke. A picker that hid the illegal combinations would be teaching the
 * player nothing about why they are illegal.
 */

const FORMATIONS: readonly SquadronFormation[] = [
  'line-ahead',
  'line-abreast',
  'wedge',
  'diamond',
  'escort-ring',
]

export function SquadronPanel({ game, side }: { game: GameState; side: SideId | null }) {
  const [picked, setPicked] = useState<string[]>([])
  const [formation, setFormation] = useState<SquadronFormation>('line-ahead')
  const [sharedBase, setSharedBase] = useState(false)

  const mine = game.ships.filter(
    (ship) =>
      !ship.destroyed &&
      !ship.offTable &&
      ship.carriedBy === null &&
      (side === null || ship.side === side),
  )
  if (mine.length < 2) return null

  const formed = new Map<string, string[]>()
  for (const ship of mine) {
    if (ship.squadronId === null) continue
    formed.set(ship.squadronId, [...(formed.get(ship.squadronId) ?? []), ship.name])
  }

  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id]))

  return (
    <div className="panel-row squadron-builder" style={{ flexWrap: 'wrap' }}>
      <span>Squadrons</span>
      <span className="spacer" />
      <select
        aria-label="Formation"
        value={formation}
        onChange={(event) => setFormation(event.target.value as SquadronFormation)}
      >
        {FORMATIONS.map((option) => (
          <option key={option} value={option}>
            {option.replace('-', ' ')}
          </option>
        ))}
      </select>
      <label title="3.7: models on a single stand write one order and may not be split up">
        <input
          type="checkbox"
          checked={sharedBase}
          onChange={(event) => setSharedBase(event.target.checked)}
        />{' '}
        one stand
      </label>
      <button
        disabled={picked.length < 2}
        onClick={() => {
          dispatch({
            type: 'form-squadron',
            squadronId: `sq-${game.turn}-${picked[0]}`,
            formation,
            shipIds: picked,
            sharedBase,
          })
          setPicked([])
        }}
      >
        Form up
      </button>

      <div className="ssd-systems" style={{ width: '100%' }}>
        {mine.map((ship) => (
          <button
            key={ship.id}
            className={`system-chip${picked.includes(ship.id) ? ' weapon-fire' : ''}`}
            title={
              ship.squadronId === null
                ? 'Pick it for a squadron'
                : `Already in ${ship.squadronId} (3.7)`
            }
            onClick={() => toggle(ship.id)}
          >
            {ship.name}
            {ship.squadronId !== null ? <span className="num">✓</span> : null}
          </button>
        ))}
      </div>

      {[...formed.entries()].map(([id, names]) => (
        <div className="panel-row" key={id} style={{ width: '100%' }}>
          <span style={{ color: 'var(--ink-dim)' }}>{names.join(', ')}</span>
          <span className="spacer" />
          <button onClick={() => dispatch({ type: 'break-squadron', squadronId: id })}>Break</button>
        </div>
      ))}
    </div>
  )
}
