import { useEffect, useMemo, useState } from 'react'

import { elementCs, holdCs, orderRefusal, present, replacementPrice, unitCs, type GroundUnit, type GroundUnitOrder } from '../campaign/army'
import {
  colonyById,
  commandPostsOf,
  holdSpaceLeft,
  plotLeadOf,
  researchBudgetOf,
  systemById,
  taskForcesAt,
} from '../campaign/campaign'
import { motorPoolDesigns } from '../dirtside/library'
import type { InfantryTeam, InfantryTroops } from '../dirtside/types'
import {
  PRICE_SCHEDULE,
  SHIPYARD_CAPACITY_RATINGS,
  SHIPYARD_THROUGHPUT_RATINGS,
  priceOf,
} from '../campaign/economy'
import { DETECTION_RANGE } from '../campaign/intel'
import { hexDistance, hexKey, systemAt } from '../campaign/map'
import { TECHNOLOGIES, effectiveCost } from '../campaign/research'
import type {
  CampaignMove,
  CampaignShip,
  CampaignState,
  Colony,
  Hex,
  PlanetaryBody,
  PlayerId,
  PurchaseItem,
  StarSystem,
  TaskForce,
  TaskForceOrder,
  TechnologyId,
} from '../campaign/types'
import { allDesigns, designById } from '../data/ships'
import { playerColour } from './CampaignMap'

/**
 * The campaign console's panels: what is in the selected hex and what can be
 * done to it this phase, and the player's own books. Every button is one
 * campaign move through `act`; a refusal comes back as a sentence and is
 * shown, never swallowed.
 */
export type Act = (move: CampaignMove) => boolean

export interface HexPanelProps {
  state: CampaignState
  viewer: PlayerId
  hex: Hex
  act: Act
  /** Begin writing a plot for a force: the map takes the legs from here. */
  onPlot: (tf: TaskForce) => void
}

export const ORDER_LABELS: Record<TaskForceOrder, string> = {
  engage: 'Engage',
  'stand-off': 'Stand off',
  'ftl-move': 'FTL move',
}

const FEATURE_LABELS: Record<StarSystem['feature'], string> = {
  standard: 'standard system',
  nebula: 'gas and dust cloud',
  'dense-asteroid-field': 'dense asteroid field',
  'multiple-star': 'multiple star',
}

const TYPE_LABELS: Record<PlanetaryBody['type'], string> = {
  terran: 'Terran',
  'sub-terran': 'Sub-Terran',
  'minimal-terran': 'Minimal-Terran',
  barren: 'Barren',
  'gas-giant': 'Gas giant',
  'special-anomaly': 'Special anomaly',
}

const TRAIT_LABELS: Record<PlanetaryBody['trait'], string> = {
  none: '',
  'mineral-rich': 'mineral rich',
  'biologically-rich': 'biologically rich',
  hazardous: 'hazardous',
  'ancient-ruins': 'ancient ruins',
  unique: 'unique',
}

function colonisable(body: PlanetaryBody): boolean {
  return body.type === 'terran' || body.type === 'sub-terran' || body.type === 'minimal-terran' || body.type === 'barren'
}

