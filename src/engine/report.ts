import { damageLevelOf, type DamageLevel } from './victory'
import type { DamageKind, GameState, ShipState } from './game'

/**
 * The after-action report (4.12).
 *
 * The scoreboard says who won. This says how: what each hull fired, what it
 * put through, what it took and what it finished, drawn from the ledger the
 * engine keeps as the damage goes through it. Two figures a player wants
 * beside every ship at the end of a battle are "how much did I do" and "how
 * much did I take", and neither was anywhere on the screen.
 *
 * Damage is credited to the hull the action named — a wing's strike to its
 * carrier, a salvo to the ship that launched it — and only for the kinds a
 * captain can take credit for. What a ship does to itself flying into a rock,
 * and what a reactor does to its neighbours, is counted against the side as
 * "other causes" and against nobody in particular.
 */

export interface ShipReport {
  id: string
  name: string
  className: string
  side: string
  level: DamageLevel
  /** Weapon activations: each mount that fired, once a turn (2.6). */
  shots: number
  /** Hull and armour boxes it marked on the enemy, by the means it used. */
  dealt: number
  dealtBy: Partial<Record<DamageKind, number>>
  /** Hull and armour boxes marked on it. */
  taken: number
  /** Hulls it finished. */
  kills: number
}

export interface SideReport {
  side: string
  name: string
  ships: ShipReport[]
  shots: number
  dealt: number
  taken: number
  kills: number
  /** Hulls of this side destroyed. */
  lost: number
  /** Damage this side's ships took that no enemy hull is credited with. */
  otherCauses: number
}

export interface AfterActionReport {
  turn: number
  sides: SideReport[]
}

/** The kinds of damage a hull is credited with; the rest is the battle's own doing. */
const CREDITED: readonly DamageKind[] = ['guns', 'ordnance', 'fighters', 'gunboats', 'boarding']

export function afterActionReport(game: GameState): AfterActionReport {
  const rows = new Map<string, ShipReport>()
  const row = (ship: ShipState): ShipReport => {
    let entry = rows.get(ship.id)
    if (!entry) {
      entry = {
        id: ship.id,
        name: ship.name,
        className: ship.design.name,
        side: ship.side,
        level: damageLevelOf(ship),
        shots: 0,
        dealt: 0,
        dealtBy: {},
        taken: 0,
        kills: 0,
      }
      rows.set(ship.id, entry)
    }
    return entry
  }
  for (const ship of game.ships) row(ship)

  for (const shot of game.ledger.shots) {
    const ship = rows.get(shot.shipId)
    if (ship) ship.shots += 1
  }

  const otherBySide = new Map<string, number>()
  for (const record of game.ledger.damage) {
    const amount = record.hull + record.armour
    const target = rows.get(record.targetId)
    if (target) target.taken += amount
    const credited =
      record.by.shipId !== null &&
      CREDITED.includes(record.by.kind) &&
      // A ship marking its own side is not a kill anyone wants credit for.
      target !== undefined &&
      rows.get(record.by.shipId)?.side !== target.side
    const source = credited && record.by.shipId !== null ? rows.get(record.by.shipId) : undefined
    if (source) {
      source.dealt += amount
      source.dealtBy[record.by.kind] = (source.dealtBy[record.by.kind] ?? 0) + amount
      if (record.destroyed) source.kills += 1
    } else if (target) {
      otherBySide.set(target.side, (otherBySide.get(target.side) ?? 0) + amount)
    }
  }

  const sides: SideReport[] = game.sides.map((side) => {
    const ships = [...rows.values()]
      .filter((ship) => ship.side === side.id)
      .sort((a, b) => b.dealt - a.dealt || a.name.localeCompare(b.name))
    const sum = (key: 'shots' | 'dealt' | 'taken' | 'kills') =>
      ships.reduce((total, ship) => total + ship[key], 0)
    return {
      side: side.id,
      name: side.name,
      ships,
      shots: sum('shots'),
      dealt: sum('dealt'),
      taken: sum('taken'),
      kills: sum('kills'),
      lost: ships.filter((ship) => ship.level === 'destroyed').length,
      otherCauses: otherBySide.get(side.id) ?? 0,
    }
  })
  return { turn: game.turn, sides }
}

const KIND_LABEL: Record<DamageKind, string> = {
  guns: 'guns',
  ordnance: 'missiles',
  fighters: 'fighters',
  gunboats: 'gunboats',
  boarding: 'boarding',
  collision: 'collisions',
  other: 'other',
}

/** "guns 12, missiles 6" — how a hull's damage was done, for a footnote. */
export function describeDealtBy(dealtBy: Partial<Record<DamageKind, number>>): string {
  return (Object.entries(dealtBy) as Array<[DamageKind, number]>)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, amount]) => `${KIND_LABEL[kind]} ${amount}`)
    .join(', ')
}

/** The report as Markdown, for the group chat. */
export function reportMarkdown(report: AfterActionReport, title = 'After-action report'): string {
  const lines: string[] = [`# ${title}`, '', `After turn ${report.turn}.`, '']
  for (const side of report.sides) {
    lines.push(
      `## ${side.name}`,
      '',
      `${side.shots} shots, ${side.dealt} damage dealt, ${side.taken} taken, ${side.kills} kills, ${side.lost} lost` +
        (side.otherCauses > 0 ? `; ${side.otherCauses} of the damage taken from other causes` : '') +
        '.',
      '',
      '| Ship | Class | State | Shots | Dealt | Taken | Kills |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: |',
    )
    for (const ship of side.ships) {
      const by = describeDealtBy(ship.dealtBy)
      lines.push(
        `| ${ship.name} | ${ship.className} | ${ship.level} | ${ship.shots} | ${ship.dealt}${
          by && Object.keys(ship.dealtBy).length > 1 ? ` (${by})` : ''
        } | ${ship.taken} | ${ship.kills} |`,
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}
