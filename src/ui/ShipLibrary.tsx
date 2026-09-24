import { useEffect, useMemo, useRef, useState } from 'react'

import type { ShipDesign } from '../engine/types'
import { allDesigns, SHIP_DESIGNS } from '../data/ships'
import { deleteDesign, savedDesigns } from '../data/shipyard'
import { designFileText, importDesign, parseDesignFile } from '../data/designFile'
import {
  communityAvailable,
  listCommunityDesigns,
  publishDesign,
  type CommunityDesign,
} from './community'
import { cpvPoints } from '../engine/battles'
import { CounterPreview } from './CounterPreview'
import { Ssd } from './Ssd'

/**
 * Browsing the ship designs.
 *
 * A Full Thrust player spends as long reading ship forms as playing — knowing
 * what a Petrograd carries is most of knowing how to fight one — so the library
 * shows real SSDs rather than a stat table.
 *
 * Three shelves. The fleet book is what the repository ships, grouped by
 * fleet because a fleet is the unit a player thinks in. The yard is this
 * player's own designs, which is also where a design file from a friend is
 * brought in. The community shelf is what other players have published to
 * the project behind the build: anyone can put a design up and anyone can
 * take one down into their own yard, and every hull that comes off it is
 * repriced and checked before it is shown.
 */

type Shelf = 'book' | 'yard' | 'community'

/** Where the author's name is kept, so publishing twice asks once. */
const AUTHOR_KEY = 'ftpc.author'

const ROSTER_IDS = new Set(SHIP_DESIGNS.map((d) => d.id))

export interface ShipLibraryProps {
  /** The selected sheet on paper. */
  onPrint?: (design: ShipDesign) => void
  onClose: () => void
  /** Take a design to the shipyard, to build on. */
  onOpenInYard?: (design: ShipDesign) => void
}

