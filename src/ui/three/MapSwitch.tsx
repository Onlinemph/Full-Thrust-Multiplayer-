/**
 * The "Map: 2D / 3D" switch — kept out of `App.tsx`'s own bulk and, more to
 * the point, out of the lazy 3D chunk: this file imports no three.js, so the
 * switch itself (and the choice, remembered per browser) costs nothing for a
 * player who never picks 3D. `BattleView3D` is the one `React.lazy` import
 * in the app, loaded only once `mode` first becomes `'3d'`.
 */
import { lazy, useState } from 'react'

export type MapMode = '2d' | '3d'

const KEY = 'ft-map-view'

function readStored(): MapMode {
  try {
    return localStorage.getItem(KEY) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

/** The player's map choice, remembered per browser (localStorage; falls back to '2d' if it is unavailable). */
export function useMapView(): [MapMode, (mode: MapMode) => void] {
  const [mode, setModeState] = useState<MapMode>(readStored)
  const setMode = (next: MapMode) => {
    setModeState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private browsing, storage disabled: the choice just does not survive a reload.
    }
  }
  return [mode, setMode]
}

/** three.js stays out of the main bundle until this is actually rendered. */
export const BattleView3D = lazy(() => import('./BattleView3D'))

export function MapModeChips({ mode, onChange }: { mode: MapMode; onChange: (mode: MapMode) => void }) {
  return (
    <div className="map-mode-switch" role="group" aria-label="Map view">
      <span>Map</span>
      <button type="button" className={mode === '2d' ? 'is-on' : undefined} onClick={() => onChange('2d')}>
        2D
      </button>
      <button type="button" className={mode === '3d' ? 'is-on' : undefined} onClick={() => onChange('3d')}>
        3D
      </button>
    </div>
  )
}
