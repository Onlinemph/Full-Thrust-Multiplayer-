import {
  EDGE_SLACK,
  missileKindOf,
  onEdge,
  oppositeEdge,
  optional,
  weaponArcs,
} from '../engine/actions'
import { mainMoveAllowance, secondaryMoveAllowance } from '../engine/fighters'
import type {
  FighterGroupState,
  GameState,
  GunboatSquadronState,
  ShipState,
} from '../engine/game'
import { shipById, tableBounds } from '../engine/game'
import type { TableEdge } from '../engine/movement'
import { arcTo, distance } from '../engine/geometry'
import { GUNBOAT_MOVE, GUNBOAT_SECONDARY_MOVE } from '../engine/gunboats'
import { missileLaunchRange, PLASMA_BOLT_RANGE } from '../engine/ordnance'
import type { Arc, Course, Point } from '../engine/types'
import {
  FLAK_MARKER_RANGE,
  projectileLine,
  SPINAL_ARC_DEGREES,
  SPINAL_MOUNT_PROFILE,
  spinalSize,
} from '../engine/weapons/kinetics'
import type { AimingMount } from './OrdnancePanel'

/**
 * How far the thing in hand can reach, drawn on the table before the click.
 *
 * Everything a player places with a click — a fighter group's move, a missile
 * marker, a plasma bolt's aim point, a spinal mount's lay, a flak barrage, a
 * ship coming back onto the table — has a rule saying where it may go, and
 * the rule was only ever discovered by clicking somewhere it may not. Worse,
 * a launcher aimed out of range was spent on a marker that never flew. So the
 * reach is drawn while the thing is in hand, and a click outside it is refused
 * with the rule, before anything is written.
 *
 * The numbers here are the engine's own — the same allowance the move handler
 * reads, the same launch range the launcher reads — so the picture on the
 * table cannot disagree with the refusal that would follow.
 */
export type Reach =
  | { kind: 'disc'; centre: Point; radius: number; label: string }
  | { kind: 'fan'; centre: Point; facing: Course; arcs: readonly Arc[]; radius: number; label: string }
  | { kind: 'cone'; centre: Point; facing: Course; halfAngle: number; radius: number; label: string }
  | { kind: 'edge'; edge: TableEdge; label: string }

/** 8.5, 9.1: a group's move in the current phase, or null in any other. */
export function reachOfGroup(
  game: GameState,
  group: FighterGroupState | GunboatSquadronState,
  boats: boolean,
): Reach | null {
  if (group.status !== 'in-flight') return null
  const secondary = game.phase === 'secondary-fighter-moves'
  if (game.phase !== 'move-fighters' && !secondary) return null
  const radius = boats
    ? secondary
      ? GUNBOAT_SECONDARY_MOVE
      : GUNBOAT_MOVE
    : secondary
      ? secondaryMoveAllowance(group as FighterGroupState)
      : mainMoveAllowance(group as FighterGroupState, game.turn)
  return { kind: 'disc', centre: group.position, radius, label: `${group.label} · ${radius} MU` }
}

/** 5.16, 5.23, 6.3, 6.8: where the mount in hand may be laid. */
export function reachOfAim(game: GameState, aim: AimingMount): Reach | null {
  const ship = shipById(game, aim.shipId)
  const weapon = ship?.design.weapons.find((w) => w.id === aim.weaponId)
  if (!ship || !weapon || ship.offTable) return null
  const centre = ship.placement.position
  const facing = ship.placement.facing
  switch (aim.kind) {
    case 'spinal': {
      const radius = SPINAL_MOUNT_PROFILE[spinalSize(weapon)].range
      return {
        kind: 'cone',
        centre,
        facing,
        halfAngle: SPINAL_ARC_DEGREES / 2,
        radius,
        label: `${weapon.label} · ${radius} MU dead ahead`,
      }
    }
    case 'flak': {
      const radius = FLAK_MARKER_RANGE[projectileLine(weapon.variant)]
      return { kind: 'fan', centre, facing, arcs: weaponArcs(ship, weapon), radius, label: `${weapon.label} · ${radius} MU` }
    }
    case 'plasma-bolt':
      return {
        kind: 'fan',
        centre,
        facing,
        arcs: weaponArcs(ship, weapon),
        radius: PLASMA_BOLT_RANGE,
        label: `${weapon.label} · ${PLASMA_BOLT_RANGE} MU`,
      }
    case 'missile': {
      const kind = missileKindOf(weapon.weaponClass)
      if (kind === null) return null
      const radius = missileLaunchRange(
        kind,
        weapon.variant === 'extended' ? 'extended' : 'standard',
        weapon.variant === 'two-stage' ? 2 : 1,
      )
      return { kind: 'fan', centre, facing, arcs: weaponArcs(ship, weapon), radius, label: `${weapon.label} · ${radius} MU` }
    }
    default:
      return null
  }
}

/** 3.9, 17.7: the edge a returning ship comes back over. */
export function reachOfReturn(game: GameState, ship: ShipState): Reach | null {
  if (!ship.exitEdge) return null
  const edge =
    optional(game).orbitalTable && ship.departure ? oppositeEdge(ship.exitEdge) : ship.exitEdge
  return { kind: 'edge', edge, label: `${ship.name} comes back on the ${edge} edge` }
}

/**
 * Whether a click lands inside the reach, or the rule it breaks if not — the
 * refusal the engine would send back, said before the action is written.
 */
export function outsideReach(game: GameState, reach: Reach, point: Point): string | null {
  switch (reach.kind) {
    case 'disc': {
      const range = distance(reach.centre, point)
      if (range > reach.radius + 1e-9) {
        return `${reach.label.split(' · ')[0]} can move ${reach.radius} MU, and that is ${range.toFixed(1)} (8.5)`
      }
      return null
    }
    case 'fan': {
      const name = reach.label.split(' · ')[0]
      const range = distance(reach.centre, point)
      if (range > reach.radius + 1e-9) {
        return `${name} reaches ${reach.radius} MU, and that is ${range.toFixed(1)}`
      }
      const arc = arcTo(reach.centre, reach.facing, point)
      if (!reach.arcs.includes(arc)) return `${name} does not bear on the ${arc} arc`
      return null
    }
    case 'cone': {
      const name = reach.label.split(' · ')[0]
      const range = distance(reach.centre, point)
      if (range > reach.radius + 1e-9) {
        return `${name} reaches ${reach.radius} MU, and that is ${range.toFixed(1)} (5.23)`
      }
      const relative = relativeBearing(reach.centre, reach.facing, point)
      if (relative > reach.halfAngle) {
        return `${name} lays on a ${reach.halfAngle * 2} degree arc off the bow, and that point is ${relative.toFixed(0)} degrees off it (5.23)`
      }
      return null
    }
    case 'edge':
      if (!onEdge(point, reach.edge, tableBounds(game))) {
        return `${reach.label} — click within ${EDGE_SLACK} MU of it (3.9)`
      }
      return null
  }
}

/** Degrees off the bow, 0 to 180. */
function relativeBearing(from: Point, facing: Course, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const bearing = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  const heading = ((facing % 12) * 30) % 360
  const relative = ((bearing - heading) % 360 + 360) % 360
  return relative > 180 ? 360 - relative : relative
}
