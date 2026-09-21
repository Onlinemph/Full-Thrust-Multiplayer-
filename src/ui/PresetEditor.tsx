import { useEffect, useMemo, useState } from 'react'

import { OPTIONAL_RULES } from '../data/optionalRules'
import { activePresetId, allPresets, deletePreset, isBuiltInPreset, savePreset, setActivePreset } from '../data/presetStore'
import {
  GEAR,
  RULE_KEYS,
  effectiveBans,
  parsePreset,
  presetIdFor,
  presetLink,
  unknownGear,
  type GearEntry,
  type RulesPreset,
} from '../data/rulesPreset'
import { TECH_BASE_OPTIONS, type TechBaseChoice } from '../data/techBaseCheck'
import { communityPresetsAvailable, listCommunityPresets, publishPreset, type CommunityPreset } from './communityPresets'

/**
 * House rules: a rules preset on the bench.
 *
 * A preset is a named list of what may be fitted and fielded and which of
 * the optional rules are on. It is edited here, kept on this browser's
 * shelf, written to a JSON file, carried in a link that applies it on a
 * click, and — where the build has a Supabase project — published to a
 * shelf other tables can take it from. The Shipyard designs under the
 * active one; a table's setup form applies one to the table.
 */
export interface PresetEditorProps {
  onClose: () => void
  /** Open on this preset (a link's, a table's), else the active one. */
  initial?: RulesPreset
  /** Offered when the editor is opened from a table's setup: apply it to that table. */
  onApply?: (preset: RulesPreset) => void
}

/** The gear list in the families a designer thinks in; the rest falls into the last group. */
const GEAR_GROUPS: ReadonlyArray<{ label: string; ids: readonly string[] }> = [
  { label: 'Beams', ids: ['beam', 'graser', 'heavy-graser', 'phaser', 'emp', 'needle-beam', 'twin-particle-array', 'meson-projector', 'gravitic-gun', 'pulser'] },
  { label: 'Kinetic', ids: ['k-gun', 'mkp', 'gatling', 'submunition-pack'] },
  { label: 'Torpedoes & plasma', ids: ['pulse-torpedo', 'plasma-cannon', 'plasma-bolt-launcher', 'fusion-array'] },
  { label: 'Ordnance', ids: ['heavy-missile', 'salvo-missile-rack', 'salvo-missile-launcher', 'antimatter-missile', 'rocket-pod', 'mine-rack', 'boarding-torpedo'] },
  { label: 'Special weapons', ids: ['transporter', 'spinal-beam', 'spinal-plasma', 'spinal-psp', 'nova-cannon', 'wave-gun'] },
  { label: 'Targeting & sensors', ids: ['firecon', 'advanced-firecon', 'adfc', 'advanced-adfc', 'enhanced-sensors', 'superior-sensors'] },
  { label: 'Point defence', ids: ['pds', 'ads', 'scattergun', 'grapeshot', 'minesweeper'] },
  { label: 'Electronic warfare', ids: ['ecm', 'area-ecm', 'stealth-field', 'stealth-hull', 'holofield', 'cloaking-device', 'cloaking-field', 'reflex-field', 'weasel-emitter', 'tuffley-cloak'] },
  { label: 'Small craft', ids: ['hangar-bay', 'launch-tube', 'catapult', 'fighter-rack', 'gunboat-rack', 'gunboat-bay', 'boat-bay', 'tender'] },
]

function groupedGear(): Array<{ label: string; entries: GearEntry[] }> {
  const placed = new Set<string>()
  const groups = GEAR_GROUPS.map((group) => {
    const entries = group.ids.map((id) => GEAR.find((g) => g.id === id)).filter((g): g is GearEntry => g !== undefined)
    for (const g of entries) placed.add(g.id)
    return { label: group.label, entries }
  }).filter((g) => g.entries.length > 0)
  const rest = GEAR.filter((g) => !placed.has(g.id))
  if (rest.length > 0) groups.push({ label: 'Crew, holds & the rest', entries: rest })
  return groups
}

type Tri = 'leave' | 'on' | 'off'

function blankPreset(): RulesPreset {
  return { version: 1, id: '', name: 'House rules', gear: { mode: 'ban', banned: [] }, table: {} }
}

