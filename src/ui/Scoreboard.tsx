import type { GameState } from '../engine/game'
import { scoreBattle, type DamageLevel } from '../engine/victory'
import type { VictoryLadder } from '../data/scenarios'

/**
 * The scoreboard (4.12).
 *
 * Worth having on screen throughout rather than only at the end, because in
 * Full Thrust a ship is worth points to the enemy the moment it is *crippled* —
 * and crippled includes losing your last FireCon or your last gun, not just
 * losing hull. A fleet can be beaten while every hull is still mostly intact,
 * and a player who cannot see that coming will play the wrong game.
 */
export function Scoreboard({ game, ladder }: { game: GameState; ladder: VictoryLadder }) {
  const score = scoreBattle(game, ladder)

  return (
    <div className="panel">
      <h3>Score</h3>
      {score.sides.map((side) => (
        <div key={side.side}>
          <div className="panel-row">
            <span style={{ color: `var(--side-${side.side})` }}>{side.name}</span>
            <span className="spacer" />
            <span className="num" title="Points scored from the enemy">
              {side.scored}
            </span>
            <span className="num" style={{ color: 'var(--ink-faint)' }}>
              / {side.committed} committed
            </span>
          </div>
          <div className="loss-list">
            {side.ships
              .filter((ship) => ship.level !== 'unhurt')
              .map((ship) => (
                <span key={ship.id} className={`loss is-${ship.level}`} title={LABEL[ship.level]}>
                  {ship.name} <span className="num">−{ship.conceded}</span>
                </span>
              ))}
          </div>
        </div>
      ))}
      {score.winner ? (
        <p style={{ color: 'var(--ink-dim)' }}>
          Ahead: <b>{score.sides.find((s) => s.side === score.winner)?.name}</b>
        </p>
      ) : (
        <p style={{ color: 'var(--ink-faint)' }}>Level.</p>
      )}
    </div>
  )
}

const LABEL: Record<DamageLevel, string> = {
  unhurt: 'Unhurt',
  damaged: 'Damaged — at least one hull box gone',
  crippled: 'Crippled — two hull rows gone, or no guns, FireCon or thrust left',
  destroyed: 'Destroyed',
  disengaged: 'Disengaged — worth full points to the enemy',
}
