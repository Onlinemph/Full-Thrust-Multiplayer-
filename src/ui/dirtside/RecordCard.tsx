import type { RecordCard as Card } from '../../dirtside/recordCard'

/**
 * The record card as the book prints it (p. 55): the vehicle's figures
 * across the top, a row a weapon with its three range bands, and the
 * "other equipment and notes" box. One card a vehicle type; the same
 * component on screen and on paper.
 */
export function RecordCard({ card }: { card: Card }) {
  return (
    <div className="ds-card">
      <div className="ds-card-head">
        <span className="ds-card-logo">Dirtside II</span>
        <span className="ds-card-field">
          <small>Name</small>
          <b>{card.name}</b>
        </span>
        <span className="ds-card-field">
          <small>Type</small>
          <b>{card.type}</b>
        </span>
      </div>
      <div className="ds-card-stats">
        <Stat label="Size class" value={String(card.size)} />
        <Stat label="Basic signature" value={String(card.basicSignature)} />
        <Stat label="Stealth level" value={String(card.stealth)} />
        <Stat label="Effective target die" value={`D${card.targetDie}`} />
        <Stat label="Mobility type" value={card.mobility} wide />
        <Stat label="Basic move" value={card.baseMove === null ? 'pass' : `${card.baseMove}"`} />
        <Stat label="Points value" value={String(card.points)} />
        <Stat label="FireCon" value={card.fireControl} />
        <Stat label="ECM" value={card.ecm} />
        <Stat label="Armour front" value={String(card.armourFront)} />
        <Stat label="Side" value={String(card.armourSide)} />
      </div>
      <table className="ds-card-table">
        <thead>
          <tr>
            <th rowSpan={2}>Type/class</th>
            <th rowSpan={2}>Mount</th>
            <th colSpan={3}>Close range</th>
            <th colSpan={3}>Medium range</th>
            <th colSpan={3}>Long range</th>
          </tr>
          <tr>
            <th>Up to</th>
            <th>Die</th>
            <th>Valid hits</th>
            <th>Up to</th>
            <th>Die</th>
            <th>Valid hits</th>
            <th>Up to</th>
            <th>Die</th>
            <th>Valid hits</th>
          </tr>
        </thead>
        <tbody>
          {card.weapons.map((row, i) => (
            <tr key={`w${i}`}>
              <td>
                {row.label}
                {row.barrels > 1 ? ` ×${row.barrels}` : ''}
              </td>
              <td>{row.mount}</td>
              {row.bands.length === 1 ? (
                <>
                  <td className="num">{row.bands[0]!.upTo}"</td>
                  <td className="num">D{row.bands[0]!.die}</td>
                  <td>{row.bands[0]!.valid}</td>
                  <td colSpan={6} className="ds-card-dim">
                    one band; {row.chits} chit{row.chits === 1 ? '' : 's'} a hit
                    {row.againstInfantry ? `; ${row.againstInfantry} vs infantry` : '; no effect on infantry'}
                  </td>
                </>
              ) : (
                row.bands.map((band) => (
                  <BandCells key={band.band} upTo={band.upTo} die={band.die} valid={band.valid} />
                ))
              )}
            </tr>
          ))}
          {card.missiles.map((row, i) => (
            <tr key={`m${i}`}>
              <td>{row.label}</td>
              <td>TU</td>
              <td className="num">{row.maxRange}"</td>
              <td className="num">D{row.die}</td>
              <td>{row.valid}</td>
              <td colSpan={6} className="ds-card-dim">
                maximum range; {row.chits} chits a hit; RED only vs reactive armour; no effect on infantry
              </td>
            </tr>
          ))}
          {card.pds ? (
            <tr>
              <td>{card.pds.label}</td>
              <td>TU</td>
              <td className="num">—</td>
              <td className="num">D{card.pds.die}</td>
              <td colSpan={7} className="ds-card-dim">
                secondary die against missiles
              </td>
            </tr>
          ) : null}
          {card.weapons.length + card.missiles.length + (card.pds ? 1 : 0) < 3
            ? Array.from({ length: 3 - card.weapons.length - card.missiles.length - (card.pds ? 1 : 0) }, (_, i) => (
                <tr key={`blank${i}`} className="ds-card-blank">
                  <td colSpan={11}>&nbsp;</td>
                </tr>
              ))
            : null}
        </tbody>
      </table>
      <div className="ds-card-notes">
        <small>Other equipment and notes</small>
        <span>{card.notes.join(' · ')}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <span className={`ds-card-stat${wide ? ' is-wide' : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  )
}

function BandCells({ upTo, die, valid }: { upTo: number; die: number; valid: string }) {
  return (
    <>
      <td className="num">{upTo}"</td>
      <td className="num">D{die}</td>
      <td>{valid}</td>
    </>
  )
}
