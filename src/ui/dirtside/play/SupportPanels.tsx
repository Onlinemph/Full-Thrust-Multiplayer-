import { LANDING_CLEARANCE } from '../../../dirtside/table/game'
import { OFF_TABLE_CALL, STRIKE_CHITS, STRIKE_RADIUS, attacksLeft, callDie, nextOverhead, orbitalShips, overhead } from '../../../dirtside/table/orbital'
import type { ElementState, GameState, OrbitalAttack, Point, SideId, UnitState } from '../../../dirtside/table/types'
import { pct } from './words'

/**
 * Help from above: ships in orbit that can be called on, and interface
 * craft waiting to come down. Both in plain words, with the call buttons
 * shown greyed and explained when the wrong element is selected rather
 * than hidden.
 */

export const ATTACK_WORDS: Record<OrbitalAttack, { call: string; noun: string }> = {
  sheaf: { call: 'Call a barrage', noun: 'barrage' },
  pbm: { call: 'Call heavy bombardment', noun: 'heavy bombardment' },
}

export interface OrbitPanelProps {
  state: GameState
  /** The side whose activation it is on this console, if a human's. */
  acting: SideId | null
  caller: ElementState | null
  callerUnit: UnitState | null
  /** Why no Call button works now, when the acting side's ships are overhead. */
  cannotCall: string | null
  armed: { shipId: string; attack: OrbitalAttack } | null
  onCall: (shipId: string, attack: OrbitalAttack) => void
  onCancel: () => void
}

export function OrbitPanel(props: OrbitPanelProps) {
  const { state } = props
  const sides = (['north', 'south'] as SideId[]).filter((s) => orbitalShips(state, s).length > 0)
  return (
    <div className="panel dst-orbit">
      <h3 className="dst-card-title">
        Orbital fire support <span className="rule-ref" title="Dirtside p. 38–40, More Thrust p. 17">p. 38</span>
      </h3>
      {sides.map((s) => {
        const now = state.phase !== 'deployment' && overhead(state, s)
        const next = nextOverhead(state, s, Math.max(1, state.turn + (now ? 1 : 0)))
        const mine = props.acting === s
        return (
          <div key={s} className={`dst-orbit-side is-${s}`}>
            <p className="dst-orbit-when">
              <b>{state.sides[s].name}</b>: {now ? <span className="is-now">overhead now</span> : 'not overhead'}
              {next ? ` · ${now ? 'next pass' : 'over the table'} on turn ${next}` : ''}
            </p>
            <ul className="dst-ships">
              {orbitalShips(state, s).map((ship) => {
                const left = attacksLeft(state, ship)
                const ready = [ship.sheafs > 0 ? `${left.sheaf} of ${ship.sheafs} barrage${ship.sheafs === 1 ? '' : 's'}` : '', ship.ortillery > 0 ? `${left.pbm} of ${ship.ortillery} heavy bombardment${ship.ortillery === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
                return (
                  <li key={ship.id}>
                    <span className="dst-ship-name">{ship.name}</span>
                    <span className="campaign-dim">{ready} ready</span>
                    {mine && now
                      ? (['sheaf', 'pbm'] as OrbitalAttack[])
                          .filter((a) => left[a] > 0)
                          .map((a) => {
                            const die = props.caller && props.callerUnit ? callDie(props.caller, props.callerUnit.leadership) : null
                            const chance = die ? Math.max(0, (die - OFF_TABLE_CALL + 1) / die) : null
                            const on = props.armed?.shipId === ship.id && props.armed.attack === a
                            return (
                              <button
                                key={a}
                                className={on ? 'is-on' : undefined}
                                disabled={!props.caller}
                                title={
                                  props.caller
                                    ? `${STRIKE_RADIUS[a] * 2}″ across, ${STRIKE_CHITS[a]} chits on every element in it; ${props.caller.name} calls on a D${die}: answers on ${OFF_TABLE_CALL}+ (${pct(chance ?? 0)}). It lands after the enemy's next activation and may stray up to 7″.`
                                    : (props.cannotCall ?? '')
                                }
                                onClick={() => (on ? props.onCancel() : props.onCall(ship.id, a))}
                              >
                                {ATTACK_WORDS[a].call}
                              </button>
                            )
                          })
                      : null}
                  </li>
                )
              })}
            </ul>
            {mine && now && !props.caller && props.cannotCall ? <p className="dst-card-note">{props.cannotCall}</p> : null}
          </div>
        )
      })}
      {state.orbit && state.orbit.strikes.length > 0 ? (
        <p className="dst-card-note is-warn">
          {state.orbit.strikes.length} strike{state.orbit.strikes.length === 1 ? '' : 's'} on the way: {state.orbit.strikes.length === 1 ? 'it lands' : 'they land'} after the enemy's next activation.
        </p>
      ) : null}
    </div>
  )
}

