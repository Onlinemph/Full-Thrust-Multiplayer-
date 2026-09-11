import { useSyncExternalStore } from 'react'

import { activeFx, subscribeFx, type BattleFx } from './fx'

/**
 * The effects currently playing. A separate hook from the game store because
 * effects change on their own schedule — they expire on a timer — and a map
 * that re-rendered the whole battle to drop a spent flash would be wasteful.
 */
export function useFx(): BattleFx[] {
  return useSyncExternalStore(subscribeFx, activeFx, activeFx)
}
