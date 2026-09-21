import type { ShipDesign } from '../engine/types'
import { useState } from 'react'

import { SCENARIOS, type Scenario } from '../data/scenarios'
import {
  newCustomScenario,
  picksOf,
  scenarioFor,
  scenarioProblem,
  withForces,
} from '../data/customScenario'
import { deleteScenario, saveScenario, savedScenarios } from '../data/scenarioStore'
import { ScenarioBuilder } from './ScenarioBuilder'
import type { GameSetup } from '../data/savedGame'
import { BATTLE_TYPE_LABELS, type BattleType } from '../engine/battles'
import { TECH_BASE_OPTIONS, type TechBaseChoice } from '../data/techBaseCheck'
import { TechBasePanel } from './TechBasePanel'
import { FACTIONS, factionById, factionTraitCoverage } from '../data/factions'
import { FleetPicker } from './FleetPicker'
import { currentSetup, newGame } from './store'
import { OPTIONAL_RULES } from '../data/optionalRules'
import { allPresets } from '../data/presetStore'
import { applyPreset, gearLabel, presetFromSetup, setupMatchesPreset } from '../data/rulesPreset'
import { PresetEditor } from './PresetEditor'

export { OPTIONAL_RULES }

/**
 * Starting a battle: the scenario, the dice seed, and which optional rules the
 * table has agreed to.
 *
 * Full Thrust is unusually full of optional rules — the book flags them as
 * optional in the heading and expects players to settle them beforehand — so
 * they belong here, before the first order is written, rather than as switches
 * to be found mid-game. They ride in the setup, which means a battle file
 * carries the rules it was fought under and replays correctly however the
 * table's habits change later.
 */

/**
 * The setup as a form: every choice the table makes before the first order,
 * bound to a draft the caller holds. The New battle modal holds the draft in
 * its own state and starts a battle from it; the match lobby binds it to the
 * host's setup, live, and shows the guest the same form with nothing on it
 * that can be pressed.
 */
export interface SetupFormProps {
  draft: GameSetup
  setDraft: (update: (draft: GameSetup) => GameSetup) => void
  /** The guest's view of the host's rules: readable, not pressable. */
  readOnly?: boolean
  /** The fleet picker is here in the modal; in the lobby each console has its own. */
  showFleets?: boolean
  /** Handing a fleet to the computer is a home-table thing. */
  showAi?: boolean
  /** A picked fleet's sheets on paper (the picker's button). */
  onPrint?: (title: string, designs: ShipDesign[]) => void
}