export interface CraftPanelProps {
  state: GameState
  /** The human side that may bring craft down or unload now, if any. */
  acting: SideId | null
  landings: Array<{ craftId: string; at: Point }>
  placing: string | null
  onPlace: (craftId: string) => void
  onCancelPlace: () => void
  onUnplace: (craftId: string) => void
  onBringDown: () => void
  onUnload: (craftId: string) => void
}

export function CraftPanel(props: CraftPanelProps) {
  const { state } = props
  const craft = state.setup.craft ?? []
  const n = props.landings.length
  return (
    <div className="panel dst-craft">
      <h3 className="dst-card-title">
        Interface craft <span className="rule-ref">p. 43</span>
      </h3>
      <ul className="dst-ships">
        {craft.map((c) => {
          const record = state.craft[c.id]!
          const planned = props.landings.find((l) => l.craftId === c.id)
          const units = c.unitIds.map((id) => state.units[id]?.name).filter(Boolean).join(', ')
          const mine = props.acting === c.side
          const canUnload = mine && c.kind === 'dropship' && record.status === 'landed' && (record.landedAt ?? Infinity) < state.activationCount
          const status = record.status === 'aloft' ? (planned ? 'landing spot chosen' : props.placing === c.id ? 'click the map where it lands' : 'in orbit') : record.status === 'landed' ? 'on the ground, loaded' : record.status === 'lost' ? 'shot down' : 'unloaded'
          return (
            <li key={c.id} className={`is-${c.side}${props.placing === c.id ? ' is-placing' : ''}`}>
              <span className="dst-craft-line">
                <span className="dst-ship-name">{c.name}</span>
                <span className="campaign-dim">
                  {c.kind === 'dropship' ? 'dropship' : 'assault lander'} · {status}
                </span>
              </span>
              <span className="dst-craft-acts">
                {mine && record.status === 'aloft' ? (
                  <button className={props.placing === c.id ? 'is-on' : undefined} onClick={() => props.onPlace(c.id)} title={`Then click the map: at least ${LANDING_CLEARANCE}″ from any enemy that can see the spot`}>
                    {planned ? 'Move spot' : 'Place'}
                  </button>
                ) : null}
                {props.placing === c.id ? <button onClick={props.onCancelPlace}>Cancel</button> : null}
                {planned ? (
                  <button className="dst-x" onClick={() => props.onUnplace(c.id)} title="Keep it in orbit" aria-label={`Keep ${c.name} in orbit`}>
                    ×
                  </button>
                ) : null}
                {canUnload ? <button onClick={() => props.onUnload(c.id)}>Unload</button> : null}
              </span>
              <span className="dst-craft-units">carries {units || 'nothing'}</span>
            </li>
          )
        })}
      </ul>
      {n > 0 ? (
        <button className="primary dst-wide" onClick={props.onBringDown}>
          Bring {n === 1 ? 'it' : n === 2 ? 'both' : `all ${n}`} down (uses this activation)
        </button>
      ) : null}
    </div>
  )
}
