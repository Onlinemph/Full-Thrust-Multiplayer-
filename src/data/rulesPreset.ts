/**
 * A rules preset: the gear a table allows and the optional rules it plays
 * under, as one named, saveable, shareable thing.
 *
 * Full Thrust has been played many ways since 1992 — the beams-and-torpedoes
 * game of the second edition, the Fleet Books' kit, the campaign's bans, a
 * club's own house rules — and Continuum keeps all of it in one catalogue.
 * A preset is how a table says which of it is on. It is data, not code: a
 * JSON file that can be kept, sent, published and clicked. Applying one to a
 * setup writes its bans and options into the setup field by field, so a
 * battle file replays the same whether or not the preset still exists.
 *
 * Gear is named by the catalogue's own ids — a weapon class ('beam',
 * 'pulse-torpedo') or a system kind ('pds', 'hangar-bay') — which is what
 * `GameSetup.bannedSystems` and the design validator already read.
 */

import { DEFAULT_CAMPAIGN_BANS } from '../engine/ew'
import { CATALOGUE_SYSTEMS, CATALOGUE_WEAPONS } from './buildCatalog'
import type { GameSetup } from './savedGame'
import type { TechBaseChoice } from './techBaseCheck'

/** The setup fields a preset may set: every optional rule, and the table's own settings. */
export const RULE_KEYS = [
  'emergencyThrust',
  'knockedOffCourse',
  'tableReentry',
  'shapedCharges',
  'movingTable',
  'aftArcFire',
  'rearArcAttacks',
  'driveDamage',
  'coreSystems',
  'reactorBreaches',
  'fighterMorale',
  'fighterQuality',
  'multiStageMissiles',
  'terrainHazards',
  'orbitalTable',
  'strikeColors',
  'civilWar',
  'solarFlares',
  'cpv',
  'sensorRules',
  'tableScale',
  'movementSystem',
  'allowNonFtl',
] as const satisfies readonly (keyof GameSetup)[]

export type RuleKey = (typeof RULE_KEYS)[number]
export type TableRules = Partial<Pick<GameSetup, RuleKey>>

/** Either a list of what is barred, or a list of the only things allowed. */
export type GearRule = { mode: 'ban'; banned: string[] } | { mode: 'allow'; allowed: string[] }

export interface RulesPreset {
  version: 1
  id: string
  name: string
  author?: string
  description?: string
  gear: GearRule
  table: TableRules
  /** A tech base (15) every side plays under, when the preset says. */
  techBase?: TechBaseChoice
}

export interface GearEntry {
  id: string
  label: string
  kind: 'weapon' | 'system'
}

/** A weapon class's name, off its smallest catalogue entry: "Beam-1" is the Beam. */
function weaponLabel(label: string): string {
  return label.replace(/[-\s]?\d+$/, '').replace(/^(SR|LR|ER) /, '')
}

/** Every piece of gear a preset can name, in catalogue order, once each. */
export const GEAR: readonly GearEntry[] = (() => {
  const seen = new Set<string>()
  const out: GearEntry[] = []
  for (const weapon of CATALOGUE_WEAPONS) {
    if (seen.has(weapon.weaponClass)) continue
    seen.add(weapon.weaponClass)
    out.push({ id: weapon.weaponClass, label: weaponLabel(weapon.label), kind: 'weapon' })
  }
  for (const system of CATALOGUE_SYSTEMS) {
    if (seen.has(system.kind)) continue
    seen.add(system.kind)
    out.push({ id: system.kind, label: system.label, kind: 'system' })
  }
  return out
})()

export const GEAR_IDS: ReadonlySet<string> = new Set(GEAR.map((g) => g.id))

export function gearLabel(id: string): string {
  return GEAR.find((g) => g.id === id)?.label ?? id
}

/** The ids the engine bars under this preset: the ban list, or everything not on the allow list. */
export function effectiveBans(preset: Pick<RulesPreset, 'gear'>): string[] {
  if (preset.gear.mode === 'ban') return [...new Set(preset.gear.banned)]
  const allowed = new Set(preset.gear.allowed)
  return GEAR.filter((g) => !allowed.has(g.id)).map((g) => g.id)
}

