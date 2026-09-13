/**
 * Full Thrust: Project Continuum — the Imperial Tech Base (section 15).
 *
 * Section 15 is the only part of the book that is not a game rule. It is a
 * *design-time* rule, aimed at the player with no genre to be limited by:
 * *"who wants to play against an opponent that uses spinal mounts, cloaking
 * devices, fighters, gunboats, scatter packs and advanced drives all on the
 * same ship? The best way to limit players is to generate a Tech Base for the
 * player's empire using the following lists."*
 *
 * So this module has no dice, no phase and no state. It is nine tables, a
 * prerequisite graph, a budget, and one predicate — may this empire field this
 * thing? — which is the question a ship designer asks about every box on an
 * SSD. Every function returns a new value and nothing passed in is touched.
 *
 * Three mechanisms carry all of it:
 *
 * - **Choices.** *"Players may choose whatever systems they wish but are
 *   limited to a number of choices as determined by their player group. We
 *   recommend no more than ten but it's up to the players."*
 * - **Free systems.** *"Some systems come for free and are marked with a '0'
 *   cost."* Which is two different things in practice, and `TechAvailability`
 *   splits them — see the note on that type.
 * - **Prerequisites.** *"you must purchase one system in order to be able to
 *   have another."* Stored as an AND of OR-groups, because Phasers need two
 *   parents and the Meson Projector accepts either of two.
 *
 * The section is a catalogue and `types.ts` is a catalogue, and they were
 * written from different parts of the book, so they do not line up. Nothing
 * here papers over that: a tech entry the engine has no symbol for carries no
 * unlock, and an engine symbol 15.1 never names can be fielded by nobody.
 * `docs/rules/techbase.md` tabulates both directions.
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, section 15
 * (pages 125–127); the prose, the readings and the two example factions'
 * printed tables are in `docs/rules/techbase.md`.
 */

import type {
  FtlKind,
  HullRows,
  ShipDesign,
  SystemKind,
  WeaponClass,
  WeaponDef,
  WeaponVariant,
} from './types'

// ---------------------------------------------------------------------------
// The budget (15, preamble)
// ---------------------------------------------------------------------------

/**
 * *"We recommend no more than ten but it's up to the players"* (15).
 *
 * A default, never a limit: both example factions in 15.2 spend more than this
 * (12 and 11), so `validateTechBase` reports going over as a warning.
 * **[reading]** — the alternative, a hard ten, makes the book's own worked
 * examples illegal.
 */
export const RECOMMENDED_TECH_CHOICE_LIMIT = 10

/** *"This technology 3 choice package"* (15.1 Fighters #21). */
export const FIGHTER_PACKAGE_COST = 3

/**
 * *"allows the user to pick 6 choices of fighter technology"* (15.1 Fighters
 * #21).
 *
 * **[reading]** Six *choices*, pooled and divisible, not six items: entries are
 * priced in choices everywhere else in the section, so Multi-Role Fighters draw
 * 3 of the 6 and an entry may be part-paid from the pool with the overflow
 * charged to the main allowance. Reading it as six items would make the package
 * worth up to twenty choices' worth of fighter tech; reading entries as atomic
 * would make the package's value depend on the order the choices were written.
 */
export const FIGHTER_PACKAGE_GRANT = 6

// ---------------------------------------------------------------------------
// Shape of the catalogue
// ---------------------------------------------------------------------------

/** The nine lists of 15.1, in the order the book prints them. */
export type TechCategory =
  | 'primary'
  | 'defensive'
  | 'targeting'
  | 'direct-fire'
  | 'ordnance'
  | 'spinal'
  | 'fighters'
  | 'gunboats'
  | 'secondary'

export const TECH_CATEGORY_LABELS: Record<TechCategory, string> = {
  primary: 'Primary ship systems',
  defensive: 'Defensive systems',
  targeting: 'Targeting systems',
  'direct-fire': 'Direct fire weapons',
  ordnance: 'Ordnance weapons',
  spinal: 'Spinal Mounts',
  fighters: 'Fighters',
  gunboats: 'Gunboats',
  secondary: 'Secondary ship systems',
}

/**
 * **[reading]** A printed cost of nothing means one of two different things,
 * and conflating them is the single easiest way to get section 15 wrong.
 *
 * The preamble says *"Some systems come for free and are marked with a '0'
 * cost. Every empire has those systems"* — but eight entries cost nothing and
 * are plainly not universal, because their own text names a parent: *"Area ECM
 * (comes with ECM technology)"*, *"Gunboat Rack (comes with Gunboats)"*, and so
 * on through the whole 15.8 armament list.
 *
 * - `choice` — costs `TechEntry.choices` from the empire's allowance.
 * - `universal` — printed *"(0 technology choices)"*. Every empire has it,
 *   before it spends anything.
 * - `bundled` — printed *"comes with X"*. Free, but unavailable until X is
 *   held.
 *
 * The alternative — every 0-cost entry is universal, per the preamble's letter
 * — hands every empire Area ECM with no ECM, Salvo Missile Racks with no
 * launcher and Gunboat Racks with no gunboats, and makes six entries'
 * parentheticals dead letters.
 */
export type TechAvailability = 'choice' | 'universal' | 'bundled'

/** Armour features 15.1 sells separately (defensive #1–#3; 4.8, 7.7, 7.8). */
export type ArmourFeature = 'basic' | 'layered' | 'regenerative'

/** Screen features 15.1 sells separately (defensive #11–#13; 7.2, 7.3, 7.16). */
export type ScreenFeature = 'basic' | 'advanced' | 'area'

/**
 * What holding a tech entry lets an empire put on a hull.
 *
 * `fighter` and `gunboat` carry plain strings rather than `FighterTypeId` and
 * `GunboatTypeId` because those unions live in `fighters.ts` and `gunboats.ts`,
 * which this module does not import — it is a data table, not a combat
 * resolver, and depending on two of the largest modules in the engine to name
 * fifteen strings would be the tail wagging the dog. The strings are the exact
 * spellings of those unions; `docs/rules/techbase.md` lists the six that have
 * no member to match.
 */
export type TechUnlock =
  | { kind: 'system'; system: SystemKind }
  | {
      kind: 'weapon'
      weaponClass: WeaponClass
      /** Classes this entry covers. Omitted where the weapon has no class. */
      ratings?: readonly number[]
      /** Variants this entry covers. Omitted where the entry covers all. */
      variants?: readonly WeaponVariant[]
    }
  | { kind: 'hull-rows'; rows: readonly HullRows[] }
  | { kind: 'drive'; advanced: boolean }
  | { kind: 'ftl'; ftl: FtlKind }
  | { kind: 'armour'; feature: ArmourFeature }
  | { kind: 'screens'; feature: ScreenFeature }
  | { kind: 'turret' }
  | { kind: 'fighter'; typeId?: string; modifier?: string }
  | { kind: 'gunboat'; typeId?: string; modifier?: string }

/** One numbered line of 15.1 or 15.8. */
export interface TechEntry {
  id: TechId
  category: TechCategory
  /** Its number within its own list, so a reader can find the printed line. */
  index: number
  /** The entry's name exactly as printed. */
  printed: string
  /** The parenthetical exactly as printed, cost and prerequisite together. */
  printedCost: string
  availability: TechAvailability
  /** Technology choices this entry costs. Zero for universal and bundled. */
  choices: number
  /**
   * An AND of OR-groups: every group must contain at least one held entry.
   * Phasers are `[[beams-1-3], [graser]]`; the Meson Projector, which comes
   * *"free with either Twin Particle Array or Gatling Batteries"*, is
   * `[[twin-particle-array, gatling]]`.
   */
  prerequisites: readonly (readonly TechId[])[]
  unlocks: readonly TechUnlock[]
  note?: string
}

/**
 * Every entry of 15.1 and 15.8, by id.
 *
 * Ids are the module's own kebab-case spellings; where the engine already has a
 * name for the thing — a `SystemKind` or a `WeaponClass` — the id is that name,
 * so `ecm`, `pds`, `graser` and `holofield` read the same on both sides.
 */
