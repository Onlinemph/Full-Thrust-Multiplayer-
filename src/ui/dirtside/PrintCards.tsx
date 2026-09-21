import { createPortal } from 'react-dom'

import type { RecordCard as Card } from '../../dirtside/recordCard'
import { RecordCard } from './RecordCard'

/** Record cards on paper: the print stylesheet hides the app and shows these. */
export function PrintCards({ title, cards }: { title: string; cards: Card[] }) {
  return createPortal(
    <div className="print-sheets ds-print">
      <h1>{title}</h1>
      {cards.map((card, i) => (
        <section className="print-sheet" key={i}>
          <RecordCard card={card} />
        </section>
      ))}
    </div>,
    document.body,
  )
}
