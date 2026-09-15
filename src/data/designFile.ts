import type { ShipDesign } from '../engine/types'
import { hullBoxesFor, priceDesign, validateDesign, describeFault } from './designPricing'
import { SHIP_DESIGNS } from './ships'
import { saveDesign, savedDesigns } from './shipyard'

/**
 * A ship design as a file, and as something another player made.
 *
 * The shipyard has always been able to hand a design back as JSON; this is
 * the other direction. A file, or a design fetched from the community, is
 * not trusted to be what it says it is: its shape is checked, its hull box
 * count and its price are worked out again from the tables rather than read
 * off the file, and the same validator the shipyard refuses to save past is
 * run over it. A design that fails is refused with the reason, not half
 * loaded — a fleet built on a hull that lies about its points is not a fleet
 * anyone agreed to fight.
 */

/** Which of a design's fields have to be there for it to be a design at all. */
function looksLikeDesign(value: unknown): value is ShipDesign {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Partial<ShipDesign>
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.mass === 'number' &&
    Number.isFinite(d.mass) &&
    typeof d.hullClass === 'string' &&
    typeof d.drive === 'object' &&
    d.drive !== null &&
    Array.isArray(d.weapons) &&
    Array.isArray(d.systems) &&
    Array.isArray(d.turrets) &&
    typeof d.armour === 'object' &&
    typeof d.screens === 'object'
  )
}

/** A file name or a pasted id, as an id: lower case, hyphens, nothing else. */
export function designSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Read a design out of text, or say what is wrong with it.
 *
 * What comes back is repriced: hull boxes from mass and integrity, points from
 * the construction tables. Optional collections the file left out are filled
 * in empty, so a design written by hand or by an older shipyard still opens.
 */
export function parseDesignFile(text: string): ShipDesign | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return 'Not a ship design file (invalid JSON).'
  }
  return normaliseDesign(raw)
}

/** The same check on a design that arrived already parsed — from the community. */
export function normaliseDesign(raw: unknown): ShipDesign | string {
  if (!looksLikeDesign(raw)) return 'Not a ship design: no hull, drive, weapons or systems in it.'
  const design: ShipDesign = {
    ...structuredClone(raw),
    id: designSlug(raw.id) || 'design',
    name: String(raw.name).trim().slice(0, 60) || 'Unnamed design',
    faction: typeof raw.faction === 'string' ? raw.faction.slice(0, 40) : 'Custom',
    fighterBays: Array.isArray(raw.fighterBays) ? raw.fighterBays : [],
    gunboats: Array.isArray(raw.gunboats) ? raw.gunboats : [],
    additionalDamageControlParties: Number.isFinite(raw.additionalDamageControlParties)
      ? raw.additionalDamageControlParties
      : 0,
    marineParties: Number.isFinite(raw.marineParties) ? raw.marineParties : 0,
  }
  if (typeof design.art === 'string' && !isCounterArtUrl(design.art)) delete design.art
  const layout = cleanLayout(design.layout)
  if (layout === undefined) delete design.layout
  else design.layout = layout
  // What the file says it costs is not evidence. The tables are.
  design.hullBoxes = Number.isFinite(raw.hullBoxes)
    ? raw.hullBoxes
    : hullBoxesFor(design.mass, design.hullClass)
  try {
    design.points = priceDesign(design).points
  } catch (error) {
    return `The design cannot be priced: ${error instanceof Error ? error.message : String(error)}`
  }
  const faults = validateDesign(design)
  if (faults.length > 0) {
    return `Not a legal design — ${faults.slice(0, 3).map(describeFault).join('; ')}${
      faults.length > 3 ? `; and ${faults.length - 3} more` : ''
    }.`
  }
  return design
}

/** The furthest from the keel a symbol can be put, in the sheet's own units. */
export const LAYOUT_REACH = 2000

/**
 * A layout as the sheet can use it: finite coordinates within reach, keyed by
 * plain ids. Anything else is dropped rather than drawn — a symbol at 1e308
 * is a hull the width of the universe.
 */
function cleanLayout(raw: unknown): ShipDesign['layout'] | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const out: NonNullable<ShipDesign['layout']> = {}
  for (const [key, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at !== 'object' || at === null) continue
    const { x, y } = at as { x?: unknown; y?: unknown }
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (Math.abs(x) > LAYOUT_REACH || Math.abs(y) > LAYOUT_REACH) continue
    out[key] = { x, y }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * A counter image the map may load: a page's own `https:` picture, or an
 * image the designer pasted in as a data URL. Nothing else — a `javascript:`
 * or plain `http:` URL is not art, and every browser that opens the battle
 * would fetch whatever it named.
 */
export function isCounterArtUrl(url: string): boolean {
  return /^https:\/\/\S+$/i.test(url) || /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(url)
}

/**
 * Put a design that came from elsewhere into this player's yard.
 *
 * An id that already means something here — a roster hull, or a different
 * design in the yard — gets a suffix rather than replacing it: `esu-frigate`
 * has to keep meaning the roster's frigate. The same design brought in twice
 * is one design. Returns the id it was stored under.
 */
export function importDesign(design: ShipDesign): string {
  const taken = new Set<string>(SHIP_DESIGNS.map((d) => d.id))
  const yard = savedDesigns()
  const twin = yard.find((d) => sameDesign(d, design))
  if (twin !== undefined) return twin.id
  for (const d of yard) taken.add(d.id)
  let id = design.id
  for (let n = 2; taken.has(id); n += 1) id = `${design.id}-${n}`
  return saveDesign({ ...design, id })
}

/** The same hull under the same name: what it carries, not what it is called. */
function sameDesign(a: ShipDesign, b: ShipDesign): boolean {
  const strip = (d: ShipDesign): string => {
    const { id: _id, ...rest } = d
    return JSON.stringify(rest)
  }
  return strip(a) === strip(b)
}

/** The design as a file. */
export function designFileText(design: ShipDesign): string {
  return JSON.stringify(design, null, 2)
}
