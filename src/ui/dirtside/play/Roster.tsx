import { CONFIDENCE_LEVELS_INDEX } from '../../../dirtside/table/confidence'
import { elementsOf, functional, unactivatedUnits } from '../../../dirtside/table/game'
import { unitKind } from '../../../dirtside/table/tableFire'
import type { GameState, SideId, UnitState } from '../../../dirtside/table/types'
import { CONFIDENCE_LABELS, CONFIDENCE_TONE, commandWords, restrictionWords } from './words'

/**
 * A side's units, one row each: the unit's code (also on its counters),
 * its name, how many elements still fight, its command marker in words and
 * its morale on a five-notch meter. The row's buttons are the things the
 * rules allow this unit right now; the screen decides which, by asking.
 */

export interface RosterAction {
  label: string
  onClick: () => void
  title?: string
  on?: boolean
}

export interface ForceProps {
  state: GameState
  side: SideId
  codes: Record<string, string>
  collapsed: boolean
  onToggle: () => void
  activeUnitId: string | null
  /** The unit answering an opportunity window. */
  firingUnitId: string | null
  /** Units that may answer the window now; the others are dimmed while it is open. */
  answering: Set<string> | null
  selectedUnitId: string | null
  hoverUnitId: string | null
  onHoverUnit: (id: string | null) => void
  onPick: (unit: UnitState) => void
  onDoublePick: (unit: UnitState) => void
  actionsFor: (unit: UnitState) => RosterAction[]
  /** Objective value the side holds. */
  holds: number
}

const MANY = 8

