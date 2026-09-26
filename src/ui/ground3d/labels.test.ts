import { describe, expect, it } from 'vitest'
import { declutterLabels, type DeclutterCandidate } from './labels'

/** A fake label element: just enough of `HTMLElement` for `declutterLabels` to read/write (K2). */
function fakeLabel(rect: { left: number; top: number; width: number; height: number }): HTMLElement {
  const style: Record<string, string> = {}
  return {
    style,
    getBoundingClientRect: () => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}) }),
  } as unknown as HTMLElement
}

function candidate(rect: { left: number; top: number; width: number; height: number }, priority: number, distance: number): DeclutterCandidate {
  return { element: fakeLabel(rect), priority, distance }
}

describe('declutterLabels (K2)', () => {
  it('keeps the nearest of two overlapping same-priority labels and fades the other', () => {
    const near = candidate({ left: 100, top: 200, width: 40, height: 16 }, 2, 5)
    const far = candidate({ left: 108, top: 204, width: 40, height: 16 }, 2, 20)
    declutterLabels([near, far], 0)
    expect(near.element.style.opacity).toBe('1')
    expect(far.element.style.opacity).toBe('0')
  })

  it('never fades the hovered target (priority 0) or the selected unit (priority 1) for crowding', () => {
    const hovered = candidate({ left: 100, top: 200, width: 40, height: 16 }, 0, 50)
    const selected = candidate({ left: 105, top: 202, width: 40, height: 16 }, 1, 60)
    const rest = candidate({ left: 102, top: 201, width: 40, height: 16 }, 2, 1)
    declutterLabels([hovered, selected, rest], 0)
    expect(hovered.element.style.opacity).toBe('1')
    expect(selected.element.style.opacity).toBe('1')
    // "the rest" loses to both never-fade tiers even though it is nearest the camera.
    expect(rest.element.style.opacity).toBe('0')
  })

  it('keeps labels that do not overlap anything, however many there are', () => {
    const a = candidate({ left: 0, top: 100, width: 20, height: 10 }, 2, 1)
    const b = candidate({ left: 200, top: 100, width: 20, height: 10 }, 2, 2)
    const c = candidate({ left: 400, top: 100, width: 20, height: 10 }, 2, 3)
    declutterLabels([a, b, c], 0)
    expect(a.element.style.opacity).toBe('1')
    expect(b.element.style.opacity).toBe('1')
    expect(c.element.style.opacity).toBe('1')
  })

  it('fades a label straying above the HUD safe margin even when nothing else overlaps it', () => {
    const underHud = candidate({ left: 500, top: 5, width: 40, height: 16 }, 0, 1)
    declutterLabels([underHud], 0, 60)
    expect(underHud.element.style.opacity).toBe('0')
  })

  it('skips a zero-sized (CSS2DRenderer-hidden) label instead of letting it block real ones', () => {
    const hidden = candidate({ left: 100, top: 200, width: 0, height: 0 }, 2, 1)
    const real = candidate({ left: 100, top: 200, width: 40, height: 16 }, 2, 2)
    declutterLabels([hidden, real], 0)
    expect(real.element.style.opacity).toBe('1')
  })
})
