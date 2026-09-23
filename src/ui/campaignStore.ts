import { useSyncExternalStore } from 'react'

import {
  applyMove,
  createCampaign,
  journalEntry,
  replayCampaign,
  type MoveOutcome,
} from '../campaign/campaign'
import { parseSavedCampaign } from '../campaign/setup'
import type { CampaignMove, CampaignSetup, CampaignState, SavedCampaign } from '../campaign/types'

/**
 * The campaign on this browser, kept the way the battle is: (setup + journal)
 * in one slot, replayed at boot, every move journalled as it is made —
 * refused moves too, since a refusal is part of the record — and the file a
 * player saves is exactly that record.
 *
 * A campaign battle fought at the table is a battle like any other, on the
 * battle store; the one thing kept here about it is which pending battle it
 * is, so the table knows where to bring the result back to.
 */

const SAVE_KEY = 'ftpc.campaign.v1'
const BATTLE_KEY = 'ftpc.campaign.battle.v1'
const LANDING_KEY = 'ftpc.campaign.landing.v1'

let saved: SavedCampaign | null = null
let state: CampaignState | null = null
let restored = false
/** The pending battle whose game is on the battle table, by id. */
let battleId: string | null = null
/** The landing whose battle is on the Dirtside table, by id. */
let landingId: string | null = null

let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function persist(): void {
  try {
    if (saved) localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
    else localStorage.removeItem(SAVE_KEY)
    if (battleId) localStorage.setItem(BATTLE_KEY, battleId)
    else localStorage.removeItem(BATTLE_KEY)
    if (landingId) localStorage.setItem(LANDING_KEY, landingId)
    else localStorage.removeItem(LANDING_KEY)
  } catch {
    // Quota, or a private window: the campaign plays on and will not survive a refresh.
  }
}

/** Boot, once and late: nothing replays until something asks for the campaign. */
function restore(): void {
  if (restored) return
  restored = true
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SAVE_KEY)
    if (raw) {
      const parsed = parseSavedCampaign(raw)
      if (typeof parsed !== 'string') {
        saved = parsed
        state = replayCampaign(parsed)
      }
    }
    battleId = typeof localStorage === 'undefined' ? null : localStorage.getItem(BATTLE_KEY)
    landingId = typeof localStorage === 'undefined' ? null : localStorage.getItem(LANDING_KEY)
  } catch {
    saved = null
    state = null
    battleId = null
    landingId = null
  }
}

/** The campaign under way, or null. */
export function currentCampaign(): CampaignState | null {
  restore()
  return state
}

export function currentCampaignSetup(): CampaignSetup | null {
  restore()
  return saved?.setup ?? null
}

/** Subscribe a component: the state mutates in place, so the snapshot is a version. */
export function useCampaign(): CampaignState | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
  return currentCampaign()
}

export function newCampaign(setup: CampaignSetup): void {
  restore()
  saved = { version: 1, setup, moves: [] }
  state = createCampaign(setup)
  battleId = null
  landingId = null
  persist()
  emit()
}

/** The one door: apply a move, journal it, keep it. */
export function campaignDispatch(move: CampaignMove): MoveOutcome {
  restore()
  if (!saved || !state) return { refused: 'No campaign is under way' }
  saved.moves.push(journalEntry(state, saved.moves.length + 1, move))
  const outcome = applyMove(state, move)
  persist()
  emit()
  return outcome
}

/** Open a campaign file. Returns an error sentence, or null on success. */
export function loadCampaign(text: string): string | null {
  restore()
  const parsed = parseSavedCampaign(text)
  if (typeof parsed === 'string') return parsed
  let replayed: CampaignState
  try {
    replayed = replayCampaign(parsed)
  } catch (error) {
    return `The campaign file does not replay: ${error instanceof Error ? error.message : String(error)}`
  }
  saved = parsed
  state = replayed
  battleId = null
  landingId = null
  persist()
  emit()
  return null
}

export function exportCampaign(): string {
  restore()
  return JSON.stringify(saved, null, 2)
}

export function abandonCampaign(): void {
  restore()
  saved = null
  state = null
  battleId = null
  landingId = null
  persist()
  emit()
}

/** The pending battle on the battle table, if a campaign battle is being fought. */
export function battleOnTable(): string | null {
  restore()
  return battleId
}

export function setBattleOnTable(id: string | null): void {
  restore()
  battleId = id
  persist()
  emit()
}

/** The landing whose battle is on the Dirtside table, if one is being fought. */
export function landingOnTable(): string | null {
  restore()
  return landingId
}

export function setLandingOnTable(id: string | null): void {
  restore()
  landingId = id
  persist()
  emit()
}

/** A handle for a browser drive in development, as the battle store offers. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __fullThrustCampaign?: unknown }).__fullThrustCampaign = {
    currentCampaign,
    currentCampaignSetup,
    campaignDispatch,
    newCampaign,
  }
}
