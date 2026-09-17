import { arcsWhenInverted } from '../engine/specialmoves'
import { ARC_ORDER, type Arc } from '../engine/types'
import { arcTo, distance } from '../engine/geometry'
import { canWeaponFire, enemiesOf, type GameState, type ShipState } from '../engine/game'
import { maxRangeOf } from '../engine/weapons'

/**
 * What a ship can bring to bear in each of its six arcs (4.2), for the rose
 * drawn round it in phase 11.
 *
 * A gunner's first question about a target is which arc it sits in and what
 * bears there; the rose answers it for every arc at once. A weapon's arcs are
 * read the way the engine reads them — a turret bears wherever its turret
 * does, a rolled ship's port battery bears to starboard (5.22, 16.2) — and a
 * mount that is knocked out or has already fired this turn is counted apart
 * from one still loaded.
 */
export interface ArcSummary {
  arc: Arc
  /** Mounts that can still fire this turn and bear into the arc. */
  ready: Array<{ id: string; short: string; range: number }>
  /** Mounts that bear here but are spent or knocked out this turn. */
  spent: number
  /** The furthest any ready mount here reaches, in MU. */
  reach: number
  /** Enemy ships in this arc, nearest first, with their range. */
  targets: Array<{ id: string; name: string; range: number }>
}

/** "Beam-3" → "B3", "Pulse Torpedo" → "PT", "PDS" → "PDS", "SML" → "SML". */
export function shortWeaponName(label: string): string {
  const compact = label.replace(/[^A-Za-z0-9 -]/g, '')
  const parts = compact.split(/[\s-]+/).filter(Boolean)
  if (parts.length === 1) {
    const one = parts[0] ?? ''
    return one.length <= 4 ? one.toUpperCase() : one.slice(0, 3).toUpperCase()
  }
  return parts
    .map((part) => (/^\d+$/.test(part) ? part : part[0]?.toUpperCase() ?? ''))
    .join('')
    .slice(0, 5)
}

export function fireArcs(game: GameState, ship: ShipState): ArcSummary[] {
  const summaries: ArcSummary[] = ARC_ORDER.map((arc) => ({
    arc,
    ready: [],
    spent: 0,
    reach: 0,
    targets: [],
  }))
  const byArc = new Map(summaries.map((s) => [s.arc, s]))

  for (const weapon of ship.design.weapons) {
    const turret = weapon.turretId
      ? ship.design.turrets.find((t) => t.id === weapon.turretId)
      : undefined
    const arcs = arcsWhenInverted(turret ? turret.arcs : weapon.arcs, ship.rollStatus.inverted)
    const live = !ship.destroyedSystems.has(weapon.id) && canWeaponFire(ship, weapon.id)
    const range = maxRangeOf(weapon)
    for (const arc of arcs) {
      const summary = byArc.get(arc)
      if (!summary) continue
      if (live) {
        summary.ready.push({ id: weapon.id, short: shortWeaponName(weapon.label), range })
        summary.reach = Math.max(summary.reach, range)
      } else {
        summary.spent += 1
      }
    }
  }

  for (const enemy of enemiesOf(game, ship)) {
    if (enemy.destroyed || enemy.offTable) continue
    const arc = arcTo(ship.placement.position, ship.placement.facing, enemy.placement.position)
    byArc.get(arc)?.targets.push({
      id: enemy.id,
      name: enemy.name,
      range: distance(ship.placement.position, enemy.placement.position),
    })
  }
  for (const summary of summaries) summary.targets.sort((a, b) => a.range - b.range)
  return summaries
}

/** "B3 ×2, B2" — the ready mounts of an arc, alike ones counted together. */
export function describeReady(ready: ArcSummary['ready']): string {
  const counts = new Map<string, number>()
  for (const mount of ready) counts.set(mount.short, (counts.get(mount.short) ?? 0) + 1)
  return [...counts.entries()].map(([short, n]) => (n > 1 ? `${short} ×${n}` : short)).join(', ')
}