export type TechId =
  // Primary ship systems (8)
  | 'hull-standard'
  | 'hull-advanced-3-row'
  | 'hangar-bay'
  | 'launch-tube-catapult'
  | 'drive-standard'
  | 'drive-advanced-gravity'
  | 'ftl-drive'
  | 'ftl-drive-advanced'
  // Defensive systems (21)
  | 'armour'
  | 'armour-layered'
  | 'armour-regenerative'
  | 'stealth-hull'
  | 'adfc'
  | 'advanced-adfc'
  | 'pds'
  | 'ads'
  | 'scattergun'
  | 'grapeshot'
  | 'screens'
  | 'advanced-screens'
  | 'area-screens'
  | 'holofield'
  | 'stealth-field'
  | 'ecm'
  | 'area-ecm'
  | 'cloaking-device'
  | 'cloaking-field'
  | 'tuffley-cloak'
  | 'antimatter-charge'
  // Targeting systems (2)
  | 'firecon'
  | 'advanced-firecon'
  // Direct fire weapons (25)
  | 'beams-1-3'
  | 'beams-4-6'
  | 'emp'
  | 'plasma-cannon'
  | 'graser'
  | 'heavy-graser'
  | 'phaser'
  | 'transporter'
  | 'gatling'
  | 'twin-particle-array'
  | 'meson-projector'
  | 'needle-beam'
  | 'pulse-torpedo'
  | 'pulse-torpedo-overloaded'
  | 'pulse-torpedo-long'
  | 'pulse-torpedo-variable'
  | 'fusion-array'
  | 'submunition-pack'
  | 'k-gun'
  | 'k-gun-long'
  | 'flak-ammo'
  | 'gravitic-gun'
  | 'boarding-torpedo'
  | 'pulser'
  | 'turrets'
  // Ordnance weapons (10)
  | 'antimatter-missile'
  | 'salvo-missile-launcher'
  | 'salvo-missile-rack'
  | 'salvo-missile-extended'
  | 'rocket-pod'
  | 'heavy-missile'
  | 'mine-rack'
  | 'mines-standard'
  | 'mkp'
  | 'plasma-bolt-launcher'
  // Spinal Mounts (3)
  | 'spinal-psp'
  | 'spinal-beam'
  | 'spinal-plasma'
  // Fighters (21)
  | 'fighter-standard-beam'
  | 'fighter-standard-gun'
  | 'fighter-heavy'
  | 'fighter-fast'
  | 'fighter-long-range'
  | 'fighter-interceptor'
  | 'fighter-attack'
  | 'fighter-torpedo'
  | 'fighter-emp'
  | 'fighter-graser'
  | 'fighter-plasma'
  | 'fighter-mkp'
  | 'fighter-needle'
  | 'fighter-missile'
  | 'fighter-rocket'
  | 'fighter-multi-role'
  | 'fighter-robot'
  | 'fighter-rack'
  | 'fighter-ftl'
  | 'assault-shuttle'
  | 'fighter-package-deal'
  // Gunboats (22) — 15.8
  | 'gunboat'
  | 'gunboat-rack'
  | 'gunboat-ftl'
  | 'gunboat-beam'
  | 'gunboat-emp'
  | 'gunboat-plasma'
  | 'gunboat-graser'
  | 'gunboat-gatling'
  | 'gunboat-needle'
  | 'gunboat-pulse-torpedo'
  | 'gunboat-submunition'
  | 'gunboat-mkp'
  | 'gunboat-k-gun'
  | 'gunboat-gravitic'
  | 'gunboat-missile'
  | 'gunboat-rocket'
  | 'gunboat-boarding-torpedo'
  | 'gunboat-ads'
  | 'gunboat-ecm'
  | 'gunboat-scatterpack'
  | 'gunboat-plasma-bomber'
  | 'gunboat-heavy'
  // Secondary ship systems (11)
  | 'enhanced-sensors'
  | 'superior-sensors'
  | 'minesweeper'
  | 'boat-bay'
  | 'cargo'
  | 'berthing'
  | 'shipyard'
  | 'marine-party'
  | 'damage-control-party'
  | 'ortillery'
  | 'weasel-emitter'

// ---------------------------------------------------------------------------
// The catalogue (15.1, 15.8)
// ---------------------------------------------------------------------------

/**
 * One list's worth of entries before defaults are filled in. `availability`
 * defaults to `'choice'` and `choices` to 1, because 96 of the 123 entries are
 * a plain one-choice purchase and spelling that out 96 times hides the ones
 * that are not.
 */
interface TechEntrySpec {
  id: TechId
  printed: string
  printedCost: string
  availability?: TechAvailability
  choices?: number
  needs?: readonly (readonly TechId[])[]
  unlocks?: readonly TechUnlock[]
  note?: string
}

function defineList(category: TechCategory, specs: readonly TechEntrySpec[]): TechEntry[] {
  return specs.map((spec, i) => {
    const availability = spec.availability ?? 'choice'
    return {
      id: spec.id,
      category,
      index: i + 1,
      printed: spec.printed,
      printedCost: spec.printedCost,
      availability,
      choices: availability === 'choice' ? (spec.choices ?? 1) : 0,
      prerequisites: spec.needs ?? [],
      unlocks: spec.unlocks ?? [],
      ...(spec.note === undefined ? {} : { note: spec.note }),
    }
  })
}

const PRIMARY = defineList('primary', [
  {
    id: 'hull-standard',
    printed: 'Standard 4, 5 and 6 row Hull',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'hull-rows', rows: [4, 5, 6] }],
    note: '15.1 governs the number of hull rows (13.7), never the hull class: no entry anywhere in the section mentions Fragile, Weak, Average, Strong or Super, so a tech base is silent on how tough a hull is.',
  },
  {
    id: 'hull-advanced-3-row',
    printed: 'Advanced 3 row Hull',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'hull-rows', rows: [3] }],
  },
  {
    id: 'hangar-bay',
    printed: 'Hangar bay and launch tube/flight deck',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [
      { kind: 'system', system: 'hangar-bay' },
      { kind: 'system', system: 'launch-tube' },
    ],
    note: 'The plant is free; what flies out of it is not. Every fighter type is a separate paid entry.',
  },
  {
    id: 'launch-tube-catapult',
    printed: 'Launch tube catapult',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'catapult' }],
  },
  {
    id: 'drive-standard',
    printed: 'Standard drive system',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'drive', advanced: false }],
  },
  {
    id: 'drive-advanced-gravity',
    printed: 'Advanced gravity drive',
    printedCost: '(3 technology choices)',
    choices: 3,
    unlocks: [{ kind: 'drive', advanced: true }],
    note: 'The dearest primary entry in the section, and one of only three 3-choice entries anywhere in it. 3.3 lets an advanced drive turn its full rating instead of half, so 15.1 prices manoeuvre as the rarest thing an empire can have.',
  },
  {
    id: 'ftl-drive',
    printed: 'FTL Drive',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [
      { kind: 'ftl', ftl: 'standard' },
      { kind: 'system', system: 'ftl-drive' },
    ],
  },
  {
    id: 'ftl-drive-advanced',
    printed: 'Advanced FTL Drives',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'ftl', ftl: 'advanced' }],
  },
])

const DEFENSIVE = defineList('defensive', [
  {
    id: 'armour',
    printed: 'Armor',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'armour', feature: 'basic' }],
  },
  {
    id: 'armour-layered',
    printed: 'Layered or Shell Armor',
    printedCost: '(1 technology choice, prerequisite is Armor)',
    needs: [['armour']],
    unlocks: [{ kind: 'armour', feature: 'layered' }],
  },
  {
    id: 'armour-regenerative',
    printed: 'Regenerative Armor',
    printedCost: '(2 technology choices)',
    choices: 2,
    unlocks: [{ kind: 'armour', feature: 'regenerative' }],
    note: 'No printed prerequisite, where Layered Armor at half the cost does require plain Armor. So an empire may field armour that repairs itself without ever buying armour that does not. As printed; not a reading, and a test pins it.',
  },
  {
    id: 'stealth-hull',
    printed: 'Stealth Hull',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'stealth-hull' }],
  },
  {
    id: 'adfc',
    printed: 'ADFC',
    printedCost: '(0 technology choice)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'adfc' }],
    note: 'Free, while the PDS and ADS it directs cost a choice each. The fire control is universal; the guns are not.',
  },
  {
    id: 'advanced-adfc',
    printed: 'Advanced ADFC',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'advanced-adfc' }],
  },
  {
    id: 'pds',
    printed: 'PDS',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'pds' }],
  },
  {
    id: 'ads',
    printed: 'ADS',
    printedCost: '(1 technology choice, PDS is prerequisite)',
    needs: [['pds']],
    unlocks: [{ kind: 'system', system: 'ads' }],
  },
  {
    id: 'scattergun',
    printed: 'Scattergun',
    printedCost: '(1 technology choice, prerequisite is Grape Shot)',
    needs: [['grapeshot']],
    unlocks: [{ kind: 'system', system: 'scattergun' }],
    note: 'The list prints this one line *before* the Grapeshot it requires, which is the likeliest place in the section to get a prerequisite backwards. 7.15 has the Grapeshot Launcher "similar in function to a Kra\'Vak Scattergun but not quite as effective", so the weaker weapon gates the better one.',
  },
  {
    id: 'grapeshot',
    printed: 'Grapeshot',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'grapeshot' }],
  },
  {
    id: 'screens',
    printed: 'Screens',
    printedCost: '(1 technology choice)',
    unlocks: [
      { kind: 'screens', feature: 'basic' },
      { kind: 'system', system: 'screen-generator' },
    ],
  },
  {
    id: 'advanced-screens',
    printed: 'Advanced Screens',
    printedCost: '(2 technology choices prerequisite is Screens)',
    choices: 2,
    needs: [['screens']],
    unlocks: [{ kind: 'screens', feature: 'advanced' }],
  },
  {
    id: 'area-screens',
    printed: 'Area Screens',
    printedCost: '(3 technology choices, Advanced Screens is prerequisite)',
    choices: 3,
    needs: [['advanced-screens']],
    unlocks: [{ kind: 'screens', feature: 'area' }],
    note: 'Six choices all told — Screens 1, Advanced 2, Area 3 — which is more than half a recommended tech base spent on 7.16 alone.',
  },
  {
    id: 'holofield',
    printed: 'Holofield',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'holofield' }],
  },
  {
    id: 'stealth-field',
    printed: 'Stealth Fields',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'stealth-field' }],
  },
  {
    id: 'ecm',
    printed: 'ECM',
    printedCost: '(2 technology choices)',
    choices: 2,
    unlocks: [{ kind: 'system', system: 'ecm' }],
    note: 'Twice the price of a holofield, a stealth field or any of the three cloaks — the only electronic-warfare entry that costs more than one choice, and the one that then gives Area ECM away.',
  },
  {
    id: 'area-ecm',
    printed: 'Area ECM',
    printedCost: '(comes with ECM technology)',
    availability: 'bundled',
    needs: [['ecm']],
    unlocks: [{ kind: 'system', system: 'area-ecm' }],
  },
  {
    id: 'cloaking-device',
    printed: 'Cloaking Device',
    printedCost: '(1 technology choice, Stealth Field is prerequisite)',
    needs: [['stealth-field']],
    unlocks: [{ kind: 'system', system: 'cloaking-device' }],
  },
  {
    id: 'cloaking-field',
    printed: 'Cloaking Field',
    printedCost: '(1 technology choice, Stealth Field is prerequisite)',
    needs: [['stealth-field']],
    unlocks: [{ kind: 'system', system: 'cloaking-field' }],
  },
  {
    id: 'tuffley-cloak',
    printed: 'Tuffley Cloak Device',
    printedCost: '(1 technology choice, Stealth Field is prerequisite)',
    needs: [['stealth-field']],
    unlocks: [{ kind: 'system', system: 'tuffley-cloak' }],
    note: "All three cloaks gate on Stealth Fields, so 7.20–7.22 costs two choices before a ship goes dark. The Reflex Field the engine also models (SystemKind 'reflex-field') is not in this list at all, and so cannot be bought by anyone.",
  },
  {
    id: 'antimatter-charge',
    printed: 'Antimatter Suicide Charge',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'antimatter-charge' }],
  },
])

