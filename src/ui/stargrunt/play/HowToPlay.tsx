import { useEffect } from 'react'

import { QUALITY_DIE } from '../../../stargrunt/types'

/**
 * How to play Stargrunt II, in a drawer beside the table: the turn, an
 * activation's two actions, fire, suppression, confidence and close
 * assault in a few lines each, what the marks on the map mean, and the
 * keys. The same shape as Dirtside's own `play/HowToPlay.tsx`; rule pages
 * are footnotes for players who own the book.
 */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape' || e.key === '?') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside className="dst-guide" role="dialog" aria-label="How to play Stargrunt II">
      <header className="dst-guide-head">
        <h2>How to play</h2>
        <button className="dst-x" onClick={onClose} aria-label="Close the guide">
          ×
        </button>
      </header>
      <div className="dst-guide-body">
        <section>
          <h3>Winning</h3>
          <p>
            Objective markers <span className="dst-glyph">◆</span> are scattered over the table. Move any fit trooper within 1″ of one, with no enemy closer to it, to hold it. When the last turn ends, the side holding the higher
            total wins.
          </p>
          <p className="dst-foot">(p. 17, reused from Dirtside — Stargrunt's own chapters give no scoring rule of their own)</p>
        </section>
        <section>
          <h3>A turn</h3>
          <ol className="dst-guide-steps">
            <li>
              <b>Who goes first.</b> The side with fewer squads left (or the winner of a roll) chooses.
            </li>
            <li>
              <b>Take turns, one squad at a time.</b> Pick a squad, press <i>Activate</i>, spend its two actions, then it ends by itself (or press End early).
            </li>
            <li>
              <b>Passing.</b> With fewer squads left to act than the enemy, you may pass: the enemy then activates two in a row.
            </li>
            <li>
              <b>When everyone has acted,</b> the turn ends and every squad is ready again.
            </li>
          </ol>
          <p className="dst-foot">pp. 14–15</p>
        </section>
        <section>
          <h3>An activation: two actions</h3>
          <p>Each squad gets two actions, in any order, from: move, fire, close assault (which takes both), reorganise, remove suppression, go in position or leave it, transfer an activation, rally, or recover from panic.</p>
          <ul>
            <li>
              <b>Move.</b> Normal (up to base mobility, no roll), Combat (a die rolled for the squad, doubled — faster but unpredictable), or Travel (twice normal, but the squad forms a column and may then only move or reorganise
              until it reorganises out of it).
            </li>
            <li>
              <b>Fire.</b> The squad's small arms roll together as one opposed die against the target's range die; support weapons can join in, or fire alone. Two or more of your dice beating theirs is a major hit — casualties and
              suppression; exactly one is a minor hit — suppression only.
            </li>
            <li>
              <b>Suppression</b> stacks up to three: a suppressed squad may only reorganise in cover, remove a suppression marker, or take a leader's action.
            </li>
            <li>
              <b>Close assault</b> spends both actions: the squad tests its nerve, the defender tests to stand, and if both hold, the fight is worked out round by round until one side breaks.
            </li>
          </ul>
          <p className="dst-foot">pp. 15–18, 22, 33–37, 41–43</p>
        </section>
        <section>
          <h3>Cover and line of sight</h3>
          <p>Woods, hills and buildings block sight; a squad within a wood neither sees nor is seen. Soft cover (scrub, a wood's edge) and hard cover (rock, a building, high ground) shift the range die in the target's favour.</p>
          <p className="dst-foot">pp. 11–13</p>
        </section>
        <section>
          <h3>Confidence</h3>
          <p>
            Casualties, suppression and a lost leader test a squad's confidence: it can drop from Confident to Steady, Shaken, Broken and Routed. Quality sets the die it tests with — Untrained D{QUALITY_DIE.untrained}, Green D
            {QUALITY_DIE.green}, Regular D{QUALITY_DIE.regular}, Veteran D{QUALITY_DIE.veteran}, Elite D{QUALITY_DIE.elite} — and leadership is the number to beat, so <b>1 is the best leader</b>. A commanding unit can rally a
            subordinate a level back up.
          </p>
          <p className="dst-foot">pp. 9–10, 16–17, 19–21</p>
        </section>
        <section>
          <h3>On the map</h3>
          <ul className="dst-guide-marks">
            <li>
              <i className="dst-guide-swatch is-north" /> North's squads, <i className="dst-guide-swatch is-south" /> South's — the same cyan and amber as the other games, nothing else.
            </li>
            <li>Every figure is a small base with a glyph: a star for the leader, a bar for a support weapon, a cross for a medic. A dimmed ring is a wound, a small cross is a dead trooper.</li>
            <li>The pennant above a squad's leader carries its code, quality die, leadership, confidence colour and up to three suppression pips.</li>
            <li>A dashed green ring (or a chain of lines) round the selected squad shows its integrity — the 6″ circle or the 2″ chain it must keep to avoid disorganising.</li>
            <li>Arm a weapon and point at an enemy squad for its odds, or a click to fire.</li>
            <li>Orange is the one thing to press next, and the ground a plotted move is heading for.</li>
          </ul>
        </section>
        <section>
          <h3>Keys</h3>
          <dl className="dst-keys">
            <div>
              <dt>
                <kbd className="dst-kbd">Enter</kbd>
              </dt>
              <dd>the orange button, whatever it says</dd>
            </div>
            <div>
              <dt>
                <kbd className="dst-kbd">Esc</kbd>
              </dt>
              <dd>cancel the action you are arming, or let go of the selection</dd>
            </div>
            <div>
              <dt>
                <kbd className="dst-kbd">E</kbd>
              </dt>
              <dd>end the activated squad's activation</dd>
            </div>
            <div>
              <dt>
                <kbd className="dst-kbd">A</kbd>
              </dt>
              <dd>activate the selected squad</dd>
            </div>
            <div>
              <dt>
                <kbd className="dst-kbd">Ctrl+Z</kbd>
              </dt>
              <dd>take back a move or deployment that rolled no dice</dd>
            </div>
            <div>
              <dt>
                <kbd className="dst-kbd">?</kbd>
              </dt>
              <dd>this guide</dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  )
}
