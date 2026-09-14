import { BEAM_RANGE_BAND } from '../../engine/geometry'
import { CORE_SYSTEM_IDS } from '../../engine/threshold'
import type { ShipDesign, SystemKind, WeaponClass, WeaponDef } from '../../engine/types'
import { canPointDefend, maxRangeOf, needsFireCon, specFor } from '../../engine/weapons'
import {
  GATLING_DICE,
  GATLING_RANGE,
  HEAVY_GRASER_RANGE_BAND,
  MESON_PROJECTOR_DICE,
  MESON_PROJECTOR_RANGE,
  TWIN_PARTICLE_ARRAY_DICE,
  TWIN_PARTICLE_ARRAY_RANGE,
} from '../../engine/weapons/beams'
import type { PlacedGlyph } from './layout'

/**
 * What a symbol on the sheet is, said in a sentence.
 *
 * The sheet's symbols are a vocabulary, and a player who has not memorised it
 * is looking at hieroglyphs. Hovering one answers the two questions they have
 * — what is it, and what does it do — with the numbers this particular mount
 * actually has (its arcs, its range, its dice by band) and the rule it comes
 * from, section number and all, so the book can be opened to the right page.
 *
 * Every fact that has a number is read off the engine rather than typed here:
 * the range from the weapon's own spec, the dice from the beam table, the arcs
 * from the mounting. Only the sentences are written by hand.
 */
export interface MountInfo {
  title: string
  /** Short facts: arcs, range, dice, mode — one per line. */
  facts: string[]
  /** The rule, in a sentence or two. */
  rule: string
  /** Where in the book. */
  section: string
  /** What has happened to it this battle, if anything. */
  state: string | null
}

interface Blurb {
  section: string
  rule: string
}

