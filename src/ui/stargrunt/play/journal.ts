import { logKind } from '../../dirtside/play/journal'
import type { LogBlock, LogTurn } from '../../dirtside/play/journal'
import type { GameState, LogEntry } from '../../../stargrunt/types'

/**
 * Where Stargrunt's own log wording needs its own read, beside Dirtside's
 * `dirtside/play/journal.ts` (K4): its `groupLog`'s "opens a block" pattern
 * and "routine, dim it" pattern are both tuned to Dirtside's own sentences
 * and miss this game's (`game.ts:577,900,597`), and objective ids (`N1`,
 * `S1`, …) read like squad codes in the log (`game.ts:751`) unless mapped
 * to a plain label here. `LogDock` takes each of these as an optional prop,
 * so Dirtside's own defaults are untouched.
 */

/** `${unit.name} activates.` / ` (panicked).` / ` (suppressed x2).` (p. 15), or a transferred activation, `on X's order` (p. 16, `game.ts:900`) — neither matches Dirtside's opener, which only knows its own "(under fire)" suffix. */
const OPENS = /^(.+?) activates(?: \(panicked\)| \(suppressed x\d+\))?\.$|^(.+?) activates at once, on .+'s order\.$/

/** Routine lines the block header already says: dimmed, never dropped — Stargrunt's own activate/end-activation sentences (`game.ts:577,597`), which Dirtside's `QUIET` (built for its own semicolon-joined "ends its activation;") does not match. */
export const QUIET = /^.+ activates(?: \(panicked\)| \(suppressed x\d+\))?\.$| ends its activation\.$/

/** The log by turn and activation, on Dirtside's own pattern (`dirtside/play/journal.ts`'s `groupLog`) but reading Stargrunt's opening and closing sentences. */
export function groupLog(log: readonly LogEntry[]): LogTurn[] {
  const turns: LogTurn[] = []
  let block: LogBlock | null = null
  log.forEach((entry, index) => {
    let turn = turns[turns.length - 1]
    if (!turn || turn.turn !== entry.turn) {
      turn = { turn: entry.turn, blocks: [] }
      turns.push(turn)
      block = null
    }
    const opens = entry.text.match(OPENS)
    if (opens) {
      block = { unit: (opens[1] ?? opens[2])!, side: entry.side, entries: [] }
      turn.blocks.push(block)
    } else if (!block) {
      block = { unit: null, side: null, entries: [] }
      turn.blocks.push(block)
    }
    block.entries.push({ ...entry, index, kind: logKind(entry.text) })
    if (/ ends its activation\.$/.test(entry.text)) block = null
  })
  return turns
}

/** Every objective's plain label ("Objective 2 (worth 3)"), keyed by its id — the ids themselves (`N1`, `S1`, …, `skirmish.ts`'s `placeObjectives`) read like squad codes once printed in a sentence. */
export function objectiveLabels(state: GameState): Record<string, string> {
  const out: Record<string, string> = {}
  state.setup.table.objectives.forEach((o, i) => {
    out[o.id] = `Objective ${i + 1} (worth ${o.value})`
  })
  return out
}

/** The engine's own `Objective S1 (value 2)` (`game.ts:751`) read as a plain label instead of an id. [reading: the wording itself is the engine's; this is the screen's half of the fix, told to the ENGINE builder in the report.] */
export function maskObjectiveIds(text: string, labels: Record<string, string>): string {
  return text.replace(/\bObjective (\S+) \(value \d+\)/g, (whole, id: string) => labels[id] ?? whole)
}
