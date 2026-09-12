/**
 * The fourteen campaign factions.
 *
 * Source: *Factions of the Continuum: A Campaign Supplement* (thirteen) and
 * *Faction Sourcebook: The Askvarian Hegemony* (a fourteenth, with four
 * clans). Both are the user's own campaign material, written against Project
 * Continuum's own construction and combat rules, which is why every trait
 * below names something the engine already models. Written out rule by rule in
 * `docs/rules/factions.md`.
 *
 * These are not section 15's tech bases and they do not overlap with them.
 * 15.2 prints two example empires and says so; this is a separate supplement
 * with fourteen more, and a faction here has *traits* — things that change what
 * it may build, what a roll does, or what a campaign turn earns — rather than a
 * list of purchased technologies.
 *
 * **A trait is one of four kinds and the kind decides who reads it:**
 *
 * - `design` and `prohibition` change what may be built, and are enforced by
 *   `designPricing.validateDesign` — the shipyard is where a player meets them.
 * - `tactical` changes a roll during a battle and is read by whichever module
 *   owns that roll.
 * - `campaign` changes RU income, repair cost or research, and belongs to
 *   `src/campaign`.
 *
 * Every trait carries `implemented`, which is the honest half of this file: a
 * faction whose traits are typed but not yet read by anything is a faction that
 * plays like plain Continuum, and a player picking it deserves to be told which
 * of its rules are actually in force. `factionTraitCoverage()` counts them.
 */

import type { HullClass, ShipGroup, SystemKind, WeaponClass } from '../engine/types'

export type FactionTraitKind = 'design' | 'tactical' | 'campaign' | 'prohibition'

/**
 * What a prohibition bars. A faction bars things by several different handles —
 * a weapon class, a system kind, a whole category — so this is a union rather
 * than one list of ids.
 */
export type FactionBan =
  | { kind: 'weapon'; weaponClass: WeaponClass }
  | { kind: 'system'; system: SystemKind }
  /** *"Direct-fire weapons of class 3 or higher"* — a rating cut, not a list. */
  | { kind: 'weapon-class-above'; rating: number }
  /** Every spinal mount, whatever it fires. */
  | { kind: 'spinal-mounts' }
  /** *"Any physical projectile"* — K-guns, torpedoes, MKP, missiles, rockets, mines. */
  | { kind: 'projectiles' }
  /** 3.6's emergency thrust, which is an order rather than a fitting. */
  | { kind: 'emergency-thrust' }
  /** Manned small craft: the Shard-Swarm flies robots or nothing. */
  | { kind: 'manned-small-craft' }
  | { kind: 'advanced-drives' }
  | { kind: 'advanced-screens' }

/** What a design trait constrains. */
export type FactionDesignRule =
  /** *"No ship above mass 110."* */
  | { kind: 'max-mass'; mass: number }
  /** *"Hulls must be Fragile (10%) or Weak (20%)."* */
  | { kind: 'hull-classes'; allowed: readonly HullClass[] }
  /** *"Hull boxes must be in five rows."* */
  | { kind: 'hull-rows'; rows: number }
  /** *"Non-carrier cruisers and capitals may mount at most two PDS."* */
  | { kind: 'max-systems'; system: SystemKind; count: number; groups: readonly ShipGroup[] }
  /** *"Thrust permanently −1 (minimum 1)."* */
  | { kind: 'thrust-modifier'; delta: number; minimum: number; groups?: readonly ShipGroup[] }
  /** *"0 damage control parties, no in-combat repair."* */
  | { kind: 'no-damage-control' }
  /** Anything the engine cannot yet check, stated in prose. */
  | { kind: 'prose' }