const WEAPON_RULES: Record<WeaponClass, Blurb> = {
  beam: {
    section: '5.3',
    rule: 'One die per class, losing a die for every 12 MU of range. A 4 or 5 hits for one point; a 6 hits and rolls again, and re-rolled damage goes through screens and armour.',
  },
  emp: {
    section: '5.4',
    rule: 'The dice and ranges of a beam, but the hits do no damage: they force threshold tests on the target’s systems instead. Ignores standard screens and armour.',
  },
  'plasma-cannon': {
    section: '5.5',
    rule: 'Class dice in 12 MU bands. Each die inflicts d6−2 hits, one fewer per level of screen; a 6 penetrates and rolls again.',
  },
  graser: {
    section: '5.6',
    rule: 'Class dice in 12 MU bands, each hit doing 1d3 semi-armour-piercing damage. Sixes re-roll and penetrate.',
  },
  'heavy-graser': {
    section: '5.7',
    rule: 'A graser with 18 MU range bands instead of 12, so it keeps its dice further out.',
  },
  phaser: {
    section: '5.8',
    rule: 'A graser that can also be fired as point defence, or aimed at a single system like a needle beam.',
  },
  transporter: {
    section: '5.9',
    rule: 'Beam dice without re-rolls. Hits do no damage: each one lands a commando raid on a system of the firer’s choosing.',
  },
  gatling: {
    section: '5.10',
    rule: 'Six beam dice out to 12 MU, all at one target. Also fires as a point defence system.',
  },
  'twin-particle-array': {
    section: '5.11',
    rule: 'Two beam dice at any range out to 24 MU, with no drop-off. Also fires as point defence.',
  },
  'meson-projector': {
    section: '5.12',
    rule: 'One beam die at any range out to 48 MU. Also fires as point defence.',
  },
  'needle-beam': {
    section: '5.13',
    rule: 'Aimed at one named system. A 4 or better does a point of damage; a natural 6 destroys the system outright, beyond repair.',
  },
  'pulse-torpedo': {
    section: '5.14',
    rule: 'One shot, hitting on a number that rises with range, for d6 semi-armour-piercing damage. A standard tube can be overloaded in orders for more damage at worse accuracy.',
  },
  'submunition-pack': {
    section: '5.15',
    rule: 'One shot: three beam dice to 6 MU, two to 12, one to 18. Crossed off once fired.',
  },
  'k-gun': {
    section: '5.16',
    rule: 'A kinetic round: one die to hit, and a hit does damage by class. Standard screens stop nothing solid. With flak ammunition it can fire a barrage instead.',
  },
  mkp: {
    section: '5.17',
    rule: 'A burst of penetrators out to 12 MU, rolled as beam dice that ignore standard screens.',
  },
  'boarding-torpedo': {
    section: '5.18',
    rule: 'Delivers a marine party to an enemy hull for a boarding action.',
  },
  'fusion-array': {
    section: '5.19',
    rule: 'Set each turn as a torpedo — one shot at one ship — or a flare, a burst over an area in 6 MU bands.',
  },
  'gravitic-gun': {
    section: '5.20',
    rule: 'Class dice in 12 MU bands. What a hit does depends on how fast the target is moving.',
  },
  pulser: {
    section: '5.21',
    rule: 'Set short, medium or long each turn, trading dice for range. Fires as point defence too.',
  },
  'spinal-beam': {
    section: '5.23',
    rule: 'A gun the ship is built around: it fires only dead ahead, in a swathe, and everything in the lane takes beam damage.',
  },
  'spinal-plasma': {
    section: '5.23',
    rule: 'A gun the ship is built around: it fires only dead ahead, in a swathe, and everything in the lane takes plasma damage.',
  },
  'spinal-psp': {
    section: '5.23',
    rule: 'A point singularity fired dead ahead: damage scales with the target’s mass and no screen stops it.',
  },
  'nova-cannon': {
    section: '7.23',
    rule: 'Armed in orders, which costs the ship every other use of its power that turn, then fired down the centre line as a template that flies on for three turns.',
  },
  'wave-gun': {
    section: '7.24',
    rule: 'Charged over several turns and discharged straight ahead. The ship fires nothing else that turn and is unscreened across its whole front arc while it does.',
  },
  'heavy-missile': {
    section: '6.2',
    rule: 'A one-shot homing missile, launched in phase 3 to a point up to 24 MU away. It attacks in phase 10 for 3d6 and is hard to shoot down.',
  },
  'salvo-missile-rack': {
    section: '6.6',
    rule: 'A one-shot rack: a salvo of six missiles placed up to 24 MU away in phase 3. Each missile that gets through the point defence does d6.',
  },
  'salvo-missile-launcher': {
    section: '6.6',
    rule: 'Fires a salvo of six missiles a turn for as long as its magazine has loads.',
  },
  'antimatter-missile': {
    section: '6.6',
    rule: 'A missile that detonates for 3d6 within 1 MU, 2d6 within 2 and 1d6 within 3 — on friend and foe alike.',
  },
  'rocket-pod': {
    section: '6.7',
    rule: 'One shot: two rockets at a ship within 18 MU, hitting on 2+ inside 6 MU, 3+ inside 12, 4+ inside 18.',
  },
  'plasma-bolt-launcher': {
    section: '6.8',
    rule: 'Launches a bolt at a point up to 30 MU away that spreads and fades as it flies. May fire only every other turn.',
  },
  'mine-rack': {
    section: '6.10',
    rule: 'Lays one mine a turn along the ship’s course, written in orders. A mine attacks anything that comes within 3 MU with four beam dice.',
  },
}

