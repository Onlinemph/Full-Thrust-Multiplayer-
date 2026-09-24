import { useState } from 'react'

import type { SideId } from '../../../dirtside/table/types'

/**
 * The strip across the top of the table: whose turn it is, where in the
 * turn we are, what the table is waiting for, and the one button to press.
 * Everything else is a quiet secondary; one the rules would refuse is shown
 * disabled with the reason, so the player learns it before the click.
 * It keeps one height whatever it says, so the table below never jumps.
 */

export interface StripAction {
  key: string
  label: string
  /** The words shown where the strip is narrow; the button keeps `label` as its name. */
  short?: string
  onClick: () => void
  /** Why the rules would refuse it now: the button is disabled and this is its helper text. */
  refused?: string | null
  title?: string
  /** A keyboard shortcut, shown as a badge that is not part of the button's name. */
  kbd?: string
}

export interface StripModel {
  turn: number
  turnLimit: number | null
  /** 0 deploy, 1 who goes first, 2 pick a unit, 3 move and fire; null once the battle is over. */
  step: number | null
  side: SideId | null
  sideText: string
  /** The table's sentence: what it is waiting for. The drives read it. */
  banner: string
  /** What to click, in plain words. */
  hint: string
  tone: 'normal' | 'warn' | 'computer' | 'result'
  primary: StripAction | null
  secondary: StripAction[]
  /** Objective value held, as far as the viewer may know it: "3", "1+?", "?" (p. 17). */
  objectives: { north: string; south: string; names: Record<SideId, string>; markers: number; hidden: boolean }
}

const STEPS = ['Deploy', 'Who goes first', 'Pick a unit', 'Move & fire']

export function StatusStrip({ model }: { model: StripModel }) {
  // The refused button the pointer is over, by key and for this banner only: when the table moves on, a
  // button drawn under a resting pointer tells nothing until the pointer moves over it.
  const [whyFor, setWhyFor] = useState<{ key: string; banner: string } | null>(null)
  const { primary, secondary } = model
  const over = whyFor && whyFor.banner === model.banner ? [primary, ...secondary].find((a) => a?.key === whyFor.key && a.refused) : null
  const why = over ? `${over.label}: ${over.refused}` : null
  const onWhy = (key: string | null) => setWhyFor((w) => (key === null ? null : w && w.key === key && w.banner === model.banner ? w : { key, banner: model.banner }))
  const decide = model.tone === 'warn'
  return (
    <section className={`dst-strip is-${model.tone}${model.side ? ` acts-${model.side}` : ''}`} aria-label="What the table is waiting for">
      <div className="dst-strip-top">
        <span className="dst-turn num" title={model.turnLimit ? `The battle ends after turn ${model.turnLimit}` : 'The battle runs until a side declares its end'}>
          {model.turn === 0 ? 'SET-UP' : `TURN ${model.turn}${model.turnLimit ? ` / ${model.turnLimit}` : ''}`}
        </span>
        <ol className="dst-steps" aria-label="The turn">
          {STEPS.map((s, i) => (
            <li key={s} className={i === model.step ? 'is-now' : model.step !== null && i < model.step ? 'is-past' : undefined} title={s}>
              {s}
            </li>
          ))}
        </ol>
        <span className={`dst-sidechip${model.side ? ` is-${model.side}` : ''}`} title={model.sideText}>
          {model.sideText}
        </span>
        {decide ? (
          <span className="dst-decide" title="The table is waiting for this decision">
            Your call
          </span>
        ) : null}
        <span className="spacer" />
        <span
          className="dst-score"
          title={`Objective markers held, by value: ${model.objectives.names.north} ${model.objectives.north}, ${model.objectives.names.south} ${model.objectives.south}. You see the values of the markers your side drew or holds; the others stay hidden${model.objectives.hidden ? ' (counted as ?)' : ''} until you take them. The higher total when the last turn ends wins. Hold more than half the ${model.objectives.markers} markers, one in the enemy rear area, to declare the end early.`}
        >
          <span className="dst-score-diamond" aria-hidden="true">
            ◆
          </span>
          <span className="dst-score-label">Objectives</span>
          <b className="num is-north">{model.objectives.north}</b>
          <span className="dst-score-sep">:</span>
          <b className="num is-south">{model.objectives.south}</b>
        </span>
      </div>
      <div className="dst-strip-main">
        <div className="dst-say">
          <p className="dst-banner" title={model.banner}>
            {model.tone === 'computer' ? <span className="dst-spinner" aria-hidden="true" /> : null}
            {model.banner}
          </p>
          <p className={`dst-hint${why ? ' is-why' : ''}`} title={why ?? model.hint}>
            {why ?? model.hint}
          </p>
        </div>
        <div className="dst-actions">
          {primary ? <StripButton action={primary} primary onWhy={onWhy} /> : null}
          {secondary.length > 0 ? (
            <div className="dst-secondary">
              {secondary.map((a) => (
                <StripButton key={a.key} action={a.kbd === 'Enter' ? { ...a, kbd: undefined } : a} onWhy={onWhy} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function StripButton({ action, primary, onWhy }: { action: StripAction; primary?: boolean; onWhy: (key: string | null) => void }) {
  const refused = action.refused ?? null
  const button = (
    <button
      className={primary && !refused ? 'primary' : 'dst-quiet'}
      disabled={!!refused}
      onClick={action.onClick}
      title={refused ?? action.title ?? action.label}
      aria-label={action.short ? action.label : undefined}
      aria-keyshortcuts={action.kbd}
    >
      {action.short ? (
        <>
          <span className="dst-btn-label dst-label-long">{action.label}</span>
          <span className="dst-btn-label dst-label-short">{action.short}</span>
        </>
      ) : (
        <span className="dst-btn-label">{action.label}</span>
      )}
      {action.kbd && !refused ? (
        <kbd className="dst-kbd" aria-hidden="true">
          {action.kbd}
        </kbd>
      ) : null}
    </button>
  )
  if (!refused) return button
  // A disabled button takes no pointer events in every browser, so its wrapper tells the hint line why,
  // once the pointer moves over it: a button drawn under a resting pointer says nothing.
  return (
    <span className="dst-refused" onMouseMove={() => onWhy(action.key)} onMouseLeave={() => onWhy(null)}>
      {button}
    </span>
  )
}
