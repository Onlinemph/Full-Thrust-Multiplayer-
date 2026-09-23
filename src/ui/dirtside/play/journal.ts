import { CONFIDENCE_LABELS } from '../../../dirtside/table/confidence'
import type { Action, GameState, LogEntry, Point, SideId } from '../../../dirtside/table/types'
import type { RecentMark } from '../TableMap'

/**
 * What just happened, read from an action and the states either side of it:
 * a few plain lines for the outcome card, fading marks for the map, and the
 * log grouped for reading. Nothing here is a rule; it compares flags the
 * engine set and quotes the sentences it logged.
 */

export type Tone = 'kill' | 'hit' | 'miss' | 'morale' | 'objective' | 'move' | 'info'

export interface Chit {
  label: string
  colour: 'red' | 'yellow' | 'green' | 'special'
}

export interface PlayLine {
  text: string
  tone: Tone
  /** The dice of a shot: "D12 rolled 4 · D8 rolled 1". */
  dice?: string
  chits?: Chit[]
  /** The verdict stamp: "KNOCKED OUT", "MISS". */
  stamp?: string
}

export interface PlayEvent {
  /** Journal index of the action. */
  seq: number
  kind: Action['kind']
  side: SideId | null
  /** Starts a new group in the recap: an activation, a turn start, a landing. */
  opens: boolean
  /** "S2 Heavy Troop", or the side's name. */
  title: string
  lines: PlayLine[]
  /** The turn it happened in. */
  turn: number
}

/** Actions that begin something a player would call "a go". */
const OPENERS: ReadonlySet<Action['kind']> = new Set(['activate', 'land-craft', 'unload', 'orbital-strike', 'choose-first', 'pass', 'done', 'declare-end', 'rally', 'ready'])

const QUIET_KINDS: ReadonlySet<Action['kind']> = new Set(['ready', 'choose-first', 'deploy'])

/** "Drew RED 1, T, YELLOW 2: …" into chit pills. */
export function parseChits(text: string): Chit[] {
  const m = text.match(/Drew ([^:]+):/)
  if (!m) return []
  return m[1]!.split(',').map((raw) => {
    const label = raw.trim()
    const colour = /^RED/.test(label) ? 'red' : /^YELLOW/.test(label) ? 'yellow' : /^GREEN/.test(label) ? 'green' : 'special'
    return { label, colour }
  })
}

/** "Firer rolled 4; target rolled 1 — hit." into "you 4 · them 1". */
export function parseDice(text: string): string | null {
  const m = text.match(/Firer rolled ([\d, ]+); target rolled (.+?) — (.+?)\.$/)
  return m ? `rolled ${m[1]!.trim()} against ${m[2]!.trim()}: ${m[3]}` : null
}

