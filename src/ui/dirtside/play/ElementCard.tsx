import { recordCardOf } from '../../../dirtside/recordCard'
import { baseMovement } from '../../../dirtside/table/tableFire'
import type { PathCost } from '../../../dirtside/table/terrain'
import type { ActivationElement, ElementState, Posture, UnitState, WeaponChoice } from '../../../dirtside/table/types'
import { elementChips, elementKind, mobilityWords, sameWeapon, type WeaponRow } from './words'

/**
 * The selected element as a game piece: its figures in boxes, like the
 * record card; what is wrong with it; and, in its own activation, how far
 * it can still go, its stance, and a row per weapon with the reach of each
 * range band. An enemy's card is the same, read-only, so looking at one
 * teaches what it can do.
 */

export interface MoveControls {
  plotting: boolean
  plot: number
  plotted: PathCost | null
  evasive: boolean
  travel: boolean
  canEvade: boolean
  onEvasive: (on: boolean) => void
  onTravel: (on: boolean) => void
  onPlot: () => void
  onConfirm: () => void
  onUndo: () => void
  onCancel: () => void
  /** Why the element cannot plot a move now, if it cannot. */
  cannotMove: string | null
  /** Why the rules bar travel mode for it now (it fired, its unit is under fire), if they do. */
  travelBlocked: string | null
}

export interface StanceControls {
  refusals: Record<Posture, string | null>
  onStance: (p: Posture) => void
  /** Systems down: try to bring them back. Offered only when it has systems down. */
  onRepair: (() => void) | null
  /** Why a repair would be refused now (tried once this activation, damaged this activation), if it would. */
  repairRefused: string | null
}

export interface FireControls {
  weapons: WeaponRow[]
  armed: WeaponChoice | null
  onArm: (w: WeaponChoice) => void
  /** Why no weapon can fire now (fired already, travel mode…). */
  locked: string | null
  /** A rule the player should know before choosing: "firing first halves the move". */
  note: string | null
}

export interface ElementCardProps {
  element: ElementState
  unit: UnitState
  code: string
  /** The element's record in its own activation, when this console controls it. */
  record: ActivationElement | null
  /** Movement factors it may use this activation, and has left. */
  cap: number
  left: number
  move: MoveControls | null
  stance: StanceControls | null
  fire: FireControls | null
  leader: boolean
}

const STANCES: Array<{ p: Posture; label: string; title: string }> = [
  { p: 'none', label: 'In the open', title: 'Up and able to shoot, easier to hit' },
  { p: 'hull-down', label: 'Hull down', title: 'Only the turret shows: harder to hit, still shoots (p. 29)' },
  { p: 'turret-down', label: 'Turret down', title: 'Hidden behind cover: very hard to hit, cannot shoot (p. 29)' },
]