export function HexPanel({ state, viewer, hex, act, onPlot }: HexPanelProps) {
  const system = systemAt(state.map, hex)
  const here = taskForcesAt(state, hex)
  const mine = here.filter((tf) => tf.owner === viewer)
  const explored = system?.exploredBy.includes(viewer) ?? false
  const colonies = system ? state.colonies.filter((c) => c.systemId === system.id) : []
  const posts = commandPostsOf(state, viewer)
  const fromPost = posts.length > 0 ? Math.min(...posts.map((p) => hexDistance(p, hex))) : null

  return (
    <div className="panel campaign-hex">
      <h3>
        {system ? system.name : `Hex ${hexKey(hex)}`}{' '}
        <span className="campaign-dim num">{hexKey(hex)}</span>
      </h3>
      {system ? (
        explored ? (
          <>
            <p className="campaign-dim">
              A {FEATURE_LABELS[system.feature]}
              {fromPost !== null ? `, ${fromPost} hex${fromPost === 1 ? '' : 'es'} from your nearest command post` : ''}.
            </p>
            <ul className="campaign-bodies">
              {system.bodies.map((body) => {
                const colony = body.colonyId ? colonyById(state, body.colonyId) : undefined
                return (
                  <li key={body.id}>
                    <b>{body.name}</b> — {TYPE_LABELS[body.type]}
                    {body.trait !== 'none' ? `, ${TRAIT_LABELS[body.trait]}` : ''}
                    {body.parentId ? ' (moon)' : ''}
                    {colony ? (
                      <span style={{ color: playerColour(state, colony.owner) }}>
                        {' '}
                        · {colony.name === body.name ? 'colony' : colony.name} of {state.players.find((p) => p.id === colony.owner)?.name}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="campaign-dim">A star you have not explored: a task force ending its move here explores it (6.2.1).</p>
        )
      ) : (
        <p className="campaign-dim">Empty space{fromPost !== null ? `, ${fromPost} hex${fromPost === 1 ? '' : 'es'} from your nearest command post` : ''}.</p>
      )}

      {colonies.map((colony) => (
        <ColonyCard key={colony.id} state={state} viewer={viewer} colony={colony} act={act} />
      ))}

      {system && state.phase === 'planetary' && explored ? <FoundColonyForm state={state} viewer={viewer} system={system} act={act} /> : null}

      {here.map((tf) => (
        <TaskForceCard key={tf.id} state={state} viewer={viewer} tf={tf} others={mine.filter((o) => o.id !== tf.id)} act={act} onPlot={onPlot} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colonies (6.4, 6.5, price schedule, shipyards)
// ---------------------------------------------------------------------------

function ColonyCard({ state, viewer, colony, act }: { state: CampaignState; viewer: PlayerId; colony: Colony; act: Act }) {
  const own = colony.owner === viewer
  const owner = state.players.find((p) => p.id === colony.owner)
  const system = systemById(state, colony.systemId)!
  const seen = own || taskForcesAt(state, system.hex).some((tf) => tf.owner === viewer)
  const myForces = taskForcesAt(state, system.hex).filter((tf) => tf.owner === viewer && tf.ships.length > 0)
  const [integration, setIntegration] = useState(100)

  return (
    <div className="campaign-card" style={{ borderLeftColor: playerColour(state, colony.owner) }}>
      <div className="campaign-card-head">
        <b>{colony.name}</b>
        <span className="campaign-dim">
          {own ? 'your colony' : `${owner?.name ?? colony.owner}'s colony`}
          {colony.commandPost ? ' · command post' : ''}
          {colony.underSiege ? ' · under siege' : ''}
        </span>
      </div>
      {seen ? (
        <dl className="campaign-facts">
          <dt>Population</dt>
          <dd className="num">
            {colony.population.loyal}M{colony.population.subject > 0 ? ` + ${colony.population.subject}M subject` : ''}
          </dd>
          <dt>Factories</dt>
          <dd className="num">
            {colony.factories}
            {colony.factoriesOffline > 0 ? ` (${colony.factoriesOffline} not yet online)` : ''}
          </dd>
          <dt>Defences</dt>
          <dd className="num">
            {colony.defences.pdu} PDU, {colony.defences.advancedPdu} advanced{colony.defences.planetShield ? ', planet shield' : ''}
          </dd>
          <dt>Yards</dt>
          <dd>
            {colony.shipyards.length === 0
              ? 'none'
              : colony.shipyards.map((y) => `${y.orbital ? 'orbital' : 'planetary'} ${y.throughput}/${y.capacity}`).join(', ')}
          </dd>
          {own ? (
            <>
              <dt>Stockpile</dt>
              <dd className="num">{colony.stockpileRp} RP</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="campaign-dim">Its books are closed to you: only a force in the system reads them.</p>
      )}

      {own && colony.buildQueue.length > 0 ? (
        <ul className="campaign-queue">
          {colony.buildQueue.map((order) => {
            const design = order.item.kind === 'starship' ? designById(order.item.designId) : undefined
            return (
              <li key={order.id}>
                <span>
                  {design?.name ?? order.item.kind} <span className="num campaign-dim">{order.rpPaid}/{order.rpRequired} RP</span>
                </span>
                <button onClick={() => act({ kind: 'cancel-build', player: viewer, colony: colony.id, order: order.id })}>Cancel</button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Garrison state={state} viewer={viewer} colony={colony} own={own} seen={seen} act={act} />

      {own && state.phase === 'planetary' ? (
        <div className="campaign-actions">
          {!colony.commandPost ? (
            <button onClick={() => act({ kind: 'establish-command-post', player: viewer, colony: colony.id })}>Establish command post</button>
          ) : null}
          {colony.population.subject > 0 ? (
            <label className="campaign-inline">
              Integrate
              <input className="num" type="number" min={100} step={100} value={integration} onChange={(e) => setIntegration(Number(e.target.value) || 0)} />
              RP
              <button onClick={() => act({ kind: 'integration-program', player: viewer, colony: colony.id, rp: integration })}>Pay</button>
            </label>
          ) : null}
        </div>
      ) : null}

      {!own && state.phase === 'planetary' && myForces.length > 0 ? (
        <div className="campaign-actions">
          {myForces.map((tf) => (
            <span key={tf.id} className="campaign-inline">
              <button onClick={() => act({ kind: 'assault', player: viewer, colony: colony.id, taskForce: tf.id })} title={state.rulesVersion >= 2 ? 'The Marine contingents go down, units aboard able to land from orbit come down in craft, and the landing is fought on the Dirtside table (More Thrust p. 17, Dirtside p. 43)' : undefined}>
                {state.rulesVersion >= 2 ? `Land from ${tf.name}` : `Assault with ${tf.name}`}
              </button>
              <button onClick={() => act({ kind: 'bombard', player: viewer, colony: colony.id, taskForce: tf.id })}>Bombard</button>
            </span>
          ))}
        </div>
      ) : null}

      {own && state.phase === 'production' ? (
        <>
          <PurchaseForm state={state} viewer={viewer} colony={colony} act={act} />
          <RecruitForm viewer={viewer} colony={colony} act={act} />
        </>
      ) : null}
    </div>
  )
}

const ITEM_KINDS: ReadonlyArray<{ kind: PurchaseItem['kind']; label: string }> = [
  { kind: 'starship', label: 'Starship' },
  { kind: 'ground-unit', label: 'Ground unit' },
  { kind: 'colony-transport', label: 'Colony transport' },
  { kind: 'scout-drone', label: 'Scout drone' },
  { kind: 'factory', label: 'Factory' },
  { kind: 'pdu', label: 'Planetary Defence Unit' },
  { kind: 'advanced-pdu', label: 'Advanced PDU' },
  { kind: 'planet-shield', label: 'Planet shield' },
  { kind: 'shipyard', label: 'Shipyard' },
]

function PurchaseForm({ state, viewer, colony, act }: { state: CampaignState; viewer: PlayerId; colony: Colony; act: Act }) {
  const designs = useMemo(() => [...allDesigns()].sort((a, b) => a.points - b.points), [])
  const [kind, setKind] = useState<PurchaseItem['kind']>('starship')
  const [designId, setDesignId] = useState(designs[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [throughput, setThroughput] = useState(30)
  const [capacity, setCapacity] = useState(100)
  const [orbital, setOrbital] = useState(true)
  const body = systemById(state, colony.systemId)?.bodies.find((b) => b.id === colony.bodyId)

  const [unit, setUnit] = useState<GroundUnitOrder>(() => ({ name: 'Rifle Platoon', infantry: { troops: 'line', teams: [...INFANTRY_PRESETS[0]!.teams] }, interfaceLanding: false }))
  const item = ((): PurchaseItem => {
    switch (kind) {
      case 'starship':
        return { kind, designId }
      case 'ground-unit':
        return { kind, unit }
      case 'shipyard':
        return { kind, throughput, capacity, orbital }
      default:
        return { kind } as PurchaseItem
    }
  })()
  let each = 0
  try {
    each = priceOf(item, { design: (id) => designById(id), breathableWorld: body?.type === 'terran' })
  } catch {
    each = 0
  }
  const capacityHere = Math.max(0, ...colony.shipyards.map((y) => y.capacity))

  return (
    <div className="campaign-form">
      <h4>Buy</h4>
      <div className="campaign-inline">
        <select aria-label="Item" value={kind} onChange={(e) => setKind(e.target.value as PurchaseItem['kind'])}>
          {ITEM_KINDS.filter((entry) => entry.kind !== 'ground-unit' || state.rulesVersion >= 2).map((entry) => (
            <option key={entry.kind} value={entry.kind}>
              {entry.label}
            </option>
          ))}
        </select>
        {kind === 'starship' ? (
          <select aria-label="Design" value={designId} onChange={(e) => setDesignId(e.target.value)}>
            {designs.map((design) => (
              <option key={design.id} value={design.id} disabled={design.mass > capacityHere}>
                {design.name} · {design.mass} mass · {design.points} RP
              </option>
            ))}
          </select>
        ) : null}
        {kind === 'shipyard' ? (
          <>
            <select aria-label="Throughput" value={throughput} onChange={(e) => setThroughput(Number(e.target.value))}>
              {SHIPYARD_THROUGHPUT_RATINGS.map((row) => (
                <option key={row.rating} value={row.rating}>
                  {row.rating} RP/turn
                </option>
              ))}
            </select>
            <select aria-label="Capacity" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              {SHIPYARD_CAPACITY_RATINGS.map((row) => (
                <option key={row.rating} value={row.rating}>
                  up to mass {row.rating}
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={orbital} onChange={(e) => setOrbital(e.target.checked)} /> orbital
            </label>
          </>
        ) : null}
        {kind !== 'planet-shield' && kind !== 'shipyard' ? (
          <input aria-label="Quantity" className="num" type="number" min={1} max={20} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
        ) : null}
        <button
          className="primary"
          disabled={each * (kind === 'planet-shield' || kind === 'shipyard' ? 1 : quantity) > colony.stockpileRp}
          onClick={() => act({ kind: 'purchase', player: viewer, colony: colony.id, item, quantity: kind === 'planet-shield' || kind === 'shipyard' ? 1 : quantity })}
        >
          Buy · <span className="num">{each * (kind === 'planet-shield' || kind === 'shipyard' ? 1 : quantity)} RP</span>
        </button>
      </div>
      {kind === 'ground-unit' ? <GroundUnitForm order={unit} onChange={setUnit} /> : null}
      {kind === 'starship' && colony.shipyards.length === 0 ? <p className="campaign-dim">No yard here: buy one first (Shipyards).</p> : null}
    </div>
  )
}

/** Infantry platoons to pick from: the teams a unit is raised with (Dirtside p. 13). */
const INFANTRY_PRESETS: ReadonlyArray<{ label: string; teams: InfantryTeam[] }> = [
  { label: 'rifle platoon: 3 rifle, APSW, anti-armour', teams: ['rifle', 'rifle', 'rifle', 'apsw', 'anti-armour'] },
  { label: 'assault platoon: 4 rifle', teams: ['rifle', 'rifle', 'rifle', 'rifle'] },
  { label: 'weapons platoon: 2 APSW, 2 anti-armour', teams: ['apsw', 'apsw', 'anti-armour', 'anti-armour'] },
  { label: 'recon section: 2 rifle, observer', teams: ['rifle', 'rifle', 'observer'] },
  { label: 'engineers: 2 rifle, 2 engineer', teams: ['rifle', 'rifle', 'engineer', 'engineer'] },
]

/**
 * A ground unit to order: a platoon of one design off the Motor Pool's shelf,
 * or an infantry platoon; able to land from orbit or not. The price is the
 * campaign's to work out; this only says what the order is.
 */
function GroundUnitForm({ order, onChange }: { order: GroundUnitOrder; onChange: (next: GroundUnitOrder) => void }) {
  const designs = useMemo(() => motorPoolDesigns().filter((d) => d.mobility !== 'aerospace' && d.mobility !== 'vtol'), [])
  const source = order.vehicle ? `v:${order.vehicle.id}` : `i:${order.infantry?.troops ?? 'line'}`
  const preset = INFANTRY_PRESETS.findIndex((p) => JSON.stringify(p.teams) === JSON.stringify(order.infantry?.teams))
  const why = orderRefusal(order)
  const cs = order.vehicle ? elementCs({ vehicle: order.vehicle }) * (order.count ?? 1) : (order.infantry?.teams.length ?? 0) * 16
  return (
    <div className="campaign-inline campaign-ground-form">
      <input aria-label="Unit name" value={order.name} onChange={(e) => onChange({ ...order, name: e.target.value })} />
      <select
        aria-label="Unit type"
        value={source}
        onChange={(e) => {
          const k = e.target.value.slice(0, 1)
          const v = e.target.value.slice(2)
          if (k === 'v') {
            const design = designs.find((d) => d.id === v)!
            onChange({ name: order.vehicle ? order.name : `${design.name} Platoon`, vehicle: design, count: order.count ?? 3, interfaceLanding: order.interfaceLanding })
          } else onChange({ name: order.infantry ? order.name : 'Rifle Platoon', infantry: { troops: v as InfantryTroops, teams: order.infantry?.teams ?? [...INFANTRY_PRESETS[0]!.teams] }, interfaceLanding: order.interfaceLanding })
        }}
      >
        <optgroup label="Infantry">
          <option value="i:militia">militia</option>
          <option value="i:line">line infantry</option>
          <option value="i:powered">powered infantry</option>
        </optgroup>
        <optgroup label="Motor Pool">
          {designs.map((d) => (
            <option key={d.id} value={`v:${d.id}`}>
              {d.name}
            </option>
          ))}
        </optgroup>
      </select>
      {order.vehicle ? (
        <label>
          ×
          <input aria-label="Vehicles" className="num" type="number" min={1} max={8} value={order.count ?? 3} onChange={(e) => onChange({ ...order, count: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} />
        </label>
      ) : (
        <select aria-label="Teams" value={preset} onChange={(e) => onChange({ ...order, infantry: { troops: order.infantry?.troops ?? 'line', teams: [...INFANTRY_PRESETS[Number(e.target.value)]!.teams] } })}>
          {INFANTRY_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      <label title="A quarter more on every element: it can come down in interface craft to fight a landing (Dirtside p. 43)">
        <input type="checkbox" checked={order.interfaceLanding} onChange={(e) => onChange({ ...order, interfaceLanding: e.target.checked })} /> lands from orbit
      </label>
      <span className="campaign-dim num">{cs} CS</span>
      {why ? <span className="campaign-damage">{why}</span> : null}
    </div>
  )
}

const markerLabel = (u: GroundUnit) => `${u.quality} ${u.leadership}`

/** A colony's ground units: the owner's garrison with what it can do this phase, or what a visitor can see of it. */
function Garrison({ state, viewer, colony, own, seen, act }: { state: CampaignState; viewer: PlayerId; colony: Colony; own: boolean; seen: boolean; act: Act }) {
  const units = state.groundUnits.filter((u) => 'colony' in u.at && u.at.colony === colony.id)
  if (units.length === 0) return null
  if (!own) return seen ? <p className="campaign-dim">Garrison: {units.length} ground unit{units.length === 1 ? '' : 's'}.</p> : null
  const system = systemById(state, colony.systemId)!
  const ships = taskForcesAt(state, system.hex)
    .filter((tf) => tf.owner === viewer)
    .flatMap((tf) => tf.ships)
    .filter((s) => {
      const d = designById(s.designId)
      return d ? holdCs(d) > 0 : false
    })
  const moving = state.phase === 'planetary' || state.phase === 'production'
  return (
    <div className="campaign-garrison">
      <h4>Garrison</h4>
      <ul className="campaign-queue">
        {units.map((u) => (
          <li key={u.id}>
            <span>
              <b>{u.name}</b>{' '}
              <span className="campaign-dim">
                {markerLabel(u)} · {present(u).length}/{u.elements.length} elements · {unitCs(u)} CS{u.interfaceLanding ? ' · lands from orbit' : ''}
                {u.battles > 0 ? ` · ${u.battles} battle${u.battles === 1 ? '' : 's'}, ${u.qualityPoints} pts` : ''}
              </span>
            </span>
            <span className="campaign-inline">
              {moving && ships.length > 0 ? (
                <select
                  aria-label={`Embark ${u.name}`}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) act({ kind: 'embark', player: viewer, unit: u.id, ship: e.target.value })
                  }}
                >
                  <option value="">Embark on…</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id} disabled={holdSpaceLeft(state, s) < unitCs(u)}>
                      {s.name} ({Math.max(0, holdSpaceLeft(state, s))} CS free)
                    </option>
                  ))}
                </select>
              ) : null}
              {state.phase === 'production' && present(u).length < u.elements.length ? (
                <button onClick={() => act({ kind: 'reinforce', player: viewer, unit: u.id })} title="Replacements for the lost elements; the new men may cost the unit a quality level (Stargrunt p. 60)">
                  Reinforce · <span className="num">{replacementPrice(u)} RP</span>
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecruitForm({ viewer, colony, act }: { viewer: PlayerId; colony: Colony; act: Act }) {
  const [name, setName] = useState('')
  return (
    <div className="campaign-form">
      <h4>Commission an admiral · {PRICE_SCHEDULE.admiral.rp} RP</h4>
      <div className="campaign-inline">
        <input aria-label="Admiral's name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          disabled={name.trim() === '' || colony.stockpileRp < PRICE_SCHEDULE.admiral.rp}
          onClick={() => {
            const id = `${viewer}-adm-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
            if (act({ kind: 'recruit-admiral', player: viewer, colony: colony.id, admiral: id, name: name.trim() })) setName('')
          }}
        >
          Recruit
        </button>
      </div>
    </div>
  )
}

function FoundColonyForm({ state, viewer, system, act }: { state: CampaignState; viewer: PlayerId; system: StarSystem; act: Act }) {
  const convoys = taskForcesAt(state, system.hex).filter((tf) => tf.owner === viewer && tf.transports > 0)
  const aboard = convoys.reduce((sum, tf) => sum + tf.transports, 0)
  const bodies = system.bodies.filter((b) => colonisable(b) && b.colonyId === null)
  const [bodyId, setBodyId] = useState(bodies[0]?.id ?? '')
  const [transports, setTransports] = useState(Math.min(5, aboard))
  if (aboard === 0 || bodies.length === 0) return null
  const chosen = bodies.find((b) => b.id === bodyId) ?? bodies[0]!
  return (
    <div className="campaign-form">
      <h4>Land colonists · {aboard} transport{aboard === 1 ? '' : 's'} in orbit</h4>
      <div className="campaign-inline">
        <select aria-label="World" value={chosen.id} onChange={(e) => setBodyId(e.target.value)}>
          {bodies.map((body) => (
            <option key={body.id} value={body.id}>
              {body.name} ({TYPE_LABELS[body.type]}{body.trait !== 'none' ? `, ${TRAIT_LABELS[body.trait]}` : ''})
            </option>
          ))}
        </select>
        <input aria-label="Transports" className="num" type="number" min={1} max={aboard} value={transports} onChange={(e) => setTransports(Math.max(1, Math.min(aboard, Number(e.target.value) || 1)))} />
        <button
          className="primary"
          onClick={() =>
            act({
              kind: 'found-colony',
              player: viewer,
              colony: `${viewer}-${chosen.id}`,
              system: system.id,
              body: chosen.id,
              transports,
            })
          }
        >
          Land
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task forces (6.1, 7, 8)
// ---------------------------------------------------------------------------

function damageOf(ship: CampaignShip): string {
  const design = designById(ship.designId)
  const parts: string[] = []
  if (ship.hullDamage > 0) parts.push(`hull ${ship.hullDamage}${design ? `/${design.hullBoxes}` : ''}`)
  const armour = ship.armourDamage.reduce((a, b) => a + b, 0)
  if (armour > 0) parts.push(`armour ${armour}`)
  if (ship.systemsDamaged.length > 0) parts.push(`${ship.systemsDamaged.length} system${ship.systemsDamaged.length === 1 ? '' : 's'} out`)
  if (ship.coreDamage.length > 0) parts.push(ship.coreDamage.join(', '))
  return parts.join(', ')
}

function TaskForceCard({
  state,
  viewer,
  tf,
  others,
  act,
  onPlot,
}: {
  state: CampaignState
  viewer: PlayerId
  tf: TaskForce
  others: TaskForce[]
  act: Act
  onPlot: (tf: TaskForce) => void
}) {
  const own = tf.owner === viewer
  const owner = state.players.find((p) => p.id === tf.owner)
  const admiral = tf.admiralId ? state.admirals.find((a) => a.id === tf.admiralId) : undefined
  const admirals = state.admirals.filter((a) => a.owner === viewer && !a.dead)
  const intel = state.players.find((p) => p.id === viewer)?.intel.find((r) => r.subjectId === tf.id)
  const enemiesInRange = own
    ? state.taskForces.filter((other) => other.owner !== viewer && hexDistance(other.hex, tf.hex) <= DETECTION_RANGE)
    : []

  return (
    <div className="campaign-card" style={{ borderLeftColor: playerColour(state, tf.owner) }}>
      <div className="campaign-card-head">
        <b>{tf.name}</b>
        <span className="campaign-dim">
          {own ? '' : `${owner?.name ?? tf.owner} · `}
          {tf.scout ? 'scout drone' : `${tf.ships.length} ship${tf.ships.length === 1 ? '' : 's'}`}
          {tf.transports > 0 && own ? ` · ${tf.transports} transports` : ''}
          {own ? ` · FTL ${tf.ftlRate}` : ''}
        </span>
      </div>
      {own ? (
        <>
          <ul className="campaign-ships">
            {tf.ships.map((ship) => {
              const design = designById(ship.designId)
              const damage = damageOf(ship)
              return (
                <li key={ship.id}>
                  <span>
                    <b>{ship.name}</b> <span className="campaign-dim">{design?.name ?? ship.designId}</span>
                    {damage ? <span className="campaign-damage"> · {damage}</span> : null}
                    {design && holdCs(design) > 0 ? <span className="campaign-dim num"> · holds {holdCs(design) - holdSpaceLeft(state, ship)}/{holdCs(design)} CS</span> : null}
                    <Embarked state={state} viewer={viewer} ship={ship} tf={tf} act={act} />
                  </span>
                  {tf.ships.length > 1 ? (
                    <button
                      title="Detach into a task force of its own"
                      onClick={() =>
                        act({
                          kind: 'form-task-force',
                          player: viewer,
                          taskForce: `${viewer}-tf-${Date.now().toString(36)}`,
                          name: `${ship.name} group`,
                          hex: tf.hex,
                          ships: [ship.id],
                          scout: false,
                        })
                      }
                    >
                      Detach
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <div className="campaign-actions">
            <label className="campaign-inline">
              Order
              <select value={tf.order} onChange={(e) => act({ kind: 'set-order', player: viewer, taskForce: tf.id, order: e.target.value as TaskForceOrder })}>
                {(Object.keys(ORDER_LABELS) as TaskForceOrder[]).map((order) => (
                  <option key={order} value={order}>
                    {ORDER_LABELS[order]}
                  </option>
                ))}
              </select>
            </label>
            {!tf.scout ? (
              <label className="campaign-inline">
                Flag
                <select value={tf.admiralId ?? ''} onChange={(e) => act({ kind: 'assign-admiral', player: viewer, taskForce: tf.id, admiral: e.target.value || null })}>
                  <option value="">none (plots as Level 3)</option>
                  {admirals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · Level {a.level}
                      {a.injuredUntilTurn !== null && a.injuredUntilTurn > state.turn ? ' (injured)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {others.length > 0 && tf.ships.length > 0 ? (
              <label className="campaign-inline">
                Merge into
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) act({ kind: 'transfer-ships', player: viewer, from: tf.id, to: e.target.value, ships: tf.ships.map((s) => s.id) })
                  }}
                >
                  <option value="">…</option>
                  {others
                    .filter((o) => !o.scout)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="campaign-plot">
            {tf.plot.length > 0 ? (
              <span>
                Plotted: {tf.plot.map((leg) => `T${leg.turn} → ${systemAt(state.map, leg.to)?.name ?? hexKey(leg.to)}`).join(', ')}
              </span>
            ) : (
              <span className="campaign-dim">
                No plot. {admiral ? `${admiral.name} plots` : 'Without a flag it plots'} {plotLeadOf(state, tf)} turn{plotLeadOf(state, tf) === 1 ? '' : 's'} ahead (6.1, 7).
              </span>
            )}
            <span className="campaign-inline">
              <button onClick={() => onPlot(tf)}>Plot course</button>
              {tf.plot.length > 0 ? <button onClick={() => act({ kind: 'plot-move', player: viewer, taskForce: tf.id, legs: [] })}>Clear</button> : null}
            </span>
          </div>
          {state.phase === 'discovery' && enemiesInRange.length > 0 ? (
            <div className="campaign-actions">
              {enemiesInRange.map((enemy) => (
                <button key={enemy.id} onClick={() => act({ kind: 'detection-check', player: viewer, taskForce: tf.id, target: enemy.id })}>
                  Detection check: {enemy.name} at {hexDistance(enemy.hex, tf.hex)} hex{hexDistance(enemy.hex, tf.hex) === 1 ? '' : 'es'}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="campaign-dim">
          {intel ? `Intelligence, turn ${intel.turn}: ${intel.note}.` : 'Nothing is known of it beyond its being here.'}
          {' '}
          Order: {ORDER_LABELS[tf.order]}.
        </p>
      )}
    </div>
  )
}

/** The ground units aboard a ship, and where they can go down this phase. */
function Embarked({ state, viewer, ship, tf, act }: { state: CampaignState; viewer: PlayerId; ship: CampaignShip; tf: TaskForce; act: Act }) {
  const aboard = state.groundUnits.filter((u) => 'ship' in u.at && u.at.ship === ship.id)
  if (aboard.length === 0) return null
  const system = systemAt(state.map, tf.hex)
  const friendly = system ? state.colonies.filter((c) => c.systemId === system.id && c.owner === viewer) : []
  const moving = state.phase === 'planetary' || state.phase === 'production'
  return (
    <ul className="campaign-embarked">
      {aboard.map((u) => (
        <li key={u.id}>
          {u.name} <span className="campaign-dim">{markerLabel(u)} · {present(u).length}/{u.elements.length} · {unitCs(u)} CS{u.interfaceLanding ? ' · lands from orbit' : ''}</span>
          {moving
            ? friendly.map((c) => (
                <button key={c.id} onClick={() => act({ kind: 'disembark', player: viewer, unit: u.id, colony: c.id })}>
                  Disembark at {c.name}
                </button>
              ))
            : null}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// The player's own books (7, 8)
// ---------------------------------------------------------------------------

export function PlayerPanel({ state, viewer, act }: { state: CampaignState; viewer: PlayerId; act: Act }) {
  const player = state.players.find((p) => p.id === viewer)
  if (!player) return null
  const budget = researchBudgetOf(state, player)
  const admirals = state.admirals.filter((a) => a.owner === viewer)
  const [showResearch, setShowResearch] = useState(state.phase === 'production')
  // Research is paid for in the production phase (8), so the list opens
  // itself when that phase comes round; a player can still fold it away.
  useEffect(() => {
    if (state.phase === 'production') setShowResearch(true)
  }, [state.phase])
  return (
    <div className="panel campaign-player">
      <h3>{player.name}</h3>
      <p className="campaign-dim">
        {budget} RP across your colonies
        {player.researchPoints > 0 ? ` · ${player.researchPoints} research points` : ''}
        {player.techPoints > 0 ? ` · ${player.techPoints} tech points` : ''}
      </p>
      <details open={showResearch} onToggle={(e) => setShowResearch((e.target as HTMLDetailsElement).open)}>
        <summary>
          Research · {player.technologies.length} known
          {state.phase === 'production' ? ' · paid this phase (8)' : ''}
        </summary>
        <ul className="campaign-research">
          {TECHNOLOGIES.map((tech) => {
            const known = player.technologies.includes(tech.id as TechnologyId)
            const cost = effectiveCost(tech.id, player.technologies)
            return (
              <li key={tech.id} className={known ? 'is-known' : undefined}>
                <span>
                  {tech.label} <span className="num campaign-dim">{known ? '✓' : `${cost} RP`}</span>
                </span>
                {!known && state.phase === 'production' ? (
                  <button disabled={cost > budget} onClick={() => act({ kind: 'research', player: viewer, technology: tech.id as TechnologyId })}>
                    Research
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </details>
      {admirals.length > 0 ? (
        <details>
          <summary>Admirals · {admirals.filter((a) => !a.dead).length}</summary>
          <ul className="campaign-research">
            {admirals.map((a) => (
              <li key={a.id}>
                {a.name} · Level {a.level}
                {a.dead ? ' · killed' : a.injuredUntilTurn !== null && a.injuredUntilTurn > state.turn ? ` · injured until turn ${a.injuredUntilTurn}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