export interface FactionTrait {
  kind: FactionTraitKind
  /** The trait's name in the supplement, where it has one. */
  name?: string
  /** The rule, as the supplement states it. */
  rule: string
  /** What a prohibition bars, for `kind: 'prohibition'`. */
  bans?: readonly FactionBan[]
  /** What a design trait constrains, for `kind: 'design'`. */
  design?: FactionDesignRule
  /**
   * Whether anything in this repository reads the trait yet.
   *
   * `false` is not a bug, it is a status: the supplement is fourteen factions
   * of rules touching every module in the engine, and a trait that is typed and
   * unread is a trait a player can be told about honestly.
   */
  implemented: boolean
}

export interface FactionClan {
  id: string
  name: string
  /** One line: what the clan is for. */
  summary: string
  traits: readonly FactionTrait[]
}

export interface Faction {
  id: string
  name: string
  /** The supplement's own one-line description. */
  doctrine: string
  /** Two sentences at most, in the supplement's voice. */
  summary: string
  /** *"Starting tech"*, as the supplement lists it — prose, not tech-base ids. */
  startingTech: readonly string[]
  traits: readonly FactionTrait[]
  /** Sub-factions, where a faction has them. Only the Askvarians do. */
  clans?: readonly FactionClan[]
}

/** Everything a physical-projectile prohibition bars (Cygnan, Izotrope). */
export const PROJECTILE_CLASSES: readonly WeaponClass[] = [
  'k-gun',
  'pulse-torpedo',
  'mkp',
  'heavy-missile',
  'salvo-missile-rack',
  'salvo-missile-launcher',
  'antimatter-missile',
  'rocket-pod',
  'mine-rack',
  'submunition-pack',
  'boarding-torpedo',
]

/** Every spinal mount in the engine's weapon list. */
export const SPINAL_CLASSES: readonly WeaponClass[] = [
  'spinal-beam',
  'spinal-plasma',
  'spinal-psp',
]

const ban = (bans: readonly FactionBan[], rule: string): FactionTrait => ({
  kind: 'prohibition',
  rule,
  bans,
  implemented: true,
})

const design = (
  name: string,
  rule: string,
  rules: FactionDesignRule,
  implemented = true,
): FactionTrait => ({ kind: 'design', name, rule, design: rules, implemented })

const tactical = (name: string, rule: string): FactionTrait => ({
  kind: 'tactical',
  name,
  rule,
  implemented: false,
})

const campaign = (name: string, rule: string): FactionTrait => ({
  kind: 'campaign',
  name,
  rule,
  implemented: false,
})