const TARGETING = defineList('targeting', [
  {
    id: 'firecon',
    printed: 'Fire Control',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'firecon' }],
  },
  {
    id: 'advanced-firecon',
    printed: 'Advanced fire Control',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'advanced-firecon' }],
  },
])

const DIRECT_FIRE = defineList('direct-fire', [
  {
    id: 'beams-1-3',
    printed: 'Beams, Class 1, 2 and 3',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'beam', ratings: [1, 2, 3] }],
    note: '**[reading]** This is what the bare word "Beams" means where Grasers, Gatling Batteries, Twin Particle Arrays, Pulsers and the Beam spinal mount name it as a prerequisite: the list has no entry called plain "Beams", and Class 4–6 has this entry as its own prerequisite, so requiring Class 1–3 and requiring "either beam entry" admit exactly the same tech bases. Requiring both would make a Graser cost three choices, which the New Anglian example does not pay.',
  },
  {
    id: 'beams-4-6',
    printed: 'Beams, Class 4, 5 and 6',
    printedCost: '(1 technology choice, prerequisite is Beams Class 1, 2 and 3)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'beam', ratings: [4, 5, 6] }],
  },
  {
    id: 'emp',
    printed: 'EMP Projectors',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'emp' }],
  },
  {
    id: 'plasma-cannon',
    printed: 'Plasma Cannon',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'plasma-cannon' }],
  },
  {
    id: 'graser',
    printed: 'Standard Grasers',
    printedCost: '(1 technology choice, Beams is prerequisite)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'graser' }],
  },
  {
    id: 'heavy-graser',
    printed: 'Heavy Grasers',
    printedCost: '(1 technology choice, prerequisite is Standard Grasers)',
    needs: [['graser']],
    unlocks: [{ kind: 'weapon', weaponClass: 'heavy-graser' }],
  },
  {
    id: 'phaser',
    printed: 'Phasers',
    printedCost: '(1 technology choice, prerequisites are Beams, and Grasers)',
    needs: [['beams-1-3'], ['graser']],
    unlocks: [{ kind: 'weapon', weaponClass: 'phaser' }],
    note: 'The only entry in the section with two separate prerequisites in the same category, and the longest paid chain in it: beams, grasers, phasers, three choices.',
  },
  {
    id: 'transporter',
    printed: 'Transporter Beams',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'transporter' }],
  },
  {
    id: 'gatling',
    printed: 'Gatling Battery',
    printedCost: '(1 technology choice, Beams is prerequisite)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'gatling' }],
  },
  {
    id: 'twin-particle-array',
    printed: 'Twin Particle Array',
    printedCost: '(1 technology choice, Beams is prerequisite)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'twin-particle-array' }],
  },
  {
    id: 'meson-projector',
    printed: 'Meson Projector',
    printedCost: '(comes free with either Twin Particle Array or Gatling Batteries)',
    availability: 'bundled',
    needs: [['twin-particle-array', 'gatling']],
    unlocks: [{ kind: 'weapon', weaponClass: 'meson-projector' }],
  },
  {
    id: 'needle-beam',
    printed: 'Needle Beams',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'needle-beam' }],
  },
  {
    id: 'pulse-torpedo',
    printed: 'Pulse Torpedoes - Standard and Short Range',
    printedCost: '(1 technology choice)',
    unlocks: [
      { kind: 'weapon', weaponClass: 'pulse-torpedo', variants: ['standard', 'short'] },
    ],
    note: 'The short-range mounting is in the base entry, not an extra. 14.4 prices short range at half mass, so the cheap version is also the free one.',
  },
  {
    id: 'pulse-torpedo-overloaded',
    printed: 'Overloaded Pulse Torpedo',
    printedCost: '(1 technology choice, prerequisite is Pulse Torpedo)',
    needs: [['pulse-torpedo']],
    unlocks: [],
    note: "5.14's Overloaded Pulse Torpedo (AP) has no home in the engine: WeaponVariant runs standard, short, long, extended, two-stage, variable, and has no 'overloaded'. Catalogued with no unlock rather than mapped onto a variant that means something else.",
  },
  {
    id: 'pulse-torpedo-long',
    printed: 'Long Range Pulse Torpedo',
    printedCost: '(1 technology choice, prerequisite is Pulse Torpedo)',
    needs: [['pulse-torpedo']],
    unlocks: [{ kind: 'weapon', weaponClass: 'pulse-torpedo', variants: ['long'] }],
  },
  {
    id: 'pulse-torpedo-variable',
    printed: 'Variable Strength Pulse Torpedo',
    printedCost: '(1 technology choice, prerequisite is Pulse Torpedo)',
    needs: [['pulse-torpedo']],
    unlocks: [{ kind: 'weapon', weaponClass: 'pulse-torpedo', variants: ['variable'] }],
  },
  {
    id: 'fusion-array',
    printed: 'Fusion Array',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'fusion-array' }],
  },
  {
    id: 'submunition-pack',
    printed: 'Submunition Pack',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'submunition-pack' }],
  },
  {
    id: 'k-gun',
    printed: 'K-Guns Standard and Short Range',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'k-gun', variants: ['standard', 'short'] }],
  },
  {
    id: 'k-gun-long',
    printed: 'Long Range K-Gun',
    printedCost: '(1 technology choice, prerequisite is K-Gun)',
    needs: [['k-gun']],
    unlocks: [{ kind: 'weapon', weaponClass: 'k-gun', variants: ['long'] }],
  },
  {
    id: 'flak-ammo',
    printed: 'Flak Ammo',
    printedCost: '(1 technology choice)',
    unlocks: [],
    note: 'No printed prerequisite, though 5.16 gives flak ammunition only to "K-Guns of class 2 or larger" and 14.4 prices it at "+2 points per gun". Encoded exactly as printed: inventing the K-Gun prerequisite the construction rules imply would be inventing a rule. It also has no engine handle — flak is a per-gun option, not a WeaponClass or SystemKind.',
  },
  {
    id: 'gravitic-gun',
    printed: 'Gravitic Guns',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'gravitic-gun' }],
  },
  {
    id: 'boarding-torpedo',
    printed: 'Boarding Torpedoes',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'boarding-torpedo' }],
  },
  {
    id: 'pulser',
    printed: 'Pulsers',
    printedCost: '(2 technology choices, prerequisite is Beams)',
    choices: 2,
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'pulser' }],
    note: 'The preamble\'s worked example, under the name it uses nowhere else: "Pulse Batteries require the empire to have beam weapons as well since Pulse Weapons are an advanced version of standard beam weaponry."',
  },
  {
    id: 'turrets',
    printed: 'Turrets',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'turret' }],
    note: '5.22\'s mounting is a technology in its own right. An empire without it fires everything on fixed arcs.',
  },
])

