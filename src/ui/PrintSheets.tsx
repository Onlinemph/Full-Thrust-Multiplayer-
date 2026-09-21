import { createPortal } from 'react-dom'

import { cpvPoints } from '../engine/battles'
import type { ShipDesign, WeaponDef } from '../engine/types'
import { Ssd, type SsdDamage } from './Ssd'

/**
 * A fleet on paper: a roster page, then a sheet a hull.
 *
 * Full Thrust is still played on tables with tape measures, and a group that
 * builds its fleet here wants to take it there. The print view is rendered
 * into the document only while a job is being printed, and the print
 * stylesheet is what makes it the only thing on the page: the app is hidden,
 * the palette turns to ink on paper, and each sheet keeps to one block so a
 * hull is never cut across two pages.
 */
export interface PrintSheet {
  design: ShipDesign
  /** The ship's name in this battle, when it has one; the class name otherwise. */
  name?: string
  /** The damage as it stands, for a fleet printed mid-battle. */
  damage?: SsdDamage
}

export interface PrintJob {
  title: string
  sheets: PrintSheet[]
  /** The currency the roster prices in; CPV unless the battle says otherwise. */
  pricing?: 'cpv' | 'points'
}

export function PrintSheets({ job }: { job: PrintJob }) {
  const pricing = job.pricing ?? 'cpv'
  const price = (design: ShipDesign) =>
    pricing === 'cpv' ? cpvPoints(design.points, design.mass) : design.points
  const total = job.sheets.reduce((sum, sheet) => sum + price(sheet.design), 0)
  return createPortal(
    <div className="print-sheets">
      <section className="print-roster">
        <h1>{job.title}</h1>
        <table>
          <thead>
            <tr>
              <th>Ship</th>
              <th>Class</th>
              <th className="num">Mass</th>
              <th className="num">{pricing === 'cpv' ? 'CPV' : 'Points'}</th>
              <th className="num">Thrust</th>
              <th>FTL</th>
              <th className="num">Hull</th>
              <th className="num">Armour</th>
              <th className="num">Screens</th>
              <th>Armament</th>
            </tr>
          </thead>
          <tbody>
            {job.sheets.map((sheet, i) => {
              const d = sheet.design
              return (
                <tr key={i}>
                  <td>{sheet.name ?? d.name}</td>
                  <td>{d.name}</td>
                  <td className="num">{d.mass}</td>
                  <td className="num">{price(d)}</td>
                  <td className="num">
                    {d.drive.thrust}
                    {d.drive.advanced ? ' adv' : ''}
                  </td>
                  <td>{d.ftl === 'none' ? (d.battlerider ? 'rider' : '—') : d.ftl}</td>
                  <td className="num">
                    {d.hullBoxes}/{d.hullRows}
                  </td>
                  <td className="num">{d.armour.layers.join('+') || '—'}</td>
                  <td className="num">
                    {d.screens.level > 0 ? `${d.screens.level}${d.screens.advanced ? ' adv' : ''}` : '—'}
                  </td>
                  <td>{armament(d)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>
                {job.sheets.length} hull{job.sheets.length === 1 ? '' : 's'}
              </th>
              <td className="num">{total}</td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </section>
      {job.sheets.map((sheet, i) => (
        <section className="print-sheet" key={i}>
          <Ssd design={sheet.design} name={sheet.name} damage={sheet.damage} pricing={pricing} />
          <p className="print-spec">
            <b>Armament</b> {armament(sheet.design) || 'none'}
            <br />
            <b>Systems</b> {fittings(sheet.design) || 'none'}
            {sheet.design.fighterBays.length > 0 || sheet.design.gunboats.length > 0 ? (
              <>
                <br />
                <b>Carried</b>{' '}
                {[
                  ...sheet.design.fighterBays.map((bay) => bay.label),
                  ...sheet.design.gunboats.map((rack) => rack.label),
                ].join(', ')}
              </>
            ) : null}
          </p>
        </section>
      ))}
    </div>,
    document.body,
  )
}

/** Clockwise from the port bow, so a forward mounting reads "FP/F/FS" (4.2). */
const ARC_ORDER = ['FP', 'F', 'FS', 'AS', 'A', 'AP'] as const

/** "FP/F/FS", or "all round" for the full circle (4.2). */
function arcsOf(weapon: WeaponDef): string {
  if (weapon.arcs.length >= 6) return 'all round'
  return ARC_ORDER.filter((arc) => weapon.arcs.includes(arc)).join('/')
}

/** "Beam-3 FP/F/FS ×2, Beam-1 all round": the mounts, tallied by label and arcs. */
export function armament(design: ShipDesign): string {
  const tally = new Map<string, number>()
  for (const weapon of design.weapons) {
    const key = `${weapon.label} ${weapon.turretId ? 'turret' : arcsOf(weapon)}`
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  return [...tally.entries()].map(([key, n]) => (n > 1 ? `${key} ×${n}` : key)).join(', ')
}

/** The fittings, tallied by label; a screen generator is on the roster already. */
export function fittings(design: ShipDesign): string {
  const tally = new Map<string, number>()
  for (const system of design.systems) {
    if (system.kind === 'screen-generator') continue
    tally.set(system.label, (tally.get(system.label) ?? 0) + 1)
  }
  return [...tally.entries()].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)).join(', ')
}
