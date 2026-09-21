import type { Scenario } from './scenarios'

/**
 * The player's own scenarios, kept the way the shipyard keeps designs: in
 * this browser, apart from any battle. A battle that uses one carries its own
 * copy in the setup, so the file opens anywhere.
 */

const KEY = 'full-thrust.scenarios.v1'

let scenarios: Scenario[] | null = null

function load(): Scenario[] {
  if (scenarios) return scenarios
  scenarios = []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        scenarios = parsed.filter(
          (s): s is Scenario =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as Scenario).id === 'string' &&
            Array.isArray((s as Scenario).sides),
        )
      }
    }
  } catch {
    // Private window, quota, or a hand-edited store: an empty shelf is right.
  }
  return scenarios
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(scenarios ?? []))
  } catch {
    // The scenario still works for this session; it just will not come back.
  }
}

/** Every scenario this player has kept, newest first. */
export function savedScenarios(): readonly Scenario[] {
  return load()
}

export function saveScenario(scenario: Scenario): void {
  const list = load()
  const copy = structuredClone(scenario)
  const at = list.findIndex((s) => s.id === copy.id)
  if (at >= 0) list[at] = copy
  else list.unshift(copy)
  persist()
}

export function deleteScenario(id: string): void {
  scenarios = load().filter((s) => s.id !== id)
  persist()
}

/** Forget the cache, so a test can start from storage again. */
export function reloadScenarios(): void {
  scenarios = null
}