const ORDNANCE = defineList('ordnance', [
  {
    id: 'antimatter-missile',
    printed: 'Antimatter Missile',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'antimatter-missile' }],
  },
  {
    id: 'salvo-missile-launcher',
    printed: 'Salvo Missile Launcher',
    printedCost: '(1 technology choice)',
    unlocks: [
      { kind: 'weapon', weaponClass: 'salvo-missile-launcher', variants: ['standard'] },
    ],
  },
  {
    id: 'salvo-missile-rack',
    printed: 'Salvo Missile Rack',
    printedCost: '(comes with Salvo Missile Launcher)',
    availability: 'bundled',
    needs: [['salvo-missile-launcher']],
    unlocks: [{ kind: 'weapon', weaponClass: 'salvo-missile-rack', variants: ['standard'] }],
  },
  {
    id: 'salvo-missile-extended',
    printed: 'Extended Range Salvo Missiles',
    printedCost: '(1 technology choice)',
    unlocks: [
      { kind: 'weapon', weaponClass: 'salvo-missile-launcher', variants: ['extended'] },
      { kind: 'weapon', weaponClass: 'salvo-missile-rack', variants: ['extended'] },
    ],
    note: 'No printed prerequisite, though by name it is a variant of the missile the entry above gates. As printed. It unlocks the extended round on both mountings, because it is the missiles that reach further, not the launcher.',
  },
  {
    id: 'rocket-pod',
    printed: 'Rocket pods',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'rocket-pod' }],
  },
  {
    id: 'heavy-missile',
    printed: 'Heavy missiles',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'heavy-missile' }],
  },
  {
    id: 'mine-rack',
    printed: 'Mine Layer Rack',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'mine-rack' }],
  },
  {
    id: 'mines-standard',
    printed: 'Standard Mines',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [],
    note: 'The mines are free; the Mine Layer Rack that lays them is not. There is no separate engine handle — 6.9\'s minefield comes out of the rack.',
  },
  {
    id: 'mkp',
    printed: 'Multiple Kinetic Penetrators',
    printedCost: '(1 technology choice, prerequisite is K-Guns)',
    needs: [['k-gun']],
    unlocks: [{ kind: 'weapon', weaponClass: 'mkp' }],
    note: 'The one prerequisite in the section that reaches from Ordnance into Direct fire, and so the one an implementation that validates each list on its own will miss.',
  },
  {
    id: 'plasma-bolt-launcher',
    printed: 'Plasma Bolt Launcher',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'weapon', weaponClass: 'plasma-bolt-launcher' }],
  },
])

const SPINAL = defineList('spinal', [
  {
    id: 'spinal-psp',
    printed: 'Point Singularity Projector',
    printedCost: '(2 technology choices, Gravitic Gun is prerequisite)',
    choices: 2,
    needs: [['gravitic-gun']],
    unlocks: [{ kind: 'weapon', weaponClass: 'spinal-psp' }],
    note: 'Three choices all told with its prerequisite — the most expensive weapon in the section.',
  },
  {
    id: 'spinal-beam',
    printed: 'Beam',
    printedCost: '(1 technology choice, Beams is prerequisite)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'weapon', weaponClass: 'spinal-beam' }],
  },
  {
    id: 'spinal-plasma',
    printed: 'Plasma',
    printedCost: '(1 technology choice, Plasma Cannon is prerequisite)',
    needs: [['plasma-cannon']],
    unlocks: [{ kind: 'weapon', weaponClass: 'spinal-plasma' }],
    note: "Every spinal mount gates on the ship-scale weapon it enlarges, so a spinal mount is never an empire's first gun. The list stops at three: the Nova Cannon and Wave Gun the engine also models are not sold by any tech base.",
  },
])

const FIGHTERS = defineList('fighters', [
  {
    id: 'fighter-standard-beam',
    printed: 'Standard Beam fighter',
    printedCost: '(1 technology choice, prerequisite is Beams)',
    needs: [['beams-1-3']],
    unlocks: [{ kind: 'fighter', typeId: 'standard' }],
    note: '8.15 splits a standard fighter\'s guns — "If equipped with beams they inflict BD* hits. If equipped with cannon they inflict BD hits… but ignore the effects of screens" — and 15.1 sells the two halves separately, each riding on its ship-scale weapon.',
  },
  {
    id: 'fighter-standard-gun',
    printed: 'Standard Gun fighter',
    printedCost: '(1 technology choice, prerequisite is K-Guns)',
    needs: [['k-gun']],
    unlocks: [{ kind: 'fighter', typeId: 'standard' }],
  },
  {
    id: 'fighter-heavy',
    printed: 'Heavy (+mod)',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', modifier: 'heavy' }],
  },
  {
    id: 'fighter-fast',
    printed: 'Fast (+mod)',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', modifier: 'fast' }],
  },
  {
    id: 'fighter-long-range',
    printed: 'Long Range (+ mod)',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', modifier: 'long-range' }],
  },
  {
    id: 'fighter-interceptor',
    printed: 'Interceptor',
    printedCost: '(comes with standard fighter technology)',
    availability: 'bundled',
    needs: [['fighter-standard-beam', 'fighter-standard-gun']],
    unlocks: [{ kind: 'fighter', typeId: 'interceptor' }],
    note: "Free with either standard fighter. 15.2's Eurasian Solar Union charges a choice for it and its printed TOTAL depends on that charge; the catalogue keeps the printed entry and validateTechBase warns about the difference rather than repricing either.",
  },
  {
    id: 'fighter-attack',
    printed: 'Attack Fighter',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', typeId: 'attack' }],
  },
  {
    id: 'fighter-torpedo',
    printed: 'Torpedo Fighter',
    printedCost: '(1 technology choice, prerequisite is Pulse Torpedoes)',
    needs: [['pulse-torpedo']],
    unlocks: [{ kind: 'fighter', typeId: 'torpedo' }],
  },
  {
    id: 'fighter-emp',
    printed: 'EMP Fighter',
    printedCost: '(1 technology choice, prerequisite is EMP Projectors)',
    needs: [['emp']],
    unlocks: [],
    note: 'Named here and nowhere else: 14.7 does not price an EMP Fighter and FighterTypeId has no member for one. The book against itself, not the engine lagging — catalogued with no unlock.',
  },
  {
    id: 'fighter-graser',
    printed: 'Graser Fighter',
    printedCost: '(1 technology choice, prerequisite is Standard Grasers)',
    needs: [['graser']],
    unlocks: [{ kind: 'fighter', typeId: 'graser' }],
  },
  {
    id: 'fighter-plasma',
    printed: 'Plasma Fighter',
    printedCost: '(1 technology choice, prerequisite is Plasma Cannon)',
    needs: [['plasma-cannon']],
    unlocks: [{ kind: 'fighter', typeId: 'plasma' }],
  },
  {
    id: 'fighter-mkp',
    printed: 'MKP Fighter',
    printedCost: '(1 technology choice, prerequisite is MKP Packs)',
    needs: [['mkp']],
    unlocks: [{ kind: 'fighter', typeId: 'mkp' }],
    note: 'Four choices deep: K-Guns, MKP, then the fighter — and the K-Gun requirement arrives through the MKP entry in the Ordnance list.',
  },
  {
    id: 'fighter-needle',
    printed: 'Needle Fighter',
    printedCost: '(1 technology choice, prerequisite is Needle Beams)',
    needs: [['needle-beam']],
    unlocks: [],
    note: 'As with the EMP Fighter: 14.7 does not price it and FighterTypeId has no member for it.',
  },
  {
    id: 'fighter-missile',
    printed: 'Missile Fighters',
    printedCost: '(1 technology choice, prerequisite is Salvo Missiles)',
    needs: [['salvo-missile-launcher']],
    unlocks: [{ kind: 'fighter', typeId: 'missile' }],
  },
  {
    id: 'fighter-rocket',
    printed: 'Rocket Fighter',
    printedCost: '(1 technology choice, prerequisite is Rocket Pods)',
    needs: [['rocket-pod']],
    unlocks: [],
    note: 'As with the EMP and Needle Fighters: named in 15.1, priced nowhere, and absent from FighterTypeId.',
  },
  {
    id: 'fighter-multi-role',
    printed: 'Multi-Role Fighters',
    printedCost: '(3 technology choices, prerequisite is Standard and Attack Fighters)',
    choices: 3,
    needs: [['fighter-standard-beam', 'fighter-standard-gun'], ['fighter-attack']],
    unlocks: [{ kind: 'fighter', typeId: 'multi-role' }],
    note: 'The only 3-choice fighter entry, and both its prerequisites cost a choice each, so the full capability is five — half a recommended tech base.',
  },
  {
    id: 'fighter-robot',
    printed: 'Robot Fighters',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', modifier: 'robot' }],
  },
  {
    id: 'fighter-rack',
    printed: 'Fighter Racks',
    printedCost: '(come with Robot Fighter technology)',
    availability: 'bundled',
    needs: [['fighter-robot']],
    unlocks: [{ kind: 'system', system: 'fighter-rack' }],
    note: 'Racks come with robots, not with fighters. An empire with hangar bays and standard fighters cannot mount a rack until it buys the robot technology — 13.12\'s rack is the unmanned launcher.',
  },
  {
    id: 'fighter-ftl',
    printed: 'FTL Fighters',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', modifier: 'ftl' }],
  },
  {
    id: 'assault-shuttle',
    printed: 'Assault Shuttles',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'fighter', typeId: 'assault-shuttle' }],
    note: 'A shuttle is not a fighter in any other sense, but 15.1 files it under Fighters, and that is the only line 15.8 draws — so buying assault shuttles bars an empire from gunboats.',
  },
  {
    id: 'fighter-package-deal',
    printed: 'Fighter Package Deal',
    printedCost:
      '(This technology 3 choice package "fighter specialists" allows the user to pick 6 choices of fighter technology)',
    choices: FIGHTER_PACKAGE_COST,
    unlocks: [],
    note: 'Not a system: a budget rule, handled in techBaseCost. Its own 3 choices are paid from the main allowance; the 6 it grants may only be spent inside this list.',
  },
])

