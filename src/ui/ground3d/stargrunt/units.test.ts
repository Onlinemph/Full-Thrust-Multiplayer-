import { describe, expect, it } from 'vitest'
import { createGame } from '../../../stargrunt/table/game'
import type { GameSetup } from '../../../stargrunt/types'
import { StargruntUnitsLayer } from './units'

// This suite runs in vitest's plain Node environment (no jsdom): `units.ts`
// only ever needs a `div`-shaped object to hang a `CSS2DObject` off (a
// settable `style`, `className`/`innerHTML`, `setAttribute`, a no-op
// `remove`, and enough of `ownerDocument`/`defaultView` for three's own
// CSS2DObject to recognise it as an Element when detaching one on removal).
if (typeof document === 'undefined') {
  class FakeElement {
    style = {}
    parentNode: unknown = null
    setAttribute(): void {}
    remove(): void {
      this.parentNode = null
    }
  }
  const fakeWindow = { Element: FakeElement }
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => Object.assign(new FakeElement(), { ownerDocument: { defaultView: fakeWindow } }),
  }
}

const SETUP: GameSetup = {
  name: 'test',
  seed: 1,
  battle: 'encounter',
  table: { width: 48, depth: 36, terrain: [], objectives: [] },
  sides: [
    {
      id: 'north',
      name: 'North',
      motivation: 'medium',
      units: [
        {
          id: 'n1',
          name: 'North Squad',
          quality: 'regular',
          leadership: 2,
          armour: 'partial-light',
          mobility: 'foot',
          commandLevel: 'squad',
          figures: [{ id: 'n1-1', smallArm: 'advanced-rifle', leader: true, position: { x: 5, y: 5 } }],
        },
      ],
    },
    { id: 'south', name: 'South', motivation: 'medium', units: [] },
  ],
  turnLimit: null,
}

const OPTS = { heightAt: () => 0, selectedUnitId: null }

describe('StargruntUnitsLayer.dispose (R13)', () => {
  it('leaves its persistent sub-groups empty, so a later update() never doubles up on stale, still-parented figures/pennants', () => {
    const layer = new StargruntUnitsLayer()
    const game = createGame(SETUP)
    layer.update(game, OPTS)
    // Simulates React StrictMode's dev-only double mount: this same layer
    // instance is disposed by one `GroundScene`'s teardown, then immediately
    // handed to a freshly constructed one and updated again.
    layer.dispose()
    layer.update(game, OPTS)

    const pennants = layer.group.children.flatMap((g) => g.children).filter((o) => (o as { isCSS2DObject?: boolean }).isCSS2DObject)
    expect(pennants.length).toBe(1)
    expect(layer.pickables().length).toBe(1)
  })
})
