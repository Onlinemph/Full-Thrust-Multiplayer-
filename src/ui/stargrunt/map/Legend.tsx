import { memo } from 'react'

import { BLOCKS_SIGHT } from '../../../dirtside/table/terrain'
import type { TerrainType } from '../../../dirtside/data/mobility'
import type { TerrainFeature } from '../../../stargrunt/types'
import { patternUrl } from '../../dirtside/map/defs'
import { TERRAIN_NAMES, TERRAIN_NOTES } from '../../dirtside/map/terrain'

/**
 * The key under the map: the same ground Dirtside stands on (its terrain
 * row's names, notes and patterns, `05-reuse-map.md` §4), plus Stargrunt's
 * own figures row — the marks `map/figures.tsx` and `map/overlays.tsx` draw.
 */

const ORDER: TerrainType[] = ['open', 'road', 'light-scrub', 'cultivated', 'rough', 'hills', 'mountains', 'light-woods', 'dense-woods', 'urban', 'building', 'rubble', 'wall', 'hedge', 'swamp', 'river', 'ford', 'open-water']

/**
 * Where Stargrunt's own reading of a type differs from Dirtside's (p. 12–13,
 * p. 56–57, and BRIEF-TERRAIN's model): a building is hard cover here, not
 * Dirtside's soft-by-contact; the streets and yards of a town are open
 * ground, not Dirtside's own urban-area rule; walls and hedges only exist at
 * this scale at all. Overrides the shared notes for exactly these rows.
 */
const SG_NOTES: Partial<Record<TerrainType, string>> = {
  urban: 'the streets and yards: open ground — the buildings give the real cover',
  building: 'hard cover; blocks sight',
  rubble: 'hard cover; no longer blocks sight',
  wall: 'hard cover against fire from beyond it',
  hedge: 'soft cover against fire from beyond it',
}

function Swatch({ type, pid }: { type: TerrainType; pid: string }) {
  const fillOf: Partial<Record<TerrainType, string>> = {
    open: patternUrl(pid, 'grass'),
    'light-woods': patternUrl(pid, 'lwoods'),
    'dense-woods': patternUrl(pid, 'dwoods'),
    rough: patternUrl(pid, 'rough'),
    'light-scrub': patternUrl(pid, 'scrub'),
    cultivated: patternUrl(pid, 'furrow-25'),
    swamp: patternUrl(pid, 'swamp'),
    'open-water': patternUrl(pid, 'water'),
  }
  const under: Partial<Record<TerrainType, string>> = { 'light-woods': 'var(--dst-woods-l)', 'dense-woods': 'var(--dst-woods-d)', rough: 'var(--dst-rough)', 'light-scrub': 'var(--dst-scrub)', swamp: 'var(--dst-swamp)' }
  return (
    <svg className="dst-legend-swatch" viewBox="0 0 2.8 1.8" width={28} height={18} aria-hidden="true">
      <rect width={2.8} height={1.8} style={{ fill: patternUrl(pid, 'grass') }} />
      {type === 'hills' || type === 'mountains' ? (
        <ellipse cx={1.4} cy={1.1} rx={1.3} ry={0.8} style={{ fill: type === 'hills' ? 'var(--dst-hill)' : 'var(--dst-mountain)', stroke: '#5a4b2c', strokeWidth: 0.06 }} />
      ) : type === 'road' ? (
        <rect x={0} y={0.55} width={2.8} height={0.7} style={{ fill: 'var(--dst-road)' }} />
      ) : type === 'river' || type === 'ford' ? (
        <rect x={0} y={0.52} width={2.8} height={0.76} style={{ fill: type === 'ford' ? '#9fb8c8' : 'var(--dst-water)' }} />
      ) : type === 'urban' ? (
        <rect x={0.3} y={0.3} width={2.2} height={1.2} style={{ fill: 'var(--dst-urban)' }} />
      ) : type === 'building' ? (
        <>
          <rect x={0.55} y={0.4} width={1.7} height={1.15} style={{ fill: 'var(--dst-building-wall)' }} />
          <rect x={0.7} y={0.5} width={1.4} height={0.95} style={{ fill: 'var(--dst-roof-cool-1)', stroke: 'var(--dst-roof-ridge-cool)', strokeWidth: 0.04 }} />
          <line x1={0.7} x2={2.1} y1={0.98} y2={0.98} stroke="var(--dst-roof-ridge-cool)" strokeWidth={0.06} opacity={0.8} />
        </>
      ) : type === 'rubble' ? (
        <>
          <polygon points="0.5,1.5 0.6,0.6 1.1,0.35 1.7,0.5 2.2,0.4 2.3,1.5" style={{ fill: 'var(--dst-rubble)', stroke: 'var(--dst-rubble-dark)', strokeWidth: 0.05 }} />
          <line x1={1.5} y1={1.3} x2={1.5} y2={0.7} stroke="var(--dst-rubble-stub)" strokeWidth={0.14} strokeLinecap="round" />
        </>
      ) : type === 'wall' ? (
        <>
          <line x1={0.2} x2={2.6} y1={0.9} y2={0.9} stroke="var(--dst-rubble-dark)" strokeWidth={0.32} />
          <line x1={0.2} x2={2.6} y1={0.9} y2={0.9} stroke="var(--dst-wall-stone)" strokeWidth={0.22} />
        </>
      ) : type === 'hedge' ? (
        <line x1={0.2} x2={2.6} y1={0.9} y2={0.9} stroke="var(--dst-hedge)" strokeWidth={0.34} strokeLinecap="round" strokeDasharray="0.02 0.3" />
      ) : (
        <>
          {under[type] ? <rect width={2.8} height={1.8} style={{ fill: under[type] }} /> : null}
          <rect width={2.8} height={1.8} style={{ fill: fillOf[type] ?? patternUrl(pid, 'grass') }} />
        </>
      )}
    </svg>
  )
}