const GUNBOATS = defineList('gunboats', [
  {
    id: 'gunboat',
    printed: 'Gunboats',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'gunboat' }],
    note: 'Under the heading "(Optional - Gunboats may not be purchased if the Empire is using fighters)", which is the section\'s only hard restriction.',
  },
  {
    id: 'gunboat-rack',
    printed: 'Gunboat Rack',
    printedCost: '(comes with Gunboats)',
    availability: 'bundled',
    needs: [['gunboat']],
    unlocks: [{ kind: 'system', system: 'gunboat-rack' }],
    note: "The rack is the only carriage 15.8 sells. The 24-mass gunboat bay of 9.1 — SystemKind 'gunboat-bay' — is not in this list, so no tech base grants it.",
  },
  {
    id: 'gunboat-ftl',
    printed: 'FTL Gunboats',
    printedCost: '(1 technology choice, prerequisite is Gunboats)',
    needs: [['gunboat']],
    unlocks: [{ kind: 'gunboat', modifier: 'ftl' }],
  },
  {
    id: 'gunboat-beam',
    printed: 'Beams',
    printedCost: '(comes with Beam technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['beams-1-3']],
    unlocks: [{ kind: 'gunboat', typeId: 'beam' }],
    note: '**[reading]** The `gunboat` prerequisite is added to this and every entry below it. 15.8 prints only the ship-side parent, but a Beam Gunboat technology held by an empire that cannot build gunboats is not a technology; item 3 shows the book adding "prerequisite is Gunboats" where it thought of it.',
  },
  {
    id: 'gunboat-emp',
    printed: 'EMP',
    printedCost: '(comes with EMP Projector technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['emp']],
    unlocks: [],
    note: 'No EMP Gunboat exists in 9.2, 14.8 or GunboatTypeId. Catalogued where 15.8 lists it, with nothing to unlock.',
  },
  {
    id: 'gunboat-plasma',
    printed: 'Plasma',
    printedCost: '(comes with Plasma Cannon technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['plasma-cannon']],
    unlocks: [{ kind: 'gunboat', typeId: 'plasma' }],
  },
  {
    id: 'gunboat-graser',
    printed: 'Graser',
    printedCost: '(comes with Graser technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['graser']],
    unlocks: [{ kind: 'gunboat', typeId: 'graser' }],
  },
  {
    id: 'gunboat-gatling',
    printed: 'Gatling/Pulser',
    printedCost: '(comes with either Gatling battery or Pulser technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['gatling', 'pulser']],
    unlocks: [{ kind: 'gunboat', typeId: 'gatling' }],
  },
  {
    id: 'gunboat-needle',
    printed: 'Needle',
    printedCost: '(comes with Needle Beam technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['needle-beam']],
    unlocks: [{ kind: 'gunboat', typeId: 'needle' }],
  },
  {
    id: 'gunboat-pulse-torpedo',
    printed: 'Pulse Torpedo',
    printedCost: '(comes with Pulse Torpedo technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['pulse-torpedo']],
    unlocks: [{ kind: 'gunboat', typeId: 'pulse-torpedo' }],
  },
  {
    id: 'gunboat-submunition',
    printed: 'Submunition',
    printedCost: '(comes with Submunition Pack technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['submunition-pack']],
    unlocks: [{ kind: 'gunboat', typeId: 'submunition' }],
  },
  {
    id: 'gunboat-mkp',
    printed: 'MKP',
    printedCost: '(comes with MKP technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['mkp']],
    unlocks: [{ kind: 'gunboat', typeId: 'mkp' }],
  },
  {
    id: 'gunboat-k-gun',
    printed: 'K-Gun',
    printedCost: '(comes with K-Gun technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['k-gun']],
    unlocks: [{ kind: 'gunboat', typeId: 'k-gun' }],
  },
  {
    id: 'gunboat-gravitic',
    printed: 'Gravitic Gun',
    printedCost: '(come with Gravitic Gun technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['gravitic-gun']],
    unlocks: [],
    note: 'No Gravitic Gunboat in 9.2, 14.8 or GunboatTypeId.',
  },
  {
    id: 'gunboat-missile',
    printed: 'Missile',
    printedCost: '(comes with standard missile technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['salvo-missile-launcher']],
    unlocks: [{ kind: 'gunboat', typeId: 'missile' }],
    note: '"Standard missile technology" is not the name of any entry. It is the Salvo Missile Launcher: 9.2\'s Missile Gunboat "carries a salvo of 4 missiles", and the launcher is the only entry in the Ordnance list that fires a salvo — Heavy Missiles are single and Antimatter is a warhead.',
  },
  {
    id: 'gunboat-rocket',
    printed: 'Rocket',
    printedCost: '(comes with Rocket Pod technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['rocket-pod']],
    unlocks: [{ kind: 'gunboat', typeId: 'rocket' }],
  },
  {
    id: 'gunboat-boarding-torpedo',
    printed: 'Boarding Torpedo',
    printedCost: '(comes with boarding torpedo technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['boarding-torpedo']],
    unlocks: [],
    note: 'No Boarding Torpedo Gunboat in 9.2, 14.8 or GunboatTypeId.',
  },
  {
    id: 'gunboat-ads',
    printed: 'Area Defense',
    printedCost: '(comes with ADS technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['ads']],
    unlocks: [{ kind: 'gunboat', typeId: 'ads' }],
    note: "The other direction of the same mismatch: 9.2 and 14.8 also sell a plain Point Defence Gunboat, and 15.8 has no entry for it, so GunboatTypeId 'point-defence' is granted by nothing.",
  },
  {
    id: 'gunboat-ecm',
    printed: 'ECM',
    printedCost: '(comes with ECM or Area ECM technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['ecm', 'area-ecm']],
    unlocks: [{ kind: 'gunboat', modifier: 'ecm' }],
    note: 'The OR is redundant as printed — Area ECM itself comes with ECM — but it is encoded as printed, and it is the reason expansion is a fixpoint: a bundled entry may gate on another bundled entry.',
  },
  {
    id: 'gunboat-scatterpack',
    printed: 'Scatterpack',
    printedCost: '(comes with Scatterpack technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['scattergun']],
    unlocks: [{ kind: 'gunboat', typeId: 'scatterpack' }],
    note: 'No entry called Scatterpack exists in 15.1, which looks like a dangling reference until 7.14 settles it: "Scatterguns (also known as Scatterpacks)". A citation, not a reading. The consequence is that Scattergun\'s own prerequisite, Grapeshot, is inherited: a Scatterpack Gunboat costs Gunboats + Grapeshot + Scattergun, three choices, more than any other armament in this list.',
  },
  {
    id: 'gunboat-plasma-bomber',
    printed: 'Plasma Bomber',
    printedCost: '(comes with Plasma Bolt Launcher technology)',
    availability: 'bundled',
    needs: [['gunboat'], ['plasma-bolt-launcher']],
    unlocks: [{ kind: 'gunboat', typeId: 'plasma-bomber' }],
  },
  {
    id: 'gunboat-heavy',
    printed: 'Heavy or Screened Gunboat (+mod)',
    printedCost: '(1 Technology choice)',
    needs: [['gunboat']],
    unlocks: [{ kind: 'gunboat', modifier: 'heavy' }],
    note: '**[reading]** The `gunboat` prerequisite is not printed on this entry, but a modification with nothing to modify is not a technology; the same reading as items 4–21.',
  },
])

const SECONDARY = defineList('secondary', [
  {
    id: 'enhanced-sensors',
    printed: 'Enhanced Sensors',
    printedCost: '(0 technology choice)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'enhanced-sensors' }],
  },
  {
    id: 'superior-sensors',
    printed: 'Superior Sensors',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'superior-sensors' }],
  },
  {
    id: 'minesweeper',
    printed: 'Minesweeper',
    printedCost: '(1 technology choice)',
    unlocks: [{ kind: 'system', system: 'minesweeper' }],
  },
  {
    id: 'boat-bay',
    printed: 'Boat bay',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'boat-bay' }],
  },
  {
    id: 'cargo',
    printed: 'Cargo holds',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'cargo' }],
  },
  {
    id: 'berthing',
    printed: 'Troop and passenger berthing',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [
      { kind: 'system', system: 'troop-berthing' },
      { kind: 'system', system: 'passenger-berthing' },
    ],
    note: 'One printed entry covering two SystemKinds — 13.13 prices troop and passenger berthing separately but 15.1 sells them as one free line.',
  },
  {
    id: 'shipyard',
    printed: 'Shipyard facilities',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'shipyard' }],
  },
  {
    id: 'marine-party',
    printed: 'Marine Boarding Parties',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'marine-party' }],
  },
  {
    id: 'damage-control-party',
    printed: 'Damage Control Parties',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'damage-control-party' }],
  },
  {
    id: 'ortillery',
    printed: 'Ortillery',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'ortillery' }],
  },
  {
    id: 'weasel-emitter',
    printed: 'Weasel Emitters',
    printedCost: '(0 technology choices)',
    availability: 'universal',
    unlocks: [{ kind: 'system', system: 'weasel-emitter' }],
    note: 'Nine of these eleven are free, which is 15.1 saying that a tech base restricts how an empire fights, not what it carries. Ortillery bombards planets and Weasel Emitters spoof sensors, and neither costs a thing.',
  },
])

