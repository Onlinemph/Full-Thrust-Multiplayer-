import { phaseNumber, type GameState } from '../../engine/game'
import type { PhaseDebt } from '../../engine/actions'
import { PHASE_LABELS, type Phase } from '../../engine/types'

/**
 * The one button a phase's controls resolve with, or ending the phase
 * outright — computed once in App.tsx (`primaryAction`) and handed down here
 * so the strip and the keyboard's Enter key agree on what pressing it does.
 */
export interface PrimaryAction {
  label: string
  run: () => void
  disabled: boolean
  /** "End phase anyway": the second click on a phase with optional work left. */
  armed: boolean
}

/**
 * The header's calmer replacement for a flat turn/phase readout and a
 * standalone red debt box: a turn counter, a four-stage track across the
 * turn's fifteen phases (2.6), whose fleet is up, one line saying what the
 * phase needs, and the single button that gets it there. Built on the same
 * idea as the Dirtside table's own status strip (dirtsidePlay.css), because
 * that instrument was already proven here before this screen got it.
 *
 * It renders the `.end-phase` button itself, and stays inside the `<header>`
 * element the way the flat readouts it replaces did — the drives look for
 * `header .end-phase`.
 */
export interface PhaseStripProps {
  game: GameState
  turnLimit: number | null
  debt: PhaseDebt
  armed: boolean
  primary: PrimaryAction
  /**
   * A decision is waiting on this console right now — App.tsx works this out
   * per phase (phase 1's own ships-still-to-order debt does not resolve
   * through the primary button the way every other phase's does).
   */
  decide: boolean
  /** Nobody at this console can do anything: it is the computer's ships. */
  computerHolds: boolean
  /** Phase 11 only: whose turn it is to fire, if it is anyone's in particular. */
  fireTurn: { side: string; name: string } | null
}

type Stage = 'orders' | 'movement' | 'attack' | 'aftermath'

const STAGE_OF: Record<Phase, Stage> = {
  orders: 'orders',
  initiative: 'orders',
  'launch-missiles': 'movement',
  'move-fighters': 'movement',
  'move-ships': 'movement',
  'secondary-fighter-moves': 'movement',
  'allocate-attacks': 'attack',
  'fighter-vs-fighter': 'attack',
  'point-defence': 'attack',
  'ordnance-vs-ships': 'attack',
  'ship-fire': 'attack',
  boarding: 'attack',
  threshold: 'aftermath',
  'damage-control': 'aftermath',
  'reactor-explosions': 'aftermath',
}

const STAGES: readonly { key: Stage; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'movement', label: 'Movement' },
  { key: 'attack', label: 'Attack' },
  { key: 'aftermath', label: 'Aftermath' },
]

/** What each phase is for, in one short line — the strip's "what to do now". */
const PHASE_NOW: Record<Phase, string> = {
  orders: 'Give every ship a course change and a thrust order.',
  initiative: 'Roll to see who fires first this turn.',
  'launch-missiles': 'Launch salvoes and lay spinal shots before anyone moves.',
  'move-fighters': "Fly this turn's fighters and gunboats.",
  'move-ships': 'Move every ship to the order written for it.',
  'secondary-fighter-moves': 'Give fighters a second move, for a CEF each.',
  'allocate-attacks': 'Missiles and fighter runs lock onto their targets.',
  'fighter-vs-fighter': 'Fighters within reach engage each other.',
  'point-defence': 'Point defence engages incoming ordnance.',
  'ordnance-vs-ships': 'Missiles and fighter runs strike their targets.',
  'ship-fire': 'Ships fire, in initiative order.',
  boarding: 'Boarding parties fight it out.',
  threshold: 'Roll threshold checks for every crossed hull row.',
  'damage-control': 'Damage control parties attempt repairs.',
  'reactor-explosions': 'Breached reactors roll to hold or let go.',
}

export function PhaseStrip({ game, turnLimit, debt, armed, primary, decide, computerHolds, fireTurn }: PhaseStripProps) {
  const stage = STAGE_OF[game.phase]
  const stageIndex = STAGES.findIndex((s) => s.key === stage)
  const hint = phaseHint(debt, armed, computerHolds)
  const hintRequired = debt.required.length > 0

  return (
    <div className="phase-strip" role="group" aria-label="This turn">
      <div className="ph-top">
        <span className="ph-turn num" title={turnLimit ? `The battle ends after turn ${turnLimit}` : 'No turn limit'}>
          TURN {game.turn}
          {turnLimit ? ` / ${turnLimit}` : ''}
        </span>
        <ol className="ph-stages" aria-label="The turn's four stages">
          {STAGES.map((s, i) => (
            <li
              key={s.key}
              className={i === stageIndex ? 'is-now' : i < stageIndex ? 'is-past' : undefined}
              title={s.label}
            >
              {s.label}
            </li>
          ))}
        </ol>
        {fireTurn ? (
          <span
            className="ph-sidechip"
            style={{
              color: `var(--side-${fireTurn.side})`,
              borderColor: `color-mix(in srgb, var(--side-${fireTurn.side}) 60%, transparent)`,
              background: `color-mix(in srgb, var(--side-${fireTurn.side}) 10%, transparent)`,
            }}
            title={`${fireTurn.name} to fire a ship`}
          >
            {fireTurn.name}&rsquo;s shot
          </span>
        ) : null}
        {decide ? (
          <span className="ph-decide" title="The table is waiting on this console">
            Your call
          </span>
        ) : null}
        {computerHolds ? (
          <span className="ph-computer" title="The computer's ships still owe this phase">
            <span className="ph-spinner" aria-hidden="true" />
            Computer
          </span>
        ) : null}
      </div>
      <div className="ph-main">
        <div className="ph-say">
          <p className="ph-banner" title={`Phase ${phaseNumber(game.phase)} · ${PHASE_LABELS[game.phase]}`}>
            {PHASE_NOW[game.phase]}
          </p>
          <p className={`ph-hint${hintRequired ? ' is-required' : debt.optional.length > 0 ? ' is-optional' : ''}`} title={hint}>
            {hint}
          </p>
        </div>
        <button
          className={`primary end-phase${armed ? ' is-armed' : ''}`}
          disabled={primary.disabled}
          title={primary.disabled ? debt.required.join('\n') : undefined}
          onClick={primary.run}
        >
          {primary.label}
        </button>
      </div>
    </div>
  )
}

function phaseHint(debt: PhaseDebt, armed: boolean, computerHolds: boolean): string {
  if (debt.required.length > 0) return debt.required.join(' · ')
  if (debt.optional.length > 0) {
    return armed ? `End phase anyway will skip: ${debt.optional.join(' · ')}` : debt.optional.join(' · ')
  }
  if (computerHolds) return "The computer's ships are still acting."
  return 'Nothing more needed from you this phase.'
}
