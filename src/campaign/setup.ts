/**
 * What the setup screen needs that is not a rule: where the stars go, what
 * the fleet picker is shown, and how a picked fleet becomes the setup's
 * starting ships. `campaign.md` states no map-layout rule ("how many stars
 * and how far apart is the GM's call"), so the layout here is a convention
 * a GM might use: homes spread evenly round the map at the same distance
 * from its centre, and the rest of the stars scattered so that no two
 * touch.
 */

import { INTRODUCTORY_VICTORY, type Scenario } from '../data/scenarios'
import { designById } from '../data/ships'
import { CAMPAIGN_TABLE } from './turn'
import { hexDistance, hexKey, hexesWithin } from './map'
import { draw, type Hex, type RandomStream } from './types'
import type { CampaignSetup, SavedCampaign } from './types'

/** Every player starts with 2,000 RP of naval ships and 20 colony transports (Economy). */
export const STARTING_FLEET_RP = 2000
export const STARTING_TRANSPORTS = 20

export interface StarLayout {
  starHexes: Hex[]
  /** One home hex a player, in player order; every home is in `starHexes`. */
  homes: Hex[]
}

/**
 * Lay the stars out for a map: homes first, round the map at two thirds of
 * its radius and as far from each other as the ring allows; then the rest,
 * drawn from the seed, never adjacent to another star. Asking for more
 * stars than the map has room for gives as many as fit.
 */
export function layoutStars(seed: number, radius: number, stars: number, players: number): StarLayout {
  const stream: RandomStream = { seed: seed >>> 0, cursor: 0 }
  const ringRadius = Math.max(1, Math.round(radius * 0.66))
  const homes: Hex[] = []
  for (let i = 0; i < players; i += 1) {
    const angle = (Math.PI * 2 * i) / players - Math.PI / 2
    // √3 is a hex's width at size 1, so a ring of this many hexes is this
    // many hex-widths across whichever way the angle points.
    const reach = ringRadius * Math.sqrt(3)
    homes.push(nearestHex(reach * Math.cos(angle), reach * Math.sin(angle), radius))
  }
  const taken = new Set(homes.map(hexKey))
  const starHexes = [...homes]
  const candidates = hexesWithin({ q: 0, r: 0 }, radius).filter((hex) => !taken.has(hexKey(hex)))
  let guard = candidates.length * 4
  while (starHexes.length < stars && candidates.length > 0 && guard-- > 0) {
    const at = Math.min(candidates.length - 1, Math.floor(draw(stream) * candidates.length))
    const hex = candidates.splice(at, 1)[0]!
    if (starHexes.some((other) => hexDistance(other, hex) < 2)) continue
    starHexes.push(hex)
  }
  return { starHexes, homes }
}

/** The hex nearest a point in the pointy-top axial plane, clamped to the map. */
function nearestHex(x: number, y: number, radius: number): Hex {
  // Pointy-top axial: x = √3(q + r/2), y = 3r/2 with a hex size of 1.
  const r = (2 / 3) * y
  const q = x / Math.sqrt(3) - r / 2
  let hex = roundHex(q, r)
  if (hexDistance({ q: 0, r: 0 }, hex) > radius) {
    const scale = radius / hexDistance({ q: 0, r: 0 }, hex)
    hex = roundHex(q * scale, r * scale)
  }
  return hex
}

function roundHex(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}

/**
 * The fleet picker's scenario: one side a player, each with the starting
 * budget, priced in printed points because one point is one RP (Economy).
 * The table and the ladder are the campaign's own and are never fought on
 * from here; the picker only reads the sides and the budget.
 */
export function pickerScenario(players: ReadonlyArray<{ id: string; name: string }>): Scenario {
  return {
    id: 'campaign-setup',
    name: 'Campaign',
    briefing: 'The fleets each player begins the campaign with.',
    objective: `Spend up to ${STARTING_FLEET_RP} RP of naval ships (Economy).`,
    table: { ...CAMPAIGN_TABLE },
    budget: STARTING_FLEET_RP,
    victory: { ...INTRODUCTORY_VICTORY },
    sides: players.map((player) => ({ id: player.id, name: player.name, force: [] })),
  }
}

/** Picked design ids as the setup's starting ships, named "Kirov 1", "Kirov 2" by class. */
export function startingShipsFrom(designIds: readonly string[]): CampaignSetup['players'][number]['startingShips'] {
  const counts = new Map<string, number>()
  return designIds.map((designId) => {
    const design = designById(designId)
    const n = (counts.get(designId) ?? 0) + 1
    counts.set(designId, n)
    const stem = design ? design.name.replace(/-class\b.*$/i, '').trim() : designId
    return { designId, name: `${stem} ${n}` }
  })
}

/** What a campaign file must be to be opened; an error sentence otherwise. */
export function parseSavedCampaign(text: string): SavedCampaign | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return 'Not a Full Thrust campaign file (invalid JSON).'
  }
  if (typeof raw !== 'object' || raw === null) return 'Not a Full Thrust campaign file.'
  const file = raw as Partial<SavedCampaign>
  if (file.version !== 1) return `Campaign file version ${String(file.version)} is not one this app reads.`
  const setup = file.setup
  if (
    typeof setup !== 'object' ||
    setup === null ||
    typeof setup.seed !== 'number' ||
    typeof setup.radius !== 'number' ||
    !Array.isArray(setup.starHexes) ||
    !Array.isArray(setup.players) ||
    setup.players.length === 0
  ) {
    return 'The campaign file has no usable setup.'
  }
  if (!Array.isArray(file.moves)) return 'The campaign file has no move journal.'
  return { version: 1, setup, moves: file.moves }
}
