import { memo } from 'react'

/**
 * The map's patterns, in inches: grass flecks, tree canopies, rocks, tufts,
 * furrows, reeds, ripples and the hatches of zones. Every id carries the
 * map's own prefix so a preview and the table can share a page. The legend's
 * swatches refer to these same patterns.
 */
export const patternId = (pid: string, name: string) => `${pid}-${name}`
export const patternUrl = (pid: string, name: string) => `url(#${pid}-${name})`

/** The four furrow directions a field is ploughed in, chosen per field. */
export const FURROWS = [0, 25, 90, 115]

const v = (name: string) => ({ fill: `var(--dst-${name})` })
const s = (name: string, width: number) => ({ stroke: `var(--dst-${name})`, strokeWidth: width })

export const MapDefs = memo(function MapDefs({ pid }: { pid: string }) {
  const id = (name: string) => patternId(pid, name)
  return (
    <defs>
      <pattern id={id('grass')} width={3} height={3} patternUnits="userSpaceOnUse">
        <rect width={3} height={3} style={v('ground')} />
        <g style={v('ground-fleck-1')}>
          <circle cx={0.3} cy={0.4} r={0.06} />
          <circle cx={1.7} cy={0.2} r={0.05} />
          <circle cx={2.4} cy={1.3} r={0.07} />
          <circle cx={1.1} cy={2.2} r={0.05} />
          <circle cx={2.8} cy={2.6} r={0.06} />
          <circle cx={0.6} cy={1.6} r={0.05} />
        </g>
        <g style={v('ground-fleck-2')}>
          <circle cx={1.2} cy={0.9} r={0.06} />
          <circle cx={2.1} cy={2.0} r={0.05} />
          <circle cx={0.2} cy={2.7} r={0.06} />
          <circle cx={2.7} cy={0.6} r={0.05} />
        </g>
      </pattern>
      <pattern id={id('grid')} width={6} height={6} patternUnits="userSpaceOnUse">
        <path d="M6,0 V6 H0" fill="none" style={s('grid', 0.035)} />
      </pattern>
      <pattern id={id('lwoods')} width={2.2} height={2.2} patternUnits="userSpaceOnUse">
        <g style={{ ...v('woods-l-tree'), stroke: '#2f4526', strokeWidth: 0.05 }}>
          <circle cx={0.5} cy={0.6} r={0.42} />
          <circle cx={1.65} cy={0.95} r={0.36} />
          <circle cx={1.0} cy={1.75} r={0.4} />
          <circle cx={2.2} cy={2.2} r={0.3} />
          <circle cx={0} cy={0} r={0.3} />
          <circle cx={2.2} cy={0} r={0.3} />
          <circle cx={0} cy={2.2} r={0.3} />
        </g>
        <g fill="#6f9350">
          <circle cx={0.38} cy={0.48} r={0.14} />
          <circle cx={1.55} cy={0.85} r={0.12} />
          <circle cx={0.88} cy={1.63} r={0.13} />
        </g>
      </pattern>
      <pattern id={id('dwoods')} width={1.5} height={1.5} patternUnits="userSpaceOnUse">
        <g style={{ ...v('woods-d-tree'), stroke: '#1b2c17', strokeWidth: 0.05 }}>
          <circle cx={0.35} cy={0.35} r={0.4} />
          <circle cx={1.15} cy={0.45} r={0.38} />
          <circle cx={0.75} cy={1.05} r={0.42} />
          <circle cx={1.45} cy={1.3} r={0.3} />
          <circle cx={0.05} cy={1.25} r={0.3} />
        </g>
        <g fill="#426638">
          <circle cx={0.25} cy={0.25} r={0.12} />
          <circle cx={1.05} cy={0.35} r={0.11} />
          <circle cx={0.65} cy={0.95} r={0.12} />
        </g>
      </pattern>
      <pattern id={id('rough')} width={1.6} height={1.6} patternUnits="userSpaceOnUse">
        <g style={{ ...v('rough-rock-1'), ...s('rough-rock-2', 0.03) }}>
          <polygon points=".2,.3 .42,.2 .5,.42 .3,.52" />
          <polygon points="1.0,.15 1.25,.25 1.15,.45 .95,.38" />
          <polygon points=".7,.9 .95,.85 1.0,1.1 .78,1.15" />
          <polygon points="1.3,1.2 1.5,1.28 1.42,1.48 1.22,1.42" />
          <polygon points=".15,1.2 .32,1.15 .35,1.35 .18,1.4" />
        </g>
        <g fill="#5f5c49">
          <circle cx={0.6} cy={0.6} r={0.05} />
          <circle cx={1.4} cy={0.7} r={0.04} />
          <circle cx={0.4} cy={0.95} r={0.04} />
        </g>
      </pattern>
      <pattern id={id('mountain')} width={1.8} height={1.6} patternUnits="userSpaceOnUse">
        <g fill="rgba(40,34,26,.35)">
          <polygon points=".2,.7 .5,.2 .8,.7" />
          <polygon points="1.1,1.5 1.4,1.0 1.7,1.5" />
        </g>
        <g fill="rgba(235,225,205,.3)">
          <polygon points=".5,.2 .58,.34 .5,.36 .44,.3" />
          <polygon points="1.4,1.0 1.48,1.14 1.4,1.16 1.34,1.1" />
        </g>
      </pattern>
      <pattern id={id('scrub')} width={1.4} height={1.4} patternUnits="userSpaceOnUse">
        <g fill="none" strokeLinecap="round" style={s('scrub-tuft', 0.05)}>
          <path d="M.2,.5 l.08,-.22 M.28,.5 v-.26 M.36,.5 l-.08,-.22" />
          <path d="M.9,1.1 l.08,-.22 M.98,1.1 v-.26 M1.06,1.1 l-.08,-.22" />
        </g>
        <g fill="#5c6a38">
          <circle cx={1.05} cy={0.35} r={0.13} />
          <circle cx={0.35} cy={1.15} r={0.11} />
        </g>
      </pattern>
      {FURROWS.map((deg) => (
        <pattern key={deg} id={id(`furrow-${deg}`)} width={0.32} height={1} patternUnits="userSpaceOnUse" patternTransform={`rotate(${deg})`}>
          <rect width={0.32} height={1} style={v('field')} />
          <rect width={0.07} height={1} style={v('field-furrow')} />
        </pattern>
      ))}
      <pattern id={id('swamp')} width={1.6} height={1.2} patternUnits="userSpaceOnUse">
        <g strokeLinecap="round" style={s('swamp-water', 0.05)}>
          <path d="M.1,.3 h.45 M.8,.85 h.5" />
        </g>
        <g strokeLinecap="round" style={s('swamp-reed', 0.045)}>
          <path d="M1.1,.4 l-.07,-.24 M1.14,.4 v-.28 M1.18,.4 l.07,-.24 M.3,.95 l-.07,-.24 M.34,.95 v-.28 M.38,.95 l.07,-.24" />
        </g>
      </pattern>
      <pattern id={id('water')} width={2} height={1} patternUnits="userSpaceOnUse">
        <rect width={2} height={1} style={v('water')} />
        <path d="M.2,.45 q.25,-.14 .5,0 M1.2,.9 q.25,-.14 .5,0" fill="none" stroke="rgba(220,240,255,.28)" strokeWidth={0.045} />
      </pattern>
      <pattern id={id('hatch-north')} width={0.6} height={0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.06} height={0.6} style={{ fill: 'var(--dst-north)', opacity: 0.22 }} />
      </pattern>
      <pattern id={id('hatch-south')} width={0.6} height={0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.06} height={0.6} style={{ fill: 'var(--dst-south)', opacity: 0.22 }} />
      </pattern>
      <pattern id={id('hatch-ordnance')} width={0.5} height={0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.06} height={0.5} style={{ fill: 'var(--dst-strike)', opacity: 0.5 }} />
      </pattern>
      <pattern id={id('hatch-fallout')} width={0.5} height={0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width={0.05} height={0.5} style={{ fill: 'var(--dst-fallout)', opacity: 0.35 }} />
      </pattern>
      <pattern id={id('hatch-down')} width={0.18} height={0.18} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={0.05} height={0.18} fill="rgba(147,160,189,.9)" />
      </pattern>
    </defs>
  )
})
