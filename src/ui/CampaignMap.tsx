import { useMemo } from 'react'

import type { CampaignState, Hex, PendingBattle, PlayerId, PlottedMove, TaskForce } from '../campaign/types'
import { hexDistance, hexKey, hexesWithin, systemAt } from '../campaign/map'

/**
 * The star map: one hex a parsec (Scale), drawn as a plotting chart — thin
 * hex rules on the void, a star where the setup put one, a ring where a
 * colony is, a counter where a task force stands, a dashed track where one
 * is plotted to go. What a viewer sees of a system is what their side has
 * explored: an unexplored star is a star and nothing else.
 */
export interface CampaignMapProps {
  state: CampaignState
  /** Whose eyes the map is read through. */
  viewer: PlayerId
  selected: Hex | null
  onSelect: (hex: Hex) => void
  /** A plot being written: drawn as it stands, from the force's hex. */
  drafting?: { taskForce: TaskForce; legs: PlottedMove[] } | null
}

const SIZE = 22
const SQRT3 = Math.sqrt(3)

/** Pointy-top axial to pixels, the same plane `layoutStars` lays homes on. */
export function hexCentre(hex: Hex): { x: number; y: number } {
  return { x: SIZE * SQRT3 * (hex.q + hex.r / 2), y: SIZE * 1.5 * hex.r }
}

