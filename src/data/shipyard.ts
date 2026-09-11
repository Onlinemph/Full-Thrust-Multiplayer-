import type { ShipDesign } from '../engine/types'

/**
 * The player's own designs.
 *
 * 2.3 calls designing ships "the heart and soul of the game", and a shipyard
 * that can only price a hull and hand back a JSON file is a calculator. A
 * design saved here shows up in the fleet picker beside the shipped roster,
 * and `withEmbedded` copies it into any battle that uses it — so a fleet of
 * home-built hulls travels in the save file and opens on a browser that has
 * never seen them.
 *
 * It lives in localStorage rather than in the game state on purpose: these are
 * *this player's* designs, not this battle's. A battle that uses one carries
 * its own copy, which is what keeps replay exact when the yard changes
 * underneath it.
 */

const KEY = 'full-thrust.shipyard.v1'

let designs: ShipDesign[] | null = null

function load(): ShipDesign[] {
  if (designs) return designs
  designs = []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      // A hand-edited or half-written entry should cost the player their yard,
      // not the app: anything that is not a design-shaped object is dropped.
      if (Array.isArray(parsed)) {
        designs = parsed.filter(
          (d): d is ShipDesign =>
            typeof d === 'object' && d !== null && typeof (d as ShipDesign).id === 'string',
        )
      }
    }
  } catch {
    // Private window, quota, or corrupt storage. An empty yard is correct.
  }
  return designs
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(designs ?? []))
  } catch {
    // The design still works for this session; it just will not come back.
  }
}

/** Every design this player has built, newest first. */
export function savedDesigns(): readonly ShipDesign[] {
  return load()
}

/** Save a design, replacing any of the same id. Returns the id it was stored under. */
export function saveDesign(design: ShipDesign): string {
  const yard = load()
  const copy = structuredClone(design)
  const at = yard.findIndex((d) => d.id === copy.id)
  if (at >= 0) yard[at] = copy
  else yard.unshift(copy)
  persist()
  return copy.id
}

export function deleteDesign(id: string): void {
  designs = load().filter((d) => d.id !== id)
  persist()
}

/** Forget the cache, so a test or an import can start from storage again. */
export function reloadShipyard(): void {
  designs = null
}