const SYSTEM_RULES: Record<SystemKind, Blurb | null> = {
  firecon: {
    section: '4.4',
    rule: 'One target a turn per FireCon. Every weapon fired at a ship needs one; point defence does not.',
  },
  'advanced-firecon': {
    section: '5.2',
    rule: 'Tracks two targets, counting as two FireCons, and scans out to 72 MU.',
  },
  pds: {
    section: '7.12',
    rule: 'Shoots at missiles and fighters attacking this ship, through any arc and without a FireCon. A 6 kills.',
  },
  ads: {
    section: '7.13',
    rule: 'One point-defence die out to 12 MU, or two out to 6 MU that may be split between two targets.',
  },
  adfc: {
    section: '7.10',
    rule: 'Lets this ship’s point defence cover one allied ship within 6 MU.',
  },
  'advanced-adfc': {
    section: '7.11',
    rule: 'Lets this ship’s point defence cover any number of allied ships within 6 MU.',
  },
  scattergun: {
    section: '7.14',
    rule: 'A one-shot burst of point-defence dice to 6 MU, no FireCon needed. It can cover an ally within 6 MU.',
  },
  grapeshot: {
    section: '7.15',
    rule: 'One shot: four point-defence dice.',
  },
  ecm: {
    section: '7.18',
    rule: 'Each level takes 6 MU off enemy sensor and lock-on ranges. A ship’s total, area ECM included, cannot exceed 3.',
  },
  'area-ecm': {
    section: '7.19',
    rule: 'ECM for this ship and every ally within 6 MU. While it is on, the ship’s own FireCons cannot be used.',
  },
  'stealth-hull': null,
  'stealth-field': {
    section: '7.5',
    rule: 'Shrinks the range brackets of everything shooting at the ship, like a stealth hull, and can be switched on and off in orders.',
  },
  holofield: {
    section: '7.17',
    rule: 'Beam dice hit this ship only on a 5 or 6, and weapons without beam dice count it 12 MU further away.',
  },
  'cloaking-device': {
    section: '7.20',
    rule: 'Written in orders for a set number of turns. The ship fades at the end of movement and cannot fire while cloaked.',
  },
  'cloaking-field': {
    section: '7.21',
    rule: 'A total cloak: the ship leaves the table and cannot see out. Two boxes; with one lost it works as a partial cloak.',
  },
  'tuffley-cloak': {
    section: '7.22',
    rule: 'A total cloak with no damaged level: one hit and it stops working.',
  },
  'reflex-field': {
    section: '7.25',
    rule: 'While it is up, energy weapons fired at the ship are reflected back at the firer. The ship may not use its own guns that turn.',
  },
  'enhanced-sensors': {
    section: '12.1',
    rule: 'Identifies contacts and reads enemy sheets at longer range than a basic sensor fit.',
  },
  'superior-sensors': {
    section: '12.2',
    rule: 'The best sensors a hull can carry: contacts are identified and enemy sheets read from further out still.',
  },
  'dummy-bogey': {
    section: '12.3',
    rule: 'A decoy that reads as a cruiser on sensors until someone gets close enough to see through it.',
  },
  'weasel-emitter': {
    section: '13.13',
    rule: 'Spoofs enemy sensors with a vapour shroud.',
  },
  'hangar-bay': {
    section: '8.2',
    rule: 'Holds one fighter group. Groups launch through the ship’s tubes and decks, and a carrier that applies thrust cannot launch without catapults.',
  },
  'launch-tube': {
    section: '8.2',
    rule: 'One launch or recovery a turn. A carrier that applied thrust this turn cannot launch through it unless it has catapults.',
  },
  catapult: {
    section: '8.2',
    rule: 'A launch tube with catapults: fighters can launch even in a turn the carrier applied thrust.',
  },
  'fighter-rack': {
    section: '8.2',
    rule: 'An external rack for one fighter group: cheaper than a bay, and the group cannot be re-armed from it.',
  },
  'gunboat-rack': {
    section: '9.1',
    rule: 'Carries one squadron of six gunboats, launched with the ordnance in phase 3.',
  },
  'gunboat-bay': {
    section: '9.1',
    rule: 'A bay big enough to take a gunboat squadron back aboard.',
  },
  'boat-bay': {
    section: '13.12',
    rule: 'Space for the ship’s boats and shuttles.',
  },
  tender: {
    section: '11.6',
    rule: 'Internal bay space that carries other ships, so a hull without FTL can be brought to the battle.',
  },
  cargo: {
    section: '13.13',
    rule: 'Hold space, by mass. Cargo is what a merchantman is for and what a raider is after.',
  },
  'passenger-berthing': {
    section: '13.13',
    rule: 'Berths for passengers, by mass.',
  },
  'troop-berthing': {
    section: '13.13',
    rule: 'Berths for troops, by mass: the ship carries a landing force.',
  },
  minesweeper: {
    section: '6.10',
    rule: 'Clears mines from the ship’s path.',
  },
  ortillery: {
    section: '13.13',
    rule: 'Orbital artillery, for bombarding a planet below. It does nothing to a ship.',
  },
  shipyard: {
    section: '13.13',
    rule: 'Shipyard facilities: repairs and construction between battles.',
  },
  'damage-control-party': {
    section: '10.4',
    rule: 'An extra damage control party beyond what the crew provides. Parties repair knocked-out systems in phase 14, and fight boarders.',
  },
  'marine-party': {
    section: '12.7',
    rule: 'Extra marines for boarding actions, whether taking a ship or holding this one.',
  },
  'antimatter-charge': {
    section: '7.9',
    rule: 'A suicide charge, set off in orders: 3d6 within 1 MU, 2d6 within 2, 1d6 within 3, and the ship goes with it.',
  },
  'screen-generator': null,
  'ftl-drive': null,
}

