import { mobilityFamily } from '../../../dirtside/data/mobility'
import { APSW_RANGE, IAVR_RANGE, weaponKind } from '../../../dirtside/data/weapons'
import { weaponLabel } from '../../../dirtside/design'
import { infantryHitOdds, vehicleHitOdds } from '../../../dirtside/odds'
import { recordCardOf } from '../../../dirtside/recordCard'
import { CONFIDENCE_LABELS, QUALITY_DIE, QUALITY_LABELS, restrictionsOf } from '../../../dirtside/table/confidence'
import { rifleRange, teamFiresRanged, type TableShotPlan } from '../../../dirtside/table/tableFire'
import type { Confidence, ElementState, Leadership, Quality, SideId, UnitState, WeaponChoice } from '../../../dirtside/table/types'

/**
 * The table in plain words: what a newcomer reads instead of "2 CO", "HD"
 * and "factors 0.0 of 12". Every sentence here describes a rule the engine
 * already applies; none of it decides one. Rule pages go last, as chips.
 */

export const pct = (x: number) => `${Math.round(x * 100)}%`

/** "Veteran (D10)": the die a unit rolls for its tests (p. 21). */
export function qualityWords(q: Quality): string {
  return `${QUALITY_LABELS[q]} (D${QUALITY_DIE[q]})`
}

export const QUALITY_SHORT: Record<Quality, string> = { green: 'GRN', regular: 'REG', veteran: 'VET' }

/** Leadership reads against intuition: 1 is best, because a test must roll over it (p. 21). */
export function leadershipWords(l: Leadership): string {
  return `Leadership ${l}${l === 1 ? ' (best)' : l === 3 ? ' (poor)' : ''}`
}

export const CONFIDENCE_TONE: Record<Confidence, 'ok' | 'warn' | 'bad'> = { CO: 'ok', ST: 'ok', SH: 'warn', BR: 'warn', RO: 'bad' }

/** What the unit's confidence stops it doing, in a sentence (p. 22). */
export function restrictionWords(level: Confidence, kind: 'infantry' | 'armour'): string {
  const r = restrictionsOf(level, kind)
  const out: string[] = []
  if (r.mustWithdraw) out.push('must withdraw towards its own baseline')
  else if (r.noAdvance) out.push('may not move nearer the enemy')
  if (r.noFire) out.push(r.returnFire ? 'fires only when fired on' : 'may not fire')
  if (r.advanceTest) out.push('must pass a test to advance or leave cover')
  if (out.length === 0) return `${CONFIDENCE_LABELS[level]}: no restrictions.`
  return `${CONFIDENCE_LABELS[level]} ${kind === 'infantry' ? 'infantry' : 'armour'} ${out.join('; ')}.`
}

/** The unit's command marker in words, with the short form kept for the compact chip. */
export function commandWords(u: UnitState): { long: string; short: string; title: string } {
  return {
    long: `${QUALITY_LABELS[u.quality]} · Leadership ${u.leadership} · ${CONFIDENCE_LABELS[u.confidence]}`,
    short: `${QUALITY_SHORT[u.quality]} ${u.leadership}`,
    title: `${qualityWords(u.quality)}: rolls a D${QUALITY_DIE[u.quality]} for its tests. ${leadershipWords(u.leadership)}: a test must roll higher than leadership plus the threat, so 1 is the best leader.`,
  }
}

export const MOBILITY_WORDS: Record<string, string> = {
  'low-wheeled': 'wheeled (road-bound)',
  'high-wheeled': 'wheeled (cross-country)',
  'slow-tracked': 'tracked',
  'fast-tracked': 'fast tracked',
  'slow-gev': 'hovercraft',
  'fast-gev': 'fast hovercraft',
  grav: 'grav',
  'combat-walker': 'walker',
  'transport-walker': 'walker',
}