export function isBarred(preset: Pick<RulesPreset, 'gear'>, id: string): boolean {
  return preset.gear.mode === 'ban' ? preset.gear.banned.includes(id) : !preset.gear.allowed.includes(id)
}

/**
 * The setup as the preset would have it: its bans, its options, its tech base
 * on every side named, and its name on the record. Fields the preset does not
 * mention are left as they were.
 */
export function applyPreset(setup: GameSetup, preset: RulesPreset, sideIds: readonly string[] = []): GameSetup {
  const next: GameSetup = { ...setup, bannedSystems: effectiveBans(preset), rulesPreset: { id: preset.id, name: preset.name } }
  for (const key of RULE_KEYS) {
    if (key in preset.table) (next as unknown as Record<string, unknown>)[key] = preset.table[key]
  }
  if (preset.techBase !== undefined && sideIds.length > 0) {
    next.techBases = { ...setup.techBases }
    for (const id of sideIds) next.techBases[id] = preset.techBase
  }
  return next
}

/** A preset that says what a setup currently says: its bans as a ban list, its options as they stand. */
export function presetFromSetup(setup: GameSetup, meta: { id: string; name: string; author?: string; description?: string }): RulesPreset {
  const table: TableRules = {}
  for (const key of RULE_KEYS) {
    const value = setup[key]
    if (value !== undefined) (table as Record<string, unknown>)[key] = value
  }
  return {
    version: 1,
    id: meta.id,
    name: meta.name,
    ...(meta.author ? { author: meta.author } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    gear: { mode: 'ban', banned: [...(setup.bannedSystems ?? [])] },
    table,
  }
}

/** Does a setup already say what the preset says? Used to show which preset a table is on. */
export function setupMatchesPreset(setup: GameSetup, preset: RulesPreset): boolean {
  const bans = new Set(setup.bannedSystems ?? [])
  const wanted = effectiveBans(preset)
  if (bans.size !== wanted.length || wanted.some((id) => !bans.has(id))) return false
  for (const key of RULE_KEYS) {
    if (key in preset.table && setup[key] !== preset.table[key]) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// The presets that ship
// ---------------------------------------------------------------------------

/** The table Continuum sets by default (see `store.ts`'s DEFAULT_SETUP). */
const CONTINUUM_TABLE: TableRules = { terrainHazards: true, coreSystems: true, cpv: true, tableScale: 1.5 }

export const BUILT_IN_PRESETS: readonly RulesPreset[] = [
  {
    version: 1,
    id: 'continuum',
    name: 'Project Continuum, everything',
    author: 'Full Thrust',
    description: 'The whole catalogue and the rules a new table starts with: core systems, terrain hazards, CPV pricing, a table half again as big.',
    gear: { mode: 'ban', banned: [] },
    table: CONTINUUM_TABLE,
  },
  {
    version: 1,
    id: 'campaign',
    name: 'Stellar Imperium campaign',
    author: 'Full Thrust',
    description: 'The campaign rules bar the Reflex Field, the Cloaking Field and the Wave Gun, and price in printed points because one point is one RP.',
    gear: { mode: 'ban', banned: [...DEFAULT_CAMPAIGN_BANS] },
    table: { ...CONTINUUM_TABLE, cpv: false },
  },
  {
    version: 1,
    id: 'fleet-book',
    name: 'Fleet Book kit',
    author: 'Full Thrust',
    description:
      'Our reading of the Fleet Books’ kit and nothing later: beams, pulse torpedoes, needle beams, submunitions, salvo missiles, K-guns, scatterguns, plasma bolts, fighters, point and area defence, standard fire control. Edit it to your own reading.',
    gear: {
      mode: 'allow',
      allowed: [
        'beam', 'pulse-torpedo', 'needle-beam', 'submunition-pack', 'salvo-missile-rack', 'salvo-missile-launcher',
        'k-gun', 'scattergun', 'plasma-bolt-launcher', 'firecon', 'pds', 'adfc', 'hangar-bay', 'cargo', 'troop-berthing',
      ],
    },
    table: { ...CONTINUUM_TABLE, coreSystems: false, cpv: false },
  },
  {
    version: 1,
    id: 'second-edition',
    name: 'Second edition, beams and torpedoes',
    author: 'Full Thrust',
    description:
      'Our reading of the 1992 game: beams, pulse torpedoes, needle beams, submunition packs, fighters, point defence and fire control; cinematic movement, printed points, no core systems. Edit it to your own reading.',
    gear: { mode: 'allow', allowed: ['beam', 'pulse-torpedo', 'needle-beam', 'submunition-pack', 'firecon', 'pds', 'adfc', 'hangar-bay', 'cargo'] },
    table: { terrainHazards: false, coreSystems: false, cpv: false, tableScale: 1, movementSystem: 'cinematic' },
  },
]

export function builtInPreset(id: string): RulesPreset | undefined {
  return BUILT_IN_PRESETS.find((p) => p.id === id)
}

// ---------------------------------------------------------------------------
// Files and links
// ---------------------------------------------------------------------------

/** What a preset file must be to be opened; an error sentence otherwise. Unknown gear ids are kept and reported by the editor. */
export function parsePreset(text: string): RulesPreset | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return 'Not a rules preset (invalid JSON).'
  }
  return presetFromObject(raw)
}

export function presetFromObject(raw: unknown): RulesPreset | string {
  if (typeof raw !== 'object' || raw === null) return 'Not a rules preset.'
  const p = raw as Partial<RulesPreset>
  if (p.version !== 1) return `Rules preset version ${String(p.version)} is not one this app reads.`
  if (typeof p.id !== 'string' || p.id.trim() === '') return 'The preset has no id.'
  if (typeof p.name !== 'string' || p.name.trim() === '') return 'The preset has no name.'
  const gear = p.gear as Partial<GearRule> | undefined
  if (!gear || (gear.mode !== 'ban' && gear.mode !== 'allow')) return 'The preset says neither what it bans nor what it allows.'
  const list = gear.mode === 'ban' ? (gear as { banned?: unknown }).banned : (gear as { allowed?: unknown }).allowed
  if (!Array.isArray(list) || list.some((x) => typeof x !== 'string')) return 'The preset’s gear list is not a list of ids.'
  const table: TableRules = {}
  if (p.table !== undefined) {
    if (typeof p.table !== 'object' || p.table === null) return 'The preset’s table rules are not an object.'
    for (const key of RULE_KEYS) {
      if (key in p.table) (table as Record<string, unknown>)[key] = (p.table as Record<string, unknown>)[key]
    }
  }
  const preset: RulesPreset = {
    version: 1,
    id: p.id.trim().slice(0, 60),
    name: p.name.trim().slice(0, 80),
    gear: gear.mode === 'ban' ? { mode: 'ban', banned: [...new Set(list as string[])] } : { mode: 'allow', allowed: [...new Set(list as string[])] },
    table,
  }
  if (typeof p.author === 'string' && p.author.trim()) preset.author = p.author.trim().slice(0, 40)
  if (typeof p.description === 'string' && p.description.trim()) preset.description = p.description.trim().slice(0, 600)
  if (typeof p.techBase === 'string') preset.techBase = p.techBase as TechBaseChoice
  return preset
}

/** Gear ids the catalogue does not know, for the editor to point out. */
export function unknownGear(preset: RulesPreset): string[] {
  const list = preset.gear.mode === 'ban' ? preset.gear.banned : preset.gear.allowed
  return list.filter((id) => !GEAR_IDS.has(id))
}

export const PRESET_HASH_KEY = 'preset'

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** The preset as a link: the app's own address with the preset in the hash, so a click applies it. */
export function presetLink(preset: RulesPreset, base: string): string {
  return `${base}#${PRESET_HASH_KEY}=${toBase64Url(JSON.stringify(preset))}`
}

/** The preset a link carries, or null when the hash is not one; an error sentence when it is one and is bad. */
export function presetFromHash(hash: string): RulesPreset | string | null {
  const match = /^#?preset=([A-Za-z0-9_-]+)$/.exec(hash.trim())
  if (!match) return null
  try {
    return parsePreset(fromBase64Url(match[1]!))
  } catch {
    return 'The link does not hold a rules preset.'
  }
}

/** A slug for a new preset from its name, unique against what is on the shelf. */
export function presetIdFor(name: string, taken: ReadonlySet<string>): string {
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'preset'
  let id = stem
  for (let n = 2; taken.has(id); n += 1) id = `${stem}-${n}`
  return id
}
