import {
  availableTech,
  emptyTechBase,
  isTechId,
  missingPrerequisites,
  techBaseCost,
  techBaseHeld,
  techChoiceCost,
  techEntry,
  validateTechBase,
  RECOMMENDED_TECH_CHOICE_LIMIT,
  TECH_BY_CATEGORY,
  TECH_CATEGORY_LABELS,
  type TechBase,
  type TechCategory,
  type TechId,
} from '../engine/techbase'

/**
 * Building an Imperial Tech Base (15).
 *
 * *"Each empire has a number of choices as determined by their player group,
 * which they can spend on technologies from the lists below."* The engine has
 * had all nine lists, the prerequisite graph and the choice budget since the
 * module was written, and the only thing a player could do with them was pick
 * one of the book's two worked examples. This is the buying half: spend the
 * choices, watch the prerequisites open up, and see what the fleet you already
 * chose could not have been built from.
 *
 * The panel never blocks. 15 is a construction rule, not a battle rule, and a
 * base over its limit or short a prerequisite is reported rather than refused —
 * the same posture the fleet picker takes towards a fleet the base cannot
 * field.
 */
export interface TechBasePanelProps {
  base: TechBase | undefined
  onChange: (base: TechBase) => void
  /** Read-only once the battle has started. */
  editable?: boolean
}

const ORDER: readonly TechCategory[] = [
  'primary',
  'defensive',
  'targeting',
  'direct-fire',
  'ordnance',
  'spinal',
  'fighters',
  'gunboats',
  'secondary',
]

export function TechBasePanel({ base, onChange, editable = true }: TechBasePanelProps) {
  const current = base ?? emptyTechBase('this table')
  const chosen = new Set(current.choices.filter(isTechId))
  const held = techBaseHeld(current)
  const open = new Set(availableTech(current))
  const budget = techBaseCost(current)
  const report = validateTechBase(current)

  const toggle = (id: TechId) => {
    if (!editable) return
    onChange({
      ...current,
      choices: chosen.has(id)
        ? current.choices.filter((held2) => held2 !== id)
        : [...current.choices, id],
    })
  }

  return (
    <div className="tech-base-panel">
      <div className="panel-row">
        <label className="code-field">
          Choices
          <input
            type="number"
            min={0}
            max={40}
            disabled={!editable}
            value={current.limit ?? RECOMMENDED_TECH_CHOICE_LIMIT}
            onChange={(event) =>
              onChange({ ...current, limit: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <span className="spacer" />
        <span
          className="num"
          style={{ color: budget.overBudget ? 'var(--warn)' : 'var(--ink-dim)' }}
        >
          {budget.spent} / {budget.limit} spent
        </span>
        {budget.packageAllowance > 0 ? (
          <span style={{ color: 'var(--ink-dim)', marginLeft: 8 }}>
            package covers {budget.packageUsed} of {budget.packageAllowance}
          </span>
        ) : null}
        {current.choices.length > 0 && editable ? (
          <button onClick={() => onChange(emptyTechBase(current.name))}>Clear</button>
        ) : null}
      </div>

      {report.errors.length > 0 || report.warnings.length > 0 ? (
        <ul className="faults">
          {report.errors.map((line, i) => (
            <li key={`e${i}`}>{line}</li>
          ))}
          {report.warnings.map((line, i) => (
            <li key={`w${i}`} style={{ color: 'var(--ink-dim)' }}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {ORDER.map((category) => (
        <section key={category}>
          <h4>{TECH_CATEGORY_LABELS[category]}</h4>
          <div className="ssd-systems">
            {TECH_BY_CATEGORY[category].map((id) => {
              const entry = techEntry(id)
              const bought = chosen.has(id)
              // Held without being bought is 15's other two ways in: an entry
              // printed "(0 technology choices)", and one that comes bundled
              // with something already held.
              const free = !bought && held.has(id)
              const buyable = open.has(id)
              const missing = missingPrerequisites(id, held)
              const cost = techChoiceCost(id)
              return (
                <button
                  key={id}
                  className={`system-chip${bought ? ' is-fitted' : ''}${
                    !bought && !buyable && !free ? ' is-blocked' : ''
                  }`}
                  // A free entry is not a purchase: universal lines and the
                  // ones that come bundled with something else are already
                  // held, and writing them into `choices` would make the base
                  // a cache of what it derives (15).
                  disabled={!editable || free || (!bought && !buyable)}
                  title={
                    free
                      ? `${entry.printed} ${entry.printedCost} — already yours`
                      : missing.length > 0
                        ? `needs ${missing.map((group) => group.map((n) => techEntry(n).printed).join(' or ')).join('; ')}`
                        : `${entry.printed} ${entry.printedCost}`
                  }
                  onClick={() => toggle(id)}
                >
                  {entry.printed}
                  <span className="num">{free ? 'free' : cost === 0 ? '0' : cost}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