export const FACTIONS: readonly Faction[] = [
  {
    id: 'goliath',
    name: 'Goliath Corporate Hegemony',
    doctrine: 'attrition brawler',
    summary: 'Flying bricks: shell armour and kinetic guns, no finesse.',
    startingTech: ['K-Guns (AP)', 'shell armour', 'standard FireCon', 'standard FTL'],
    traits: [
      design(
        'Industrial Durability',
        '+10% of total mass in extra hull boxes, rounded up, added to the final row of the damage track',
        { kind: 'prose' },
        false,
      ),
      tactical(
        'Close-Quarters Dominance',
        'Once a turn, nominate one K-Gun system; firing it at 12 MU or less, re-roll any or all missed dice',
      ),
      campaign(
        'Masters of the Forge',
        'Armour, shell armour and regenerative armour cost 40% less RU to build and to repair',
      ),
      ban(
        [{ kind: 'system', system: 'advanced-firecon' }],
        'Advanced Fire Control',
      ),
      ban(
        [
          { kind: 'system', system: 'stealth-hull' },
          { kind: 'system', system: 'stealth-field' },
          { kind: 'system', system: 'holofield' },
          { kind: 'system', system: 'cloaking-device' },
        ],
        'Stealth hulls, stealth fields, holofields and cloaking devices',
      ),
    ],
  },
  {
    id: 'aethelgard',
    name: 'Aethelgard Ascendancy',
    doctrine: 'glass cannon',
    summary: 'Spinal mounts and the single perfect strike.',
    startingTech: ['beam spinal mount', 'class-3 beams', 'standard screens', 'Advanced Fire Control'],
    traits: [
      design(
        'Spinal Weapon Virtuosos',
        'Spinal mounts cost 10% fewer points, and are exempt from the no-manoeuvre-after-firing restriction',
        { kind: 'prose' },
        false,
      ),
      tactical('Superior Targeting Solutions', '+1 DRM on direct-fire hit rolls beyond 24 MU'),
      campaign('Monumental Construction', 'Capital ships (mass 91+) cost 10% less RU'),
      design(
        'Glory is Fleeting',
        'Every ship has Flawed Design with no points discount; a threshold hit on that icon causes a reactor breach without destroying the ship',
        { kind: 'prose' },
        false,
      ),
      ban([{ kind: 'weapon-class-above', rating: 0 }], 'Any Class-1 weapon except PDS'),
    ],
  },
  {
    id: 'chytrid',
    name: 'Chytrid Mycelium',
    doctrine: 'carrier swarm',
    summary: 'Grown, not built. Fighters without end.',
    startingTech: ['regenerative armour', 'hangar bays', 'standard fighters', 'interceptors'],
    traits: [
      tactical(
        'Living Carriers',
        'Hangar bays re-arm two groups a turn; a 1 on re-arming costs one extra turn rather than failing; launch one extra group a turn beyond the launch facilities',
      ),
      tactical('Symbiotic Swarms', 'Standard fighters get +1 DRM in dogfights against other fighters'),
      campaign(
        'Rapid Gestation',
        'After each battle roll D3; that many wholly destroyed friendly fighter groups return at full strength, free',
      ),
      design(
        'Hive Ship Vulnerability',
        'Hull boxes must be in five rows, with no points reduction for the weaker layout',
        { kind: 'hull-rows', rows: 5 },
      ),
      ban(
        [{ kind: 'weapon-class-above', rating: 2 }, { kind: 'spinal-mounts' }],
        'Direct-fire weapons of class 3 or higher, and any spinal mount',
      ),
    ],
  },
  {
    id: 'sisterhood',
    name: 'Silent Sisterhood of Veil',
    doctrine: 'surgical strike',
    summary: 'Small, fast, cloaked, and aimed at one system at a time.',
    startingTech: ['Tuffley cloak', 'needle beams', 'ECM', 'advanced FTL'],
    traits: [
      tactical(
        'Ghost in the Machine',
        'Needle beams destroy the targeted system on 5 or 6; any hit (4+) also does 1 hull damage bypassing armour and screens',
      ),
      tactical(
        'Phase-Shift Disengagement',
        'Once a battle, leave the table at the end of the damage control phase and re-enter from any table edge at the start of a later movement phase; not available with enemy boarders aboard',
      ),
      campaign(
        'Veil of Secrets',
        '1 Intelligence Point a turn: auto-succeed one espionage roll, or force an opponent to reveal one ship’s full current SSD at the start of a battle',
      ),
      design('Fragile Vessels', 'No ship above mass 110; hulls must be Fragile or Weak', {
        kind: 'max-mass',
        mass: 110,
      }),
      design('Fragile Vessels (hulls)', 'Hulls must be Fragile (10%) or Weak (20%)', {
        kind: 'hull-classes',
        allowed: ['fragile', 'weak'],
      }),
      tactical(
        'Power Hungry Systems',
        'Activating a cloaking device drops thrust by 2, minimum 1, for the duration',
      ),
    ],
  },
  {
    id: 'durani',
    name: 'Durani Star-Khanate',
    doctrine: 'raider',
    summary: 'Salvaged, stolen, jury-rigged, and faster than it has any right to be.',
    startingTech: ['salvo missile launchers', 'pulse torpedoes', 'standard armour', 'standard FTL'],
    traits: [
      tactical(
        'Jury-Rigged Power',
        'Emergency thrust twice per ship per battle with no damage roll; later uses roll as normal',
      ),
      tactical(
        '"Heavy" Salvo',
        'Once a battle, a salvo missile launcher fires a heavy salvo: each hit does 1d6+1 instead of 1d6',
      ),
      campaign(
        'Expert Scavengers',
        'After any battle, pick one destroyed enemy ship and gain 50% of its base RU cost',
      ),
      tactical(
        'Unreliable Systems',
        '+1 DRM on every system’s roll at the second and every later threshold check of a battle; the first check is normal',
      ),
      ban(
        [{ kind: 'advanced-screens' }, { kind: 'advanced-drives' }, { kind: 'spinal-mounts' }],
        'Advanced screens, advanced drives and any spinal mount',
      ),
      campaign('Technological Patchwork', 'Strong or Super hulls cost 10% more RU'),
    ],
  },
  {
    id: 'void-corsairs',
    name: 'Void-Corsairs of the Crimson Axis',
    doctrine: 'boarding and capture',
    summary: 'A destroyed ship is a wasted opportunity.',
    startingTech: ['transporter beams', 'boarding torpedoes', 'EMP projectors', 'assault shuttles'],
    traits: [
      tactical(
        'Terrifying Reputation',
        'Attacking marines +1 DRM; defending damage control parties −1 DRM',
      ),
      tactical(
        'Crippling Strikes',
        'EMP projector hits may affect any core system — bridge, life support or power core — bypassing the normal targeting restrictions',
      ),
      campaign(
        'Prize Crews',
        'A ship captured by boarding joins the fleet for the next battle for 25% of its base RU cost, keeping its damage',
      ),
      campaign('Poorly Maintained Ships', 'Repairs cost 25% more RU'),
      design('No Heavy Metal', 'No ship above mass 110', { kind: 'max-mass', mass: 110 }),
    ],
  },
  {
    id: 'cygnan',
    name: 'Cygnan Assembly',
    doctrine: 'battlefield control',
    summary: 'Gravity and fields, never projectiles.',
    startingTech: ['gravitic guns', 'holofield', 'advanced screens', 'advanced drives'],
    traits: [
      tactical('Gravitic Mastery', 'Gravitic gun damage per hit +1 at every target speed band'),
      design('Gravitic engineering', 'Gravitic gun mass cost −1, minimum 1', { kind: 'prose' }, false),
      tactical(
        'Holographic Superiority',
        'Attackers against a holofielded Cygnan ship suffer the range penalty even inside 6 MU, and −1 DRM on top',
      ),
      campaign(
        'Predictive Algorithms',
        'Once a battle, roll D3; force the opponent to pre-plot and reveal that many ships’ first turn of movement before writing your own',
      ),
      ban([{ kind: 'emergency-thrust' }], 'Emergency thrust'),
      ban(
        [{ kind: 'projectiles' }],
        'Any physical projectile: K-guns, pulse torpedoes, MKP, all missiles, rockets and mines',
      ),
    ],
  },
  {
    id: 'sol-marines',
    name: 'Sol-Federation Marine Corps',
    doctrine: 'combined arms',
    summary: 'Gunboats where other navies use fighters.',
    startingTech: ['gunboat racks', 'beam gunboats', 'ADFC', 'pulsers'],
    traits: [
      design(
        'Combined Arms Doctrine',
        'Gunboat squadrons get the Heavy/Screened modification free, and +1 CEF (7 total)',
        { kind: 'prose' },
        false,
      ),
      tactical(
        'Area Denial Specialists',
        'ADFC and Advanced ADFC support allied ships out to 12 MU instead of 6',
      ),
      campaign('Expeditionary Logistics', 'Battle damage repairs cost 50% fewer RU'),
      ban([{ kind: 'system', system: 'hangar-bay' }], 'Hangar bays — gunboat racks only'),
      ban(
        [
          { kind: 'system', system: 'reflex-field' },
          { kind: 'system', system: 'cloaking-device' },
          { kind: 'system', system: 'holofield' },
          { kind: 'weapon', weaponClass: 'gravitic-gun' },
          { kind: 'weapon', weaponClass: 'nova-cannon' },
        ],
        'Reflex fields, cloaking devices, holofields, gravitic guns and the spinal mount nova cannon',
      ),
    ],
  },
  {
    id: 'samc',
    name: 'South African Mercantile Confederation',
    doctrine: 'militarised traders',
    summary: 'Q-ships behind a networked escort screen.',
    startingTech: ['cargo hold', 'class-1 beams', 'salvo missile launchers', 'ADFC'],
    traits: [
      design(
        'Deceptive Hulls',
        'Cruisers (40–90) and capitals (91+) mount one cargo hold free — 0 mass, 0 points',
        { kind: 'prose' },
        false,
      ),
      tactical(
        'Q-ship batteries',
        'Class-1 beams inflict 1 damage on 4, 5 or 6 inside 6 MU, ignoring the screen reduction',
      ),
      tactical('Superior Convoy Defense', 'ADS and ADFC support allies out to 9 MU instead of 6'),
      campaign('Mercantile Network', '+20% RU on top of anything else earned, after every battle'),
      design(
        'Specialized Hulls',
        'Non-carrier cruisers and capitals may mount at most two PDS',
        { kind: 'max-systems', system: 'pds', count: 2, groups: ['cruiser', 'capital'] },
      ),
      design('Freighter Hulls', 'Capitals (91+) have thrust permanently −1, minimum 1', {
        kind: 'thrust-modifier',
        delta: -1,
        minimum: 1,
        groups: ['capital'],
      }),
    ],
  },
  {
    id: 'izotrope',
    name: 'Izotrope Technocracy',
    doctrine: 'energy specialist',
    summary: 'A mobile power plant wrapped around a weapon.',
    startingTech: ['plasma cannons', 'plasma bolt launchers', 'advanced screens', 'fusion arrays'],
    traits: [
      tactical(
        'Plasma Overcharge',
        'Once a turn, one plasma cannon or plasma bolt launcher fires as one class higher, with no burnout risk',
      ),
      design(
        'Efficient Power Distribution',
        'Up to three screen levels with three or more generators; at level 3 a 6 does 1 damage and grants no re-roll, and screen generators cost 10% fewer points',
        { kind: 'prose' },
        false,
      ),
      campaign(
        'Energy Research Focus',
        '+2 tech tier points a turn, spendable only on direct-fire energy weapons or screens',
      ),
      tactical('Volatile Cores', 'Every ship suffers a reactor breach when destroyed, whatever the cause'),
      ban([{ kind: 'projectiles' }], 'K-guns, MKP and all missiles — any physical projectile'),
    ],
  },
  {
    id: 'shard-swarm',
    name: 'Shard-Swarm',
    doctrine: 'drone swarm',
    summary: 'A rogue self-replicating AI. Escorts are ammunition.',
    startingTech: ['robot fighters', 'fighter racks', 'gatling batteries', 'standard beams'],
    traits: [
      tactical(
        'Expendable Drones',
        'Escorts (mass 44 or less) are robot-crewed and auto-pass morale; on destruction roll D6 and a 6 causes a reactor breach',
      ),
      tactical(
        'Networked Targeting',
        'For every two friendly ships firing at the same target this phase, both gain +1 DRM',
      ),
      campaign('Automated Foundries', 'Escorts (mass 44 or less) cost 40% less RU'),
      tactical(
        'Centralized Command',
        'Once every Nexus ship (mass 60+) is destroyed, all remaining escorts take a permanent −1 DRM for the rest of the battle',
      ),
      ban([{ kind: 'manned-small-craft' }], 'Manned fighters and gunboats — robot fighters only'),
      design(
        'Unmanned hulls',
        'No damage control parties and no in-combat repair; robot fighter groups may defend against boarders as one marine unit each',
        { kind: 'no-damage-control' },
      ),
    ],
  },
  {
    id: 'tyrant',
    name: 'Tyrant Star Hegemony',
    doctrine: 'missile artillery',
    summary: 'Win before the fleets meet.',
    startingTech: ['salvo missile launchers', 'ER missiles', 'Advanced Fire Control', 'standard FTL'],
    traits: [
      tactical(
        'Advanced Targeting Protocols',
        'One AFC launches missiles from two launchers in the same phase; salvo and heavy missile maximum range +6 MU',
      ),
      tactical(
        'Overwhelming Salvos',
        '+1 to the D6 that decides how many missiles of a salvo are on target',
      ),
      campaign(
        'Ordnance-Focused Industry',
        'SMLs, SMRs and magazine reloads cost 40% less RU',
      ),
      ban([{ kind: 'weapon-class-above', rating: 2 }], 'Direct-fire weapons of class 3 or higher'),
      ban([{ kind: 'system', system: 'ads' }], 'Area Defense Systems'),
    ],
  },
  {
    id: 'xxcha',
    name: 'Xxcha Archonate',
    doctrine: 'defensive fortress',
    summary: 'The shell endures.',
    startingTech: ['regenerative armour', 'ADS', 'standard beams', 'standard FTL'],
    traits: [
      tactical('Fortress Doctrine', 'Capitals (91+) with ADS fire it to 24 MU instead of 12'),
      tactical('Resilient Carapace', 'Regenerative armour repairs on 4, 5 or 6 instead of 5 or 6'),
      design('Carapace engineering', 'Regenerative armour mass cost −10%', { kind: 'prose' }, false),
      campaign('Patient Diplomacy', '+10% RU each turn, and one free re-roll on any campaign die roll'),
      design('Deliberate Movement', 'Thrust permanently −1, minimum 1', {
        kind: 'thrust-modifier',
        delta: -1,
        minimum: 1,
      }),
      ban([{ kind: 'advanced-drives' }, { kind: 'spinal-mounts' }], 'Advanced drives and any spinal mount'),
    ],
  },
  {
    id: 'askvarian',
    name: 'Askvarian Hegemony',
    doctrine: 'the rust cannon',
    summary:
      'A flotilla society of freed slaves, fast and unreliable. Alone among these factions it has sub-factions: a ship is assigned to one Clan and takes exactly one Clan trait.',
    startingTech: [],
    traits: [
      tactical(
        'Trust in Rust',
        'Roll one fewer die when checking for emergency-thrust drive damage; a check that would be one die becomes automatic',
      ),
      design(
        'Jury-Rigged Ingenuity',
        'May always take Flawed Design (+10% mass), carrying its −1 DRM on all threshold checks',
        { kind: 'prose' },
        false,
      ),
      tactical(
        'Fractured Doctrine',
        'Advanced Fire Control takes a permanent −1 DRM on targeting; every FireCon, standard or advanced, is knocked out on a threshold roll of 4, 5 or 6 regardless of which threshold it is',
      ),
      campaign(
        'The Vherokior Principle',
        'Reverse engineering and stolen tech cost 75% less; scrapping returns 50% of a ship’s RU cost',
      ),
      campaign(
        'The Scattered Peoples',
        'Each capital or carrier not in a system with a friendly unsieged colony generates 100 RP a turn',
      ),
      campaign(
        'Clannish Politics',
        'Enemy counter-espionage +10% success; Specific Targeting research +20% RP',
      ),
    ],
    clans: [
      {
        id: 'brutor',
        name: 'Brutor',
        summary: 'By axe and by breach.',
        traits: [
          design(
            'Boarding stock',
            'One free marine boarding party per 50 mass, rounded up, outside the crew complement limit; assault shuttles and transporter beams at 25% off both mass and points',
            { kind: 'prose' },
            false,
          ),
          ban(
            [
              { kind: 'weapon', weaponClass: 'salvo-missile-launcher' },
              { kind: 'weapon', weaponClass: 'salvo-missile-rack' },
              { kind: 'system', system: 'ads' },
            ],
            'Salvo missiles and Area Defense Systems',
          ),
        ],
      },
      {
        id: 'sebiestor',
        name: 'Sebiestor',
        summary: 'Field-rigged and fleet-footed.',
        traits: [
          design(
            'Field-rigged drives',
            'Main drive mass is calculated as though the thrust rating were one lower, with points paid in full for the real rating; +1 on damage control repair rolls for regenerative armour and defensive screens',
            { kind: 'prose' },
            false,
          ),
          design('Screened', 'Must install at least one level of screens', { kind: 'prose' }, false),
        ],
      },
      {
        id: 'vherokior',
        name: 'Vherokior',
        summary: 'There’s always a price.',
        traits: [
          design(
            'Cheap electronics',
            'ECM and Area ECM at half mass, points unchanged; −2 points per 10 mass of cargo, capped at 10% of the ship’s total cost',
            { kind: 'prose' },
            false,
          ),
          design('Thin hulls', 'Must use Fragile or Weak hulls', {
            kind: 'hull-classes',
            allowed: ['fragile', 'weak'],
          }),
        ],
      },
      {
        id: 'krusual',
        name: 'Krusual',
        summary: 'Shrapnel and shadows.',
        traits: [
          design(
            'Shrapnel works',
            'K-guns of all classes and SMLs at −1 mass each, minimum 1; salvo missile loads cost 1.5 mass instead of 2; flak ammunition free on class-2 and larger K-guns',
            { kind: 'prose' },
            false,
          ),
          ban(
            [
              { kind: 'weapon', weaponClass: 'beam' },
              { kind: 'weapon', weaponClass: 'graser' },
              { kind: 'weapon', weaponClass: 'heavy-graser' },
              { kind: 'weapon', weaponClass: 'phaser' },
            ],
            'Beam, graser and phaser weapons',
          ),
        ],
      },
    ],
  },
]

