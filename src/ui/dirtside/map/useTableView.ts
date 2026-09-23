import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import type { Point } from '../../../dirtside/table/types'

/**
 * The map's view of the table: which inch sits at the pane's top-left
 * corner and how many pixels an inch takes. The view is fitted to the pane
 * until the player zooms or pans, and it holds still while the page around
 * it shifts a little: a pane that grows by a line, or shrinks into the room
 * it has to spare, leaves every model where it was on screen, so nothing
 * jumps from under the pointer. It is fitted again only when the pane
 * changes by more than REFIT_PX, when it could no longer hold the table and
 * its margins (the scale then only ever steps down to the smallest pane it
 * has had, once), when the window is resized, or when the player asks for
 * the whole table.
 */

/** Where the pane stands on the page and its size, in CSS pixels. */
export interface Pane {
  w: number
  h: number
  left: number
  top: number
}

/** The inch at the pane's top-left corner and the scale, in pixels per inch. */
export interface Frame {
  x: number
  y: number
  ppi: number
}

/** Room around the table in inches, for the rulers and the margin lettering. */
export interface Margin {
  left: number
  right: number
  top: number
  bottom: number
}

/** A frame and the pane it was set for: the pane may since have moved or changed size. */
interface Anchored {
  frame: Frame
  pane: Pane
}

/** How far the pane may change size, in pixels, before a fitted view is fitted again. */
export const REFIT_PX = 40
/** The scale used before the pane has been measured. */
const FIRST_PPI = 20

/** The whole table and its margins, centred in the pane. */
export function fitFrame(W: number, D: number, pane: Pane, m: Margin): Frame {
  const bw = W + m.left + m.right
  const bh = D + m.top + m.bottom
  const ppi = pane.w > 0 && pane.h > 0 ? Math.min(pane.w / bw, pane.h / bh) : FIRST_PPI
  const w = pane.w > 0 ? pane.w / ppi : bw
  const h = pane.h > 0 ? pane.h / ppi : bh
  return { x: -m.left - (w - bw) / 2, y: -m.top - (h - bh) / 2, ppi }
}

/** The frame as it stands now: moved by as much as the pane moved, so the table stays put on screen. */
function follow(base: Anchored, pane: Pane): Frame {
  const { frame } = base
  return { x: frame.x + (pane.left - base.pane.left) / frame.ppi, y: frame.y + (pane.top - base.pane.top) / frame.ppi, ppi: frame.ppi }
}

const between = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A fitted frame nudged no more than it must: the table and its margins stay
 * in sight where the pane still holds them, and where it is a few pixels
 * short of that, the margins give way and the table itself stays in sight.
 */
export function keepInSight(f: Frame, pane: Pane, W: number, D: number, m: Margin): Frame {
  if (pane.w <= 0 || pane.h <= 0) return f
  const axis = (at: number, view: number, lo: number, hi: number, size: number) => {
    if (hi - lo <= view) return between(at, hi - view, lo)
    if (size <= view) return between(at, size - view, 0)
    return at
  }
  return { ppi: f.ppi, x: axis(f.x, pane.w / f.ppi, -m.left, W + m.right, W), y: axis(f.y, pane.h / f.ppi, -m.top, D + m.bottom, D) }
}

/** How many pixels of the margins may give way before a fitted view is fitted again to keep them, and what flies in them, in sight. */
export const MARGIN_GIVE_PX = 6

/** Whether the table and its margins still fit the pane at a scale, give or take MARGIN_GIVE_PX. */
const holdsTable = (pane: Pane, ppi: number, W: number, D: number, m: Margin) =>
  pane.w >= (W + m.left + m.right) * ppi - MARGIN_GIVE_PX && pane.h >= (D + m.top + m.bottom) * ppi - MARGIN_GIVE_PX

function measure(el: SVGSVGElement): Pane {
  const r = el.getBoundingClientRect()
  // Page coordinates, so scrolling the page does not count as the pane moving.
  return { w: r.width, h: r.height, left: r.left + window.scrollX, top: r.top + window.scrollY }
}

export interface TableView {
  pane: Pane
  frame: Frame
  /** The viewBox in inches. */
  box: { x: number; y: number; w: number; h: number }
  /** Zoom by a factor on the view's width (above 1 zooms out), holding a point of the table still. */
  zoomAt: (factor: number, at: Point | null) => void
  /** Put the view's top-left corner at this inch, at the current scale. */
  panTo: (x: number, y: number) => void
  /** Fit the whole table to the pane as it is now. */
  fit: () => void
}