export function ElementCard(props: ElementCardProps) {
  const { element: el, unit, record, move, stance, fire } = props
  const card = el.vehicle ? recordCardOf(el.vehicle) : null
  const bmf = baseMovement(el)
  const chips = elementChips(el, unit)
  const stats: Array<{ label: string; value: string; title: string }> = card
    ? [
        { label: 'Armour', value: `${card.armourFront} / ${card.armourSide}`, title: `Front ${card.armourFront}, sides and rear ${card.armourSide}: the chit points a hit must reach (p. 10)` },
        { label: 'Hit on', value: `D${card.targetDie}`, title: 'The die the enemy rolls against its shooter: bigger is harder to hit (p. 29)' },
        { label: 'Move', value: `${bmf}″`, title: `${mobilityWords(el)}: ${bmf} factors a turn, an inch each on open ground (p. 25)` },
        { label: 'Fire control', value: card.fireControl, title: 'Its gunner\'s die at close range; one step smaller each band out (p. 28)' },
      ]
    : [
        { label: 'Troops', value: el.infantry!.troops, title: 'Militia, line or powered: how many chits it takes to remove (p. 33)' },
        { label: 'Team', value: el.infantry!.team.replace('-', ' '), title: 'Rifle and APSW teams shoot in a firefight; the others support (p. 13)' },
        { label: 'Move', value: `${bmf}″`, title: `${mobilityWords(el)}: ${bmf}″ a turn on open ground (p. 25)` },
      ]
  const plotted = move?.plotted ?? null
  const used = record?.factorsUsed ?? 0
  const spend = move?.plotting && plotted && !plotted.blockedAt ? plotted.factors : 0
  const over = move?.plotting && plotted ? plotted.factors > props.left + 1e-9 : false
  const scale = Math.max(bmf, 1)

  return (
    <div className={`panel dst-element is-${el.sideId}${el.destroyed ? ' is-destroyed' : ''}`}>
      <header className="dst-el-head">
        <span className="dst-code">{props.code}</span>
        <span className="dst-el-names">
          <b className="dst-el-name">{el.name}</b>
          <span className="dst-el-sub">
            {elementKind(el)} · {unit.name}
            {props.leader ? <span className="dst-leader" title="The unit leader: it calls fire from orbit, and losing it shakes the unit (p. 23)"> · leader</span> : null}
          </span>
        </span>
      </header>

      <div className="dst-stats">
        {stats.map((s) => (
          <div key={s.label} className="dst-stat" title={s.title}>
            <span>{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>

      {chips.length > 0 ? (
        <div className="dst-chips">
          {chips.map((c) => (
            <span key={c.label} className={`dst-status-chip is-${c.tone}`} title={c.title}>
              {c.label}
            </span>
          ))}
        </div>
      ) : null}

      {record && !el.destroyed ? (
        <div className="dst-movebar" title="Movement factors: an inch of open ground costs one; woods, hills and rough cost more, roads less in travel mode">
          <div className="dst-movebar-label">
            <span>Movement</span>
            <span>
              {used.toFixed(1)} used{spend ? ` · ${spend.toFixed(1)} plotted` : ''} · <b>{Math.max(0, props.left - spend).toFixed(1)}</b> of {props.cap} left
              {record.moved ? ' · moved' : ''}
              {record.fired ? ' · fired' : ''}
            </span>
          </div>
          <div className="dst-movebar-track">
            <i className="is-used" style={{ width: `${(Math.min(used, scale) / scale) * 100}%` }} />
            <i className={`is-plot${over ? ' is-over' : ''}`} style={{ width: `${(Math.min(spend, Math.max(0, scale - used)) / scale) * 100}%` }} />
            {props.cap < bmf ? <i className="is-lost" style={{ width: `${((bmf - props.cap) / scale) * 100}%` }} title={record.firedBeforeMoving ? 'Fired first: half move' : 'Damaged: half speed'} /> : null}
            <span className="dst-movebar-half" style={{ left: '50%' }} title="Moving more than half makes its shots harder (p. 28)" />
          </div>
        </div>
      ) : null}

      {move && record && !el.destroyed ? (
        move.plotting ? (
          <div className="dst-row dst-plotrow">
            <span className={`dst-plotread num${over || plotted?.blockedAt ? ' is-over' : ''}`}>
              {move.plot === 0
                ? 'Click the table for each waypoint: 0 factors'
                : plotted?.blockedAt
                  ? `blocked by ${plotted.blockedBy?.replace('-', ' ')} — no factors`
                  : `${plotted?.length.toFixed(1)}″ for ${plotted?.factors.toFixed(1)} factors · ${(props.left - (plotted?.factors ?? 0)).toFixed(1)} left after`}
            </span>
            <button className={move.plot > 0 && !over && !plotted?.blockedAt ? 'primary' : undefined} onClick={move.onConfirm} disabled={move.plot === 0} aria-keyshortcuts="Enter">
              Move
            </button>
            <button onClick={move.onUndo} disabled={move.plot === 0} aria-keyshortcuts="Backspace">
              Remove last point
            </button>
            <button onClick={move.onCancel} aria-keyshortcuts="Escape">
              Cancel
            </button>
            <label className={`dst-toggle${move.canEvade ? '' : ' is-off'}`} title={move.canEvade ? 'Harder to hit until its next activation; needs easy or normal going all the way, and the unit may not fire (p. 27)' : 'Only fast hovercraft and grav vehicles move evasively (p. 26)'}>
              <input type="checkbox" checked={move.evasive} disabled={!move.canEvade} onChange={(e) => move.onEvasive(e.target.checked)} /> Evasive
            </label>
            <label className={`dst-toggle${move.travelBlocked ? ' is-off' : ''}`} title={move.travelBlocked ?? 'Double speed on roads; the element may not fire this activation (p. 25)'}>
              <input type="checkbox" checked={move.travel && !move.travelBlocked} disabled={!!move.travelBlocked} onChange={(e) => move.onTravel(e.target.checked)} /> Travel mode
            </label>
          </div>
        ) : (
          <div className="dst-row">
            <button onClick={move.onPlot} disabled={!!move.cannotMove} title={move.cannotMove ?? 'Or just click the ground where it should go'} aria-keyshortcuts="M">
              Plot a move
            </button>
            <span className="dst-row-note">{move.cannotMove ?? 'or click the ground on the map'}</span>
          </div>
        )
      ) : null}

      {stance && el.vehicle && !el.destroyed ? (
        <div className="dst-row dst-stance">
          <span className="dst-row-label">Stance</span>
          <span className="dst-seg">
            {STANCES.map((s) => {
              const refused = el.posture === s.p ? null : stance.refusals[s.p]
              return (
                <button key={s.p} className={el.posture === s.p ? 'is-on' : undefined} disabled={!!refused} title={refused ?? s.title} onClick={() => stance.onStance(s.p)}>
                  {s.label}
                </button>
              )
            })}
          </span>
          {stance.onRepair ? (
            <button onClick={stance.onRepair} disabled={!!stance.repairRefused} title={stance.repairRefused ?? 'Roll to bring its systems back: a 6 on a D6, or 3 and up with backup systems (p. 32)'}>
              Try a repair
            </button>
          ) : null}
        </div>
      ) : null}
      {stance && el.vehicle && !el.destroyed && Object.entries(stance.refusals).some(([p, r]) => r && p !== el.posture) && el.posture === 'none' ? (
        <p className="dst-card-note">Hull and turret down need cover: touch a hilltop, a wood edge or buildings.</p>
      ) : null}

      {fire ? (
        <div className="dst-fire">
          <div className="dst-fire-head">
            <span className="dst-row-label">Weapons</span>
            <span className="dst-row-note">{fire.locked ?? 'pick one, then click a lit enemy'}</span>
          </div>
          {fire.weapons.map((w, i) => {
            const on = sameWeapon(fire.armed, w.choice)
            const reach = Math.max(...w.bands.map((b) => b.upTo), 1)
            return (
              <div key={`${w.label}-${i}`} className={`dst-weapon${on ? ' is-armed' : ''}`}>
                <button className={on ? 'is-on' : undefined} onClick={() => fire.onArm(w.choice)} disabled={!!fire.locked} title={w.title} aria-keyshortcuts={String(i + 1)}>
                  {w.label}
                </button>
                <span className="dst-band-ruler" title={w.bands.map((b, j) => `${['close', 'medium', 'long'][j]} to ${b.upTo}″${b.die ? `, D${b.die}` : ''}`).join('; ')}>
                  {w.bands.map((b, j) => {
                    const from = j === 0 ? 0 : w.bands[j - 1]!.upTo
                    return (
                      <i key={j} className={`is-band-${j}`} style={{ width: `${((b.upTo - from) / reach) * 100}%` }}>
                        {b.die ? <em>D{b.die}</em> : null}
                        <span>{b.upTo}″</span>
                      </i>
                    )
                  })}
                </span>
                <span className="dst-weapon-chits">{w.chits}</span>
              </div>
            )
          })}
          {fire.note ? <p className="dst-card-note">{fire.note}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
