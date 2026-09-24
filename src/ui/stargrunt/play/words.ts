/**
 * A refusal's "what to do instead" (K4), for Stargrunt's own reasons
 * (`game.ts`'s `refuse(...)` calls) — Dirtside's `dirtside/play/words.ts`
 * `adviceFor` is tuned to its own vocabulary ("line of sight", "fixed
 * mount", …) and never matches these, so `RefusalToast` gives up silently.
 * `RefusalToast` takes this as an optional `adviceFor` prop; Dirtside's own
 * screen keeps passing its own function, untouched.
 */
export function adviceFor(reason: string): string | null {
  if (/disorganised and must reorganise/.test(reason)) return 'Reorganise first to pull the figures back into integrity.'
  if (/travel-formed and may only move or reorganise/.test(reason)) return 'Reorganise to fall out of the travel column before doing anything else.'
  if (/suppressed in the open and cannot reorganise/.test(reason)) return 'Remove suppression first, then reorganise once it is gone.'
  if (/is suppressed: only reorganise/.test(reason)) return 'Try Reorganise (if in cover) or Remove suppression instead.'
  if (/is broken and fires only once it has been fired on/.test(reason)) return 'Wait for the enemy to fire on this unit first, or act with another unit.'
  if (/is broken and must move to the nearest cover/.test(reason)) return 'Plot the move into the nearest cover instead of open ground.'
  if (/is broken and may leave cover only to withdraw/.test(reason)) return 'Move it further from the enemy, or hold it in cover.'
  if (/is routed and will not fire/.test(reason)) return 'A routed unit only withdraws; try Move instead.'
  if (/is routed and must withdraw/.test(reason)) return 'Plot the move away from the enemy baseline.'
  if (/must close assault with both of its actions/.test(reason)) return 'Close assault only as the first action of the activation, with both actions still free.'
  if (/beyond the reach of two combat moves/.test(reason)) return 'Move closer first, or pick a nearer enemy unit.'
  if (/charge must end in base contact/.test(reason)) return 'Every charging figure needs a path ending against the target.'
  if (/has no one left to (fight|hit)/.test(reason)) return 'Pick a unit that still has figures able to fight.'
  if (/'s weapon has fired this turn|small arms have fired this turn/.test(reason)) return 'Fire with a different weapon, or wait for next turn.'
  if (/has no support weapon/.test(reason)) return 'Pick a figure carrying a support weapon.'
  if (/has already attempted two transfers/.test(reason)) return 'This unit is done handing off activations for the turn.'
  if (/No line of sight/.test(reason)) return 'Move to a spot with a clear line, or choose another target.'
  if (/is within a wood: direct fire cannot reach it/.test(reason)) return 'Only figures at the wood’s edge can be seen or seen from.'
  if (/leaves the table/.test(reason)) return 'Keep every waypoint on the table.'
  if (/Deploy inside your own deployment zone/.test(reason)) return 'Click inside your own shaded strip.'
  if (/A side may pass only with fewer/.test(reason)) return 'Activate a unit instead — passing needs fewer units left than the enemy.'
  return null
}