function hexOutline(): string {
  const points: string[] = []
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    points.push(`${(SIZE * Math.cos(angle)).toFixed(2)},${(SIZE * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

/** Colour a player's markers take, by seat. */
export function playerColour(state: CampaignState, id: PlayerId): string {
  const index = state.players.findIndex((p) => p.id === id)
  return ['var(--side-a)', 'var(--side-b)', 'var(--side-c)', 'var(--ordnance)'][index] ?? 'var(--side-neutral)'
}

export function CampaignMap({ state, viewer, selected, onSelect, drafting }: CampaignMapProps) {
  const radius = state.map.radius
  const cells = useMemo(() => hexesWithin({ q: 0, r: 0 }, radius), [radius])
  const outline = useMemo(hexOutline, [])
  const extent = SIZE * SQRT3 * (radius + 1)
  const width = extent * 2
  const height = SIZE * 1.5 * (radius + 1) * 2 + SIZE
  const viewBox = `${-extent} ${-height / 2} ${width} ${height}`

  const forcesByHex = new Map<string, TaskForce[]>()
  for (const tf of state.taskForces) {
    const key = hexKey(tf.hex)
    forcesByHex.set(key, [...(forcesByHex.get(key) ?? []), tf])
  }
  const battlesByHex = new Map<string, PendingBattle[]>()
  for (const battle of state.battles) {
    if (battle.resolved) continue
    const key = hexKey(battle.hex)
    battlesByHex.set(key, [...(battlesByHex.get(key) ?? []), battle])
  }
  const selectedKey = selected ? hexKey(selected) : null

  return (
    <svg className="campaign-map" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Star map">
      <g className="campaign-cells">
        {cells.map((hex) => {
          const { x, y } = hexCentre(hex)
          const key = hexKey(hex)
          return (
            <g
              key={key}
              className={`campaign-cell${key === selectedKey ? ' is-selected' : ''}`}
              data-hex={key}
              transform={`translate(${x} ${y})`}
              onClick={() => onSelect(hex)}
            >
              <polygon points={outline} />
            </g>
          )
        })}
      </g>

      <g className="campaign-plots">
        {state.taskForces
          .filter((tf) => tf.owner === viewer && tf.plot.length > 0)
          .map((tf) => (
            <Track key={tf.id} from={tf.hex} legs={tf.plot} colour={playerColour(state, tf.owner)} />
          ))}
        {drafting && drafting.legs.length > 0 ? (
          <Track from={drafting.taskForce.hex} legs={drafting.legs} colour="var(--thrust)" drafting />
        ) : null}
      </g>

      <g className="campaign-stars">
        {Object.values(state.map.systems).map((system) => {
          const { x, y } = hexCentre(system.hex)
          const explored = system.exploredBy.includes(viewer)
          const colonies = state.colonies.filter((c) => c.systemId === system.id)
          const owners = [...new Set(colonies.map((c) => c.owner))]
          return (
            <g key={system.id} className="campaign-star" transform={`translate(${x} ${y})`} onClick={() => onSelect(system.hex)}>
              {owners.map((owner, i) => (
                <circle key={owner} r={9 + i * 3} className="campaign-colony-ring" style={{ stroke: playerColour(state, owner) }} />
              ))}
              {system.feature === 'nebula' && explored ? <circle r={SIZE * 0.8} className="campaign-nebula" /> : null}
              {system.feature === 'dense-asteroid-field' && explored ? <circle r={SIZE * 0.7} className="campaign-rocks" /> : null}
              <circle r={system.feature === 'multiple-star' && explored ? 5 : 3.5} className={`campaign-sun${explored ? ' is-explored' : ''}`} />
              {colonies.some((c) => c.commandPost && c.owner === viewer) ? (
                <rect x={-3} y={-3} width={6} height={6} className="campaign-post" transform="rotate(45)" />
              ) : null}
              <text y={SIZE * 0.95} textAnchor="middle" className="campaign-star-name">
                {system.name}
              </text>
            </g>
          )
        })}
      </g>

      <g className="campaign-forces">
        {[...forcesByHex.values()].map((forces) => {
          const { x, y } = hexCentre(forces[0]!.hex)
          const hasSystem = systemAt(state.map, forces[0]!.hex) !== undefined
          return forces.map((tf, i) => {
            const angle = (Math.PI * 2 * i) / Math.max(forces.length, 3) - Math.PI / 2
            const spread = hasSystem ? SIZE * 0.55 : SIZE * 0.3
            const ox = forces.length === 1 && !hasSystem ? 0 : Math.cos(angle) * spread
            const oy = forces.length === 1 && !hasSystem ? 0 : Math.sin(angle) * spread
            const mine = tf.owner === viewer
            const label = tf.scout ? 'S' : tf.ships.length > 0 ? String(tf.ships.length) : 'T'
            return (
              <g
                key={tf.id}
                className={`campaign-force${mine ? ' is-mine' : ''}`}
                transform={`translate(${x + ox} ${y + oy})`}
                style={{ color: playerColour(state, tf.owner) }}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(tf.hex)
                }}
              >
                <title>{`${tf.name}: ${tf.ships.length} ships${tf.transports ? `, ${tf.transports} transports` : ''}`}</title>
                {tf.scout ? <circle r={4} /> : <polygon points="-5,4 5,4 0,-5" />}
                <text y={tf.scout ? 2.6 : 2.8} textAnchor="middle">
                  {label}
                </text>
              </g>
            )
          })
        })}
        {[...battlesByHex.entries()].map(([key, battles]) => {
          const { x, y } = hexCentre(battles[0]!.hex)
          return (
            <g key={`battle-${key}`} className="campaign-battle" transform={`translate(${x} ${y - SIZE * 0.55})`}>
              <title>{battles.length === 1 ? 'A battle to fight' : `${battles.length} battles to fight`}</title>
              <path d="M-5,-5 L5,5 M5,-5 L-5,5" />
            </g>
          )
        })}
      </g>

      {selected && !systemAt(state.map, selected) ? (
        <text x={hexCentre(selected).x} y={hexCentre(selected).y + SIZE * 0.85} textAnchor="middle" className="campaign-star-name">
          {hexKey(selected)}
        </text>
      ) : null}
    </svg>
  )
}

function Track({ from, legs, colour, drafting }: { from: Hex; legs: PlottedMove[]; colour: string; drafting?: boolean }) {
  const points = [from, ...legs.map((leg) => leg.to)].map(hexCentre)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const end = points[points.length - 1]!
  return (
    <g className={`campaign-track${drafting ? ' is-drafting' : ''}`} style={{ color: colour }}>
      <path d={d} />
      <circle cx={end.x} cy={end.y} r={3} />
      {legs.map((leg) => {
        const p = hexCentre(leg.to)
        return (
          <text key={`${leg.turn}-${hexKey(leg.to)}`} x={p.x + 6} y={p.y - 6} className="campaign-track-turn">
            T{leg.turn}
          </text>
        )
      })}
    </g>
  )
}

/** How far a hex is from the nearest of a player's command posts, for the chart's notes. */
export function distanceFromPosts(hex: Hex, posts: readonly Hex[]): number | null {
  if (posts.length === 0) return null
  return Math.min(...posts.map((post) => hexDistance(post, hex)))
}