export function describeAction(before: GameState, action: Action, after: GameState, codes: Record<string, string>): PlayEvent {
  const logged = after.log.slice(before.log.length)
  const lines: PlayLine[] = []
  const side = 'side' in action ? action.side : null
  const unitLabel = (id: string | undefined | null) => {
    const u = id ? after.units[id] : null
    return u ? `${codes[u.id] ?? ''} ${u.name}`.trim() : ''
  }
  let title = side ? after.sides[side].name : 'The table'

  switch (action.kind) {
    case 'activate':
      title = unitLabel(action.unitId)
      break
    case 'move': {
      const el = after.elements[action.elementId]!
      title = unitLabel(el.unitId)
      const moved = logged.find((l) => l.text.startsWith(`${el.name} moves `))
      const test = logged.find((l) => /tests to move/.test(l.text))
      if (test) lines.push({ text: test.text.replace(/^[^,]+, /, 'Test to move: '), tone: /stay put/.test(test.text) ? 'miss' : 'info' })
      if (moved) {
        const inches = moved.text.match(/moves ([\d.]+)"/)?.[1]
        lines.push({ text: `${el.name} moved ${inches ?? ''}″${action.travel ? ' in travel mode' : ''}${action.evasive ? ', evading' : ''}.`, tone: 'move' })
      }
      if (after.activation?.window && !before.activation?.window) lines.push({ text: `${after.sides[after.activation.window.sideId].name} may fire at it as it arrives.`, tone: 'info' })
      break
    }
    case 'fire':
    case 'opportunity-fire': {
      const first = after.elements[action.shots[0]?.elementId ?? '']
      title = action.kind === 'opportunity-fire' ? `${unitLabel(action.unitId)} fires back` : unitLabel(first?.unitId)
      const reported = new Set<string>()
      for (const shot of action.shots) {
        const firer = after.elements[shot.elementId]
        const target = after.elements[shot.targetId]
        const was = before.elements[shot.targetId]
        if (!firer || !target || !was) continue
        const mine = logged.filter((l) => l.text.startsWith(`${firer.name} → ${target.name}`) || l.text.startsWith(`${firer.name} fires at ${target.name}`))
        const chits = mine.flatMap((l) => parseChits(l.text))
        const dice = mine.map((l) => parseDice(l.text)).find(Boolean) ?? undefined
        // The verdict is read from this shot's own lines, so two shots at one target each get their own;
        // the flags the engine set are the fallback when the log says nothing plain.
        const said = mine.map((l) => l.text).filter((t) => !/F: the shot never fired/.test(t)).join(' ')
        const effects = ['damaged', 'immobilised', 'systems down'].filter((e) => new RegExp(`— [^.]*${e}`).test(said))
        if (effects.length === 0 && !reported.has(target.id)) {
          if (!was.damaged && target.damaged) effects.push('damaged')
          if (!was.immobilised && target.immobilised) effects.push('immobilised')
          if (!was.systemsDown && target.systemsDown) effects.push('systems down')
        }
        let stamp: string
        let tone: Tone
        if (/BOOM|knocked out|element removed/.test(said) || (!reported.has(target.id) && !was.destroyed && target.destroyed && !/— miss\.|wasted|no chits drawn/.test(said))) {
          stamp = target.vehicle ? 'KNOCKED OUT' : 'REMOVED'
          tone = 'kill'
        } else if (/wasted/.test(said)) {
          stamp = 'WASTED'
          tone = 'miss'
        } else if (effects.length) {
          stamp = effects.join(', ').toUpperCase()
          tone = 'hit'
        } else if (/— miss\.|no chits drawn|ineffective/.test(said)) {
          stamp = 'MISS'
          tone = 'miss'
        } else {
          stamp = 'NO EFFECT'
          tone = 'miss'
        }
        if (tone === 'kill' || tone === 'hit') reported.add(target.id)
        lines.push({ text: `${firer.name} → ${target.name}${codes[target.unitId] ? ` (${codes[target.unitId]})` : ''}`, tone, stamp, chits: chits.length ? chits : undefined, dice })
      }
      const eff = logged.find((l) => /checks fire effectiveness/.test(l.text))
      if (eff) lines.unshift({ text: eff.text.replace(/^.*? — /, 'Fire effectiveness: ').replace(/\.$/, ''), tone: 'info' })
      break
    }
    case 'posture': {
      const el = after.elements[action.elementId]!
      title = unitLabel(el.unitId)
      lines.push({ text: `${el.name} ${action.posture === 'none' ? 'comes up into the open' : `goes ${action.posture.replace('-', ' ')}`}.`, tone: 'info' })
      break
    }
    case 'end-activation': {
      const was = before.activation ? before.units[before.activation.unitId] : null
      title = unitLabel(was?.id)
      if (logged.some((l) => /is evading/.test(l.text))) lines.push({ text: `${was?.name} is evading until its next activation.`, tone: 'info' })
      break
    }
    case 'decline-opportunity':
      lines.push({ text: `${after.sides[action.side].name} holds fire${action.forActivation ? ' for the rest of this activation' : ''}.`, tone: 'info' })
      break
    case 'ready':
      lines.push({ text: `${after.sides[action.side].name} is deployed.`, tone: 'info' })
      break
    case 'choose-first':
      lines.push({ text: `${after.sides[action.first].name} activates first in turn ${after.turn}.`, tone: 'info' })
      break
    case 'pass':
    case 'done':
    case 'declare-end':
    case 'rally':
    case 'regroup':
    case 'repair':
    case 'call-orbital':
    case 'orbital-strike':
    case 'land-craft':
    case 'unload':
      if (action.kind === 'rally') title = unitLabel(action.unitId)
      for (const l of logged.slice(0, 3)) {
        if (/is under fire\.|tests confidence|takes objective|wins:|^A draw:|Turn \d+ ends/.test(l.text)) continue
        lines.push({ text: l.text.replace(/ at \(\d+\.\d, \d+\.\d\)/, ''), tone: /no answer|still down|no change|shot down/.test(l.text) ? 'miss' : 'info' })
      }
      break
    case 'deploy':
      break
  }

  // What changed anywhere on the table: fire from orbit and salvos catch more than their target.
  const named = new Set(action.kind === 'fire' || action.kind === 'opportunity-fire' ? action.shots.map((s) => s.targetId) : [])
  for (const el of Object.values(after.elements)) {
    if (named.has(el.id)) continue
    const was = before.elements[el.id]
    if (!was) continue
    if (!was.destroyed && el.destroyed) lines.push({ text: `${el.name}${codes[el.unitId] ? ` (${codes[el.unitId]})` : ''}`, tone: 'kill', stamp: el.vehicle ? 'KNOCKED OUT' : 'REMOVED' })
    else if ((!was.damaged && el.damaged) || (!was.immobilised && el.immobilised) || (!was.systemsDown && el.systemsDown)) {
      const effects = [!was.damaged && el.damaged ? 'damaged' : '', !was.immobilised && el.immobilised ? 'immobilised' : '', !was.systemsDown && el.systemsDown ? 'systems down' : ''].filter(Boolean)
      lines.push({ text: `${el.name}${codes[el.unitId] ? ` (${codes[el.unitId]})` : ''}`, tone: 'hit', stamp: effects.join(', ').toUpperCase() })
    }
  }
  for (const u of Object.values(after.units)) {
    const was = before.units[u.id]
    if (!was) continue
    if (was.confidence !== u.confidence) lines.push({ text: `${codes[u.id] ?? ''} ${u.name}: ${CONFIDENCE_LABELS[was.confidence]} → ${CONFIDENCE_LABELS[u.confidence]}`.trim(), tone: 'morale' })
    if (!was.panic && u.panic) lines.push({ text: `${codes[u.id] ?? ''} ${u.name} panics on first contact`.trim(), tone: 'morale' })
  }
  for (const o of after.setup.table.objectives) {
    const was = before.objectives[o.id]?.heldBy ?? null
    const now = after.objectives[o.id]?.heldBy ?? null
    if (now && was !== now) lines.push({ text: `${after.sides[now].name} takes an objective worth ${o.value}`, tone: 'objective' })
  }
  if (after.result && !before.result) lines.push({ text: after.result.winner === 'draw' ? `A draw: ${after.result.reason}.` : `${after.sides[after.result.winner].name} wins: ${after.result.reason}.`, tone: 'objective' })

  return { seq: before.journal.length, kind: action.kind, side, opens: OPENERS.has(action.kind), title, lines, turn: after.turn }
}

/** Marks for the map: the path an element took, the line a shot flew and how it ended. */
export function marksOf(before: GameState, action: Action, after: GameState): RecentMark[] {
  if (action.kind === 'move') {
    const was = before.elements[action.elementId]
    const now = after.elements[action.elementId]
    if (!was || !now || (now.position.x === was.position.x && now.position.y === was.position.y)) return []
    return [{ kind: 'move', side: action.side, path: [{ ...was.position }, ...action.path.map((p): Point => ({ ...p }))] }]
  }
  if (action.kind === 'fire' || action.kind === 'opportunity-fire') {
    return action.shots.flatMap((s): RecentMark[] => {
      const firer = after.elements[s.elementId]
      const target = after.elements[s.targetId]
      const was = before.elements[s.targetId]
      if (!firer || !target || !was) return []
      const result = !was.destroyed && target.destroyed ? 'kill' : (!was.damaged && target.damaged) || (!was.immobilised && target.immobilised) || (!was.systemsDown && target.systemsDown) ? 'hit' : 'miss'
      return [{ kind: 'fire', side: action.side, from: { ...firer.position }, to: { ...target.position }, result }]
    })
  }
  return []
}

// ---- The log, for reading.

export type LogKind = 'move' | 'fire' | 'damage' | 'morale' | 'objective' | 'orbital' | 'turn' | 'info'

/** What a log line is about, from its words. */
export function logKind(text: string): LogKind {
  if (/knocked out|element removed|BOOM|shot down|— damaged|immobilised|systems down\./.test(text)) return 'damage'
  if (/takes objective|wins:|A draw:|declares game end/.test(text)) return 'objective'
  if (/^Turn \d/.test(text)) return 'turn'
  if (/ calls |beaten zone|NUKE|arrives:|in low orbit|touches down|comes in under fire|unloads/.test(text)) return 'orbital'
  if (/ → |Firer rolled|Drew |fires at|fire effectiveness|caught in the salvo/.test(text)) return 'fire'
  if (/tests |confidence|panic|rallies|under fire\.|takes command|command unit is lost/.test(text)) return 'morale'
  if (/ moves [\d.]+"/.test(text)) return 'move'
  return 'info'
}

export const LOG_ICON: Record<LogKind, string> = { move: '➜', fire: '✦', damage: '✖', morale: '⚑', objective: '◆', orbital: '☄', turn: '◷', info: '·' }

export interface LogBlock {
  /** "Heavy Troop", or null for the lines between activations. */
  unit: string | null
  side: SideId | null
  entries: Array<LogEntry & { index: number; kind: LogKind }>
}

export interface LogTurn {
  turn: number
  blocks: LogBlock[]
}

/** The log by turn, and within a turn by activation: from "X activates" to "X ends its activation". */
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
    const opens = entry.text.match(/^(.+?) activates( \(under fire\))?\.$/)
    if (opens) {
      block = { unit: opens[1]!, side: entry.side, entries: [] }
      turn.blocks.push(block)
    } else if (!block) {
      block = { unit: null, side: null, entries: [] }
      turn.blocks.push(block)
    }
    block.entries.push({ ...entry, index, kind: logKind(entry.text) })
    if (/ ends its activation;/.test(entry.text)) block = null
  })
  return turns
}

