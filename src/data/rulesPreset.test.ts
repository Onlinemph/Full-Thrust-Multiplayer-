/**
 * Rules presets: gear allowed or barred by catalogue id, the table's
 * options, applied to a setup field by field so a battle file stands on
 * its own; kept, sent as JSON, and carried in a link.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMPAIGN_BANS } from '../engine/ew'
import { OPTIONAL_RULES } from './optionalRules'
import { activePresetId, allPresets, deletePreset, presetById, reloadPresets, savePreset, setActivePreset } from './presetStore'
import {
  BUILT_IN_PRESETS,
  GEAR,
  GEAR_IDS,
  RULE_KEYS,
  applyPreset,
  effectiveBans,
  gearLabel,
  isBarred,
  parsePreset,
  presetFromHash,
  presetFromSetup,
  presetIdFor,
  presetLink,
  setupMatchesPreset,
  unknownGear,
  type RulesPreset,
} from './rulesPreset'
import type { GameSetup } from './savedGame'

const setup: GameSetup = { scenarioId: 'intro-fleet-engagement', seed: 1, rulesVersion: 1, cpv: true, terrainHazards: true }

describe('the gear list', () => {
  it('names every weapon class and system kind in the catalogue once, with a readable label', () => {
    expect(GEAR_IDS.has('beam')).toBe(true)
    expect(GEAR_IDS.has('pulse-torpedo')).toBe(true)
    expect(GEAR_IDS.has('pds')).toBe(true)
    expect(GEAR_IDS.has('hangar-bay')).toBe(true)
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length)
    expect(gearLabel('beam')).toBe('Beam')
    expect(gearLabel('pulse-torpedo')).toBe('Pulse Torp')
    expect(gearLabel('salvo-missile-rack')).toBe('SM Rack')
  })

  it('bars what a ban list names, or everything an allow list does not', () => {
    const bans: RulesPreset['gear'] = { mode: 'ban', banned: ['wave-gun', 'wave-gun'] }
    expect(effectiveBans({ gear: bans })).toEqual(['wave-gun'])
    const allow: RulesPreset['gear'] = { mode: 'allow', allowed: ['beam', 'pds', 'firecon'] }
    const barred = effectiveBans({ gear: allow })
    expect(barred).not.toContain('beam')
    expect(barred).toContain('pulse-torpedo')
    expect(barred.length).toBe(GEAR.length - 3)
    expect(isBarred({ gear: allow }, 'beam')).toBe(false)
    expect(isBarred({ gear: allow }, 'k-gun')).toBe(true)
  })
})

describe('applying a preset to a setup', () => {
  it('writes the bans, the options it names and its name, and leaves the rest alone', () => {
    const preset = BUILT_IN_PRESETS.find((p) => p.id === 'campaign')!
    const next = applyPreset(setup, preset, ['a', 'b'])
    expect(next.bannedSystems).toEqual([...DEFAULT_CAMPAIGN_BANS])
    expect(next.cpv).toBe(false)
    expect(next.coreSystems).toBe(true)
    expect(next.rulesPreset).toEqual({ id: 'campaign', name: 'Stellar Imperium campaign' })
    expect(next.scenarioId).toBe(setup.scenarioId)
    expect(next.seed).toBe(1)
    expect(setupMatchesPreset(next, preset)).toBe(true)
    expect(setupMatchesPreset({ ...next, cpv: true }, preset)).toBe(false)
  })

  it('puts a tech base on every side named, and only then', () => {
    const preset: RulesPreset = { version: 1, id: 't', name: 'T', gear: { mode: 'ban', banned: [] }, table: {}, techBase: 'custom' }
    expect(applyPreset(setup, preset, ['a', 'b']).techBases).toEqual({ a: 'custom', b: 'custom' })
    expect(applyPreset(setup, preset).techBases).toBeUndefined()
  })

  it('reads a preset back off a setup, options and bans as they stand', () => {
    const from = presetFromSetup({ ...setup, bannedSystems: ['nova-cannon'], movementSystem: 'vector' }, { id: 'mine', name: 'Mine', author: 'me' })
    expect(from.gear).toEqual({ mode: 'ban', banned: ['nova-cannon'] })
    expect(from.table).toEqual({ cpv: true, terrainHazards: true, movementSystem: 'vector' })
    expect(from.author).toBe('me')
    expect(setupMatchesPreset({ ...setup, bannedSystems: ['nova-cannon'], movementSystem: 'vector' }, from)).toBe(true)
  })

  it('covers every live optional rule and the table settings', () => {
    for (const rule of OPTIONAL_RULES) expect(RULE_KEYS).toContain(rule.key)
    expect(RULE_KEYS).toContain('tableScale')
    expect(RULE_KEYS).toContain('movementSystem')
  })
})

describe('the presets that ship', () => {
  it('name only gear the catalogue has, and each has a distinct id', () => {
    for (const preset of BUILT_IN_PRESETS) expect(unknownGear(preset)).toEqual([])
    expect(new Set(BUILT_IN_PRESETS.map((p) => p.id)).size).toBe(BUILT_IN_PRESETS.length)
  })

  it('the campaign preset bars what the campaign rules bar', () => {
    expect(effectiveBans(BUILT_IN_PRESETS.find((p) => p.id === 'campaign')!)).toEqual([...DEFAULT_CAMPAIGN_BANS])
  })

  it('the second-edition preset bars the Continuum kit and keeps the beams', () => {
    const second = BUILT_IN_PRESETS.find((p) => p.id === 'second-edition')!
    expect(isBarred(second, 'beam')).toBe(false)
    expect(isBarred(second, 'k-gun')).toBe(true)
    expect(isBarred(second, 'wave-gun')).toBe(true)
    expect(second.table.coreSystems).toBe(false)
  })
})

describe('files and links', () => {
  const preset = BUILT_IN_PRESETS.find((p) => p.id === 'fleet-book')!

  it('round-trips through JSON and refuses what is not a preset', () => {
    expect(parsePreset(JSON.stringify(preset))).toEqual(preset)
    expect(parsePreset('nope')).toMatch(/invalid JSON/)
    expect(parsePreset('{"version":2}')).toMatch(/version 2/)
    expect(parsePreset('{"version":1,"id":"x","name":"X"}')).toMatch(/neither what it bans/)
    expect(parsePreset('{"version":1,"id":"x","name":"X","gear":{"mode":"ban","banned":[1]}}')).toMatch(/not a list of ids/)
    const loose = parsePreset('{"version":1,"id":"x","name":"X","gear":{"mode":"ban","banned":["beam","laser-cannon"]},"table":{"cpv":false,"bogus":1}}')
    expect(loose).toMatchObject({ gear: { banned: ['beam', 'laser-cannon'] }, table: { cpv: false } })
    expect(unknownGear(loose as RulesPreset)).toEqual(['laser-cannon'])
  })

  it('carries the preset in a link and reads it back', () => {
    const link = presetLink(preset, 'https://example.test/app/')
    expect(link).toMatch(/^https:\/\/example\.test\/app\/#preset=[A-Za-z0-9_-]+$/)
    const hash = link.slice(link.indexOf('#'))
    expect(presetFromHash(hash)).toEqual(preset)
    expect(presetFromHash('#match=ABCDEF')).toBeNull()
    expect(presetFromHash('#preset=!!!')).toBeNull()
  })

  it('makes an id from a name and keeps it unique on the shelf', () => {
    expect(presetIdFor('My Club’s Rules!', new Set())).toBe('my-club-s-rules')
    expect(presetIdFor('Beams', new Set(['beams', 'beams-2']))).toBe('beams-3')
  })
})

describe('the shelf', () => {
  it('lists the shipped presets first, keeps saved ones, and lets a saved one replace a shipped id', () => {
    reloadPresets()
    expect(allPresets().map((p) => p.id)).toEqual(BUILT_IN_PRESETS.map((p) => p.id))
    savePreset({ version: 1, id: 'club', name: 'Club', gear: { mode: 'ban', banned: ['beam'] }, table: {} })
    expect(presetById('club')?.name).toBe('Club')
    savePreset({ ...BUILT_IN_PRESETS[0]!, name: 'Continuum, my way' })
    expect(allPresets().filter((p) => p.id === 'continuum')).toHaveLength(1)
    expect(presetById('continuum')?.name).toBe('Continuum, my way')
    setActivePreset('club')
    expect(activePresetId()).toBe('club')
    deletePreset('club')
    expect(presetById('club')).toBeUndefined()
    expect(activePresetId()).toBeNull()
    reloadPresets()
  })
})
