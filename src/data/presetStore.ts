import { BUILT_IN_PRESETS, type RulesPreset } from './rulesPreset'

/**
 * The shelf of rules presets: the ones that ship, and this browser's own.
 * One of them is "active": the one the Shipyard designs under and a new
 * table starts from, until a setup says otherwise.
 */

const KEY = 'ftpc.rules-presets.v1'
const ACTIVE_KEY = 'ftpc.rules-preset.active.v1'

let presets: RulesPreset[] | null = null
let active: string | null | undefined

function load(): RulesPreset[] {
  if (presets) return presets
  presets = []
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        presets = parsed.filter(
          (p): p is RulesPreset => typeof p === 'object' && p !== null && typeof (p as RulesPreset).id === 'string' && typeof (p as RulesPreset).gear === 'object',
        )
      }
    }
  } catch {
    // Private window, quota, or a hand-edited store: an empty shelf is right.
  }
  return presets
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets ?? []))
  } catch {
    // The preset still works for this session; it just will not come back.
  }
}

/** This browser's own presets, newest first. */
export function savedPresets(): readonly RulesPreset[] {
  return load()
}

/** Everything on the shelf: the shipped presets first. A saved preset with a shipped id replaces it. */
export function allPresets(): RulesPreset[] {
  const own = load()
  const ownIds = new Set(own.map((p) => p.id))
  return [...BUILT_IN_PRESETS.filter((p) => !ownIds.has(p.id)), ...own]
}

export function presetById(id: string): RulesPreset | undefined {
  return allPresets().find((p) => p.id === id)
}

export function isBuiltInPreset(id: string): boolean {
  return BUILT_IN_PRESETS.some((p) => p.id === id) && !load().some((p) => p.id === id)
}

export function savePreset(preset: RulesPreset): void {
  const list = load()
  const copy = structuredClone(preset)
  const at = list.findIndex((p) => p.id === copy.id)
  if (at >= 0) list[at] = copy
  else list.unshift(copy)
  persist()
}

export function deletePreset(id: string): void {
  presets = load().filter((p) => p.id !== id)
  persist()
  if (activePresetId() === id) setActivePreset(null)
}

/** The active preset's id, or null for "the whole catalogue". */
export function activePresetId(): string | null {
  if (active === undefined) {
    try {
      active = typeof localStorage === 'undefined' ? null : localStorage.getItem(ACTIVE_KEY)
    } catch {
      active = null
    }
  }
  return active ?? null
}

export function activePreset(): RulesPreset | undefined {
  const id = activePresetId()
  return id ? presetById(id) : undefined
}

export function setActivePreset(id: string | null): void {
  active = id
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Remembered for the session only.
  }
}

/** Forget the caches, so a test can start from storage again. */
export function reloadPresets(): void {
  presets = null
  active = undefined
}