const OTHER_RULES: Record<string, Blurb> = {
  drive: {
    section: '3.2',
    rule: 'The thrust rating is the whole of what the ship can spend in a turn on speeding up, slowing down and turning — with at most half of it on the turn. Halved by its first threshold loss.',
  },
  'drive-advanced': {
    section: '3.3',
    rule: 'An advanced drive may put its whole thrust rating into a course change rather than half of it.',
  },
  ftl: {
    section: '11.1',
    rule: 'The ship can enter and leave the battle by FTL: two turns to spool up, and it drops out with some scatter.',
  },
  'ftl-advanced': {
    section: '11.3',
    rule: 'An advanced FTL drive enters and leaves precisely: no scatter, no risk.',
  },
  'ftl-tug': {
    section: '11.6',
    rule: 'An FTL tug: it can carry other hulls through hyperspace on the strength of its own drive.',
  },
  screen: {
    section: '7.2',
    rule: 'Each generator is one level of screen, to a working maximum of two. Level 1 turns a beam’s 5s into misses; level 2 turns its 6s into single hits. A generator beyond the second is a backup.',
  },
  'screen-advanced': {
    section: '7.3',
    rule: 'Advanced screens work on beams like standard ones, and also blunt the weapons standard screens do nothing about: missiles, pulse torpedoes and the like.',
  },
  'area-screen': {
    section: '7.16',
    rule: 'One extra level of screen for this ship and every ship within 6 MU of it, stacking to a maximum of three.',
  },
  'core-systems': {
    section: '10.3',
    rule: 'The bridge, life support and power core, rolled for at every threshold check like any other system. Losing the bridge puts the ship out of control; losing life support kills the crew in a few turns; losing the core leaves a breach that may explode at the end of any turn.',
  },
  bridge: {
    section: '10.3',
    rule: 'Knocked out: roll a die. 1 to 5 and the ship is out of control for that many turns; a 6 and it never recovers.',
  },
  'life-support': {
    section: '10.3',
    rule: 'Knocked out: roll a die, and after that many turns the crew is lost — unless damage control gets it back first.',
  },
  'power-core': {
    section: '10.3',
    rule: 'Knocked out: a breached core. At the end of every turn it rolls a die, and on a 5 or 6 the ship is destroyed.',
  },
  flaw: {
    section: '13.13',
    rule: 'A flawed design: the ship’s threshold checks fail a pip earlier than the book says.',
  },
  wing: {
    section: '8.15',
    rule: 'A fighter group in its hangar. Six craft, launched in phase 3, flown in phases 4 and 8, and fighting like Beam-1s for as long as their endurance lasts.',
  },
  squadron: {
    section: '9.1',
    rule: 'A gunboat squadron on its rack: six boats, closer to small ships than to fighters, launched with the ordnance.',
  },
}

/** The dice a classed beam-type mount rolls in each band, as a sentence. */
function diceByBand(rating: number, band: number): string {
  const parts: string[] = []
  for (let n = Math.round(rating); n >= 1; n -= 1) {
    const to = (Math.round(rating) - n + 1) * band
    parts.push(`${n} to ${to}`)
  }
  return `${parts.join(', ')} MU`
}

const CLASSED_BEAM: ReadonlySet<WeaponClass> = new Set<WeaponClass>([
  'beam',
  'emp',
  'graser',
  'phaser',
  'needle-beam',
  'plasma-cannon',
  'transporter',
  'gravitic-gun',
])

