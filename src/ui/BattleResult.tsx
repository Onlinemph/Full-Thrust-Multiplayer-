import type { GameState } from '../engine/game'
import { optional } from '../engine/actions'
import { damageLevelOf, scoreBattle } from '../engine/victory'
import type { Scenario } from '../data/scenarios'

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
    return { over: true, reason: 'turn-limit', winner: scoreBattle(game, ladder, { cpv: optional(game).cpv }).winner }
  }

  return { over: false }
}

export function BattleResult({
  game,
  scenario,
  end,
  onClose,
}: {
  game: GameState
  scenario: Scenario
  end: Extract<BattleEnd, { over: true }>
  onClose: () => void
}) {
  const score = scoreBattle(game, scenario.victory, { cpv: optional(game).cpv })
  const winner = score.sides.find((s) => s.side === end.winner)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
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

        <p>
          The battle is still here — close this and you can rewind it with Undo, save it, or keep
          playing past the limit.
        </p>
        <button className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