const ALL_ENTRIES: readonly TechEntry[] = [
  ...PRIMARY,
  ...DEFENSIVE,
  ...TARGETING,
  ...DIRECT_FIRE,
  ...ORDNANCE,
  ...SPINAL,
  ...FIGHTERS,
  ...GUNBOATS,
  ...SECONDARY,
]

/** Every numbered line of 15.1 and 15.8, by id. */
export const TECH_ENTRIES: Record<TechId, TechEntry> = Object.fromEntries(
  ALL_ENTRIES.map((e) => [e.id, e]),
) as Record<TechId, TechEntry>

/** Every id, in the order the book prints them. */
export const TECH_IDS: readonly TechId[] = ALL_ENTRIES.map((e) => e.id)

/** Ids grouped by list, each in printed order. */
export const TECH_BY_CATEGORY: Record<TechCategory, readonly TechId[]> = {
  primary: PRIMARY.map((e) => e.id),
  defensive: DEFENSIVE.map((e) => e.id),
  targeting: TARGETING.map((e) => e.id),
  'direct-fire': DIRECT_FIRE.map((e) => e.id),
  ordnance: ORDNANCE.map((e) => e.id),
  spinal: SPINAL.map((e) => e.id),
  fighters: FIGHTERS.map((e) => e.id),
  gunboats: GUNBOATS.map((e) => e.id),
  secondary: SECONDARY.map((e) => e.id),
}

/** Every entry printed *"(0 technology choices)"*: what an empire has before it spends. */
export const UNIVERSAL_TECH: readonly TechId[] = ALL_ENTRIES.filter(
  (e) => e.availability === 'universal',
).map((e) => e.id)

/** True when `id` is a line of 15.1 or 15.8. Guards data crossing a wire. */
export function isTechId(id: string): id is TechId {
  return Object.prototype.hasOwnProperty.call(TECH_ENTRIES, id)
}

/** The catalogue entry for `id` (15.1, 15.8). */
export function techEntry(id: TechId): TechEntry {
  return TECH_ENTRIES[id]
}

// ---------------------------------------------------------------------------
// A tech base (15, preamble)
// ---------------------------------------------------------------------------

/**
 * An empire's tech base: the entries it has bought, and the budget its player
 * group set. Universal and bundled entries are *not* listed here — they are
 * derived by `techBaseHeld`, which is what keeps a tech base a record of
 * decisions rather than a denormalised cache.
 */
export interface TechBase {
  name: string
  /** The entries paid for, in the order written. */
  choices: readonly TechId[]
  /** *"a number of choices as determined by their player group"* (15). */
  limit?: number
  /** A printed TOTAL to check the rows against, where the book prints one. */
  printedTotal?: number
}

/** An empty tech base: what every empire has before it chooses anything. */
export function emptyTechBase(name = 'unnamed'): TechBase {
  return { name, choices: [] }
}

function toSet(ids: Iterable<TechId>): Set<TechId> {
  return new Set(ids)
}

/** Every OR-group of `id`'s prerequisites has a member in `held` (15). */
export function prerequisitesMet(id: TechId, held: Iterable<TechId>): boolean {
  const have = held instanceof Set ? (held as Set<TechId>) : toSet(held)
  return TECH_ENTRIES[id].prerequisites.every((group) => group.some((need) => have.has(need)))
}

/**
 * The OR-groups of `id` that `held` does not satisfy — each inner array is one
 * unmet requirement, any member of which would satisfy it (15).
 */
export function missingPrerequisites(
  id: TechId,
  held: Iterable<TechId>,
): readonly (readonly TechId[])[] {
  const have = held instanceof Set ? (held as Set<TechId>) : toSet(held)
  return TECH_ENTRIES[id].prerequisites.filter((group) => !group.some((need) => have.has(need)))
}

/**
 * Everything the empire has: the entries it bought, every universal entry, and
 * every bundled entry whose parent is now present (15).
 *
 * A fixpoint rather than a single pass, because a bundled entry may gate on
 * another bundled entry — 15.8's gunboat ECM comes with *"ECM or Area ECM"*,
 * and Area ECM is itself bundled off ECM.
 */
export function techBaseHeld(base: TechBase | readonly TechId[]): ReadonlySet<TechId> {
  const chosen = Array.isArray(base) ? (base as readonly TechId[]) : (base as TechBase).choices
  const held = new Set<TechId>(UNIVERSAL_TECH)
  for (const id of chosen) if (isTechId(id)) held.add(id)

  const bundled = ALL_ENTRIES.filter((e) => e.availability === 'bundled')
  let grew = true
  while (grew) {
    grew = false
    for (const entry of bundled) {
      if (held.has(entry.id)) continue
      if (prerequisitesMet(entry.id, held)) {
        held.add(entry.id)
        grew = true
      }
    }
  }
  return held
}

/**
 * *"Gunboats may not be purchased if the Empire is using fighters"* (15.8).
 *
 * **[reading]** The test is on the tech base, not on a fleet list or a battle:
 * holding anything from the Fighters list bars everything in the Gunboats list
 * and the other way round. Reading *"is using"* as a per-battle condition would
 * leave the section's one hard restriction unenforceable by the only kind of
 * check section 15 makes, which is a check at design time.
 */
export function usesFighters(base: TechBase | readonly TechId[]): boolean {
  const held = techBaseHeld(base)
  return TECH_BY_CATEGORY.fighters.some((id) => held.has(id))
}

/** The other half of 15.8's exclusion. */
export function usesGunboats(base: TechBase | readonly TechId[]): boolean {
  const held = techBaseHeld(base)
  return TECH_BY_CATEGORY.gunboats.some((id) => held.has(id))
}

// ---------------------------------------------------------------------------
// The budget (15, preamble; 15.1 Fighters #21)
// ---------------------------------------------------------------------------

export interface TechBudget {
  /** What the chosen entries cost as printed, before the fighter package. */
  gross: number
  /** 6 if the Fighter Package Deal is held, else 0 (15.1 Fighters #21). */
  packageAllowance: number
  /** How much of that allowance the Fighters-list choices absorbed. */
  packageUsed: number
  /** What the empire's own allowance pays: `gross - packageUsed`. */
  spent: number
  /** The limit in force — `RECOMMENDED_TECH_CHOICE_LIMIT` unless set. */
  limit: number
  overBudget: boolean
}

/** What one entry costs in technology choices (15.1). */
export function techChoiceCost(id: TechId): number {
  return TECH_ENTRIES[id].choices
}

/**
 * What a tech base costs (15, preamble; 15.1 Fighters #21).
 *
 * The Fighter Package Deal's own 3 choices are paid from the main allowance —
 * the package is not itself "fighter technology you pick with the package" —
 * and the 6 it grants then absorbs the cost of the other Fighters-list entries,
 * to a maximum of 6.
 *
 * **[reading]** The allowance is a divisible pool, so `packageUsed` is simply
 * `min(6, cost of the other Fighters entries)`. Treating entries as atomic
 * would make the package's worth depend on the order the choices were written
 * down, and nothing in the section gives them an order.
 */
export function techBaseCost(base: TechBase): TechBudget {
  const seen = new Set<TechId>()
  let gross = 0
  let fighterCost = 0
  let hasPackage = false

  for (const id of base.choices) {
    if (!isTechId(id) || seen.has(id)) continue
    seen.add(id)
    const entry = TECH_ENTRIES[id]
    gross += entry.choices
    if (id === 'fighter-package-deal') hasPackage = true
    else if (entry.category === 'fighters') fighterCost += entry.choices
  }

  const packageAllowance = hasPackage ? FIGHTER_PACKAGE_GRANT : 0
  const packageUsed = Math.min(packageAllowance, fighterCost)
  const spent = gross - packageUsed
  const limit = base.limit ?? RECOMMENDED_TECH_CHOICE_LIMIT
  return { gross, packageAllowance, packageUsed, spent, limit, overBudget: spent > limit }
}

// ---------------------------------------------------------------------------
// The predicate: may this empire field this? (15)
// ---------------------------------------------------------------------------

/**
 * A question a ship designer asks about one box on an SSD.
 *
 * `fighter` and `gunboat` may name a type, a modifier, or both; both must be
 * granted for the answer to be yes. Naming neither asks the bare question — may
 * this empire field gunboats at all?
 */
