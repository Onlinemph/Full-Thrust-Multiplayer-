import { useState } from 'react'

import { scenarioById, SCENARIOS } from '../data/scenarios'
import type { GameSetup } from '../data/savedGame'
import { BATTLE_TYPE_LABELS, type BattleType } from '../engine/battles'
import { TECH_BASE_OPTIONS, type TechBaseChoice } from '../data/techBaseCheck'
import { FACTIONS, factionById, factionTraitCoverage } from '../data/factions'
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
  /**
   * Why this one is not in force yet.
   *
   * A switch that does nothing is worse than a switch that is not there: the
   * player sets it, plays a battle under a rule they think they chose, and the
   * engine never hears about it. `setupPassthrough.test.ts` holds the rest of
   * this list to the opposite standard.
   */
  notYet?: string
}

export const OPTIONAL_RULES: Toggle[] = [
  {
    key: 'emergencyThrust',
    label: 'Emergency thrust',
    rule: '3.6',
    detail: 'Up to 150% of the drive rating, at the risk of damaging it.',
  },
  {
    key: 'knockedOffCourse',
    label: 'Knocked off course',
    rule: '12.11',
    detail:
      'A threshold point rolls once more, at the same odds, to see whether the hit slewed the ' +
      'ship a clock point off its heading.',
  },
  {
    key: 'tableReentry',
    label: 'Return to the table',
    rule: '3.9',
    detail:
      'A ship that flies off the edge rolls a die: 4 or better and it may come back after that ' +
      'many turns, 3 or less and it has left the battle for good.',
  },
  {
    key: 'movingTable',
    label: 'Moving table',
    rule: '16.4',
    detail:
      'Slide the playing area under the ships when the action drifts into a corner. Leaving the ' +
      'edge then stops being a retreat, and a fleet that runs can be pursued (16.5).',
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
    detail:
      'A group that has lost anyone rolls before it attacks, and aborts if the die beats the ' +
      'number of fighters left. An aborted attack spends no endurance. Robot fighters are immune.',
  },
  {
    key: 'fighterQuality',
    label: 'Aces and turkeys',
    rule: '8.18',
    detail:
      'Every group rolls at the start of the game: a 6 puts an Ace in it, a 1 makes it a Turkey. ' +
      'An Ace is an extra attack die and the last pilot to die; a Turkey is −1 in dogfights and ' +
      'on intercepts.',
  },
  {
    key: 'multiStageMissiles',
    label: 'Multi-stage missiles',
    rule: '6.6',
    detail: 'Missiles that fly on after a first stage burns out.',
    notYet: 'a two-stage mount flies its two stages already; the magazine rules are not in',
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
    key: 'orbitalTable',
    rule: '17.7',
    label: 'Orbital table',
    detail:
      'The table is a slice of orbit above a planet, so running off the edge is a lap round the ' +
      'world rather than a retreat: the ship comes back on the opposite edge at the same course ' +
      'and speed, three to five turns later depending on its thrust.',
  },
  {
    key: 'strikeColors',
    rule: '12.9',
    label: 'Striking the colors',
    detail:
      'A ship crossing a hull row rolls against the same ladder as its threshold check, and on a ' +
      'failure her captain surrenders to the nearest enemy vessel. The hull is a prize, intact ' +
      'and out of the fight.',
  },
  {
    key: 'civilWar',
    rule: '12.10',
    label: 'Civil war',
    detail:
      'Both fleets built by the same navy know where each other are thin: +1 on every direct-fire ' +
      'die. Nothing for ordnance, point defence or fighters, and the engine checks the fleets ' +
      'really are one navy before granting it.',
  },
  {
    key: 'solarFlares',
    rule: '17.3',
    label: 'Solar flares',
    detail:
      'A star on the table flares now and then and every ship in reach rolls for each FireCon, ' +
      'plus one per active screen level: below a 4 the box is knocked out. Nothing to fly round ' +
      'and nothing to plot against — screens are the only answer.',
  },
  {
    key: 'cpv',
    label: 'Combat Points Value',
    rule: '18.3',
    detail:
      'Reprice every hull by its mass rather than by the printed figure. Small ships get dearer, ' +
      'big ones cheaper, and the scoreboard counts in the same currency.',
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
          {(scenarioById(draft.scenarioId)?.sides ?? []).map((side) => {
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

        <section>
          <FleetPicker
            scenarioId={draft.scenarioId}
            forces={draft.forces ?? {}}
            techBases={draft.techBases ?? {}}
            cpv={Boolean(draft.cpv)}
            factions={draft.factions ?? {}}
            clans={draft.clans ?? {}}
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