// ---- The recap: the last few goes, each summed up in a line.

export interface RecapGroup {
  key: number
  side: SideId | null
  title: string
  headline: string
  lines: PlayLine[]
  turn: number
}

/** Events grouped into goes: an activation with its moves and shots and the fire that answered them. */
export function recapGroups(events: readonly PlayEvent[]): RecapGroup[] {
  const groups: Array<{ events: PlayEvent[] }> = []
  for (const e of events) {
    if (e.kind === 'deploy') continue
    if (e.opens || groups.length === 0) groups.push({ events: [e] })
    else groups[groups.length - 1]!.events.push(e)
  }
  // A go worth recalling did something on the table; deploying and choosing who starts are not.
  const worth = groups.filter((g) => g.events.some((e) => !QUIET_KINDS.has(e.kind) && (e.lines.length > 0 || e.kind === 'activate')))
  return worth.map((g) => {
    const first = g.events[0]!
    let lines = g.events.flatMap((e) => e.lines)
    // A company's worth of moves reads as one line.
    const moves = lines.filter((l) => l.tone === 'move')
    if (moves.length > 3) {
      const at = lines.indexOf(moves[0]!)
      lines = lines.filter((l) => l.tone !== 'move')
      lines.splice(at, 0, { text: `${moves.length} elements moved.`, tone: 'move' })
    }
    return { key: first.seq, side: first.side, title: first.title, headline: headlineOf(g.events), lines, turn: first.turn }
  })
}

function headlineOf(events: readonly PlayEvent[]): string {
  const first = events[0]!
  const verbs: string[] = []
  const add = (v: string) => {
    if (!verbs.includes(v)) verbs.push(v)
  }
  for (const e of events) {
    if (e.kind === 'move') add('moved')
    else if (e.kind === 'fire') add('fired')
    else if (e.kind === 'opportunity-fire') add('drew fire')
    else if (e.kind === 'posture') add('took cover')
    else if (e.kind === 'call-orbital') add('called fire from orbit')
  }
  const results = [
    ...new Set(
      events
        .flatMap((e) => e.lines)
        .filter((l) => l.tone === 'kill' || l.tone === 'hit')
        .map((l) => `${l.text.replace(/^.* → /, '')} ${l.stamp?.toLowerCase() ?? ''}`.trim()),
    ),
  ]
  if (verbs.length === 0) return first.kind === 'activate' ? `${first.title} activated and held its ground.` : (first.lines[0]?.text ?? first.title)
  return `${first.title} ${verbs.join(' and ')}${results.length ? `: ${results.slice(0, 3).join(', ')}${results.length > 3 ? '…' : ''}` : ''}.`
}
