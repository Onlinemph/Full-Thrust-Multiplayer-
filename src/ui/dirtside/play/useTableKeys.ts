import { useEffect, useRef } from 'react'

import type { Posture } from '../../../dirtside/table/types'

/**
 * The Dirtside table from the keyboard, as the fleet table plays: cycle the
 * elements, plot, fire, confirm, end. Nothing here can do what a click
 * cannot; every key ends in the same handler as its button, and a handler
 * the screen leaves out means the key does nothing now.
 */
export interface TableKeys {
  /** Tab / n: the next element with something left to do (or the next unit to pick); Shift+Tab back. */
  next?: (back: boolean) => void
  /** Esc: cancel the mode, or let go of the selection. */
  cancel?: () => void
  /** M: plot a move. */
  plot?: () => void
  /** Backspace: take off the last waypoint. */
  undoPoint?: () => void
  /** Enter / Space: the one thing to press next. */
  primary?: () => void
  /** 1–4: arm weapon N. */
  arm?: (index: number) => void
  /** F: fire the volley. */
  fire?: () => void
  /** U / H / T: up, hull down, turret down. */
  stance?: (posture: Posture) => void
  /** E: end the activation. */
  end?: () => void
  /** A: activate the selected unit. */
  activate?: () => void
  /** ?: the guide. */
  guide?: () => void
  /** Ctrl+Z: take back a move that rolled no dice. */
  takeBack?: () => void
}

/** The keys as the guide lists them. */
export const KEY_LIST: ReadonlyArray<readonly [string, string]> = [
  ['Tab', 'next element still to act (Shift+Tab back); between activations, the next unit'],
  ['Enter', 'the orange button: confirm a move, fire, end, ready'],
  ['M', 'plot a move for the selected element'],
  ['Backspace', 'take off the last waypoint'],
  ['Esc', 'cancel what you are doing, or let go of the selection'],
  ['1–4', 'pick weapon 1 to 4'],
  ['F', 'fire the volley'],
  ['U H T', 'stance: in the open, hull down, turret down'],
  ['A', 'activate the selected unit'],
  ['E', 'end the activation'],
  ['Ctrl+Z', 'take back a move that rolled no dice'],
  ['?', 'this guide'],
]

export function useTableKeys(keys: TableKeys, suspended: boolean): void {
  // The handlers change every render; the listener reads the latest through a ref and is added once.
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    if (suspended) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
      const k = ref.current
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z') {
        if (k.takeBack) {
          event.preventDefault()
          k.takeBack()
        }
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const run = (f: (() => void) | undefined) => {
        if (!f) return
        event.preventDefault()
        f()
      }
      // A focused button answers Enter and Space itself; the table's primary is only for when nothing is focused.
      const onButton = target?.tagName === 'BUTTON' || target?.tagName === 'SUMMARY'
      switch (event.key) {
        case 'Tab':
          // Tab still walks the controls once one has focus; from the table it walks the elements.
          if (k.next && !target?.closest('button, a, summary, [tabindex]')) run(() => k.next!(event.shiftKey))
          break
        case 'n':
          if (k.next) run(() => k.next!(false))
          break
        case 'Escape':
          run(k.cancel)
          break
        case 'm':
        case 'M':
          run(k.plot)
          break
        case 'Backspace':
          run(k.undoPoint)
          break
        case 'Enter':
        case ' ':
          if (!onButton) run(k.primary)
          break
        case '1':
        case '2':
        case '3':
        case '4':
          if (k.arm) run(() => k.arm!(Number(event.key) - 1))
          break
        case 'f':
        case 'F':
          run(k.fire)
          break
        case 'u':
        case 'U':
          if (k.stance) run(() => k.stance!('none'))
          break
        case 'h':
        case 'H':
          if (k.stance) run(() => k.stance!('hull-down'))
          break
        case 't':
        case 'T':
          if (k.stance) run(() => k.stance!('turret-down'))
          break
        case 'e':
        case 'E':
          run(k.end)
          break
        case 'a':
        case 'A':
          run(k.activate)
          break
        case '?':
          run(k.guide)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [suspended])
}