export function SetupForm({
  draft,
  setDraft,
  readOnly = false,
  showFleets = true,
  showAi = true,
  onPrint,
}: SetupFormProps) {
  const toggle = (key: keyof GameSetup) =>
    setDraft((d) => ({ ...d, [key]: !d[key] } as GameSetup))

  /* The rules preset the table is on: the one its setup names, while the
     setup still says what that preset says. Any edit above takes it off
     the preset and the select reads "custom" until one is applied again. */
  const [editingPreset, setEditingPreset] = useState(false)
  const presets = allPresets()
  const onPreset = draft.rulesPreset && presets.find((p) => p.id === draft.rulesPreset?.id)
  const presetId = onPreset && setupMatchesPreset(draft, onPreset) ? onPreset.id : ''
  const bans = draft.bannedSystems ?? []

  /* The scenario the draft names: one of the shipped ones, or the one it
     carries. A custom scenario is edited in place on this form, and its
     forces are written from the picks so it is complete on its own. */
  const scenario = scenarioFor(draft)
  const custom =
    draft.customScenario !== undefined && draft.customScenario.id === draft.scenarioId
      ? draft.customScenario
      : null
  const [shelf, setShelf] = useState<readonly Scenario[]>(() => savedScenarios())
  const onShelf =
    custom !== null &&
    shelf.some((kept) => kept.id === custom.id && JSON.stringify(kept) === JSON.stringify(custom))
  const chooseScenario = (value: string) => {
    if (value === '__new__') {
      const fresh = newCustomScenario(Date.now())
      setDraft((d) => ({ ...d, scenarioId: fresh.id, customScenario: fresh, forces: {} }))
      return
    }
    const kept = shelf.find((s) => s.id === value)
    if (kept) {
      const copy = structuredClone(kept)
      setDraft((d) => ({ ...d, scenarioId: copy.id, customScenario: copy, forces: picksOf(copy) }))
      return
    }
    setDraft((d) => ({ ...d, scenarioId: value, forces: undefined, customScenario: undefined }))
  }

  return (
    <fieldset className="setup-form" disabled={readOnly}>
      <section>
        <label className="code-field">
          Scenario
          <select aria-label="Scenario" value={draft.scenarioId} onChange={(event) => chooseScenario(event.target.value)}>
            {SCENARIOS.map((shipped) => (
              <option key={shipped.id} value={shipped.id}>
                {shipped.name}
              </option>
            ))}
            {shelf.length > 0 ? (
              <optgroup label="My scenarios">
                {shelf.map((kept) => (
                  <option key={kept.id} value={kept.id}>
                    {kept.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {custom !== null && !shelf.some((kept) => kept.id === custom.id) ? (
              <option value={custom.id}>{custom.name} (unsaved)</option>
            ) : null}
            <option value="__new__">New custom scenario…</option>
          </select>
        </label>
        {custom !== null ? (
          <ScenarioBuilder
            scenario={custom}
            saved={onShelf}
            onChange={(next) =>
              setDraft((d) => ({ ...d, customScenario: next, scenarioId: next.id }))
            }
            onSave={() => {
              saveScenario(custom)
              setShelf([...savedScenarios()])
            }}
            onDelete={
              shelf.some((kept) => kept.id === custom.id)
                ? () => {
                    deleteScenario(custom.id)
                    setShelf([...savedScenarios()])
                  }
                : undefined
            }
          />
        ) : null}

        <label className="code-field">
          Dice seed
          <input
            className="num"
            type="number"
            value={draft.seed}
            onChange={(event) =>
              setDraft((d) => ({ ...d, seed: Number(event.target.value) || 0 }))
            }
          />
        </label>
        <p>
          The same seed and the same orders give the same battle, every time. Change it for a
          fresh roll of the dice; keep it to replay one.
        </p>

        {/* The scenario writes a 6' × 4' table, which is a knife fight at
            these ranges. Everything written on it — fleets, planets, gates —
            scales with it, so a bigger table is the same battle with more
            room to manoeuvre in, not a different one. */}
        <label className="code-field">
          Table
          <select
            aria-label="Table size"
            value={String(draft.tableScale ?? 1)}
            onChange={(event) =>
              setDraft((d) => ({ ...d, tableScale: Number(event.target.value) }))
            }
          >
            {(() => {
              const table = scenario?.table ?? { width: 72, height: 48 }
              return [
                { k: 1, label: 'As written' },
                { k: 1.5, label: 'Large' },
                { k: 2, label: 'Vast' },
              ].map(({ k, label }) => (
                <option key={k} value={String(k)}>
                  {label} — {Math.round(table.width * k)} × {Math.round(table.height * k)} MU
                </option>
              ))
            })()}
          </select>
        </label>
      </section>

      <section>
        <h3>Movement</h3>
        <p>
          12.12 is a second movement system, not a variant of the first. Under it a ship&rsquo;s
          course and its facing come apart: you write a sheet like <code>TP3, MD6</code> and the
          ship flies a chord that has nothing to do with where its bow is pointing, which is what
          lets it shoot over its shoulder at the thing it is running from.
        </p>
        <label className="code-field">
          System
          <select
            aria-label="Movement system"
            value={draft.movementSystem ?? 'cinematic'}
            disabled={(draft.aiSides ?? []).length > 0}
            onChange={(event) =>
              setDraft((d) => ({
                ...d,
                movementSystem: event.target.value as 'cinematic' | 'vector',
              }))
            }
          >
            <option value="cinematic">Cinematic (3.1) — course is facing</option>
            <option value="vector">Vector (12.12) — course and facing separate</option>
          </select>
        </label>
        {(draft.aiSides ?? []).length > 0 ? (
          <p style={{ color: 'var(--warn)' }}>
            Two players only for now. The computer writes cinematic orders and would sit still
            under 12.12, which is worse than not offering it.
          </p>
        ) : null}
      </section>

      <section>
        <h3>Deployment</h3>
        <p>
          18.1 gives three battles, and each of them puts the fleets on the table differently.
          Pick one and the scenario&rsquo;s written positions are replaced by a deployment: the
          lower die places first, then you alternate, ship by ship, inside your own zone. Leave
          it as the scenario wrote it and the fleets start where they always have.
        </p>
        <label className="code-field">
          Battle type
          <select
            aria-label="Battle type"
            value={draft.battleType ?? 'scenario'}
            onChange={(event) =>
              setDraft((d) => ({
                ...d,
                battleType:
                  event.target.value === 'scenario'
                    ? undefined
                    : (event.target.value as BattleType | 'none'),
              }))
            }
          >
            <option value="scenario">As the scenario writes it</option>
            <option value="none">No deployment step</option>
            {(Object.keys(BATTLE_TYPE_LABELS) as BattleType[]).map((type) => (
              <option key={type} value={type}>
                {BATTLE_TYPE_LABELS[type]} (18.1)
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h3>Factions</h3>
        <p>
          The campaign supplement&rsquo;s fourteen navies, each with its own traits and its own
          list of things it will not build. Separate from the tech base: a hull can be legal
          under section 15 and barred by the faction flying it.{' '}
          {(() => {
            const coverage = factionTraitCoverage()
            return `${coverage.implemented} of ${coverage.total} traits are enforced so far — the
              prohibitions and the design limits. The ones that change a roll in a battle are
              typed and not yet read by anything.`
          })()}
        </p>
        {(scenario?.sides ?? []).map((side) => {
          const chosen = draft.factions?.[side.id] ?? ''
          const faction = chosen ? factionById(chosen) : undefined
          return (
            <div key={side.id} className="panel-row">
              <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
                {side.name}
                <select
                  aria-label={`${side.name} faction`}
                  value={chosen}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      factions: { ...d.factions, [side.id]: event.target.value },
                      clans: { ...d.clans, [side.id]: '' },
                    }))
                  }
                >
                  <option value="">None</option>
                  {FACTIONS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              {faction?.clans ? (
                <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
                  Clan
                  <select
                    aria-label={`${side.name} clan`}
                    value={draft.clans?.[side.id] ?? ''}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        clans: { ...d.clans, [side.id]: event.target.value },
                      }))
                    }
                  >
                    <option value="">None</option>
                    {faction.clans.map((clan) => (
                      <option key={clan.id} value={clan.id}>
                        {clan.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <span className="spacer" />
              {faction ? (
                <span style={{ color: 'var(--ink-dim)' }}>{faction.doctrine}</span>
              ) : null}
            </div>
          )
        })}
      </section>

      <section>
        <h3>Tech base</h3>
        <p>
          Section 15 buys an empire a short list of technologies and lets it build nothing else.
          The roster here was not built to either of the book&rsquo;s example lists, so a side
          plays unrestricted unless you pick one — and picking one tells you which of the ships
          you have chosen could not have been built.
        </p>
        {(scenario?.sides ?? []).map((side) => (
          <label key={side.id} className="code-field">
            {side.name}
            <select
              aria-label={`${side.name} tech base`}
              value={draft.techBases?.[side.id] ?? 'unrestricted'}
              onChange={(event) =>
                setDraft((d) => ({
                  ...d,
                  techBases: {
                    ...d.techBases,
                    [side.id]: event.target.value as TechBaseChoice,
                  },
                }))
              }
            >
              {TECH_BASE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {draft.techBases?.[side.id] === 'custom' ? (
              <TechBasePanel
                base={draft.customTechBases?.[side.id]}
                onChange={(base) =>
                  setDraft((d) => ({
                    ...d,
                    customTechBases: { ...d.customTechBases, [side.id]: base },
                  }))
                }
              />
            ) : null}
          </label>
        ))}
      </section>

      <section>
        <h3>Non-FTL hulls</h3>
        <p>
          11.8 keeps in-system ships &mdash; monitors, freighters, System Defense Ships &mdash;
          out of a one-off battle &ldquo;unless specifically permitted by player agreement or
          scenario design&rdquo;. This is that permission. Battleriders that brought their
          Mothership are exempt either way; everything else is named in the log at the start of
          the battle rather than refused.
        </p>
        <label className="rule-toggle">
          <input
            type="checkbox"
            checked={Boolean(draft.allowNonFtl)}
            onChange={(event) =>
              setDraft((d) => ({ ...d, allowNonFtl: event.target.checked || undefined }))
            }
          />
          <span>
            <b>Permit non-FTL ships</b>{' '}
            <span className="rule-detail">by player agreement (11.8)</span>
          </span>
        </label>
      </section>

      {showFleets ? (
      <section>
        <FleetPicker
          scenarioId={draft.scenarioId}
          scenario={scenario}
          forces={draft.forces ?? {}}
          techBases={draft.techBases ?? {}}
          customTechBases={draft.customTechBases ?? {}}
          cpv={Boolean(draft.cpv)}
          bannedSystems={draft.bannedSystems}
          factions={draft.factions ?? {}}
          clans={draft.clans ?? {}}
          onChange={(forces) =>
            setDraft((d) => ({
              ...d,
              forces,
              // A custom scenario carries its fleets as its own forces, so a
              // file of the battle, or a lobby, has them without the picks.
              customScenario:
                d.customScenario !== undefined && d.customScenario.id === d.scenarioId
                  ? withForces(d.customScenario, forces)
                  : d.customScenario,
            }))
          }
          onPrint={onPrint}
        />
      </section>
      ) : null}

      {showAi ? (
      <section>
        <h3>Who plays which fleet</h3>
        <p>
          A fleet the computer commands is flown by the same rules you play by — it writes its
          orders in phase 1 like everyone else, and you can take its turn back with Undo.
        </p>
        {(scenario?.sides ?? []).map((side) => {
          const ai = (draft.aiSides ?? []).includes(side.id)
          return (
            <label key={side.id} className="rule-toggle">
              <input
                type="checkbox"
                checked={ai}
                onChange={() =>
                  setDraft((d) => {
                    const sides = new Set(d.aiSides ?? [])
                    if (sides.has(side.id)) sides.delete(side.id)
                    else sides.add(side.id)
                    // The computer cannot fly 12.12 yet, so handing it a
                    // fleet puts the battle back on cinematic movement
                    // rather than leaving a fleet that never manoeuvres.
                    return {
                      ...d,
                      aiSides: [...sides],
                      movementSystem: sides.size > 0 ? 'cinematic' : d.movementSystem,
                    }
                  })
                }
              />
              <span>
                <b>{side.name}</b>{' '}
                <span className="rule-detail">{ai ? 'computer' : 'you'}</span>
              </span>
            </label>
          )
        })}
      </section>
      ) : null}

      <section>
        <h3>Rules preset</h3>
        <p>
          The gear this table allows and the rules it plays under, as one named thing: applied here, it writes
          its bans and options into the setup above, and the battle file carries them.
        </p>
        <div className="panel-row">
          <select
            aria-label="Rules preset"
            disabled={readOnly}
            value={presetId}
            onChange={(event) => {
              const preset = presets.find((p) => p.id === event.target.value)
              if (preset) setDraft((d) => applyPreset(d, preset, scenario?.sides.map((side) => side.id) ?? []))
            }}
          >
            <option value="">{draft.rulesPreset ? `Custom (from ${draft.rulesPreset.name})` : 'Custom, as set above'}</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {!readOnly ? <button onClick={() => setEditingPreset(true)}>Edit gear and rules…</button> : null}
        </div>
        <p className="rule-detail">
          Barred: {bans.length === 0 ? 'nothing' : bans.map(gearLabel).join(', ')}.
        </p>
        {editingPreset ? (
          <PresetEditor
            initial={
              presetId
                ? presets.find((p) => p.id === presetId)
                : presetFromSetup(draft, { id: '', name: draft.rulesPreset ? `${draft.rulesPreset.name}, edited` : 'This table\u2019s rules' })
            }
            onClose={() => setEditingPreset(false)}
            onApply={(preset) => {
              setDraft((d) => applyPreset(d, preset, scenario?.sides.map((side) => side.id) ?? []))
              setEditingPreset(false)
            }}
          />
        ) : null}
      </section>
      <section>
        <h3>Optional rules</h3>
        <p>Settle these before the first order is written. They ride in the battle file.</p>
        {OPTIONAL_RULES.map((option) => (
          <label
            key={option.key}
            className={option.notYet ? 'rule-toggle is-not-yet' : 'rule-toggle'}
          >
            <input
              type="checkbox"
              disabled={option.notYet !== undefined}
              checked={option.notYet ? false : Boolean(draft[option.key])}
              onChange={() => toggle(option.key)}
            />
            <span>
              <b>{option.label}</b> <span className="rule-ref">{option.rule}</span>
              <br />
              <span className="rule-detail">{option.detail}</span>
              {option.notYet ? (
                <>
                  <br />
                  <span className="rule-detail" style={{ color: 'var(--warn)' }}>
                    Not in force — {option.notYet}.
                  </span>
                </>
              ) : null}
            </span>
          </label>
        ))}
      </section>

    </fieldset>
  )
}

export function SetupPanel({
  onClose,
  onStarted,
  onPrint,
}: {
  onClose: () => void
  /** Called once a battle has actually been started from here. */
  onStarted?: () => void
  /** A picked fleet's sheets on paper. */
  onPrint?: (title: string, designs: ShipDesign[]) => void
}) {
  const [draft, setDraft] = useState<GameSetup>(() => ({ ...currentSetup() }))
  // A scenario of the players' own has to have fleets before it can start.
  const custom = draft.customScenario?.id === draft.scenarioId ? draft.customScenario : undefined
  const problem = custom ? scenarioProblem(custom) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>New battle</h2>

        <SetupForm draft={draft} setDraft={setDraft} onPrint={onPrint} />

        <div className="panel-row">
          <button onClick={onClose}>Cancel</button>
          <span className="spacer" />
          {problem ? <span className="rule-detail" style={{ color: 'var(--warn)' }}>{problem}</span> : null}
          <button
            className="primary"
            disabled={problem !== null}
            title={problem ?? undefined}
            onClick={() => {
              newGame(draft)
              onClose()
              onStarted?.()
            }}
          >
            Start battle
          </button>
        </div>
        <p>Starting a battle discards the one in progress. Save it first if you want it.</p>
      </div>
    </div>
  )
}
