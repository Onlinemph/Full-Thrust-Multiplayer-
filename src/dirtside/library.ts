import { BOOK_EXAMPLES } from './data/examples'
import type { VehicleDesign } from './types'

/**
 * The Motor Pool's shelf: this browser's vehicle designs, kept the way the
 * Shipyard keeps hulls. The book's examples are always on it and cannot be
 * deleted, only copied.
 */

const KEY = 'ftpc.dirtside.designs.v1'

let designs: VehicleDesign[] | null = null

function load(): VehicleDesign[] {
  if (designs) return designs
  designs = []
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        designs = parsed.filter(
          (d): d is VehicleDesign => typeof d === 'object' && d !== null && typeof (d as VehicleDesign).id === 'string' && Array.isArray((d as VehicleDesign).weapons),
        )
      }
    }
  } catch {
    // Private window, quota, or a hand-edited store: an empty shelf is right.
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

/** The book's vehicles first, then this browser's, newest first. */
export function motorPoolDesigns(): readonly VehicleDesign[] {
  return [...BOOK_EXAMPLES.map((e) => e.design), ...load()]
}

export function isBookDesign(id: string): boolean {
  return BOOK_EXAMPLES.some((e) => e.design.id === id)
}

export function saveVehicleDesign(design: VehicleDesign): void {
  const list = load()
  const copy = structuredClone(design)
  const at = list.findIndex((d) => d.id === copy.id)
  if (at >= 0) list[at] = copy
  else list.unshift(copy)
  persist()
}

export function deleteVehicleDesign(id: string): void {
  designs = load().filter((d) => d.id !== id)
  persist()
}

export function reloadMotorPool(): void {
  designs = null
}
