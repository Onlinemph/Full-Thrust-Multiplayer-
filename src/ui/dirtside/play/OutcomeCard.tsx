import type { SideId } from '../../../dirtside/table/types'
import type { PlayLine, RecapGroup } from './journal'

/**
 * What just happened: the latest go in full — each shot with its dice, the
 * chits it drew and a stamp for the verdict; morale and objectives as
 * callouts — and the goes before it as one line each.
 */
export function OutcomeCard({ groups, sideName, onDismiss }: { groups: RecapGroup[]; sideName: (s: SideId) => string; onDismiss: () => void }) {
  if (groups.length === 0) return null
  const latest = groups[groups.length - 1]!
  const earlier = groups.slice(0, -1).reverse()
  return (
    <div className={`panel dst-outcome${latest.side ? ` is-${latest.side}` : ''}`} aria-live="polite">
      <header className="dst-outcome-head">
        <span className="dst-outcome-kicker">Just now</span>
        <b className="dst-outcome-title">{latest.title}</b>
        {latest.side ? <span className="dst-outcome-side">{sideName(latest.side)}</span> : null}
        <button className="dst-x" onClick={onDismiss} title="Hide until the next thing happens" aria-label="Hide what just happened">
          ×
        </button>
      </header>
      <ul className="dst-outcome-lines">
        {latest.lines.map((l, i) => (
          <OutcomeLine key={i} line={l} />
        ))}
      </ul>
      {earlier.length > 0 ? (
        <ul className="dst-outcome-earlier">
          {earlier.map((g) => (
            <li key={g.key} className={g.side ? `is-${g.side}` : undefined}>
              {g.headline}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function OutcomeLine({ line }: { line: PlayLine }) {
  return (
    <li className={`is-${line.tone}`}>
      <span className="dst-outcome-text">{line.text}</span>
      {line.stamp ? <span className={`dst-stamp is-${line.tone}`}>{line.stamp}</span> : null}
      {line.dice || line.chits ? (
        <span className="dst-outcome-detail">
          {line.dice ? <span className="dst-dice num">{line.dice}</span> : null}
          {line.chits?.map((c, i) => (
            <span key={i} className={`dst-chit is-${c.colour}`}>
              {c.label}
            </span>
          ))}
        </span>
      ) : null}
    </li>
  )
}
