import { useMemo, useState } from 'react'

import { allDesigns } from '../data/ships'
import { Ssd } from './Ssd'

/**
 * Browsing the ship designs.
 *
 * A Full Thrust player spends as long reading ship forms as playing — knowing
 * what a Petrograd carries is most of knowing how to fight one — so the library
 * shows real SSDs rather than a stat table. Grouped by fleet, because a fleet
 * is the unit a player thinks in.
 */
export function ShipLibrary({ onClose }: { onClose: () => void }) {
  const designs = useMemo(() => allDesigns(), [])
  const [selectedId, setSelectedId] = useState(designs[0]?.id ?? '')
  const selected = designs.find((d) => d.id === selectedId) ?? designs[0]

  const fleets = useMemo(() => {
    const byFaction = new Map<string, typeof designs>()
    for (const design of designs) {
      const list = byFaction.get(design.faction) ?? []
      list.push(design)
      byFaction.set(design.faction, list)
    }
    // Within a fleet, smallest first: that is the order a player reads a fleet
    // list in, and it makes the point ladder visible.
    for (const list of byFaction.values()) list.sort((a, b) => a.points - b.points)
    return [...byFaction.entries()]
  }, [designs])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide" onClick={(event) => event.stopPropagation()}>
        <h2>Ship library</h2>

        <div className="library">
          <nav className="library-list">
            {fleets.map(([faction, list]) => (
              <div key={faction}>
                <h4>{faction}</h4>
                {list.map((design) => (
                  <button
                    key={design.id}
                    className={`panel-row${design.id === selectedId ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(design.id)}
                  >
                    <span>{design.name}</span>
                    <span className="spacer" />
                    <span className="num">{design.points}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="library-form">
            {selected ? (
              <>
                <Ssd design={selected} />
                {selected.notes ? (
                  <p className="rule-detail" style={{ marginTop: 'var(--gap)' }}>
                    {selected.provisional ? <b>Reconstruction. </b> : null}
                    {selected.notes}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