export function useTableView(svg: RefObject<SVGSVGElement | null>, W: number, D: number, margin: Margin, readOnly: boolean): TableView {
  const [pane, setPane] = useState<Pane>({ w: 0, h: 0, left: 0, top: 0 })
  const [fitted, setFitted] = useState<Anchored | null>(null)
  const [chosen, setChosen] = useState<Anchored | null>(null)

  // The observer and the window listener read the latest values through refs.
  const latest = useRef({ W, D, margin, readOnly, pane, fitted, chosen })
  latest.current = { W, D, margin, readOnly, pane, fitted, chosen }

  const refit = useCallback((p: Pane) => {
    const { W: w, D: d, margin: m } = latest.current
    const next = { frame: fitFrame(w, d, p, m), pane: p }
    latest.current.fitted = next
    setFitted(next)
  }, [])

  /** A new measure of the pane: refit when it changed a lot, it no longer holds the table, the window was resized, or this is a preview. */
  const onPane = useCallback(
    (p: Pane, force: boolean) => {
      if (p.w <= 0 || p.h <= 0) return
      setPane((old) => (Math.abs(old.w - p.w) < 0.5 && Math.abs(old.h - p.h) < 0.5 && Math.abs(old.left - p.left) < 0.5 && Math.abs(old.top - p.top) < 0.5 ? old : p))
      latest.current.pane = p
      const { fitted: f, readOnly: preview, W: w, D: d, margin: m } = latest.current
      if (force || preview || !f || Math.abs(p.w - f.pane.w) > REFIT_PX || Math.abs(p.h - f.pane.h) > REFIT_PX || !holdsTable(p, f.frame.ppi, w, d, m)) refit(p)
    },
    [refit],
  )

  useEffect(() => {
    const el = svg.current
    if (!el) return
    onPane(measure(el), true)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => onPane(measure(el), false))
    observer.observe(el)
    const onWindow = () => onPane(measure(el), true)
    window.addEventListener('resize', onWindow)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onWindow)
    }
  }, [svg, onPane])

  // A new table, or a switch between preview and play: start again from the whole table.
  useEffect(() => {
    setChosen(null)
    const el = svg.current
    if (el) onPane(measure(el), true)
  }, [W, D, readOnly, svg, onPane])

  const frame = chosen ? follow(chosen, pane) : fitted ? keepInSight(follow(fitted, pane), pane, W, D, margin) : fitFrame(W, D, pane, margin)
  const bw = W + margin.left + margin.right
  const bh = D + margin.top + margin.bottom
  const box = { x: frame.x, y: frame.y, w: pane.w > 0 ? pane.w / frame.ppi : bw, h: pane.h > 0 ? pane.h / frame.ppi : bh }
  const current = useRef({ frame, box, pane })
  current.current = { frame, box, pane }

  /** Keep at least a quarter of the table in sight. */
  const choose = useCallback((f: Frame) => {
    const { W: w, D: d } = latest.current
    const p = current.current.pane
    const vw = p.w > 0 ? p.w / f.ppi : w
    const vh = p.h > 0 ? p.h / f.ppi : d
    const next = { ppi: f.ppi, x: Math.min((3 * w) / 4, Math.max(w / 4 - vw, f.x)), y: Math.min((3 * d) / 4, Math.max(d / 4 - vh, f.y)) }
    setChosen({ frame: next, pane: p })
  }, [])

  const zoomAt = useCallback(
    (factor: number, at: Point | null) => {
      const { frame: f, box: b, pane: p } = current.current
      const { W: w } = latest.current
      const width = p.w > 0 ? p.w : b.w * f.ppi
      // Between 6" across and twice the table's width.
      const ppi = Math.min(width / 6, Math.max(width / (w * 2), f.ppi / factor))
      const c = at ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 }
      const s = f.ppi / ppi
      choose({ ppi, x: c.x - (c.x - f.x) * s, y: c.y - (c.y - f.y) * s })
    },
    [choose],
  )

  const panTo = useCallback((x: number, y: number) => choose({ ppi: current.current.frame.ppi, x, y }), [choose])

  const fit = useCallback(() => {
    setChosen(null)
    const el = svg.current
    if (el) onPane(measure(el), true)
  }, [svg, onPane])

  return { pane, frame, box, zoomAt, panTo, fit }
}
