import { useState } from 'react'

import type { SideId } from '../../../dirtside/table/types'

/**
 * The strip across the top of the table: whose turn it is, where in the
 * turn we are, what the table is waiting for, and the one button to press.
 * Everything else is a quiet secondary; one the rules would refuse is shown
 * disabled with the reason, so the player learns it before the click.
 */

export interface StripAction {
  key: string
  label: string
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
  objectives: { north: number; south: number; names: Record<SideId, string>; markers: number }
}

const STEPS = ['Deploy', 'Who goes first', 'Pick a unit', 'Move & fire']

export function StatusStrip({ model }: { model: StripModel }) {
  const [why, setWhy] = useState<string | null>(null)
  const { primary, secondary } = model
  return (
    <section className={`dst-strip is-${model.tone}${model.side ? ` acts-${model.side}` : ''}`} aria-label="What the table is waiting for">
      <div className="dst-strip-top">
        <span className="dst-turn num" title={model.turnLimit ? `The battle ends after turn ${model.turnLimit}` : 'The battle runs until a side declares its end'}>
          {model.turn === 0 ? 'SET-UP' : `TURN ${model.turn}${model.turnLimit ? ` / ${model.turnLimit}` : ''}`}
        </span>
        <ol className="dst-steps" aria-label="The turn">
          {STEPS.map((s, i) => (
            <li key={s} className={i === model.step ? 'is-now' : model.step !== null && i < model.step ? 'is-past' : undefined}>
              {s}
            </li>
          ))}
        </ol>
        <span className={`dst-sidechip${model.side ? ` is-${model.side}` : ''}`}>{model.sideText}</span>
        <span className="spacer" />
        <span
          className="dst-score"
          title={`Objective markers held, by value: ${model.objectives.names.north} ${model.objectives.north}, ${model.objectives.names.south} ${model.objectives.south}. You see the values of the markers your side drew; the enemy's stay hidden until taken. The higher total when the last turn ends wins. Hold more than half the ${model.objectives.markers} markers, one in the enemy rear area, to declare the end early.`}
        >
          <span className="dst-score-diamond" aria-hidden="true">◆</span>
          <span className="dst-score-label">Objectives</span>
          <b className="num is-north">{model.objectives.north}</b>
          <span className="dst-score-sep">:</span>
          <b className="num is-south">{model.objectives.south}</b>
        </span>
      </div>
      <div className="dst-strip-main">
        <div className="dst-say">
          <p className="dst-banner">
            {model.tone === 'computer' ? <span className="dst-spinner" aria-hidden="true" /> : null}
            {model.banner}
          </p>
          <p className={`dst-hint${why ? ' is-why' : ''}`}>{why ?? model.hint}</p>
        </div>
        <div className="dst-actions">
          {primary ? <StripButton action={primary} primary onWhy={setWhy} /> : null}
          {secondary.length > 0 ? (
            <div className="dst-secondary">
              {secondary.map((a) => (
                <StripButton key={a.key} action={a} onWhy={setWhy} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function StripButton({ action, primary, onWhy }: { action: StripAction; primary?: boolean; onWhy: (why: string | null) => void }) {
  const refused = action.refused ?? null
  const button = (
    <button
      className={primary && !refused ? 'primary' : 'dst-quiet'}
      disabled={!!refused}
      onClick={action.onClick}
      title={refused ?? action.title}
      aria-keyshortcuts={action.kbd}
    >
      {action.label}
      {action.kbd && !refused ? (
        <kbd className="dst-kbd" aria-hidden="true">
          {action.kbd}
        </kbd>
      ) : null}
    </button>
  )
  if (!refused) return button
  // A disabled button takes no pointer events in every browser, so its wrapper tells the hint line why.
  return (
    <span className="dst-refused" onMouseEnter={() => onWhy(`${action.label}: ${refused}`)} onMouseLeave={() => onWhy(null)}>
      {button}
    </span>
  )
}
