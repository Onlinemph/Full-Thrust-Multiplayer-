import { describe, expect, it } from 'vitest'

import { SHIP_DESIGNS } from '../../data/ships'
import { factionFleet, playBattle, type BattleReport } from './harness'

declare const process: { env: Record<string, string | undefined> }

/**
 * Whole-fleet playtests, faction against faction, with the computer on both
 * sides. Run on demand — `PLAYTEST=1 npx vitest run src/engine/playtest` —
 * because a hundred battles is minutes, not the seconds a test run gets.
 */

const FACTIONS = [...new Set(SHIP_DESIGNS.map((design) => design.faction))].filter(
  (faction) => faction !== 'Introductory' && faction !== 'Continuum',
)

function summarise(reports: BattleReport[]): string {
  const lines: string[] = []
  const refusals = new Map<string, { count: number; examples: Set<string> }>()
  const neverFired = new Map<string, number>()
  const hitsByClass = new Map<string, number>()
  const firedByClass = new Map<string, number>()
  let stuck = 0
  for (const report of reports) {
    if (report.stuck) {
      stuck += 1
      lines.push(`STUCK ${report.spec.a[0]} v ${report.spec.b[0]} seed ${report.spec.seed}: ${report.stuck}`)
    }
    for (const refusal of report.refusals) {
      const key = `${refusal.type}${refusal.weaponClass ? ` [${refusal.weaponClass}]` : ''}`
      const entry = refusals.get(key) ?? { count: 0, examples: new Set() }
      entry.count += 1
      if (entry.examples.size < 3) entry.examples.add(refusal.text)
      refusals.set(key, entry)
    }
    for (const cls of report.present) {
      if (!report.fired[cls]) neverFired.set(cls, (neverFired.get(cls) ?? 0) + 1)
    }
    for (const [cls, n] of Object.entries(report.fired)) firedByClass.set(cls, (firedByClass.get(cls) ?? 0) + n)
    for (const [cls, n] of Object.entries(report.hits)) hitsByClass.set(cls, (hitsByClass.get(cls) ?? 0) + n)
  }
  lines.push(`battles ${reports.length}, stuck ${stuck}`)
  lines.push('REFUSALS')
  for (const [key, entry] of [...refusals.entries()].sort((x, y) => y[1].count - x[1].count)) {
    lines.push(`  ${entry.count.toString().padStart(5)} ${key}`)
    for (const example of entry.examples) lines.push(`          ${example}`)
  }
  lines.push('NEVER FIRED (battles where present but unused)')
  for (const [cls, n] of [...neverFired.entries()].sort((x, y) => y[1] - x[1])) lines.push(`  ${n.toString().padStart(4)} ${cls}`)
  lines.push('FIRED / HITS by class')
  const classes = new Set([...firedByClass.keys(), ...hitsByClass.keys()])
  for (const cls of [...classes].sort()) {
    lines.push(`  ${cls.padEnd(24)} fired ${(firedByClass.get(cls) ?? 0).toString().padStart(5)}  hits ${(hitsByClass.get(cls) ?? 0).toString().padStart(5)}`)
  }
  return lines.join('\n')
}

describe.skipIf(!process.env.PLAYTEST)('faction playtests', () => {
  it('plays every faction against the next, computer on both sides', () => {
    const reports: BattleReport[] = []
    for (let i = 0; i < FACTIONS.length; i += 1) {
      const a = FACTIONS[i]!
      const b = FACTIONS[(i + 1) % FACTIONS.length]!
      for (const seed of [1, 2]) {
        reports.push(
          playBattle({
            a: factionFleet(SHIP_DESIGNS, a),
            b: factionFleet(SHIP_DESIGNS, b),
            seed: seed * 1000 + i,
            turns: 12,
          }),
        )
      }
    }
    const summary = summarise(reports)
    console.log(summary)
    for (const report of reports) {
      console.log(
        `${report.spec.a[0]!.split('-')[0]} v ${report.spec.b[0]!.split('-')[0]} seed ${report.spec.seed}: turns ${report.turns}, ` +
          `taken a ${report.taken.a} b ${report.taken.b}, lost a ${report.lost.a} b ${report.lost.b}, ` +
          `closest ${report.closest.join(' ')}, quiet ${report.quietTurns}, refusals ${report.refusals.length}`,
      )
    }
    expect(reports.filter((report) => report.stuck).length).toBe(0)
    // Every refusal is the computer's copy of the rules disagreeing with the
    // engine's; a handful across the matrix is a fresh divergence to look at.
    expect(reports.reduce((sum, report) => sum + report.refusals.length, 0)).toBeLessThanOrEqual(6)
  })

  it('beats a fleet that holds its course and its fire', () => {
    const lines: string[] = []
    for (let i = 0; i < FACTIONS.length; i += 1) {
      const faction = FACTIONS[i]!
      const fleet = factionFleet(SHIP_DESIGNS, faction)
      const report = playBattle({ a: fleet, b: fleet, seed: 77 + i, turns: 12, passive: 'b' })
      lines.push(
        `${faction.padEnd(40)} dealt ${report.taken.b.toString().padStart(4)} took ${report.taken.a.toString().padStart(4)} ` +
          `killed ${report.lost.b}/${fleet.length} lost ${report.lost.a} quiet ${report.quietTurns} closest ${report.closest.slice(0, 6).join(' ')}` +
          (report.stuck ? ` STUCK ${report.stuck}` : ''),
      )
      expect(report.stuck, faction).toBeNull()
      expect(report.lost.b, `${faction} killed nothing`).toBeGreaterThan(0)
      expect(report.lost.a, `${faction} lost a ship to a fleet that never fired`).toBe(0)
    }
    console.log(lines.join('\n'))
  })
})

describe('one battle, always', () => {
  it('runs the two intro navies against each other without a refusal or a stall', () => {
    const report = playBattle({
      a: factionFleet(SHIP_DESIGNS, 'Eurasian Solar Union'),
      b: factionFleet(SHIP_DESIGNS, 'New Anglian Confederation'),
      seed: 0x1a,
      turns: 8,
    })
    expect(report.stuck).toBeNull()
    expect(report.refusals.map((refusal) => `${refusal.type}: ${refusal.text}`)).toEqual([])
    expect(report.taken.a + report.taken.b).toBeGreaterThan(0)
    expect(report.fired['beam'] ?? 0).toBeGreaterThan(0)
  })
})