export function factionById(id: string): Faction | undefined {
  return FACTIONS.find((faction) => faction.id === id)
}

export function clanOf(faction: Faction, clanId: string): FactionClan | undefined {
  return faction.clans?.find((clan) => clan.id === clanId)
}

/** Every trait a ship of this faction and clan flies under. */
export function traitsFor(factionId: string, clanId?: string): readonly FactionTrait[] {
  const faction = factionById(factionId)
  if (!faction) return []
  const clan = clanId ? clanOf(faction, clanId) : undefined
  return [...faction.traits, ...(clan?.traits ?? [])]
}

export interface TraitCoverage {
  total: number
  implemented: number
  byKind: Record<FactionTraitKind, { total: number; implemented: number }>
}

/**
 * How much of the supplement is actually in force.
 *
 * The point of counting is that it is honest: a faction whose traits are typed
 * but read by nothing plays exactly like plain Continuum, and the shipyard says
 * so rather than implying the rules are live.
 */
export function factionTraitCoverage(): TraitCoverage {
  const byKind: TraitCoverage['byKind'] = {
    design: { total: 0, implemented: 0 },
    tactical: { total: 0, implemented: 0 },
    campaign: { total: 0, implemented: 0 },
    prohibition: { total: 0, implemented: 0 },
  }
  let total = 0
  let implemented = 0
  const count = (trait: FactionTrait) => {
    total += 1
    byKind[trait.kind].total += 1
    if (trait.implemented) {
      implemented += 1
      byKind[trait.kind].implemented += 1
    }
  }
  for (const faction of FACTIONS) {
    for (const trait of faction.traits) count(trait)
    for (const clan of faction.clans ?? []) for (const trait of clan.traits) count(trait)
  }
  return { total, implemented, byKind }
}