export function mobilityWords(el: ElementState): string {
  if (el.vehicle) return MOBILITY_WORDS[el.vehicle.mobility] ?? el.vehicle.mobility.replace('-', ' ')
  if (el.infantry?.cavalry) return 'mounted infantry'
  return el.infantry?.troops === 'powered' ? 'powered infantry' : 'on foot'
}

export function familyOf(el: ElementState) {
  return el.vehicle ? mobilityFamily(el.vehicle.mobility) : 'infantry'
}

/** Whether an element takes open water as poor going: amphibious, or powered infantry (p. 26), as the engine reads it. */
export function wades(el: ElementState): boolean {
  return !!el.vehicle?.amphibious || el.infantry?.troops === 'powered'
}

/** The element's type in a few words: "Heavy GEV tank", "Line rifle team". */
export function elementKind(el: ElementState): string {
  if (el.vehicle) return el.vehicle.role
  if (el.infantry) return `${el.infantry.troops[0]!.toUpperCase()}${el.infantry.troops.slice(1)} ${el.infantry.team.replace('-', ' ')} team`
  return 'element'
}

export interface StatusChip {
  label: string
  tone: 'info' | 'warn' | 'bad' | 'good'
  title: string
}

/** Everything wrong with (or protecting) an element, as chips with the rule in the title. */
export function elementChips(el: ElementState, unit: UnitState): StatusChip[] {
  const chips: StatusChip[] = []
  if (el.destroyed) return [{ label: 'Knocked out', tone: 'bad', title: 'Out of action for the rest of the battle (p. 30).' }]
  if (el.aboard) chips.push({ label: 'Aboard a craft', tone: 'info', title: 'Off the table until its craft lands and unloads (p. 43).' })
  if (el.damaged) chips.push({ label: 'Damaged', tone: 'warn', title: 'Half speed; every range band counts one step longer (p. 30).' })
  if (el.immobilised) chips.push({ label: 'Immobilised', tone: 'warn', title: 'Cannot move for the rest of the battle; it may still fire (p. 30).' })
  if (el.systemsDown) chips.push({ label: 'Systems down', tone: 'bad', title: 'No combat action until repaired; try a repair in a later activation (p. 32).' })
  if (el.dugIn) chips.push({ label: 'Dug in', tone: 'good', title: 'In a prepared position: harder to hit, lost on moving (p. 20).' })
  if (el.posture === 'hull-down') chips.push({ label: 'Hull down', tone: 'good', title: 'Only the turret shows: the enemy rolls a second die, the higher counts (p. 29).' })
  if (el.posture === 'turret-down') chips.push({ label: 'Turret down', tone: 'good', title: 'Hidden behind cover: very hard to hit, and it cannot shoot until it comes up (p. 29).' })
  if (el.wood === 'edge') chips.push({ label: 'Wood edge', tone: 'good', title: 'Soft cover at the treeline: sees out and can be seen (p. 20).' })
  if (el.wood === 'within') chips.push({ label: 'Inside a wood', tone: 'info', title: 'Deep in the trees: it can neither see nor be seen (p. 20).' })
  if (unit.evasive) chips.push({ label: 'Evading', tone: 'info', title: 'Harder to hit until its next activation, and it may not fire (p. 27).' })
  if (unit.underFire) chips.push({ label: 'Under fire', tone: 'warn', title: 'Must pass a test to move this activation; infantry shoot with a smaller die (p. 24).' })
  if (unit.panic) chips.push({ label: 'Panic', tone: 'bad', title: 'Frozen by first contact: its next activation only recovers (p. 23).' })
  return chips
}

export interface WeaponRow {
  choice: WeaponChoice
  /** The button's text: the weapon's short name. */
  label: string
  /** "Mass-Driver Cannon, turret". */
  title: string
  /** Range bands as reach in inches and the firer's die, close first. */
  bands: Array<{ upTo: number; die: number | null }>
  /** "4 chits a hit", "3 chits". */
  chits: string
}