function weaponFacts(weapon: WeaponDef, glyph: PlacedGlyph): string[] {
  const facts: string[] = []
  const arcs = glyph.arcs ?? weapon.arcs
  if (weapon.turretId !== undefined) facts.push(`Turret ${weapon.turretId}: bears ${arcs.join(' ')}`)
  else if (arcs.length === 6) facts.push('All six arcs')
  else if (arcs.length > 0) facts.push(`Arcs ${arcs.join(' ')}`)

  const spec = specFor(weapon)
  const range = maxRangeOf(weapon)
  if (range > 0) facts.push(`Range ${range} MU`)

  if (CLASSED_BEAM.has(weapon.weaponClass)) {
    facts.push(`Dice ${diceByBand(weapon.rating, BEAM_RANGE_BAND)}`)
  } else if (weapon.weaponClass === 'heavy-graser') {
    facts.push(`Dice ${diceByBand(weapon.rating, HEAVY_GRASER_RANGE_BAND)}`)
  } else if (weapon.weaponClass === 'gatling') {
    facts.push(`${GATLING_DICE} dice to ${GATLING_RANGE} MU`)
  } else if (weapon.weaponClass === 'twin-particle-array') {
    facts.push(`${TWIN_PARTICLE_ARRAY_DICE} dice to ${TWIN_PARTICLE_ARRAY_RANGE} MU`)
  } else if (weapon.weaponClass === 'meson-projector') {
    facts.push(`${MESON_PROJECTOR_DICE} die to ${MESON_PROJECTOR_RANGE} MU`)
  }

  if (spec?.damageMode) {
    const mode =
      spec.damageMode === 'P'
        ? 'penetrating on a 6'
        : spec.damageMode === 'SAP'
          ? 'semi-armour-piercing'
          : spec.damageMode === 'AP'
            ? 'armour-piercing'
            : String(spec.damageMode)
    facts.push(`Damage ${mode}`)
  }
  if (weapon.variant !== 'standard') facts.push(`${weapon.variant} variant`)
  if (weapon.ammo !== undefined) facts.push(`${weapon.ammo} shot${weapon.ammo === 1 ? '' : 's'}`)
  if (canPointDefend(weapon)) facts.push('Can fire as point defence')
  if (!needsFireCon(weapon) && !(spec?.ordnance ?? false)) facts.push('Needs no FireCon')
  facts.push(`Mass ${weapon.mass}, ${weapon.points} points`)
  return facts
}

function stateOf(glyph: PlacedGlyph): string | null {
  switch (glyph.state) {
    case 'destroyed':
      return 'Knocked out'
    case 'fired':
      return 'Fired this turn'
    case 'degraded':
      return 'Degraded'
    case 'absent':
      return 'Not fitted'
    default:
      return null
  }
}

/**
 * What the symbol under the pointer is, or null for one the sheet does not
 * explain — which should be none of them, and the test says so.
 */