export type TechQuery =
  | { kind: 'tech'; tech: TechId }
  | { kind: 'system'; system: SystemKind }
  | { kind: 'weapon'; weaponClass: WeaponClass; rating?: number; variant?: WeaponVariant }
  | { kind: 'hull-rows'; rows: HullRows }
  | { kind: 'drive'; advanced: boolean }
  | { kind: 'ftl'; ftl: FtlKind }
  | { kind: 'armour'; feature: ArmourFeature }
  | { kind: 'screens'; feature: ScreenFeature }
  | { kind: 'turret' }
  | { kind: 'fighter'; typeId?: string; modifier?: string }
  | { kind: 'gunboat'; typeId?: string; modifier?: string }

export interface TechVerdict {
  allowed: boolean
  /** Entries in this tech base that grant it. Any one is enough. */
  grantedBy: readonly TechId[]
  /**
   * Entries anywhere in 15.1 or 15.8 that would grant it. Empty means the
   * master reference sells no such thing, so no tech base can ever allow it.
   */
  wouldNeed: readonly TechId[]
  /** Why, in the section's own terms. */
  reason: string
}

function unlockMatches(unlock: TechUnlock, query: TechQuery): boolean {
  switch (query.kind) {
    case 'tech':
      return false
    case 'system':
      return unlock.kind === 'system' && unlock.system === query.system
    case 'weapon': {
      if (unlock.kind !== 'weapon' || unlock.weaponClass !== query.weaponClass) return false
      if (query.rating !== undefined && unlock.ratings && !unlock.ratings.includes(query.rating)) {
        return false
      }
      if (
        query.variant !== undefined &&
        unlock.variants &&
        !unlock.variants.includes(query.variant)
      ) {
        return false
      }
      return true
    }
    case 'hull-rows':
      return unlock.kind === 'hull-rows' && unlock.rows.includes(query.rows)
    case 'drive':
      return unlock.kind === 'drive' && unlock.advanced === query.advanced
    case 'ftl':
      return unlock.kind === 'ftl' && unlock.ftl === query.ftl
    case 'armour':
      return unlock.kind === 'armour' && unlock.feature === query.feature
    case 'screens':
      return unlock.kind === 'screens' && unlock.feature === query.feature
    case 'turret':
      return unlock.kind === 'turret'
    case 'fighter':
    case 'gunboat':
      // Handled by `grantsPart`, which splits a type/modifier pair in two.
      return false
  }
}

/** One half of a fighter/gunboat query: a type id, or a modifier. */
type CraftPart = { kind: 'fighter' | 'gunboat'; typeId?: string; modifier?: string }

function unlockMatchesCraft(unlock: TechUnlock, part: CraftPart): boolean {
  if (unlock.kind !== part.kind) return false
  if (part.typeId !== undefined) return unlock.typeId === part.typeId
  if (part.modifier !== undefined) return unlock.modifier === part.modifier
  // The bare question: does this entry grant the craft at all?
  return true
}

function entriesGranting(query: TechQuery): TechId[] {
  if (query.kind === 'tech') return [query.tech]
  if (query.kind === 'fighter' || query.kind === 'gunboat') {
    const parts: CraftPart[] = []
    if (query.typeId !== undefined) parts.push({ kind: query.kind, typeId: query.typeId })
    if (query.modifier !== undefined) parts.push({ kind: query.kind, modifier: query.modifier })
    if (parts.length === 0) parts.push({ kind: query.kind })
    const out: TechId[] = []
    for (const part of parts) {
      for (const entry of ALL_ENTRIES) {
        if (entry.unlocks.some((u) => unlockMatchesCraft(u, part)) && !out.includes(entry.id)) {
          out.push(entry.id)
        }
      }
    }
    return out
  }
  return ALL_ENTRIES.filter((e) => e.unlocks.some((u) => unlockMatches(u, query))).map((e) => e.id)
}

const EXCLUSION_QUOTE =
  '"Gunboats may not be purchased if the Empire is using fighters" (15.8)'

/**
 * The question section 15 exists to answer: may this empire put this on a ship?
 *
 * A `false` with an empty `wouldNeed` is not a failure of the query — it is the
 * correct answer for something 15.1 does not sell. The Nova Cannon, the Wave
 * Gun, reflex fields, dummy bogeys, tenders, gunboat bays, FTL tugs, two-stage
 * missiles and Light Fighters are all modelled by the engine and named by no
 * line of section 15, so no tech base can grant them and the reason says so.
 */
export function mayField(base: TechBase | readonly TechId[], query: TechQuery): TechVerdict {
  const held = techBaseHeld(base)
  const wouldNeed = entriesGranting(query)

  // A fighter/gunboat query with both halves must have both halves granted.
  let grantedBy: TechId[]
  let allowed: boolean
  if (
    (query.kind === 'fighter' || query.kind === 'gunboat') &&
    query.typeId !== undefined &&
    query.modifier !== undefined
  ) {
    const forType = entriesGranting({ kind: query.kind, typeId: query.typeId }).filter((id) =>
      held.has(id),
    )
    const forMod = entriesGranting({ kind: query.kind, modifier: query.modifier }).filter((id) =>
      held.has(id),
    )
    allowed = forType.length > 0 && forMod.length > 0
    grantedBy = [...new Set([...forType, ...forMod])]
  } else {
    grantedBy = wouldNeed.filter((id) => held.has(id))
    allowed = grantedBy.length > 0
  }

  if (allowed) {
    return { allowed, grantedBy, wouldNeed, reason: `granted by ${grantedBy.join(', ')} (15.1)` }
  }
  if (wouldNeed.length === 0) {
    return {
      allowed: false,
      grantedBy: [],
      wouldNeed,
      reason: 'section 15 lists no technology that grants this, so no tech base can (15.1)',
    }
  }
  if (query.kind === 'gunboat' && usesFighters(base)) {
    return { allowed: false, grantedBy: [], wouldNeed, reason: EXCLUSION_QUOTE }
  }
  if (query.kind === 'fighter' && usesGunboats(base)) {
    return { allowed: false, grantedBy: [], wouldNeed, reason: EXCLUSION_QUOTE }
  }
  return {
    allowed: false,
    grantedBy: [],
    wouldNeed,
    reason: `not in this tech base; 15.1 grants it with ${wouldNeed.join(' or ')}`,
  }
}

/** `mayField` for a `SystemKind` — the common case (15.1). */
export function mayFieldSystem(
  base: TechBase | readonly TechId[],
  system: SystemKind,
): TechVerdict {
  return mayField(base, { kind: 'system', system })
}

/** `mayField` for a weapon as built, class and rating and variant (15.1). */
export function mayFieldWeapon(
  base: TechBase | readonly TechId[],
  weapon: Pick<WeaponDef, 'weaponClass' | 'rating' | 'variant'>,
): TechVerdict {
  return mayField(base, {
    kind: 'weapon',
    weaponClass: weapon.weaponClass,
    rating: weapon.rating,
    variant: weapon.variant,
  })
}

/**
 * What the empire could buy next: entries it does not hold whose prerequisites
 * it does, minus whatever 15.8's exclusion has closed off.
 */
export function availableTech(base: TechBase | readonly TechId[]): readonly TechId[] {
  const held = techBaseHeld(base)
  const fighters = usesFighters(base)
  const gunboats = usesGunboats(base)
  return ALL_ENTRIES.filter((entry) => {
    if (held.has(entry.id)) return false
    if (entry.category === 'gunboats' && fighters) return false
    if (entry.category === 'fighters' && gunboats) return false
    return prerequisitesMet(entry.id, held)
  }).map((e) => e.id)
}

// ---------------------------------------------------------------------------
// Validation (15)
// ---------------------------------------------------------------------------

export interface TechBaseReport {
  name: string
  /** As written. */
  choices: readonly TechId[]
  /** As written plus universal and bundled entries (`techBaseHeld`). */
  held: readonly TechId[]
  budget: TechBudget
  /** Things that make the tech base illegal. */
  errors: readonly string[]
  /** Things worth saying that do not. */
  warnings: readonly string[]
  legal: boolean
}

/**
 * Check a tech base against 15: prerequisites, the fighter/gunboat exclusion,
 * and the budget.
 *
 * Going over the limit is a **warning**, never an error — 15 recommends ten and
 * then prints two example factions that spend 12 and 11. So is listing a free
 * entry as a choice, and so is a printed TOTAL that disagrees with what the
 * master reference charges for the same rows (which is exactly the Eurasian
 * Solar Union's Interceptor).
 */
