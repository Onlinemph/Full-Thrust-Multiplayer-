import { useLayoutEffect, useState, type RefObject } from 'react'

import type { Point } from '../../../dirtside/table/types'
import { adviceFor as defaultAdviceFor } from './words'

/**
 * A refusal as guidance: "Can't do that", the engine's reason word for
 * word, what to do instead when there is a common answer, and the rule
 * page as a quiet chip. A refused click on the map shows it beside the
 * click; a refused button shows it under the strip. It never takes a click
 * meant for the table, and goes on the next action that works.
 * `adviceFor` reads the reason for its "what to do instead" line; it
 * defaults to Dirtside's own vocabulary (K4: a game whose refusals read
 * differently, e.g. Stargrunt's `stargrunt/play/words.ts`, passes its own).
 */
export function RefusalToast({
  reason,
  page,
  at,
  pane,
  onClose,
  adviceFor = defaultAdviceFor,
}: {
  reason: string
  page: string
  at: Point | null
  pane: RefObject<HTMLDivElement | null>
  onClose: () => void
  adviceFor?: (reason: string) => string | null
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const box = pane.current
    const svg = box?.querySelector('svg.dst-map') as SVGSVGElement | null
    if (!at || !box || !svg) {
      setPos(null)
      return
    }
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = at.x
    pt.y = at.y
    const p = pt.matrixTransform(ctm)
    const rect = box.getBoundingClientRect()
    // Beside the click, kept inside the pane: 22rem wide at most.
    const width = Math.min(352, rect.width - 16)
    const left = Math.max(8, Math.min(p.x - rect.left + 16, rect.width - width - 8))
    const below = p.y - rect.top + 16
    const top = below + 120 > rect.height ? Math.max(8, p.y - rect.top - 120) : below
    setPos({ left, top })
  }, [at, pane, reason])
  const advice = adviceFor(reason)
  return (
    <div className={`dst-refusal${at ? ' is-at' : ' is-top'}`} role="alert" style={pos ? { left: pos.left, top: pos.top } : undefined}>
      <div className="dst-refusal-head">
        <b>Can't do that</b>
        <span className="dst-page">Rulebook {page}</span>
        <button className="dst-x" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      </div>
      <p className="dst-refusal-why">{reason}</p>
      {advice ? <p className="dst-refusal-advice">{advice}</p> : null}
    </div>
  )
}
