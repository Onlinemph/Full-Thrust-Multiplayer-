import { useState } from 'react'

import { scenarioById, SCENARIOS } from '../data/scenarios'
import type { GameSetup } from '../data/savedGame'
import { BATTLE_TYPE_LABELS, type BattleType } from '../engine/battles'
import { TECH_BASE_OPTIONS, type TechBaseChoice } from '../data/techBaseCheck'
import { FleetPicker } from './FleetPicker'
import { currentSetup, newGame } from './store'

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

interface Toggle {
  key: keyof GameSetup
  label: string
  rule: string
  detail: string
}

const OPTIONAL_RULES: Toggle[] = [
  {
    key: 'emergencyThrust',
    label: 'Emergency thrust',
    rule: '3.6',
    detail: 'Up to 150% of the drive rating, at the risk of damaging it.',
  },
  {
    key: 'aftArcFire',
    label: 'Aft arc fire',
    rule: '4.2',
    detail:
      'A ship that spent no thrust at all this turn may shoot through its own drive plume. ' +
      'Without this the aft arc is closed to offensive fire, always.',
  },
  {
    key: 'rearArcAttacks',
    label: 'Rear arc attacks',
    rule: '4.10',
    detail: 'Fire from inside a target’s rear arc ignores its armour entirely.',
  },
  {
    key: 'driveDamage',
    label: 'Drive damage',
    rule: '4.11',
    detail: 'A ship that lost two or more hull rows rolls twice for its drive.',
  },
  {
    key: 'coreSystems',
    label: 'Core systems',
    rule: '10.3',
    detail: 'A bridge, life support and a power core that damage can single out.',
  },
  {
    key: 'reactorBreaches',
    label: 'Reactor breaches',
    rule: '10.3',
    detail: 'A gutted reactor may take the ship, and its neighbours, with it.',
  },
  {
    key: 'fighterMorale',
    label: 'Fighter morale',
    rule: '8.17',
    detail: 'Fighter groups may break off rather than press a hopeless attack.',
  },
  {
    key: 'fighterQuality',
    label: 'Aces and turkeys',
    rule: '8.18',
    detail: 'Pilot quality varies: some groups are far better than average, some far worse.',
  },
  {
    key: 'multiStageMissiles',
    label: 'Multi-stage missiles',
    rule: '6.6',
    detail: 'Missiles that fly on after a first stage burns out.',
  },
  {
    key: 'terrainHazards',
    rule: '17',
    label: 'Terrain hazards',
    detail:
      'A planetoid you fly into destroys you outright, a cloud crossed above 12 MU costs a die, ' +
      'and an asteroid field costs one per 6 MU straight through screens and armour. Without ' +
      'this the rock on the table is only cover.',
  },
  {
    key: 'sensorRules',
    label: 'Sensors and ECM',
    rule: '12.1',
    detail: 'Enemy SSDs are closed: you see what your sensors tell you and no more.',
  },
]

/**
 * The three systems the campaign rules ban outright. Listed by name rather than
 * hidden behind a single switch, because a tournament may want a different set.
 */
const BANNABLE = ['reflex-field', 'cloaking-field', 'wave-gun'] as const
const BANNABLE_LABELS: Record<(typeof BANNABLE)[number], string> = {
  'reflex-field': 'Reflex field (7.25)',
  'cloaking-field': 'Cloaking field (7.21)',
  'wave-gun': 'Wave gun (7.24)',
}

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<GameSetup>(() => ({ ...currentSetup() }))

  const toggle = (key: keyof GameSetup) =>
    setDraft((d) => ({ ...d, [key]: !d[key] } as GameSetup))

  const banned = new Set(draft.bannedSystems ?? [])
  const toggleBan = (system: string) => {
    const next = new Set(banned)
    if (next.has(system)) next.delete(system)
    else next.add(system)
    setDraft((d) => ({ ...d, bannedSystems: [...next] }))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>New battle</h2>

        <section>
          <label className="code-field">
            Scenario
            <select
              aria-label="Scenario"
              value={draft.scenarioId}
              onChange={(event) =>
                setDraft((d) => ({ ...d, scenarioId: event.target.value, forces: undefined }))
              }
            >
              {SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>

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
          <h3>Tech base</h3>
          <p>
            Section 15 buys an empire a short list of technologies and lets it build nothing else.
            The roster here was not built to either of the book&rsquo;s example lists, so a side
            plays unrestricted unless you pick one — and picking one tells you which of the ships
            you have chosen could not have been built.
          </p>
          {(scenarioById(draft.scenarioId)?.sides ?? []).map((side) => (
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
            </label>
          ))}
        </section>

        <section>
          <FleetPicker
            scenarioId={draft.scenarioId}
            forces={draft.forces ?? {}}
            techBases={draft.techBases ?? {}}
            onChange={(forces) => setDraft((d) => ({ ...d, forces }))}
          />
        </section>

        <section>
          <h3>Who plays which fleet</h3>
          <p>
            A fleet the computer commands is flown by the same rules you play by — it writes its
            orders in phase 1 like everyone else, and you can take its turn back with Undo.
          </p>
          {(scenarioById(draft.scenarioId)?.sides ?? []).map((side) => {
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
                      return { ...d, aiSides: [...sides] }
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

        <section>
          <h3>Optional rules</h3>
          <p>Settle these before the first order is written. They ride in the battle file.</p>
          {OPTIONAL_RULES.map((option) => (
            <label key={option.key} className="rule-toggle">
              <input
                type="checkbox"
                checked={Boolean(draft[option.key])}
                onChange={() => toggle(option.key)}
              />
              <span>
                <b>{option.label}</b> <span className="rule-ref">{option.rule}</span>
                <br />
                <span className="rule-detail">{option.detail}</span>
              </span>
            </label>
          ))}
        </section>

        <section>
          <h3>Banned systems</h3>
          <p>
            The campaign rules bar all three of these. A tournament may bar a different set.
          </p>
          {BANNABLE.map((system) => (
            <label key={system} className="rule-toggle">
              <input
                type="checkbox"
                checked={banned.has(system)}
                onChange={() => toggleBan(system)}
              />
              <span>{BANNABLE_LABELS[system]}</span>
            </label>
          ))}
        </section>

        <div className="panel-row">
          <button onClick={onClose}>Cancel</button>
          <span className="spacer" />
          <button
            className="primary"
            onClick={() => {
              newGame(draft)
              onClose()
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