export interface LegendProps {
  features: readonly TerrainFeature[]
  pid: string
  showSymbols: boolean
  onToggleSymbols: () => void
  onHoverType: (type: TerrainType | null) => void
}

export const Legend = memo(function Legend({ features, pid, showSymbols, onToggleSymbols, onHoverType }: LegendProps) {
  const present = new Set<TerrainType>(['open', ...features.map((f) => f.terrain)])
  const types = ORDER.filter((t) => present.has(t))
  return (
    <div className="dst-legend sg-legend" aria-label="Map key">
      <div className="dst-legend-row">
        {types.map((t) => {
          const note = SG_NOTES[t] ?? TERRAIN_NOTES[t]
          return (
            <span key={t} className="dst-legend-item" onPointerEnter={() => onHoverType(t === 'open' ? null : t)} onPointerLeave={() => onHoverType(null)} title={`${TERRAIN_NAMES[t]}${note ? `: ${note}` : ''}`}>
              <Swatch type={t} pid={pid} />
              <span className="dst-legend-text">
                <span className="dst-legend-name">
                  {TERRAIN_NAMES[t]}
                  {BLOCKS_SIGHT.includes(t) ? (
                    <svg className="dst-eye" viewBox="0 0 16 12" width={13} height={10} aria-label="blocks sight">
                      <path d="M1,6 Q8,-1 15,6 Q8,13 1,6 Z" fill="none" stroke="currentColor" strokeWidth={1.4} />
                      <circle cx={8} cy={6} r={2} fill="currentColor" />
                      <line x1={2} y1={11} x2={14} y2={1} stroke="currentColor" strokeWidth={1.6} />
                    </svg>
                  ) : null}
                </span>
              </span>
            </span>
          )
        })}
        <span className="spacer" />
        <button type="button" className={`dst-legend-toggle${showSymbols ? ' is-on' : ''}`} aria-pressed={showSymbols} onClick={onToggleSymbols}>
          Symbols
        </button>
      </div>
      {showSymbols ? (
        <div className="dst-legend-row is-markers">
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.35 -0.35 0.7 0.7" width={18} height={18}>
              <circle r={0.22} className="sg-figure-base is-north" />
            </svg>
            rifleman
          </span>
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.35 -0.35 0.7 0.7" width={18} height={18}>
              <circle r={0.22} className="sg-figure-base is-south" />
              <rect x={-0.02} y={-0.19} width={0.04} height={0.26} rx={0.02} className="sg-glyph" transform="rotate(20)" />
            </svg>
            support weapon
          </span>
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.35 -0.35 0.7 0.7" width={18} height={18}>
              <circle r={0.22} className="sg-figure-base is-north" />
              <path d="M0,-0.13 L0.04,-0.04 L0.14,-0.04 L0.06,0.02 L0.09,0.12 L0,0.06 L-0.09,0.12 L-0.06,0.02 L-0.14,-0.04 L-0.04,-0.04 Z" className="sg-glyph" />
            </svg>
            leader
          </span>
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.35 -0.35 0.7 0.7" width={18} height={18}>
              <circle r={0.22} className="sg-figure-base is-south" />
              <path d="M-0.09,0 H0.09 M0,-0.09 V0.09" className="sg-glyph sg-glyph-medic" strokeWidth={0.05} stroke="currentColor" />
            </svg>
            medic
          </span>
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.35 -0.35 0.7 0.7" width={18} height={18}>
              <circle r={0.22} className="sg-figure-base is-north is-wounded" />
              <circle r={0.29} className="sg-wound-ring" />
            </svg>
            wounded
          </span>
          <span className="dst-legend-item">
            <svg className="dst-legend-swatch is-counter" viewBox="-0.2 -0.2 0.4 0.4" width={18} height={18}>
              <path d="M-0.12,-0.12 L0.12,0.12 M-0.12,0.12 L0.12,-0.12" className="sg-dead-x" />
            </svg>
            dead
          </span>
          <span className="dst-legend-sep" />
          <span className="dst-legend-item">
            <span className="dst-key is-select" />
            selected
          </span>
          <span className="dst-legend-item">
            <span className="dst-key is-halo" />
            acting now
          </span>
          <span className="dst-legend-item">
            <span className="sg-key sg-key-pip" />x1–3 suppression
          </span>
          <span className="dst-legend-item">
            <span className="sg-key sg-key-ip">IP</span>in position
          </span>
          <span className="dst-legend-item">
            <span className="sg-key sg-key-dis">DIS</span>disorganised
          </span>
          <span className="dst-legend-item">
            <span className="sg-key sg-key-ring" />
            unit integrity (p. 11)
          </span>
          <span className="dst-legend-item">
            <span className="dst-key is-objective">?</span>objective
          </span>
        </div>
      ) : null}
    </div>
  )
})
