import { memo } from 'react'

import { FACTORS_PER_INCH, type Going, type TerrainType, goingOf, mobilityFamily } from '../../../dirtside/data/mobility'
import { BLOCKS_SIGHT } from '../../../dirtside/table/terrain'
import type { ElementState, TerrainFeature } from '../../../dirtside/table/types'
import type { InfantryElement } from '../../../dirtside/types'
import { INFANTRY_BASE, InfantrySilhouette, VEHICLE_BASE, VehicleSilhouette } from './counters'
import { FURROWS, patternUrl } from './defs'
import type { Silhouette } from './geometry'
import { TERRAIN_NAMES, TERRAIN_NOTES } from './terrain'

/**
 * The key under the map: only the ground this table has, each swatch drawn
 * with the map's own pattern, what it does to sight, and — with an element
 * selected — how that element takes it. A second row, on request, explains
 * the counters and the marks beside them.
 */

const ORDER: TerrainType[] = ['open', 'road', 'light-scrub', 'cultivated', 'rough', 'hills', 'mountains', 'light-woods', 'dense-woods', 'urban', 'swamp', 'river', 'ford', 'open-water']

const GOING_WORDS: Record<Going, string> = { easy: 'easy', normal: 'normal', poor: 'poor', difficult: 'difficult', impassable: 'no entry' }

function goingText(going: Going): string {
  if (going === 'impassable') return 'no entry'
  const f = FACTORS_PER_INCH[going]
  return `${GOING_WORDS[going]} · ${f === 0.5 ? '½' : f} per inch`
}

function Swatch({ type, pid, id }: { type: TerrainType; pid: string; id: string }) {
  const fillOf: Partial<Record<TerrainType, string>> = {
    open: patternUrl(pid, 'grass'),
    'light-woods': patternUrl(pid, 'lwoods'),
    'dense-woods': patternUrl(pid, 'dwoods'),
    rough: patternUrl(pid, 'rough'),
    'light-scrub': patternUrl(pid, 'scrub'),
    cultivated: patternUrl(pid, `furrow-${FURROWS[1]}`),
    swamp: patternUrl(pid, 'swamp'),
    'open-water': patternUrl(pid, 'water'),
  }
  const under: Partial<Record<TerrainType, string>> = { 'light-woods': 'var(--dst-woods-l)', 'dense-woods': 'var(--dst-woods-d)', rough: 'var(--dst-rough)', 'light-scrub': 'var(--dst-scrub)', swamp: 'var(--dst-swamp)' }
  return (
    <svg className="dst-legend-swatch" viewBox="0 0 2.8 1.8" width={28} height={18} aria-hidden="true" data-id={id}>
      <rect width={2.8} height={1.8} style={{ fill: patternUrl(pid, 'grass') }} />
      {type === 'hills' || type === 'mountains' ? (
        <>
          <ellipse cx={1.4} cy={1.1} rx={1.3} ry={0.8} style={{ fill: type === 'hills' ? 'var(--dst-hill)' : 'var(--dst-mountain)', stroke: '#5a4b2c', strokeWidth: 0.06 }} />
          <ellipse cx={1.3} cy={1.0} rx={0.8} ry={0.45} style={{ fill: type === 'hills' ? 'var(--dst-hill-step-2)' : 'var(--dst-mountain-step-2)', stroke: 'var(--dst-hill-line)', strokeWidth: 0.04 }} />
          <ellipse cx={1.2} cy={0.92} rx={0.35} ry={0.2} style={{ fill: type === 'hills' ? 'var(--dst-hill-step-4)' : 'var(--dst-mountain-step-4)', stroke: 'var(--dst-hill-line)', strokeWidth: 0.04 }} />
        </>
      ) : type === 'road' ? (
        <>
          <rect x={0} y={0.45} width={2.8} height={0.9} style={{ fill: 'var(--dst-verge)' }} />
          <rect x={0} y={0.55} width={2.8} height={0.7} style={{ fill: 'var(--dst-road)' }} />
        </>
      ) : type === 'river' || type === 'ford' ? (
        <>
          <rect x={0} y={0.4} width={2.8} height={1} style={{ fill: 'var(--dst-bank)' }} />
          <rect x={0} y={0.52} width={2.8} height={0.76} style={{ fill: type === 'ford' ? '#9fb8c8' : 'var(--dst-water)' }} />
          {type === 'ford' ? <line x1={0.2} x2={2.6} y1={0.9} y2={0.9} stroke="#e0d8c0" strokeWidth={0.2} strokeDasharray="0.18 0.22" /> : null}
        </>
      ) : type === 'urban' ? (
        <>
          <rect x={0.1} y={0.1} width={2.6} height={1.6} style={{ fill: 'var(--dst-urban)' }} />
          <rect x={0.3} y={0.3} width={0.9} height={0.5} style={{ fill: 'var(--dst-urban-roof)' }} />
          <rect x={1.4} y={0.3} width={1.1} height={0.5} style={{ fill: 'var(--dst-urban-roof)' }} />
          <rect x={0.3} y={1.0} width={1.4} height={0.5} style={{ fill: 'var(--dst-urban-roof)' }} />
        </>
      ) : (
        <>
          {under[type] ? <rect width={2.8} height={1.8} style={{ fill: under[type] }} /> : null}
          <rect width={2.8} height={1.8} style={{ fill: fillOf[type] ?? patternUrl(pid, 'grass') }} />
        </>
      )}
    </svg>
  )
}