export function describeGlyph(design: ShipDesign, glyph: PlacedGlyph): MountInfo | null {
  const state = stateOf(glyph)

  const weapon = design.weapons.find((w) => w.id === glyph.key)
  if (weapon !== undefined) {
    const blurb = WEAPON_RULES[weapon.weaponClass]
    return {
      title: glyph.label,
      facts: weaponFacts(weapon, glyph),
      rule: blurb.rule,
      section: blurb.section,
      state,
    }
  }

  const system = design.systems.find((s) => s.id === glyph.key)
  if (system !== undefined) {
    if (system.kind === 'screen-generator') {
      const blurb = design.screens.advanced ? OTHER_RULES['screen-advanced'] : OTHER_RULES.screen
      return {
        title: glyph.label,
        facts: [`Screens level ${design.screens.level}${design.screens.advanced ? ', advanced' : ''}`],
        rule: blurb.rule,
        section: blurb.section,
        state,
      }
    }
    if (system.kind === 'ftl-drive') {
      const blurb =
        design.ftl === 'advanced'
          ? OTHER_RULES['ftl-advanced']
          : design.ftl === 'tug'
            ? OTHER_RULES['ftl-tug']
            : OTHER_RULES.ftl
      return { title: glyph.label, facts: [], rule: blurb.rule, section: blurb.section, state }
    }
    const blurb = SYSTEM_RULES[system.kind]
    if (blurb === null) return null
    const facts: string[] = []
    if (glyph.kind === 'bay') {
      // A hangar with a wing in it is described as the wing (8.2, 8.15).
      const wingRule = glyph.icon.startsWith('hangar-bay-')
        ? OTHER_RULES.wing
        : glyph.icon === 'gunboat-rack-occupied-sample'
          ? OTHER_RULES.squadron
          : null
      if (wingRule !== null) {
        return {
          title: glyph.label,
          facts: [`${system.label}, mass ${system.mass}`],
          rule: wingRule.rule,
          section: wingRule.section,
          state,
        }
      }
    }
    if (system.arcs !== undefined && system.arcs.length > 0 && system.arcs.length < 6) {
      facts.push(`Arcs ${system.arcs.join(' ')}`)
    }
    if (system.rating !== undefined) facts.push(`Rating ${system.rating}`)
    facts.push(`Mass ${system.mass}, ${system.points} points`)
    return { title: glyph.label, facts, rule: blurb.rule, section: blurb.section, state }
  }

  // The rest are drawn from the design rather than from a system entry.
  if (glyph.key.startsWith('count-')) {
    const kind = glyph.key.slice('count-'.length) as SystemKind
    const blurb = SYSTEM_RULES[kind]
    if (!blurb) return null
    return {
      title: glyph.label,
      facts: glyph.value !== undefined ? [`${glyph.value} in service`] : [],
      rule: blurb.rule,
      section: blurb.section,
      state,
    }
  }
  if (glyph.key.startsWith('wing-')) {
    return { title: glyph.label, facts: [], rule: OTHER_RULES.wing.rule, section: '8.15', state }
  }
  if (glyph.key.startsWith('squadron-')) {
    return { title: glyph.label, facts: [], rule: OTHER_RULES.squadron.rule, section: '9.1', state }
  }
  switch (glyph.key) {
    case 'drive': {
      const blurb = design.drive.advanced ? OTHER_RULES['drive-advanced'] : OTHER_RULES.drive
      const thrust = glyph.value ?? design.drive.thrust
      const turn = design.drive.advanced ? thrust : Math.floor(thrust / 2)
      return {
        title: glyph.label,
        facts: [
          `Thrust ${thrust}${thrust < design.drive.thrust ? ` of ${design.drive.thrust}` : ''}`,
          `Up to ${turn} point${turn === 1 ? '' : 's'} of it on the turn`,
        ],
        rule: blurb.rule,
        section: blurb.section,
        state,
      }
    }
    case 'ftl': {
      const blurb =
        design.ftl === 'advanced'
          ? OTHER_RULES['ftl-advanced']
          : design.ftl === 'tug'
            ? OTHER_RULES['ftl-tug']
            : OTHER_RULES.ftl
      return { title: glyph.label, facts: [], rule: blurb.rule, section: blurb.section, state }
    }
    case 'area-screen': {
      const blurb = OTHER_RULES['area-screen']
      return {
        title: glyph.label,
        facts: design.screens.area ? [`Level ${design.screens.area.level ?? 1}`] : [],
        rule: blurb.rule,
        section: blurb.section,
        state,
      }
    }
    case 'flawed-design': {
      const blurb = OTHER_RULES.flaw
      return { title: 'Flawed design', facts: [], rule: blurb.rule, section: blurb.section, state }
    }
    case 'core-systems': {
      const blurb = OTHER_RULES['core-systems']
      const cells = glyph.cells ?? []
      const facts = cells.map(
        (cell) =>
          `${cell.label}: ${
            cell.state === 'destroyed' ? 'knocked out' : cell.state === 'absent' ? 'not fitted' : 'up'
          }`,
      )
      return { title: 'Core systems', facts, rule: blurb.rule, section: blurb.section, state }
    }
    default:
      break
  }
  if (glyph.key === CORE_SYSTEM_IDS.bridge) return cellInfo('Bridge', OTHER_RULES.bridge, state)
  if (glyph.key === CORE_SYSTEM_IDS.lifeSupport) {
    return cellInfo('Life support', OTHER_RULES['life-support'], state)
  }
  if (glyph.key === CORE_SYSTEM_IDS.powerCore) return cellInfo('Power core', OTHER_RULES['power-core'], state)
  return null
}

/** One of the three core systems, hovered on its own cell (10.3). */
export function describeCoreCell(key: string): MountInfo | null {
  if (key === CORE_SYSTEM_IDS.bridge) return cellInfo('Bridge', OTHER_RULES.bridge, null)
  if (key === CORE_SYSTEM_IDS.lifeSupport) return cellInfo('Life support', OTHER_RULES['life-support'], null)
  if (key === CORE_SYSTEM_IDS.powerCore) return cellInfo('Power core', OTHER_RULES['power-core'], null)
  return null
}

function cellInfo(title: string, blurb: Blurb, state: string | null): MountInfo {
  return { title, facts: [], rule: blurb.rule, section: blurb.section, state }
}

export { WEAPON_RULES, SYSTEM_RULES }
