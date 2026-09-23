import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { LogEntry, SideId } from '../../../dirtside/table/types'
import { LOG_ICON, groupLog } from './journal'

/**
 * The battle's log, for reading: by turn, and within a turn by activation,
 * with an icon for what each line is about, the side's colour down its edge,
 * the lines that matter picked out, and the rule pages behind a switch.
 * Every sentence is kept whole in the page, folded or not.
 */

/** Routine lines the block header already says: dimmed, never dropped. */
const QUIET = / activates( \(under fire\))?\.$| ends its activation;|command marker is inverted/

const PAGES_KEY = 'ftpc.dirtside.logPages'

function readPages(): boolean {
  try {
    return localStorage.getItem(PAGES_KEY) === '1'
  } catch {
    return false
  }
}

export const LogDock = memo(function LogDock({ log, northName, southName }: { log: readonly LogEntry[]; northName: string; southName: string }) {
  const sideName = (s: SideId) => (s === 'north' ? northName : southName)
  const [folded, setFolded] = useState(false)
  const [pages, setPages] = useState(readPages)
  const turns = useMemo(() => groupLog(log), [log])
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [log.length, folded])

  useEffect(() => {
    try {
      localStorage.setItem(PAGES_KEY, pages ? '1' : '0')
    } catch {
      // A private window: the switch lasts for this visit.
    }
  }, [pages])

  const latest = log[log.length - 1]
  return (
    <div className={`side-dock dst-log-dock${folded ? ' is-folded' : ''}`}>
      <div className="side-dock-head">
        <b className="dst-dock-title">Log</b>
        <span className="campaign-dim num">{log.length}</span>
        <span className="spacer" />
        <button className={`side-dock-toggle${pages ? ' is-on' : ''}`} onClick={() => setPages((p) => !p)} title="Show the rulebook page beside every line" aria-pressed={pages}>
          Rule pages
        </button>
        <button className="side-dock-toggle" onClick={() => setFolded((f) => !f)} aria-expanded={!folded}>
          {folded ? 'Show ▴' : 'Fold ▾'}
        </button>
      </div>
      {folded && latest ? <p className={`dst-log-latest${latest.side ? ` is-${latest.side}` : ''}`}>{latest.text}</p> : null}
      <div
        ref={scroller}
        className={`dst-log${pages ? ' show-pages' : ''}`}
        hidden={folded}
        onScroll={(e) => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {turns.map((t, ti) => (
          <details key={`${t.turn}-${ti}`} className="dst-log-turn" open={ti >= turns.length - 2}>
            <summary>{t.turn === 0 ? 'Set-up' : `Turn ${t.turn}`}</summary>
            {t.blocks.map((b, bi) => (
              <div key={bi} className={`dst-log-block${b.side ? ` is-${b.side}` : ''}${b.unit ? ' is-activation' : ''}`}>
                {b.unit ? (
                  <div className="dst-log-block-head">
                    {b.unit}
                    {b.side ? <span> · {sideName(b.side)}</span> : null}
                  </div>
                ) : null}
                {b.entries.map((e) => (
                  <p key={e.index} className={`is-${e.kind}${e.side ? ` is-${e.side}` : ''}${QUIET.test(e.text) ? ' is-quiet' : ''}`} title={e.page ? `Rulebook ${e.page}` : undefined}>
                    <span className="dst-log-icon" aria-hidden="true">
                      {LOG_ICON[e.kind]}
                    </span>
                    <span className="dst-log-text">{e.text}</span>
                    {e.page ? <span className="rule-ref"> {e.page}</span> : null}
                  </p>
                ))}
              </div>
            ))}
          </details>
        ))}
      </div>
    </div>
  )
})