export function ForcePanel(props: ForceProps) {
  const { state, side, collapsed } = props
  const units = Object.values(state.units).filter((u) => u.sideId === side)
  const toAct = unactivatedUnits(state, side).length
  const name = state.sides[side].name
  const over = !!state.result
  const flags = [state.sides[side].done && !over ? 'done for this turn' : '', state.sides[side].commandLost ? 'command lost' : ''].filter(Boolean)
  const lost = Object.values(state.elements).filter((e) => e.sideId === side && e.destroyed).length
  const summary = `${units.length} unit${units.length === 1 ? '' : 's'} · ${over ? `${lost} element${lost === 1 ? '' : 's'} lost` : `${toAct} still to act`}${flags.length ? ` · ${flags.join(' · ')}` : ''}`

  if (collapsed) {
    return (
      <div className={`panel dst-force is-${side} is-collapsed`}>
        <button className="dst-force-fold" onClick={props.onToggle} aria-expanded={false}>
          <span className="dst-force-name">{name}</span>
          <span className="dst-force-sum" title={summary}>{summary}</span>
          <span className="dst-force-holds" title="Objective value held">
            ◆ <b className="num">{props.holds}</b>
          </span>
          <span className="dst-fold-mark" aria-hidden="true">▸</span>
        </button>
      </div>
    )
  }

  // A long list (a landing's twenty platoons) folds the units that are spent for the turn.
  const spent = (u: UnitState) => u.id !== props.activeUnitId && (u.activated || elementsOf(state, u).every((e) => e.destroyed))
  const fold = units.length > MANY && units.filter(spent).length >= 3
  const shown = fold ? units.filter((u) => !spent(u)) : units
  const folded = fold ? units.filter(spent) : []

  return (
    <div className={`panel dst-force is-${side}`}>
      <button className="dst-force-fold" onClick={props.onToggle} aria-expanded={true}>
        <span className="dst-force-name">{name}</span>
        <span className="dst-force-sum" title={summary}>{summary}</span>
        <span className="dst-force-holds" title="Objective value held">
          ◆ <b className="num">{props.holds}</b>
        </span>
        <span className="dst-fold-mark" aria-hidden="true">▾</span>
      </button>
      <ul className="dst-units">
        {shown.map((u) => (
          <UnitRow key={u.id} {...props} unit={u} />
        ))}
      </ul>
      {folded.length > 0 ? (
        <details className="dst-spent">
          <summary>
            {folded.length} unit{folded.length === 1 ? '' : 's'} done for this turn or out of action
          </summary>
          <ul className="dst-units">
            {folded.map((u) => (
              <UnitRow key={u.id} {...props} unit={u} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function UnitRow(props: ForceProps & { unit: UnitState }) {
  const { state, unit: u, codes } = props
  const elements = elementsOf(state, u)
  const alive = elements.filter(functional).length
  const aboard = elements.some((e) => e.aboard && !e.destroyed)
  const gone = alive === 0 && !aboard
  const active = props.activeUnitId === u.id
  const command = commandWords(u)
  const kind = unitKind(state, u)
  const tone = CONFIDENCE_TONE[u.confidence]
  const notches = 5 - CONFIDENCE_LEVELS_INDEX[u.confidence]
  const status = gone ? 'gone' : active ? 'active' : u.activated ? 'done' : aboard && alive === 0 ? 'aboard' : 'ready'
  const glyph = { gone: '✕', active: '▶', done: '✓', aboard: '⬡', ready: '●' }[status]
  // Never the word "activate" in this button's name: the drives find the row's Activate button by it.
  const statusTitle = { gone: 'Out of action', active: 'Acting now', done: 'Has had its go this turn', aboard: 'Aboard a craft in orbit', ready: 'Still to act this turn' }[status]
  const answering = props.answering
  const cls = [
    'dst-unit',
    `is-${status}`,
    active ? 'is-active' : '',
    props.firingUnitId === u.id ? 'is-firing' : '',
    answering ? (answering.has(u.id) ? 'can-answer' : 'is-muted') : '',
    props.hoverUnitId === u.id ? 'is-hover' : '',
    props.selectedUnitId === u.id ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const actions = props.actionsFor(u)
  const flags: Array<{ label: string; title: string; tone: string }> = []
  if (u.underFire) flags.push({ label: 'under fire', title: 'Must pass a test to move this activation; infantry shoot with a smaller die (p. 24).', tone: 'warn' })
  if (u.panic) flags.push({ label: 'panic', title: 'Frozen by first contact: its next activation only recovers (p. 23).', tone: 'bad' })
  if (u.evasive) flags.push({ label: 'evading', title: 'Harder to hit until its next activation; may not fire (p. 27).', tone: 'info' })
  if (aboard) flags.push({ label: 'aboard a craft', title: 'Off the table until its craft lands and unloads (p. 43).', tone: 'info' })
  return (
    <li className={cls} onMouseEnter={() => props.onHoverUnit(u.id)} onMouseLeave={() => props.onHoverUnit(null)}>
      <button className="dst-unit-name" onClick={() => props.onPick(u)} onDoubleClick={() => props.onDoublePick(u)} title={`${statusTitle}. ${command.title}`}>
        <span className={`dst-unit-glyph is-${status}`} aria-hidden="true">
          {glyph}
        </span>
        <span className="dst-code">{codes[u.id]}</span>
        <span className="dst-unit-main">
          <span className="dst-unit-line">
            <span className="dst-unit-title">{u.name}</span>
            {u.commandUnit ? (
              <span className="dst-hq" title="The force's command unit: it rallies the others; if it is lost, every unit loses heart (p. 24)">
                HQ
              </span>
            ) : null}
            {flags.map((f) => (
              <span key={f.label} className={`dst-flag is-${f.tone}`} title={f.title}>
                {f.label}
              </span>
            ))}
          </span>
          <span className="dst-unit-words">
            {command.long.split(' · ').slice(0, 2).join(' · ')}
          </span>
        </span>
        <span className="dst-unit-side">
          <span className="dst-pips" title={`${alive} of ${u.strength} elements still fighting`} aria-label={`${alive} of ${u.strength} elements`}>
            {elements.map((e) => (
              <i key={e.id} className={e.destroyed ? 'is-out' : e.aboard ? 'is-aboard' : e.damaged || e.immobilised || e.systemsDown ? 'is-hurt' : undefined} />
            ))}
          </span>
          <span className={`dst-morale is-${tone}`} title={restrictionWords(u.confidence, kind)}>
            <span className="dst-morale-word">{CONFIDENCE_LABELS[u.confidence]}</span>
            <span className="dst-meter" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} className={i < notches ? 'is-on' : undefined} />
              ))}
            </span>
          </span>
        </span>
      </button>
      {actions.length > 0 ? (
        <span className="dst-unit-acts">
          {actions.map((a) => (
            <button key={a.label} className={a.on ? 'is-on' : undefined} onClick={a.onClick} title={a.title}>
              {a.label}
            </button>
          ))}
        </span>
      ) : null}
    </li>
  )
}
