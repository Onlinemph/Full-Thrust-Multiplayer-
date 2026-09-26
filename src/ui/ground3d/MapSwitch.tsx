/**
 * The "Map: 2D / 3D" switch each table screen mounts — `src/ui/three/
 * MapSwitch.tsx`'s own idea, generalised over the storage key so Dirtside
 * and Stargrunt each remember their own choice. This file imports no
 * three.js, so the switch itself costs nothing for a player who never picks
 * 3D — each game's own `React.lazy(() => import('./dirtside/DirtsideView3D'))`
 * (or Stargrunt's) is the one import that actually pulls the lazy chunk in.
 */
import { useState } from 'react'

export type MapMode = '2d' | '3d'

function readStored(key: string): MapMode {
  try {
    return localStorage.getItem(key) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

/** The player's map choice for one game, remembered per browser (falls back to '2d' if storage is unavailable). */
export function useMapView(storageKey: string): [MapMode, (mode: MapMode) => void] {
  const [mode, setModeState] = useState<MapMode>(() => readStored(storageKey))
  const setMode = (next: MapMode) => {
    setModeState(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Private browsing, storage disabled: the choice just does not survive a reload.
    }
  }
  return [mode, setMode]
}

export function MapModeChips({ mode, onChange }: { mode: MapMode; onChange: (mode: MapMode) => void }) {
  return (
    <div className="g3d-map-switch" role="group" aria-label="Map view">
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
