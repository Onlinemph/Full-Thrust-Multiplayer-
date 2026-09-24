import { useEffect, useState } from 'react'

import { QUALITY_DIE } from '../../../dirtside/table/confidence'
import { CONFIDENCE_LEVELS } from '../../../dirtside/table/types'
import { KEY_LIST } from './useTableKeys'
import { CONFIDENCE_LABELS, CONFIDENCE_TONE, restrictionWords } from './words'

/**
 * How to play, in a drawer beside the table: the turn, an activation,
 * seeing, shooting and morale in a few lines each, what the marks on the
 * map mean, and the keys. The morale ladder is written from the engine's
 * own restrictions so it cannot drift from the rules. Rule pages are
 * footnotes, for players who own the book.
 */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The table's keys stand down while the guide is open; these two close it. The keypress that opened
      // it (already taken, so marked handled) reaches here too, and must not close it again.
      if (e.defaultPrevented) return
      if (e.key === 'Escape' || e.key === '?') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside className="dst-guide" role="dialog" aria-label="How to play Dirtside II">
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
            Objective markers <span className="dst-glyph">◆</span> are scattered over the table. Drive any element within 1″ of one to take it. Each side knows the values of the markers it drew; the enemy's show <b>?</b> until
            taken. When the last turn ends, the side holding the higher total wins.
          </p>
          <p className="dst-foot">Hold more than half of the markers, one of them in the enemy's rear third, and you may declare the game over early. (p. 17)</p>
        </section>
        <section>
          <h3>A turn</h3>
          <ol className="dst-guide-steps">
            <li>
              <b>Who goes first.</b> The side with fewer units (or the winner of a roll) chooses. Going second lets you answer what the enemy does.
            </li>
            <li>
              <b>Take turns, one unit at a time.</b> Pick a unit, press <i>Activate</i>, do everything with it, then <i>End</i> its activation. Then the other side picks one.
            </li>
            <li>
              <b>Passing.</b> With fewer units left to act than the enemy, you may pass: the enemy then activates two in a row.
            </li>
            <li>
              <b>When everyone has acted,</b> the turn ends and every unit is ready again.
            </li>
          </ol>
          <p className="dst-foot">pp. 17–19</p>
        </section>
        <section>
          <h3>An activation</h3>
          <p>
            Each element of the unit may <b>move</b> and make <b>one attack</b>, in either order. Click an element, then click the ground to plot a move; the path shows what it costs. Pick a weapon and click a lit enemy to add a
            shot to the volley, then fire every shot at once.
          </p>
          <ul>
            <li>Firing first limits the element to half its move afterwards.</li>
            <li>Moving more than half its move makes its shots harder.</li>
            <li>Woods, hills and rough ground cost more to cross; roads cost less in travel mode (but then it cannot fire).</li>
            <li>When you move in sight of an enemy unit that has not acted yet, it may fire at you as you arrive (opportunity fire). That spends its activation.</li>
          </ul>
          <p className="dst-foot">pp. 18–20, 25–28</p>
        </section>
        <section>
          <h3>Seeing and shooting</h3>
          <p>Woods, hills and buildings block sight; an element deep inside a wood neither sees nor is seen, one on its edge is in cover. Nothing sees farther than 60″.</p>
          <p>
            A shot is the firer's die against the target's: bigger vehicles and closer ranges favour the firer, cover and hull-down favour the target. A hit draws chits: red, yellow and green count against the target's armour, and
            enough of them knock it out. The odds you see when you point at a target, and in the volley, are worked out from exactly this.
          </p>
          <p className="dst-foot">pp. 4, 20, 28–33</p>
        </section>
        <section>
          <h3>Morale</h3>
          <p>
            Losses and fire shake a unit down this ladder; its HQ can rally it back up. A unit's quality is the die it tests with: green D{QUALITY_DIE.green}, regular D{QUALITY_DIE.regular}, veteran D{QUALITY_DIE.veteran}. Its
            leadership is the number to beat, so <b>1 is the best leader</b>.
          </p>
          <ol className="dst-ladder">
            {CONFIDENCE_LEVELS.map((c) => {
              const armour = rest(c, 'armour')
              const infantry = rest(c, 'infantry')
              return (
                <li key={c} className={`is-${CONFIDENCE_TONE[c]}`}>
                  <b>{CONFIDENCE_LABELS[c]}</b>
                  <span>{infantry === armour ? armour : `Vehicles: ${armour} Infantry: ${infantry}`}</span>
                </li>
              )
            })}
          </ol>
          <p className="dst-foot">Green units may panic the first time they are fired on. pp. 21–24</p>
        </section>
        <section>
          <h3>On the map</h3>
          <ul className="dst-guide-marks">
            <li>
              <i className="dst-guide-swatch is-north" /> North's units, <i className="dst-guide-swatch is-south" /> South's. The tag shows the unit's code (N1, S2…), also in the list.
            </li>
            <li>Cyan is North and amber is South, nothing else.</li>
            <li>A tick on a tag, or a dimmed counter: that unit has acted this turn.</li>
            <li>Dashed rings round the selected element: how far it can still move, and its weapon's ranges. The chip on a plotted path says how far it goes and what is left, or why it cannot go.</li>
            <li>
              With a weapon picked, a bright ring marks every enemy it can shoot; a faint dashed ring on a dimmed counter means it can't. Point at a target for the odds, or for why not; a shot in the volley gets an orange reticle.
              Terrain that blocks the shot is outlined in dashes.
            </li>
            <li>Red is damage and nothing else: a red mark is a hit, a wreck is knocked out.</li>
            <li>Orange is the one button to press next, and movement being spent. When the table waits on your decision, the strip says so in orange.</li>
          </ul>
        </section>
        <section>
          <h3>Keys</h3>
          <dl className="dst-keys">
            {KEY_LIST.map(([k, what]) => (
              <div key={k}>
                <dt>
                  <kbd className="dst-kbd">{k}</kbd>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </aside>
  )
}

/** A rung's restrictions without the rung's name: "may not move nearer the enemy." */
const rest = (c: (typeof CONFIDENCE_LEVELS)[number], kind: 'infantry' | 'armour') => {
  const words = restrictionWords(c, kind).replace(/^\S+:? (armour |infantry )?/, '')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const TIP_KEY = 'ftpc.dirtside.firstTip.v1'

/** A short tip for a first game, shown until dismissed once. */
export function FirstGameTip({ onGuide }: { onGuide: () => void }) {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(TIP_KEY) !== 'seen'
    } catch {
      return true
    }
  })
  if (!shown) return null
  const hide = () => {
    setShown(false)
    try {
      localStorage.setItem(TIP_KEY, 'seen')
    } catch {
      // A private window: the tip comes back next visit.
    }
  }
  return (
    <div className="dst-tip" role="note">
      <p>
        <b>New to Dirtside?</b> Hold the objective markers <span className="dst-glyph">◆</span> to win. Sides take turns activating one unit at a time: move and shoot with its elements, then end its activation. The strip above the map
        always says what to do next.
      </p>
      <div className="dst-tip-acts">
        <button onClick={onGuide}>How to play</button>
        <button className="dst-quiet" onClick={hide}>
          Got it
        </button>
      </div>
    </div>
  )
}
