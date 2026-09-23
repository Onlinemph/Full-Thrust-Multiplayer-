import type { TableShotPlan } from '../../../dirtside/table/tableFire'
import type { GameState, Refusal, ShotOrder, UnitState } from '../../../dirtside/table/types'
import { oddsOf, pct, planLine, weaponsOf } from './words'

/**
 * The volley being built: every target is named before any shot is rolled
 * (p. 28), so the shots queue here with their odds, and the elements still
 * without one are listed apart from them.
 */

export interface VolleyProps {
  state: GameState
  unit: UnitState
  code: string
  opportunity: boolean
  volley: ShotOrder[]
  planFor: (order: ShotOrder) => TableShotPlan | Refusal
  /** Elements of the unit that could still take a shot, and why the others cannot. */
  pending: Array<{ id: string; name: string; why: string }>
  onRemove: (elementId: string) => void
  onFire: () => void
  onClear: () => void
}

export function VolleyPanel(props: VolleyProps) {
  const { state, volley } = props
  let expected = 0
  return (
    <div className={`panel dst-volley${props.opportunity ? ' is-opportunity' : ''}`}>
      <h3>
        {props.opportunity ? 'Fire back' : 'Volley'}{' '}
        <span className="campaign-dim">
          {props.code} {props.unit.name}
        </span>
      </h3>
      {volley.length === 0 ? <p className="dst-card-note">No shots yet: pick a weapon on an element, then click a lit enemy.</p> : null}
      <ul className="dst-shots">
        {volley.map((s) => {
          const plan = props.planFor(s)
          const firer = state.elements[s.elementId]!
          const target = state.elements[s.targetId]!
          const weapon = weaponsOf(firer).find((w) => w.choice.kind === s.weapon.kind && (s.weapon.kind !== 'direct' || (w.choice.kind === 'direct' && w.choice.weaponId === s.weapon.weaponId)))
          const odds = plan.ok ? oddsOf(plan) : null
          if (odds) expected += odds.kill
          return (
            <li key={s.elementId}>
              <div className="dst-shot-main">
                <span className="dst-shot-who">
                  <b>{firer.name}</b> → {target.name}
                </span>
                {odds ? (
                  <span className="dst-oddsbar" title={odds.long} aria-hidden="true">
                    <i className="is-kill" style={{ width: pct(odds.kill) }} />
                    <i className="is-dmg" style={{ width: pct(odds.damaged) }} />
                  </span>
                ) : null}
                <span className="dst-shot-odds num">{odds ? odds.short : 'refused'}</span>
                <button className="dst-x" onClick={() => props.onRemove(s.elementId)} title="Take this shot out of the volley" aria-label={`Take ${firer.name}'s shot out`}>
                  ×
                </button>
              </div>
              <div className="dst-shot-line">{plan.ok ? `${weapon?.label ?? ''} · ${planLine(plan)}` : `${plan.reason} (${plan.page})`}</div>
            </li>
          )
        })}
      </ul>
      {props.pending.length > 0 ? (
        <p className="dst-volley-pending">
          {props.pending.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? ' · ' : ''}
              {p.name}: {p.why}
            </span>
          ))}
        </p>
      ) : null}
      <div className="dst-volley-foot">
        <span className="campaign-dim">
          {volley.length} shot{volley.length === 1 ? '' : 's'}
          {volley.length > 0 ? ` · about ${expected.toFixed(1)} kill${Math.abs(expected - 1) < 0.05 ? '' : 's'} expected` : ''}
        </span>
        <span className="spacer" />
        <button className={volley.length > 0 ? 'primary' : undefined} onClick={props.onFire} disabled={volley.length === 0} aria-keyshortcuts="F">
          {props.opportunity ? 'Fire!' : 'Fire the volley'}
        </button>
        <button onClick={props.onClear}>Clear</button>
      </div>
    </div>
  )
}