function CounterSwatch({ look, inf, side = 'north' }: { look?: Silhouette; inf?: InfantryElement; side?: 'north' | 'south' }) {
  const base = look ? VEHICLE_BASE : INFANTRY_BASE
  return (
    <svg className="dst-legend-swatch is-counter" viewBox="-0.75 -1.0 1.5 2.0" width={18} height={24} aria-hidden="true">
      <g transform={look ? 'rotate(0)' : 'rotate(0)'}>
        <rect x={base.x} y={base.y} width={base.w} height={base.h} rx={look ? 0.12 : 0.18} style={{ fill: `var(--dst-${side})`, stroke: 'var(--dst-outline)', strokeWidth: 0.06 }} />
        {look ? <VehicleSilhouette look={look} /> : inf ? <InfantrySilhouette inf={inf} /> : null}
        {look ? <polygon points="-0.2,-0.65 0,-0.88 0.2,-0.65" fill="var(--dst-ink)" /> : null}
      </g>
    </svg>
  )
}

export interface LegendProps {
  features: readonly TerrainFeature[]
  pid: string
  selected: ElementState | null
  showMarkers: boolean
  onToggleMarkers: () => void
  onHoverType: (type: TerrainType | null) => void
}

export const Legend = memo(function Legend({ features, pid, selected, showMarkers, onToggleMarkers, onHoverType }: LegendProps) {
  const present = new Set<TerrainType>(['open', ...features.map((f) => f.terrain)])
  const types = ORDER.filter((t) => present.has(t))
  const family = selected ? (selected.vehicle ? mobilityFamily(selected.vehicle.mobility) : 'infantry') : null
  const wades = !!selected?.vehicle?.amphibious || selected?.infantry?.troops === 'powered'
  return (
    <div className="dst-legend" aria-label="Map key">
      <div className="dst-legend-row">
        {/* Always there and always the same size, so picking a model never changes the key's height and the map above it holds still. */}
        <span className={`dst-legend-for${selected && family ? '' : ' is-empty'}`} title={selected && family ? `How ${selected.name} takes each kind of ground` : 'Pick a model to see how it takes each kind of ground'}>
          <span>{selected && family ? 'Going for' : 'Going'}</span>
          <b>{selected && family ? selected.name : 'pick a model'}</b>
        </span>
        {types.map((t) => {
          const going = family ? goingOf(family, t, wades) : null
          const note = TERRAIN_NOTES[t]
          return (
            <span key={t} className="dst-legend-item" onPointerEnter={() => onHoverType(t === 'open' ? null : t)} onPointerLeave={() => onHoverType(null)} title={`${TERRAIN_NAMES[t]}${note ? `: ${note}` : ''}${going ? ` · ${selected!.name}: ${goingText(going)}` : ''}`}>
              <Swatch type={t} pid={pid} id={t} />
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
                <span className={`dst-legend-going ${going ? `is-${going}` : 'is-empty'}`} aria-hidden={going ? undefined : true}>
                  {going ? GOING_WORDS[going] : '·'}
                </span>
              </span>
            </span>
          )
        })}
        <span className="spacer" />
        <button type="button" className={`dst-legend-toggle${showMarkers ? ' is-on' : ''}`} aria-pressed={showMarkers}
          onClick={(event) => {
            onToggleMarkers()
            // From a click, the keyboard goes back to the map (see TableMap's toolbar).
            if (event.detail > 0) (event.currentTarget.closest('.dst-mapwrap') as HTMLElement | null)?.focus({ preventScroll: true })
          }}
        >
          Symbols
        </button>
      </div>
      {showMarkers ? (
        <div className="dst-legend-row is-markers">
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'tracks', body: 'turret', label: '' }} />tank</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'tracks', body: 'ifv', label: '' }} />carrier</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'wheels', body: 'turret', label: '' }} />wheeled</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'skirt', body: 'turret', label: '' }} side="south" />hover (GEV)</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'grav', body: 'turret', label: '' }} side="south" />grav</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'legs', body: 'turret', label: '' }} />walker</span>
          <span className="dst-legend-item"><CounterSwatch look={{ gear: 'tracks', body: 'artillery', label: '' }} />artillery</span>
          <span className="dst-legend-item"><CounterSwatch inf={{ troops: 'line', team: 'rifle' }} />rifle team</span>
          <span className="dst-legend-item"><CounterSwatch inf={{ troops: 'line', team: 'apsw' }} side="south" />support team</span>
          <span className="dst-legend-sep" />
          <span className="dst-legend-item"><span className="dst-key is-select" />selected</span>
          <span className="dst-legend-item"><span className="dst-key is-halo" />acting now</span>
          <span className="dst-legend-item" title="Green, Regular or Veteran, and the leader's number: 1 is the best (p. 18)"><span className="dst-key is-quality">R2</span>quality · leadership</span>
          <span className="dst-legend-item"><span className="dst-key is-target" />can be shot</span>
          <span className="dst-legend-item"><span className="dst-key is-noshot" />no shot</span>
          <span className="dst-legend-item"><span className="dst-key is-reticle" />in the volley</span>
          <span className="dst-legend-item"><span className="dst-key is-spent" />activated</span>
          <span className="dst-legend-item"><span className="dst-key is-berm" />hull down</span>
          <span className="dst-legend-item"><span className="dst-key is-sandbags" />dug in</span>
          <span className="dst-legend-item"><span className="dst-key is-move" />move left</span>
          <span className="dst-legend-item"><span className="dst-key is-fire" />fire left</span>
          <span className="dst-legend-item"><span className="dst-key is-pip">D</span>damaged</span>
          <span className="dst-legend-item"><span className="dst-key is-pip is-ring">I</span>immobilised</span>
          <span className="dst-legend-item"><span className="dst-key is-pip is-sys">S</span>systems down</span>
          <span className="dst-legend-item"><span className="dst-key is-objective">?</span>objective</span>
        </div>
      ) : null}
    </div>
  )
})
