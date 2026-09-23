import { useMemo, useState } from 'react'

import { CAMPAIGN_RULES_VERSION, HOME_DEFAULTS } from '../campaign/campaign'
import { STARTING_FLEET_RP, STARTING_TRANSPORTS, layoutStars, pickerScenario, startingShipsFrom } from '../campaign/setup'
import { CAMPAIGN_BANNED_SYSTEMS } from '../campaign/turn'
import type { CampaignSetup } from '../campaign/types'
import { FACTIONS } from '../data/factions'
import { designCost } from '../data/fleetList'
import { designById } from '../data/ships'
import { hexCentre } from './CampaignMap'
import { FleetPicker } from './FleetPicker'
import { currentCampaign, loadCampaign, newCampaign } from './campaignStore'

/**
 * Setting up a campaign: who plays, how big the sky is, what a home world
 * starts with (the GM's call, so it is on the form), and the 2,000 RP of
 * ships each player begins with, picked with the same picker a battle uses.
 */
export interface CampaignSetupPanelProps {
  onClose: () => void
  onStarted: () => void
}

interface Seat {
  id: string
  name: string
  faction: string
  computer: boolean
}

const SEAT_NAMES = ['Terra', 'Eurasia', 'Ceres', 'Vesta']
const SEAT_COLOURS = ['var(--side-a)', 'var(--side-b)', 'var(--side-c)', 'var(--ordnance)']

