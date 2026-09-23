import { inRearArea } from '../../../dirtside/table/game'
import type { GameState, SideId } from '../../../dirtside/table/types'
import { CONFIDENCE_LABELS } from './words'

/**
 * The end of the battle, over the table: who won and why, the objective
 * markers turned face up, what each side lost, and what to do next.
 */
export interface ResultPanelProps {
  state: GameState
  onDismiss: () => void
  /** The one way on: back to the campaign, or a new skirmish. */
  next: { label: string; onClick: () => void }
}

export function ResultPanel({ state, onDismiss, next }: ResultPanelProps) {
  const result = state.result!
  const sides: SideId[] = ['north', 'south']
  const name = (s: SideId) => state.sides[s].name
  const total = Math.max(1, result.values.north + result.values.south)
  const objectives = state.setup.table.objectives
  const where = (p: { x: number; y: number }) => (inRearArea(state.setup, 'north', p) ? `${name('north')} rear area` : inRearArea(state.setup, 'south', p) ? `${name('south')} rear area` : 'the middle of the table')
  const losses = (s: SideId) => {
    const els = Object.values(state.elements).filter((e) => e.sideId === s)
    const units = Object.values(state.units).filter((u) => u.sideId === s)
    return {
      out: els.filter((e) => e.destroyed).length,
      of: els.length,
      shaken: units.filter((u) => u.confidence === 'BR' || u.confidence === 'RO').map((u) => `${u.name} (${CONFIDENCE_LABELS[u.confidence].toLowerCase()})`),
    }
  }
  return (
    <div className="dst-result-veil">
      <section className={`dst-result is-${result.winner}`} role="dialog" aria-label="The battle is over">
        <p className="dst-result-kicker">The battle is over · {state.turn} turn{state.turn === 1 ? '' : 's'} played</p>
        <h2 className="dst-result-head">{result.winner === 'draw' ? 'A draw' : `${name(result.winner)} wins`}</h2>
        <p className="dst-result-why">
          {result.reason.charAt(0).toUpperCase() + result.reason.slice(1)}. {name('north')} holds objectives worth {result.values.north}, {name('south')} {result.values.south}.
        </p>
        <div className="dst-race" aria-hidden="true">
          <i className="is-north" style={{ width: `${(result.values.north / total) * 100}%` }} />
          <i className="is-south" style={{ width: `${(result.values.south / total) * 100}%` }} />
        </div>
        <div className="dst-result-grid">
          <div>
            <h4>Objective markers</h4>
            <ul className="dst-result-objs">
              {objectives.map((o) => {
                const held = state.objectives[o.id]?.heldBy ?? null
                return (
                  <li key={o.id} className={held ? `is-${held}` : undefined}>
                    <b className="num">{o.value}</b>
                    <span>{held ? `held by ${name(held)}` : 'not held'}</span>
                    <span className="campaign-dim">in {where(o.position)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <h4>Losses</h4>
            {sides.map((s) => {
              const l = losses(s)
              return (
                <p key={s} className={`dst-result-loss is-${s}`}>
                  <b>{name(s)}</b>: {l.out} of {l.of} elements knocked out
                  {l.shaken.length ? `; ${l.shaken.join(', ')}` : ''}
                </p>
              )
            })}
          </div>
        </div>
        <div className="dst-result-acts">
          <button onClick={onDismiss}>Look at the table</button>
          <button className="primary" onClick={next.onClick}>
            {next.label}
          </button>
        </div>
      </section>
    </div>
  )
}
