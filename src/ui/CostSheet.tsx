import { breakdownDesign, type CostLine } from '../data/designPricing'
import type { ShipDesign } from '../engine/types'

/**
 * The working behind the shipyard's readout (13.14, 18.3).
 *
 * The book ends its design example with a table — a row for every decision,
 * its mass and its points, sub-totals, a total — and a player checking a hull
 * against a printed fleet list needs exactly that: the row that disagrees,
 * not a total that does. So every row here carries its arithmetic in the
 * book's own terms ("10% of 86 = 8.6 → 9 × 2") and the section it answers
 * to, the CPV sum is written out in 18.3's three steps, and carried craft are
 * listed apart from the hull the way the Fleet Books print a carrier.
 *
 * The rows are the same ones `priceDesign` adds up, so the sheet cannot
 * disagree with the mass bar above it.
 */
export function CostSheet({ design }: { design: ShipDesign }) {
  const sheet = breakdownDesign(design)
  const { cost, cpv, embarked } = sheet
  return (
    <details className="cost-sheet">
      <summary>
        <span className="cost-title">Points working</span>
        <span className="rule-detail">13.14, 18.3</span>
        <span className="spacer" />
        <span className="num">
          {cpv.points} CPV · {cost.points} points
          {embarked.points > 0 ? ` · ${cpv.points + embarked.points} CPV with craft` : ''}
        </span>
      </summary>
      <div className="cost-scroll">
        <table className="cost-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Working</th>
              <th className="num">Mass</th>
              <th className="num">Points</th>
            </tr>
          </thead>
          {sheet.groups.map((group) => (
            <tbody key={group.id}>
              <tr className="cost-group">
                <th colSpan={2}>
                  {group.label} <span className="rule-ref">{group.rule}</span>
                </th>
                <td className="num">{fmt(group.mass)}</td>
                <td className="num">{fmt(group.points)}</td>
              </tr>
              {group.lines.map((line, i) => (
                <Row key={i} line={line} />
              ))}
            </tbody>
          ))}
          <tbody>
            <tr className="cost-total">
              <th colSpan={2}>Total</th>
              <td className="num">
                {fmt(cost.massUsed)} / {fmt(cost.massAvailable)}
              </td>
              <td className="num">
                {sheet.flawed || sheet.subtotal === cost.points
                  ? fmt(sheet.subtotal)
                  : `${fmt(sheet.subtotal)} → ${cost.points}`}
              </td>
            </tr>
            {sheet.flawed ? (
              <>
                <tr>
                  <td>
                    Flawed design <span className="rule-ref">13.13</span>
                  </td>
                  <td className="cost-working">{sheet.flawed.mass}</td>
                  <td className="num" />
                  <td className="num" />
                </tr>
                <tr className="cost-total">
                  <th colSpan={2}>Points</th>
                  <td className="cost-working">{sheet.flawed.points}</td>
                  <td className="num">{cost.points}</td>
                </tr>
              </>
            ) : null}
          </tbody>
          <tbody>
            <tr className="cost-group">
              <th colSpan={2}>
                Combat Points Value <span className="rule-ref">18.3</span>
              </th>
              <td className="num" />
              <td className="num">{cpv.points}</td>
            </tr>
            {cpv.steps.map((step, i) => (
              <tr key={i}>
                <td />
                <td className="cost-working" colSpan={3}>
                  {step}
                </td>
              </tr>
            ))}
          </tbody>
          {embarked.lines.length > 0 ? (
            <tbody>
              <tr className="cost-group">
                <th colSpan={2}>
                  Carried craft <span className="rule-ref">14.7, 14.8</span>
                </th>
                <td className="num" />
                <td className="num">{fmt(embarked.points)}</td>
              </tr>
              {embarked.lines.map((line, i) => (
                <Row key={i} line={line} />
              ))}
              <tr className="cost-total">
                <th colSpan={2}>
                  Hull and craft on a fleet list <span className="rule-ref">18.2</span>
                </th>
                <td className="cost-working">{fmt(sheet.listed)} in printed points</td>
                <td className="num">{fmt(cpv.points + embarked.points)} CPV</td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>
    </details>
  )
}

function Row({ line }: { line: CostLine }) {
  const count = line.count ?? 1
  return (
    <tr>
      <td>
        {line.label}
        {count > 1 ? <span className="cost-count"> ×{count}</span> : null}{' '}
        <span className="rule-ref">{line.rule}</span>
      </td>
      <td className="cost-working">{line.working}</td>
      <td className="num">{line.mass === 0 ? '—' : fmt(line.mass)}</td>
      <td className="num">{fmt(line.points)}</td>
    </tr>
  )
}

/** Whole numbers plain, fractions to two places: a 1.5-mass SRK-1 stays 1.5. */
function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}