export function CampaignSetupPanel({ onClose, onStarted }: CampaignSetupPanelProps) {
  const [seats, setSeats] = useState<Seat[]>([
    { id: 'p1', name: SEAT_NAMES[0]!, faction: '', computer: false },
    { id: 'p2', name: SEAT_NAMES[1]!, faction: '', computer: true },
  ])
  const [radius, setRadius] = useState(8)
  const [stars, setStars] = useState(18)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff))
  const [home, setHome] = useState<{ population: number; factories: number; shipyard: { throughput: number; capacity: number } }>({
    ...HOME_DEFAULTS,
    shipyard: { ...HOME_DEFAULTS.shipyard },
  })
  const [forces, setForces] = useState<Partial<Record<string, string[]>>>({})

  const layout = useMemo(() => layoutStars(seed, radius, stars, seats.length), [seed, radius, stars, seats.length])
  const scenario = useMemo(() => pickerScenario(seats), [seats])

  const spent = (seat: Seat) =>
    (forces[seat.id] ?? []).reduce((sum, id) => {
      const design = designById(id)
      return sum + (design ? designCost(design, false) : 0)
    }, 0)
  const problem = ((): string | null => {
    const names = new Set(seats.map((s) => s.name.trim().toLowerCase()))
    if (names.size < seats.length || seats.some((s) => s.name.trim() === '')) return 'Every player needs a name of their own'
    const empty = seats.find((s) => (forces[s.id] ?? []).length === 0)
    if (empty) return `${empty.name} has no ships: pick a fleet below`
    const over = seats.find((s) => spent(s) > STARTING_FLEET_RP)
    if (over) return `${over.name}'s fleet is over the ${STARTING_FLEET_RP} RP a player starts with`
    if (layout.starHexes.length < seats.length + 1) return 'The map needs more stars than players'
    return null
  })()

  const start = () => {
    if (problem) return
    if (currentCampaign() && !window.confirm('A campaign is under way in this browser. Start a new one over it? (Save it to a file first if you want it back.)')) return
    const setup: CampaignSetup = {
      seed,
      rulesVersion: CAMPAIGN_RULES_VERSION,
      starHexes: layout.starHexes,
      radius,
      players: seats.map((seat, index) => ({
        id: seat.id,
        name: seat.name.trim(),
        faction: seat.faction,
        home: layout.homes[index]!,
        startingShips: startingShipsFrom(forces[seat.id] ?? []),
        startingTransports: STARTING_TRANSPORTS,
        ...(seat.computer ? { computer: true } : {}),
      })),
      bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
      home,
    }
    newCampaign(setup)
    onStarted()
  }

  const setSeat = (index: number, patch: Partial<Seat>) => setSeats((list) => list.map((seat, i) => (i === index ? { ...seat, ...patch } : seat)))
  const factions = Object.fromEntries(seats.filter((s) => s.faction).map((s) => [s.id, s.faction]))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal campaign-setup" onClick={(event) => event.stopPropagation()}>
        <h2>New campaign</h2>
        <p>
          A Stellar Imperium campaign: one hex a parsec, one turn a year, production every fourth turn. Each player begins with a home world,{' '}
          {STARTING_FLEET_RP} RP of naval ships and {STARTING_TRANSPORTS} colony transports. Hot-seat: every human plays from this console.
        </p>

        <section>
          <h3>Players</h3>
          {seats.map((seat, index) => (
            <div key={seat.id} className="panel-row campaign-seat">
              <span className="campaign-swatch" style={{ background: SEAT_COLOURS[index] }} />
              <input aria-label={`Player ${index + 1} name`} value={seat.name} onChange={(e) => setSeat(index, { name: e.target.value })} />
              <select aria-label={`Player ${index + 1} faction`} value={seat.faction} onChange={(e) => setSeat(index, { faction: e.target.value })}>
                <option value="">No faction rules</option>
                {FACTIONS.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}
                  </option>
                ))}
              </select>
              <label title="The computer fights this player's battles at the table. Its fleets are yours to move from this console.">
                <input type="checkbox" checked={seat.computer} onChange={(e) => setSeat(index, { computer: e.target.checked })} /> computer
              </label>
              {seats.length > 2 ? (
                <button
                  aria-label={`Remove player ${index + 1}`}
                  onClick={() => {
                    setSeats((list) => list.filter((_, i) => i !== index))
                    setForces((f) => {
                      const next = { ...f }
                      delete next[seat.id]
                      return next
                    })
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {seats.length < 4 ? (
            <button
              onClick={() =>
                setSeats((list) => [
                  ...list,
                  { id: `p${Date.now().toString(36)}`, name: SEAT_NAMES[list.length] ?? `Player ${list.length + 1}`, faction: '', computer: false },
                ])
              }
            >
              Add a player
            </button>
          ) : null}
        </section>

        <section>
          <h3>The sky</h3>
          <div className="campaign-setup-grid">
            <label>
              Map radius
              <input className="num" type="number" min={4} max={16} value={radius} onChange={(e) => setRadius(Math.max(4, Math.min(16, Number(e.target.value) || 8)))} />
            </label>
            <label>
              Stars
              <input className="num" type="number" min={seats.length + 1} max={80} value={stars} onChange={(e) => setStars(Math.max(2, Math.min(80, Number(e.target.value) || 12)))} />
            </label>
            <label>
              Seed
              <input className="num" type="number" value={seed} onChange={(e) => setSeed(Math.abs(Math.floor(Number(e.target.value) || 0)))} />
            </label>
            <button onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))}>Reroll</button>
          </div>
          <LayoutPreview radius={radius} stars={layout.starHexes} homes={layout.homes} />
          <p>
            {layout.starHexes.length} stars. What each holds is rolled from the seed when the campaign starts (6.2.1); a home rolled without a habitable world is given one by the GM.
          </p>
        </section>

        <section>
          <h3>Home worlds</h3>
          <p>The rules leave the home system to the GM. These are its books on turn one.</p>
          <div className="campaign-setup-grid">
            <label>
              Population (M)
              <input className="num" type="number" min={1} max={50} value={home.population} onChange={(e) => setHome({ ...home, population: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label>
              Factories
              <input className="num" type="number" min={0} max={10} value={home.factories} onChange={(e) => setHome({ ...home, factories: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label>
              Yard RP/turn
              <select value={home.shipyard.throughput} onChange={(e) => setHome({ ...home, shipyard: { ...home.shipyard, throughput: Number(e.target.value) } })}>
                {[10, 30, 50, 70, 100, 125].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Yard max mass
              <select value={home.shipyard.capacity} onChange={(e) => setHome({ ...home, shipyard: { ...home.shipyard, capacity: Number(e.target.value) } })}>
                {[25, 50, 100, 200, 300, 400].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <h3>Starting fleets</h3>
          <p>
            Priced in printed points: one Full Thrust point is one RP (Economy). Reflex Fields, Cloaking Fields and Wave Guns are barred (Banned systems).
          </p>
          <FleetPicker
            scenarioId={scenario.id}
            scenario={scenario}
            forces={forces}
            cpv={false}
            bannedSystems={CAMPAIGN_BANNED_SYSTEMS}
            factions={factions}
            onChange={setForces}
          />
        </section>

        <section>
          <div className="campaign-inline">
            <button className="primary" disabled={problem !== null} title={problem ?? undefined} onClick={start}>
              Start the campaign
            </button>
            <label className="file-button">
              Load a campaign file
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const error = loadCampaign(await file.text())
                  event.target.value = ''
                  if (error) window.alert(error)
                  else onStarted()
                }}
              />
            </label>
            <button onClick={onClose}>Cancel</button>
          </div>
          {problem ? <p style={{ color: 'var(--warn)' }}>{problem}</p> : null}
        </section>
      </div>
    </div>
  )
}

function LayoutPreview({ radius, stars, homes }: { radius: number; stars: readonly { q: number; r: number }[]; homes: readonly { q: number; r: number }[] }) {
  const extent = 22 * Math.sqrt(3) * (radius + 1)
  const height = 22 * 1.5 * (radius + 1) * 2
  const homeKeys = homes.map((h) => `${h.q},${h.r}`)
  return (
    <svg className="campaign-preview" viewBox={`${-extent} ${-height / 2} ${extent * 2} ${height}`} aria-label="Map preview">
      <circle r={22 * Math.sqrt(3) * (radius + 0.5)} className="campaign-preview-edge" />
      {stars.map((hex) => {
        const { x, y } = hexCentre(hex)
        const seat = homeKeys.indexOf(`${hex.q},${hex.r}`)
        return <circle key={`${hex.q},${hex.r}`} cx={x} cy={y} r={seat >= 0 ? 9 : 4} style={seat >= 0 ? { fill: SEAT_COLOURS[seat] } : undefined} />
      })}
    </svg>
  )
}