/** The weapons an element can use at the table, in the order the record card prints them. */
export function weaponsOf(el: ElementState): WeaponRow[] {
  const out: WeaponRow[] = []
  if (el.vehicle) {
    const card = recordCardOf(el.vehicle)
    el.vehicle.weapons.forEach((w, i) => {
      const row = card.weapons[i]
      out.push({
        choice: { kind: 'direct', weaponId: w.id },
        label: `${weaponLabel(w)}${w.barrels > 1 ? ` ×${w.barrels}` : ''}`,
        title: `${weaponKind(w.type).label}, class ${w.class}, ${w.mount === 'turret' ? 'turret' : 'fixed mount (fires 30° ahead)'}`,
        bands: row ? row.bands.map((b) => ({ upTo: b.upTo, die: b.die })) : [],
        chits: `${w.class} chit${w.class === 1 ? '' : 's'} a hit`,
      })
    })
    out.push({ choice: { kind: 'apsw' }, label: 'APSW', title: 'Anti-personnel support weapon: against infantry and soft vehicles only', bands: [{ upTo: APSW_RANGE, die: null }], chits: '3 chits' })
  }
  if (el.infantry && teamFiresRanged(el)) {
    if (el.infantry.team === 'apsw') out.push({ choice: { kind: 'apsw' }, label: 'APSW', title: 'Anti-personnel support weapon: against infantry and soft vehicles only', bands: [{ upTo: APSW_RANGE, die: null }], chits: '3 chits' })
    else {
      const reach = rifleRange(el.infantry.troops)
      out.push({ choice: { kind: 'rifles' }, label: 'Rifles', title: 'Personal arms in a firefight: against infantry and soft vehicles', bands: [{ upTo: reach, die: null }], chits: el.infantry.troops === 'powered' ? '3 chits' : '2 chits' })
      out.push({ choice: { kind: 'iavr' }, label: 'IAVR', title: 'Infantry anti-vehicle rocket: at a vehicle within 4"', bands: [{ upTo: IAVR_RANGE, die: null }], chits: '2 chits' })
    }
  }
  return out
}

export const sameWeapon = (a: WeaponChoice | null, b: WeaponChoice | null) => !!a && !!b && a.kind === b.kind && (a.kind !== 'direct' || (b.kind === 'direct' && a.weaponId === b.weaponId))

export interface Odds {
  /** The chance the shot hits, when it rolls to hit. */
  hit: number | null
  /** Knocked out, or an infantry element removed. */
  kill: number
  damaged: number
  /** "Hit 63% · KO 51%". */
  short: string
  /** "63% to hit, 51% to knock out, 4% to damage". */
  long: string
}

/** The shot's odds from its plan, as the Firing Range shows them. */
export function oddsOf(plan: TableShotPlan): Odds {
  if (plan.kind === 'direct') {
    if (plan.plan.kind === 'vehicle') {
      const o = plan.plan.odds
      return { hit: o.hit, kill: o.knockedOut, damaged: o.damaged, short: `Hit ${pct(o.hit)} · KO ${pct(o.knockedOut)}`, long: `${pct(o.hit)} to hit, ${pct(o.knockedOut)} to knock out, ${pct(o.damaged)} to damage` }
    }
    return { hit: null, kill: plan.plan.killed, damaged: 0, short: `Kill ${pct(plan.plan.killed)}`, long: `hits automatically, ${pct(plan.plan.killed)} to remove the element` }
  }
  if (plan.against === 'infantry' || plan.against === 'soft-vehicle') {
    const killed = infantryHitOdds(plan.chits, plan.validity, plan.killTotal!).killed
    return { hit: null, kill: killed, damaged: 0, short: `Kill ${pct(killed)}`, long: `${plan.chits} chits drawn, ${pct(killed)} to kill (before the unit's fire-effectiveness roll)` }
  }
  const odds = vehicleHitOdds(plan.chits, plan.validity, plan.armour!)
  const dam = (['Dam', 'Dam&SD:T', 'Dam&MOB', 'Dam&SD:T&MOB'] as const).reduce((s, c) => s + odds[c], 0)
  return { hit: null, kill: odds.Kill, damaged: dam, short: `KO ${pct(odds.Kill)}`, long: `${plan.chits} chits drawn, ${pct(odds.Kill)} to knock out, ${pct(dam)} to damage` }
}

