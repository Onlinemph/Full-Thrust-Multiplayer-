import type { GameState } from '../engine/game'
import { optional } from '../engine/actions'
import { damageLevelOf, scoreBattle } from '../engine/victory'
import type { Scenario } from '../data/scenarios'
import { AfterAction } from './AfterAction'

/**
 * How a battle ends (4.12).
 *
 * Two ways: the scenario's turn limit runs out, or one side has nothing left
 * that can fight. The second is the one worth defining carefully — a fleet of
 * hulls that are all crippled has lost, even though none of them has actually
 * been destroyed, because a crippled ship has no guns, no FireCon or no thrust
 * and cannot affect the battle either way.
 */
export type BattleEnd =
  | { over: false }
  | { over: true; reason: 'turn-limit' | 'annihilation'; winner: string | null }

export function battleEnd(game: GameState, scenario: Scenario | undefined): BattleEnd {
  const ladder = scenario?.victory
  if (!ladder) return { over: false }

  const standing = new Map<string, number>()
  for (const ship of game.ships) {
    const level = damageLevelOf(ship)
    const fit = level === 'unhurt' || level === 'damaged'
    standing.set(ship.side, (standing.get(ship.side) ?? 0) + (fit ? 1 : 0))
  }

  const sidesWithShips = [...standing.entries()].filter(([, count]) => count > 0)
  if (sidesWithShips.length <= 1 && game.turn > 1) {
    return {
      over: true,
      reason: 'annihilation',
      winner: sidesWithShips[0]?.[0] ?? null,
    }
  }

  if (scenario.turnLimit && game.turn > scenario.turnLimit) {
    return {
      over: true,
      reason: 'turn-limit',
      winner: scoreBattle(game, ladder, { cpv: optional(game).cpv, battleOver: true }).winner,
    }
  }

  return { over: false }
}

export function BattleResult({
  game,
  scenario,
  end,
  onClose,
  onReturn,
}: {
  game: GameState
  scenario: Scenario
  end: Extract<BattleEnd, { over: true }>
  onClose: () => void
  /** A campaign battle: fold the result back and go back to the star map. */
  onReturn?: () => void
}) {
  // 11.7's riders are written off here and only here: the battle is over.
  const score = scoreBattle(game, scenario.victory, {
    cpv: optional(game).cpv,
    battleOver: true,
  })
  const winner = score.sides.find((s) => s.side === end.winner)

  // Which side's colour won reads before the sentence does — the same idea
  // as the Dirtside table's own result strip (dirtsidePlay.css .dst-strip.is-result).
  const resultColor = winner ? `var(--side-${winner.side})` : 'var(--ink-faint)'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ borderTop: `3px solid ${resultColor}` }} onClick={(event) => event.stopPropagation()}>
        <h2>{winner ? `${winner.name} wins` : 'A draw'}</h2>
        <p>
          {end.reason === 'turn-limit'
            ? `The battle ran its ${scenario.turnLimit} turns.`
            : 'One fleet has nothing left that can fight.'}{' '}
          {scenario.objective}
        </p>

        {score.sides.map((side) => (
          <section key={side.side}>
            <div className="panel-row">
              <b style={{ color: `var(--side-${side.side})` }}>{side.name}</b>
              <span className="spacer" />
              <span className="num budget">{side.scored}</span>
              <span className="num" style={{ color: 'var(--ink-faint)' }}>
                of {side.committed} committed
              </span>
            </div>
            <div className="loss-list">
              {side.ships.map((ship) => (
                <span key={ship.id} className={`loss is-${ship.level}`}>
                  {ship.name} <span className="num">{ship.level}</span>
                </span>
              ))}
            </div>
          </section>
        ))}

        {/* 4.12 scores the losses; this is how they happened. */}
        <AfterAction game={game} title={`${scenario.name} — after-action report`} />

        <p>
          {onReturn
            ? 'Return to the campaign to write this result onto the fleets, or close this to look over the wreckage first.'
            : 'The battle is still here — close this and you can rewind it with Undo, save it, or keep playing past the limit.'}
        </p>
        <div className="campaign-inline">
          {onReturn ? (
            <button className="primary" onClick={onReturn}>
              Return to campaign
            </button>
          ) : null}
          <button className={onReturn ? undefined : 'primary'} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