export function ShipLibrary({ onClose, onOpenInYard, onPrint }: ShipLibraryProps) {
  const [shelf, setShelf] = useState<Shelf>('book')
  const [yard, setYard] = useState<readonly ShipDesign[]>(() => savedDesigns())
  const [community, setCommunity] = useState<CommunityDesign[] | null>(null)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [author, setAuthor] = useState(() => readAuthor())
  const fileInput = useRef<HTMLInputElement>(null)

  const book = useMemo(
    () => allDesigns().filter((d) => ROSTER_IDS.has(d.id)),
    // The book does not change while the modal is open.
    [],
  )
  const fleets = useMemo(() => {
    const byFaction = new Map<string, ShipDesign[]>()
    for (const design of book) {
      const list = byFaction.get(design.faction) ?? []
      list.push(design)
      byFaction.set(design.faction, list)
    }
    // Within a fleet, smallest first: that is the order a player reads a fleet
    // list in, and it makes the point ladder visible. In CPV, the currency
    // the shelf prices in (18.3).
    for (const list of byFaction.values()) {
      list.sort((a, b) => cpvPoints(a.points, a.mass) - cpvPoints(b.points, b.mass))
    }
    return [...byFaction.entries()]
  }, [book])

  const shown: ShipDesign[] =
    shelf === 'book' ? book : shelf === 'yard' ? [...yard] : (community ?? []).map((c) => c.design)
  const [selectedId, setSelectedId] = useState(book[0]?.id ?? '')
  const selected = shown.find((d) => d.id === selectedId) ?? shown[0]
  const selectedRow = community?.find((c) => c.design.id === selected?.id)

  const loadShelf = () => {
    if (!communityAvailable()) return
    setBusy(true)
    setCommunityError(null)
    void listCommunityDesigns()
      .then((result) => {
        if ('error' in result) setCommunityError(result.error)
        else setCommunity(result)
      })
      .finally(() => setBusy(false))
  }
  // The shelf is read the first time it is looked at, not before.
  useEffect(() => {
    if (shelf === 'community' && community === null) loadShelf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf])

  const refreshYard = () => setYard(savedDesigns())

  const takeFile = (file: File) => {
    void file.text().then((text) => {
      const parsed = parseDesignFile(text)
      if (typeof parsed === 'string') {
        setNotice(parsed)
        return
      }
      const id = importDesign(parsed)
      refreshYard()
      setShelf('yard')
      setSelectedId(id)
      setNotice(`${parsed.name} is in the yard as ${id}.`)
    })
  }

  const download = (design: ShipDesign) => {
    const blob = new Blob([designFileText(design)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${design.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const publish = (design: ShipDesign) => {
    const name = author.trim()
    if (name === '') {
      setNotice('Put a name to it first — the shelf shows who published each design.')
      return
    }
    writeAuthor(name)
    setBusy(true)
    void publishDesign(design, name)
      .then((result) => {
        if ('error' in result) setNotice(result.error)
        else {
          setNotice(`${design.name} is on the shelf.`)
          setCommunity(null)
        }
      })
      .finally(() => setBusy(false))
  }

  const addToYard = (design: ShipDesign) => {
    const id = importDesign(design)
    refreshYard()
    setNotice(`${design.name} is in your yard as ${id}. It is in the fleet picker now.`)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide" onClick={(event) => event.stopPropagation()}>
        <h2>Ship library</h2>

        <div className="library-shelves" role="tablist">
          <button
            role="tab"
            aria-selected={shelf === 'book'}
            className={shelf === 'book' ? 'primary' : undefined}
            onClick={() => setShelf('book')}
          >
            Fleet book <span className="num">{book.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={shelf === 'yard'}
            className={shelf === 'yard' ? 'primary' : undefined}
            onClick={() => setShelf('yard')}
          >
            My yard <span className="num">{yard.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={shelf === 'community'}
            className={shelf === 'community' ? 'primary' : undefined}
            onClick={() => setShelf('community')}
          >
            Community{community ? <span className="num">{community.length}</span> : null}
          </button>
          <span className="spacer" />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) takeFile(file)
              event.target.value = ''
            }}
          />
          <button
            title="A design file from the shipyard, yours or a friend's, into the yard"
            onClick={() => fileInput.current?.click()}
          >
            Upload a design file
          </button>
        </div>

        {notice ? (
          <p className="library-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="library">
          <nav className="library-list">
            {shelf === 'book'
              ? fleets.map(([faction, list]) => (
                  <div key={faction}>
                    <h4>{faction}</h4>
                    {list.map((design) => (
                      <ShelfRow
                        key={design.id}
                        design={design}
                        selected={design.id === selected?.id}
                        onSelect={() => setSelectedId(design.id)}
                      />
                    ))}
                  </div>
                ))
              : null}

            {shelf === 'yard' ? (
              yard.length === 0 ? (
                <p className="rule-detail">
                  Nothing here yet. Save a design in the shipyard, upload a design file, or take
                  one off the community shelf.
                </p>
              ) : (
                yard.map((design) => (
                  <ShelfRow
                    key={design.id}
                    design={design}
                    selected={design.id === selected?.id}
                    onSelect={() => setSelectedId(design.id)}
                  />
                ))
              )
            ) : null}

            {shelf === 'community' ? (
              !communityAvailable() ? (
                <p className="rule-detail">
                  Not set up for this build. The community shelf lives in the same Supabase
                  project as remote play; the README has the steps.
                </p>
              ) : communityError ? (
                <p className="rule-detail" style={{ color: 'var(--damage)' }}>
                  {communityError}
                </p>
              ) : community === null ? (
                <p className="rule-detail">Reading the shelf…</p>
              ) : community.length === 0 ? (
                <p className="rule-detail">Nothing published yet. Yours could be first.</p>
              ) : (
                community.map((entry) => (
                  <ShelfRow
                    key={entry.id}
                    design={entry.design}
                    detail={`${entry.author || 'anonymous'}${
                      entry.publishedAt ? ` · ${entry.publishedAt.slice(0, 10)}` : ''
                    }`}
                    selected={entry.design.id === selected?.id}
                    onSelect={() => setSelectedId(entry.design.id)}
                  />
                ))
              )
            ) : null}
            {shelf === 'community' && communityAvailable() ? (
              <button disabled={busy} onClick={loadShelf}>
                {busy ? 'Reading…' : 'Refresh'}
              </button>
            ) : null}
          </nav>

          <div className="library-form">
            {selected ? (
              <>
                <div className="library-head">
                  <CounterPreview design={selected} size={64} />
                  <div className="library-actions">
                    {onOpenInYard ? (
                      <button onClick={() => onOpenInYard(selected)}>Open in the shipyard</button>
                    ) : null}
                    <button onClick={() => download(selected)}>Download</button>
                    {onPrint ? (
                      <button title="This sheet on paper" onClick={() => onPrint(selected)}>
                        Print
                      </button>
                    ) : null}
                    {shelf !== 'yard' ? (
                      <button onClick={() => addToYard(selected)}>Add to my yard</button>
                    ) : null}
                    {shelf === 'yard' ? (
                      <>
                        {communityAvailable() ? (
                          <button
                            className="primary"
                            disabled={busy}
                            title="Put this design on the community shelf for anyone to use"
                            onClick={() => publish(selected)}
                          >
                            Publish
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            deleteDesign(selected.id)
                            refreshYard()
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {shelf === 'yard' && communityAvailable() ? (
                  <label className="code-field library-author">
                    Publish as
                    <input
                      type="text"
                      value={author}
                      maxLength={40}
                      placeholder="your name or handle"
                      onChange={(event) => setAuthor(event.target.value)}
                    />
                  </label>
                ) : null}
                {selectedRow ? (
                  <p className="rule-detail">
                    Published by {selectedRow.author || 'anonymous'}
                    {selectedRow.publishedAt ? ` on ${selectedRow.publishedAt.slice(0, 10)}` : ''}.
                    Repriced from the construction tables on this table.
                  </p>
                ) : null}
                <Ssd design={selected} />
                {selected.notes ? (
                  <p className="rule-detail" style={{ marginTop: 'var(--gap)' }}>
                    {selected.provisional ? <b>Reconstruction. </b> : null}
                    {selected.notes}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="rule-detail">Pick a design to read its sheet.</p>
            )}
          </div>
        </div>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function ShelfRow({
  design,
  detail,
  selected,
  onSelect,
}: {
  design: ShipDesign
  detail?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className={`panel-row${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <span aria-hidden="true">
        <CounterPreview design={design} size={24} />
      </span>
      <span>
        {design.name}
        {detail ? <span className="library-detail">{detail}</span> : null}
      </span>
      <span className="spacer" />
      <span
        className="num"
        title={`${cpvPoints(design.points, design.mass)} Combat Points Value (18.3); ${design.points} points as built`}
      >
        {cpvPoints(design.points, design.mass)}
      </span>
    </button>
  )
}

function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeAuthor(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name)
  } catch {
    // A private window; the name lasts the session.
  }
}