/** The range band and dice of a planned shot, in a line: "24.3″ · close · D12 vs D8 · side armour 3". */
export function planLine(plan: TableShotPlan): string {
  const bits = [`${plan.range.toFixed(1)}″`]
  if (plan.kind === 'direct') {
    const p = plan.plan
    bits.push(`${p.band} range`)
    if (p.kind === 'vehicle') bits.push(`${p.dice > 1 ? `${p.dice}×` : ''}D${p.firerDie} vs D${p.targetPrimary}${p.targetSecondary ? `+D${p.targetSecondary}` : ''}`)
    if (plan.aspect) bits.push(`${plan.aspect} armour${p.kind === 'vehicle' ? ` ${p.armour}` : ''}`)
  } else {
    bits.push(`${plan.chits} chits`)
    if (plan.armour !== null && plan.aspect) bits.push(`${plan.aspect} armour ${plan.armour}`)
  }
  return bits.join(' · ')
}

/** A refusal cut to a chip's width for a target on the map: "no sight", "out of range". */
export function shortReason(reason: string): string {
  if (/line of sight/i.test(reason)) return 'no line of sight'
  if (/reaches|range/i.test(reason)) {
    const m = reason.match(/reaches (\d+(?:\.\d+)?)"; the target is at (\d+(?:\.\d+)?)"/)
    return m ? `${m[2]}″ > ${m[1]}″` : 'out of range'
  }
  if (/arc/i.test(reason)) return 'outside the arc'
  if (/already made its combat action/.test(reason)) return 'already fired'
  if (/no effect on an armoured/.test(reason)) return 'no effect on armour'
  if (/fired at a vehicle/.test(reason)) return 'vehicles only'
  if (/within the wood|inside/i.test(reason)) return 'hidden in the wood'
  if (/turret down/.test(reason)) return 'turret down'
  if (/travel mode/.test(reason)) return 'moved in travel mode'
  if (/systems down/.test(reason)) return 'systems down'
  return reason.replace(/\.$/, '')
}

/** A refusal's "what to do instead", for the reasons a newcomer meets most. */
export function adviceFor(reason: string): string | null {
  if (/within 6" of|deploy/i.test(reason) && /baseline|zone/i.test(reason)) return 'Click inside the shaded strip along your own edge of the table.'
  if (/line of sight/i.test(reason)) return 'Woods, hills and buildings block sight. Move first, or pick another target.'
  if (/That path costs/.test(reason)) return 'Plot a shorter path, or one over easier ground (roads are cheapest).'
  if (/impassable/.test(reason)) return 'Go round it: this element cannot enter that terrain.'
  if (/fixed mount/.test(reason)) return 'Turn the vehicle to face the target first, before moving.'
  if (/reaches/.test(reason)) return 'Get closer, or use a longer-ranged weapon.'
  if (/bring it down first/.test(reason)) return 'Press "Bring down the orbital fire" first.'
  if (/leaves the table/.test(reason)) return 'Keep every waypoint on the table.'
  if (/may not advance/.test(reason)) return 'This unit is shaken up: it may only hold or move away from the enemy.'
  if (/12" from|clearance|nearest visible enemy/i.test(reason)) return 'Pick a spot farther from enemies that can see it.'
  return null
}

export const sideCode = (s: SideId) => (s === 'north' ? 'N' : 'S')

export { CONFIDENCE_LABELS, QUALITY_LABELS }