export function validateTechBase(base: TechBase): TechBaseReport {
  const errors: string[] = []
  const warnings: string[] = []

  const seen = new Set<TechId>()
  for (const id of base.choices) {
    if (!isTechId(id)) {
      errors.push(`"${id}" is not an entry in 15.1 or 15.8`)
      continue
    }
    if (seen.has(id)) {
      warnings.push(`${TECH_ENTRIES[id].printed} is listed twice; it is only paid for once (15.1)`)
      continue
    }
    seen.add(id)
    const entry = TECH_ENTRIES[id]
    if (entry.availability === 'universal') {
      warnings.push(
        `${entry.printed} costs no choice — "${entry.printedCost}" — every empire has it (15)`,
      )
    } else if (entry.availability === 'bundled') {
      warnings.push(
        `${entry.printed} costs no choice — it ${entry.printedCost.replace(/^\(|\)$/g, '')} (15.1)`,
      )
    }
  }

  const held = techBaseHeld(base)
  for (const id of seen) {
    for (const group of missingPrerequisites(id, held)) {
      const names = group.map((g) => TECH_ENTRIES[g].printed).join(' or ')
      errors.push(`${TECH_ENTRIES[id].printed} requires ${names} (15.1)`)
    }
  }

  const fighters = usesFighters(base)
  const gunboats = usesGunboats(base)
  if (fighters && gunboats) {
    errors.push(EXCLUSION_QUOTE)
  }

  const budget = techBaseCost(base)
  if (budget.overBudget) {
    warnings.push(
      `${budget.spent} technology choices spent against a limit of ${budget.limit} — "We recommend no more than ten but it's up to the players" (15)`,
    )
  }
  if (base.printedTotal !== undefined && base.printedTotal !== budget.gross) {
    warnings.push(
      `printed TOTAL is ${base.printedTotal}; the same rows cost ${budget.gross} in 15.1 (15.2)`,
    )
  }

  return {
    name: base.name,
    choices: [...base.choices],
    held: TECH_IDS.filter((id) => held.has(id)),
    budget,
    errors,
    warnings,
    legal: errors.length === 0,
  }
}

/**
 * Check one built ship against a tech base (15).
 *
 * Walks only what section 15 names. Hull class (13.7), Core Systems (10.3),
 * Flawed Design, emergency thrust and streamlining appear in none of the nine
 * lists, so a tech base is silent on them and this is too.
 */
export function validateDesignAgainstTechBase(
  base: TechBase | readonly TechId[],
  design: ShipDesign,
): readonly string[] {
  const problems: string[] = []
  const complain = (what: string, query: TechQuery) => {
    const verdict = mayField(base, query)
    if (!verdict.allowed) problems.push(`${design.name}: ${what} — ${verdict.reason}`)
  }

  complain(`a ${design.hullRows}-row hull`, { kind: 'hull-rows', rows: design.hullRows })
  if (design.drive.advanced) complain('an advanced gravity drive', { kind: 'drive', advanced: true })
  if (design.ftl === 'advanced') complain('an advanced FTL drive', { kind: 'ftl', ftl: 'advanced' })
  if (design.ftl === 'tug') complain('an FTL tug', { kind: 'ftl', ftl: 'tug' })

  const armourBoxes = design.armour.layers.reduce((sum, n) => sum + n, 0)
  if (armourBoxes > 0) complain('armour', { kind: 'armour', feature: 'basic' })
  if (design.armour.layers.length > 1) {
    complain('layered or shell armour', { kind: 'armour', feature: 'layered' })
  }
  if (design.armour.regenerative) {
    complain('regenerative armour', { kind: 'armour', feature: 'regenerative' })
  }

  if (design.screens.level > 0 || design.screens.generators > 0) {
    complain('defensive screens', { kind: 'screens', feature: 'basic' })
  }
  if (design.screens.advanced || design.screens.area?.advanced) {
    complain('advanced screens', { kind: 'screens', feature: 'advanced' })
  }
  if (design.screens.area) complain('area screens', { kind: 'screens', feature: 'area' })

  if (design.turrets.length > 0) complain('a turret', { kind: 'turret' })

  for (const weapon of design.weapons) {
    complain(weapon.label, {
      kind: 'weapon',
      weaponClass: weapon.weaponClass,
      rating: weapon.rating,
      variant: weapon.variant,
    })
  }
  for (const system of design.systems) {
    complain(system.label, { kind: 'system', system: system.kind })
  }
  for (const bay of design.fighterBays) {
    complain(bay.label, { kind: 'fighter', typeId: bay.typeId })
  }
  for (const squadron of design.gunboats) {
    complain(squadron.label, { kind: 'gunboat', typeId: squadron.typeId })
  }

  return problems
}

// ---------------------------------------------------------------------------
// 15.2 Example Factions
// ---------------------------------------------------------------------------

/**
 * *"Note: the examples presented here are not strictly the same as any of the
 * published Fleet Books. They are merely presented here as examples."* (15.2)
 *
 * Two factions are printed and both are here as printed, row labels and TOTAL
 * lines included, so that the mapping onto 15.1 can be checked rather than
 * trusted. `docs/rules/factions.md` describes fourteen *other* factions from a
 * different source entirely; the two sets do not overlap and neither supersedes
 * the other.
 */
export type ExampleFactionId = 'new-anglian-confederation' | 'eurasian-solar-union'

export interface ExampleFactionRow {
  /** The "Tech type" cell, exactly as the table prints it. */
  printed: string
  /** The "#CHOICES" cell, exactly as the table prints it. */
  printedChoices: number
  /** The 15.1 entry it maps to. */
  tech: TechId
}

export interface ExampleFaction {
  id: ExampleFactionId
  name: string
  rows: readonly ExampleFactionRow[]
  /** The table's own TOTAL line. */
  printedTotal: number
  base: TechBase
  notes: readonly string[]
}

function faction(
  id: ExampleFactionId,
  name: string,
  rows: readonly ExampleFactionRow[],
  printedTotal: number,
  notes: readonly string[],
): ExampleFaction {
  return {
    id,
    name,
    rows,
    printedTotal,
    base: { name, choices: rows.map((r) => r.tech), printedTotal },
    notes,
  }
}

export const EXAMPLE_FACTIONS: Record<ExampleFactionId, ExampleFaction> = {
  'new-anglian-confederation': faction(
    'new-anglian-confederation',
    'New Anglian Confederation',
    [
      { printed: 'BEAM WEAPONS CLASS 1, 2 AND 3', printedChoices: 1, tech: 'beams-1-3' },
      { printed: 'BEAM WEAPONS CLASS 4, 5, AND 6', printedChoices: 1, tech: 'beams-4-6' },
      { printed: 'STANDARD GRASERS', printedChoices: 1, tech: 'graser' },
      { printed: 'PDS', printedChoices: 1, tech: 'pds' },
      { printed: 'STANDARD SCREENS', printedChoices: 1, tech: 'screens' },
      { printed: 'ADVANCED SCREENS', printedChoices: 2, tech: 'advanced-screens' },
      { printed: 'SALVO MISSILE LAUNCHER', printedChoices: 1, tech: 'salvo-missile-launcher' },
      { printed: 'PULSE TORPEDO', printedChoices: 1, tech: 'pulse-torpedo' },
      { printed: 'SUBMUNITION PACKS', printedChoices: 1, tech: 'submunition-pack' },
      { printed: 'STANDARD FIGHTER', printedChoices: 1, tech: 'fighter-standard-beam' },
      { printed: 'TORPEDO FIGHTER', printedChoices: 1, tech: 'fighter-torpedo' },
    ],
    12,
    [
      'The printed TOTAL of 12 is exactly what 15.1 charges for these rows.',
      '**[reading]** "STANDARD FIGHTER" is the Standard Beam fighter: 15.1 has no generic entry, and this faction buys beams and no K-Guns, so the beam version is the only one whose prerequisite it meets.',
      'Every prerequisite is met — Grasers off the beams, Advanced Screens off Standard Screens, the Torpedo Fighter off the Pulse Torpedo.',
      'Buying fighters bars gunboats (15.8).',
    ],
  ),
  'eurasian-solar-union': faction(
    'eurasian-solar-union',
    'Eurasian Solar Union',
    [
      { printed: 'BEAM WEAPONS CLASS 1, 2 AND 3', printedChoices: 1, tech: 'beams-1-3' },
      { printed: 'BEAM WEAPONS CLASS 4 AND 5', printedChoices: 1, tech: 'beams-4-6' },
      { printed: 'PDS', printedChoices: 1, tech: 'pds' },
      { printed: 'STANDARD SCREENS', printedChoices: 1, tech: 'screens' },
      { printed: 'SPINAL MOUNT BEAMS', printedChoices: 1, tech: 'spinal-beam' },
      { printed: 'ATTACK FIGHTER', printedChoices: 1, tech: 'fighter-attack' },
      { printed: 'STANDARD FIGHTER', printedChoices: 1, tech: 'fighter-standard-beam' },
      { printed: 'INTERCEPTOR FIGHTER', printedChoices: 1, tech: 'fighter-interceptor' },
      { printed: 'LONG RANGE FIGHTER', printedChoices: 1, tech: 'fighter-long-range' },
      { printed: 'FAST FIGHTER', printedChoices: 1, tech: 'fighter-fast' },
      { printed: 'ASSAULT SHUTTLES', printedChoices: 1, tech: 'assault-shuttle' },
    ],
    11,
    [
      '**[reading]** "BEAM WEAPONS CLASS 4 AND 5" is 15.1\'s "Beams, Class 4, 5 and 6": no entry sells 4 and 5 without 6, and the row pays the one choice that entry costs. Inventing a class-4-and-5 entry would be inventing a number the master reference does not have.',
      '**[reading]** "INTERCEPTOR FIGHTER 1" contradicts 15.1\'s "Interceptor (comes with standard fighter technology)", and the printed TOTAL of 11 depends on the charge. The catalogue governs, so the same rows cost 10; validateTechBase warns about the gap instead of repricing the Interceptor, which would contradict 15.1 for the sake of one worked example.',
      'Buying fighters bars gunboats (15.8).',
    ],
  ),
}