export function PresetEditor({ onClose, initial, onApply }: PresetEditorProps) {
  const [shelf, setShelf] = useState(() => allPresets())
  const [draft, setDraft] = useState<RulesPreset>(() => structuredClone(initial ?? shelf.find((p) => p.id === activePresetId()) ?? blankPreset()))
  const [notice, setNotice] = useState<string | null>(null)
  const [author, setAuthor] = useState(() => draft.author ?? '')
  const [community, setCommunity] = useState<CommunityPreset[] | { error: string } | null>(null)
  const groups = useMemo(groupedGear, [])
  const onShelf = shelf.some((p) => p.id === draft.id)
  const builtIn = draft.id !== '' && isBuiltInPreset(draft.id)
  const bans = effectiveBans(draft)
  const unknown = unknownGear(draft)

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(id)
  }, [notice])

  const set = (patch: Partial<RulesPreset>) => setDraft((d) => ({ ...d, ...patch }))
  const listOf = (p: RulesPreset) => (p.gear.mode === 'ban' ? p.gear.banned : p.gear.allowed)
  const setList = (ids: string[]) => set({ gear: draft.gear.mode === 'ban' ? { mode: 'ban', banned: ids } : { mode: 'allow', allowed: ids } })
  const checked = (id: string) => (draft.gear.mode === 'ban' ? !draft.gear.banned.includes(id) : draft.gear.allowed.includes(id))
  /** A tick means "allowed" whichever way the list is kept. */
  const setAllowed = (id: string, allowed: boolean) => {
    const list = listOf(draft)
    const inList = draft.gear.mode === 'ban' ? !allowed : allowed
    setList(inList ? [...new Set([...list, id])] : list.filter((x) => x !== id))
  }
  const setAll = (ids: readonly string[], allowed: boolean) => {
    const list = new Set(listOf(draft))
    for (const id of ids) {
      const inList = draft.gear.mode === 'ban' ? !allowed : allowed
      if (inList) list.add(id)
      else list.delete(id)
    }
    setList([...list])
  }
  const switchMode = (mode: 'ban' | 'allow') => {
    if (mode === draft.gear.mode) return
    // The same gear stays allowed; only the way the list is written changes.
    const allowed = GEAR.filter((g) => checked(g.id)).map((g) => g.id)
    set({ gear: mode === 'allow' ? { mode: 'allow', allowed } : { mode: 'ban', banned: GEAR.filter((g) => !allowed.includes(g.id)).map((g) => g.id) } })
  }
  const triOf = (key: (typeof RULE_KEYS)[number]): Tri => (key in draft.table ? (draft.table[key] ? 'on' : 'off') : 'leave')
  const setTri = (key: (typeof RULE_KEYS)[number], value: Tri) => {
    const table = { ...draft.table }
    if (value === 'leave') delete (table as Record<string, unknown>)[key]
    else (table as Record<string, unknown>)[key] = value === 'on'
    set({ table })
  }
  const setTable = (key: (typeof RULE_KEYS)[number], value: unknown) => {
    const table = { ...draft.table }
    if (value === undefined) delete (table as Record<string, unknown>)[key]
    else (table as Record<string, unknown>)[key] = value
    set({ table })
  }

  const withId = (): RulesPreset => {
    const id = draft.id || presetIdFor(draft.name, new Set(shelf.map((p) => p.id)))
    const preset: RulesPreset = { ...draft, id, name: draft.name.trim() || 'House rules' }
    if (author.trim()) preset.author = author.trim()
    else delete preset.author
    return preset
  }
  const save = () => {
    const preset = withId()
    savePreset(preset)
    setDraft(preset)
    setShelf(allPresets())
    setNotice(`Saved "${preset.name}" to the shelf`)
  }
  const useInYard = () => {
    const preset = withId()
    savePreset(preset)
    setActivePreset(preset.id)
    setDraft(preset)
    setShelf(allPresets())
    setNotice(`The Shipyard now designs under "${preset.name}"`)
  }
  const download = () => {
    const preset = withId()
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${preset.id}.rules.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const copyLink = async () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const link = presetLink(withId(), base)
    try {
      await navigator.clipboard.writeText(link)
      setNotice('Link copied: anyone who opens it gets this preset')
    } catch {
      window.prompt('Copy this link', link)
    }
  }
  const importFile = async (file: File) => {
    const parsed = parsePreset(await file.text())
    if (typeof parsed === 'string') {
      setNotice(parsed)
      return
    }
    setDraft(parsed)
    setAuthor(parsed.author ?? '')
    setNotice(`Opened "${parsed.name}"; save it to keep it`)
  }
  const publish = async () => {
    const result = await publishPreset(withId(), author)
    setNotice('error' in result ? result.error : 'Published to the community shelf')
    if (!('error' in result)) setCommunity(null)
  }
  const loadCommunity = async () => {
    setCommunity(await listCommunityPresets())
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide preset-editor" onClick={(event) => event.stopPropagation()}>
        <div className="yard-head">
          <h2>House rules</h2>
          <label className="ds-shelf">
            Shelf{' '}
            <select
              value={onShelf ? draft.id : ''}
              onChange={(e) => {
                const found = shelf.find((p) => p.id === e.target.value)
                if (found) {
                  setDraft(structuredClone(found))
                  setAuthor(found.author ?? '')
                }
              }}
            >
              {!onShelf ? <option value="">(unsaved preset)</option> : null}
              {shelf.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {isBuiltInPreset(p.id) ? ' · shipped' : ''}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => { setDraft(blankPreset()); setAuthor('') }}>New preset</button>
          <span className="spacer" />
          {notice ? <span className="yard-legal">{notice}</span> : null}
          <button onClick={onClose}>Close</button>
        </div>
        <p>
          What a table allows and the rules it plays under, as one thing you can keep, send and click. The Shipyard designs under
          the active preset; a table applies one on its setup form; a battle file carries what was applied and replays the same
          whether or not the preset still exists.
        </p>

        <section>
          <div className="yard-pair">
            <label className="code-field">
              Name
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="code-field">
              Author
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="who wrote it" />
            </label>
          </div>
          <label className="code-field" style={{ width: '100%' }}>
            Description
            <input value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} placeholder="what this table is for" />
          </label>
          <p className="rule-detail">
            Id <code>{draft.id || presetIdFor(draft.name, new Set(shelf.map((p) => p.id)))}</code>
            {builtIn ? ' · a shipped preset: saving keeps your version in its place' : ''}
          </p>
        </section>

        <section>
          <h3>Gear</h3>
          <div className="panel-row">
            <label>
              <input type="radio" name="gear-mode" checked={draft.gear.mode === 'ban'} onChange={() => switchMode('ban')} /> Everything except what is unticked
            </label>
            <label>
              <input type="radio" name="gear-mode" checked={draft.gear.mode === 'allow'} onChange={() => switchMode('allow')} /> Only what is ticked
            </label>
            <span className="spacer" />
            <button onClick={() => setAll(GEAR.map((g) => g.id), true)}>Tick all</button>
            <button onClick={() => setAll(GEAR.map((g) => g.id), false)}>Untick all</button>
          </div>
          <p className="rule-detail">
            A tick is gear that may be fitted in the Shipyard and fielded at the table; {bans.length === 0 ? 'nothing is barred' : `${bans.length} barred`}.
            {unknown.length > 0 ? ` Unknown to this catalogue: ${unknown.join(', ')}.` : ''}
          </p>
          <div className="preset-gear">
            {groups.map((group) => (
              <div key={group.label} className="preset-group">
                <h4>
                  {group.label}
                  <span className="campaign-inline">
                    <button onClick={() => setAll(group.entries.map((g) => g.id), true)}>all</button>
                    <button onClick={() => setAll(group.entries.map((g) => g.id), false)}>none</button>
                  </span>
                </h4>
                <div className="preset-ticks">
                  {group.entries.map((entry) => (
                    <label key={entry.id} className={checked(entry.id) ? undefined : 'is-barred'}>
                      <input type="checkbox" checked={checked(entry.id)} onChange={(e) => setAllowed(entry.id, e.target.checked)} /> {entry.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>Optional rules</h3>
          <p className="rule-detail">Set a rule on or off, or leave it as the table has it.</p>
          <div className="preset-rules">
            {OPTIONAL_RULES.filter((rule) => rule.notYet === undefined).map((rule) => (
              <label key={rule.key} className="preset-rule">
                <select value={triOf(rule.key as (typeof RULE_KEYS)[number])} onChange={(e) => setTri(rule.key as (typeof RULE_KEYS)[number], e.target.value as Tri)}>
                  <option value="leave">leave</option>
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
                <span>
                  <b>{rule.label}</b> <span className="rule-ref">{rule.rule}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="campaign-inline">
            <label className="campaign-inline">
              Table size
              <select value={draft.table.tableScale === undefined ? '' : String(draft.table.tableScale)} onChange={(e) => setTable('tableScale', e.target.value === '' ? undefined : Number(e.target.value))}>
                <option value="">leave</option>
                <option value="1">the scenario’s</option>
                <option value="1.5">half again</option>
                <option value="2">double</option>
              </select>
            </label>
            <label className="campaign-inline">
              Movement
              <select value={draft.table.movementSystem ?? ''} onChange={(e) => setTable('movementSystem', e.target.value || undefined)}>
                <option value="">leave</option>
                <option value="cinematic">cinematic</option>
                <option value="vector">vector (12.12)</option>
              </select>
            </label>
            <label className="campaign-inline">
              Non-FTL hulls (11.8)
              <select value={draft.table.allowNonFtl === undefined ? '' : draft.table.allowNonFtl ? 'on' : 'off'} onChange={(e) => setTable('allowNonFtl', e.target.value === '' ? undefined : e.target.value === 'on')}>
                <option value="">leave</option>
                <option value="on">allowed</option>
                <option value="off">refused</option>
              </select>
            </label>
            <label className="campaign-inline">
              Tech base (15)
              <select value={draft.techBase ?? ''} onChange={(e) => set({ techBase: (e.target.value || undefined) as TechBaseChoice | undefined })}>
                <option value="">leave</option>
                {TECH_BASE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <div className="campaign-inline">
            {onApply ? (
              <button className="primary" onClick={() => onApply(withId())}>
                Apply to this table
              </button>
            ) : null}
            <button className={onApply ? undefined : 'primary'} onClick={save}>
              {onShelf ? 'Save' : 'Save to the shelf'}
            </button>
            <button onClick={useInYard}>Use in the Shipyard</button>
            {onShelf && !isBuiltInPreset(draft.id) ? (
              <button
                onClick={() => {
                  deletePreset(draft.id)
                  setShelf(allPresets())
                  setNotice(`Deleted "${draft.name}"`)
                  setDraft(blankPreset())
                }}
              >
                Delete
              </button>
            ) : null}
            <button onClick={download}>Save as a file</button>
            <label className="file-button">
              Open a file
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (file) await importFile(file)
                  event.target.value = ''
                }}
              />
            </label>
            <button onClick={copyLink}>Copy a link</button>
          </div>
        </section>

        {communityPresetsAvailable() ? (
          <section>
            <h3>Community shelf</h3>
            <div className="campaign-inline">
              <button onClick={publish} disabled={author.trim() === ''} title={author.trim() === '' ? 'Put your name in Author first' : undefined}>
                Publish this preset
              </button>
              <button onClick={loadCommunity}>{community === null ? 'Show what others published' : 'Refresh'}</button>
            </div>
            {community && 'error' in community ? <p className="rule-detail" style={{ color: 'var(--warn)' }}>{community.error}</p> : null}
            {community && !('error' in community) ? (
              community.length === 0 ? (
                <p className="rule-detail">Nothing published yet.</p>
              ) : (
                <div className="library-list">
                  {community.map((entry) => (
                    <div key={entry.id} className="panel-row">
                      <span>
                        <b>{entry.preset.name}</b> <span className="campaign-dim">by {entry.author || 'anonymous'}</span>
                        {entry.preset.description ? <span className="rule-detail"> · {entry.preset.description}</span> : null}
                      </span>
                      <span className="spacer" />
                      <button
                        onClick={() => {
                          setDraft(structuredClone(entry.preset))
                          setAuthor(entry.preset.author ?? entry.author)
                          setNotice(`Opened "${entry.preset.name}"; save it to keep it`)
                        }}
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
