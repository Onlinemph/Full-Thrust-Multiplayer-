/**
 * A screenshot check for OVERLAYS's stage-2 work on the 3D battle view
 * (ft3d): the plotted track and move ghost, the fire rose (both the 3D ring
 * `overlays.ts` draws and its DOM legend in `BattleView3D.tsx`'s HUD slot),
 * and the `onHoverArc` wiring between them.
 *
 *   DRIVE_URL=http://localhost:5244/ node tools/visual_overlays.mjs
 *
 * Drives the engine directly through `window.__fullThrust.dispatch` (the
 * same handle `visual_3d.mjs`/`drive_vs_computer.mjs` read) rather than
 * clicking through every phase, so this stays a fast, targeted look at one
 * builder's own layer rather than a full game drive.
 */
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// playwright is a global tool install in this container (`npm root -g`),
// not a repo dependency, and neither ESM `import` nor a plain CJS `require`
// searches that path on its own — so it is loaded from there by name.
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright')

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/overlays'
mkdirSync(SHOT_DIR, { recursive: true })

let server = null
let base = process.env.DRIVE_URL
if (!base) {
  server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' })
  await server.listen()
  base = server.resolvedUrls.local[0]
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

let failed = 0
const fail = (msg) => {
  failed++
  console.log(`FAIL     ${msg}`)
}
const ok = (msg) => console.log(`ok       ${msg}`)

const dispatch = (action) => page.evaluate((a) => window.__fullThrust.dispatch(a), action)
const snap = () =>
  page.evaluate(() => {
    const g = window.__fullThrust.currentGame()
    return {
      phase: g.phase,
      ships: g.ships
        .filter((s) => !s.destroyed && !s.offTable)
        .map((s) => ({ id: s.id, side: s.side, order: s.order !== null, moved: s.lastKnown?.turn === g.turn })),
    }
  })

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New battle' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await page.waitForSelector('.end-phase')
  await page.waitForFunction(() => Boolean(window.__fullThrust?.currentGame()))

  let s = await snap()
  if (s.phase !== 'orders') fail(`expected to start in 'orders', got '${s.phase}'`)

  // A demo ship gets a real course change and a burn, so its track curves and
  // its speed changes — a hold-course order would draw a straight, silent
  // line and prove nothing. Every other ship on the table holds.
  const demoId = s.ships[0].id
  const demoRefused = await dispatch({ type: 'plot-turn', shipId: demoId, direction: 'starboard', points: 2 })
  if (demoRefused.refused) fail(`demo ship's turn was refused: ${demoRefused.refused}`)
  const accelRefused = await dispatch({ type: 'plot-accel', shipId: demoId, accel: 2 })
  if (accelRefused.refused) fail(`demo ship's burn was refused: ${accelRefused.refused}`)
  for (const ship of s.ships) {
    if (ship.id === demoId) continue
    await dispatch({ type: 'plot-accel', shipId: ship.id, accel: 0 })
  }
  s = await snap()
  if (s.ships.some((sh) => !sh.order)) fail(`still ${s.ships.filter((sh) => !sh.order).length} ship(s) without orders`)
  else ok('every ship has an order')

  // Into 3D, still in phase 1: the demo ship's plotted track and move ghost.
  await page.locator('.map-mode-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__battle3d), null, { timeout: 30000 })
  await page.waitForTimeout(1200)
  await page.evaluate((id) => window.__battle3d.focusShip(id, 22, true), demoId)
  await page.waitForTimeout(500)

  const clickHull = async (id) => {
    const xy = await page.evaluate((shipId) => {
      const s = window.__battle3d
      const p = s.ships.drawnPosition(shipId)
      const v = s.camera.position.clone().set(p.x, 0.3, p.z).project(s.camera)
      const r = s.renderer.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }, id)
    await page.mouse.click(xy.x, xy.y)
  }
  // Phase 1 auto-selects the first ship still owing orders (`selectNextOwing`)
  // — often the demo ship itself — and clicking an already-selected hull
  // toggles it off, exactly as the 2D counter's own onClick does. So: select
  // only if the click would not just deselect it.
  const selectDemo = async () => {
    const already = await page.evaluate(() => window.__battle3d.view?.selectedId ?? null)
    if (already !== demoId) await clickHull(demoId)
    await page.waitForTimeout(300)
    return page.evaluate(() => window.__battle3d.view?.selectedId ?? null)
  }
  const selected = await selectDemo()
  if (selected !== demoId) fail(`the demo hull is not selected (got ${selected})`)
  else ok('the demo hull is selected')
  await page.screenshot({ path: join(SHOT_DIR, '01-track-and-ghost.png') })

  const plotLabels = await page.evaluate(() => document.querySelectorAll('.l3d-plot').length)
  if (plotLabels < 1) fail('no plotted-track ghost label found (.l3d-plot)')
  else ok(`${plotLabels} plotted-track ghost label(s) drawn`)
  const ringLabels = await page.evaluate(() => document.querySelectorAll('.l3d-ring').length)
  if (ringLabels < 3) fail(`expected 3 range-ring labels round the selected ship, found ${ringLabels}`)
  else ok(`${ringLabels} range-ring label(s) drawn`)

  // Walk the rest of the turn to phase 11 (ship-fire), where the rose lives.
  const toInitiative = await dispatch({ type: 'advance-phase' })
  if (toInitiative.refused) fail(`advance-phase (orders -> initiative) refused: ${toInitiative.refused}`)
  const rollInit = await dispatch({ type: 'roll-initiative' })
  if (rollInit.refused) fail(`roll-initiative refused: ${rollInit.refused}`)
  let guard = 0
  while ((await snap()).phase !== 'move-ships' && guard++ < 10) {
    const r = await dispatch({ type: 'advance-phase' })
    if (r.refused) {
      fail(`advance-phase refused on the way to move-ships: ${r.refused}`)
      break
    }
  }
  s = await snap()
  for (const ship of s.ships) await dispatch({ type: 'move-ship', shipId: ship.id })
  guard = 0
  while ((await snap()).phase !== 'ship-fire' && guard++ < 10) {
    const r = await dispatch({ type: 'advance-phase' })
    if (r.refused) {
      fail(`advance-phase refused on the way to ship-fire: ${r.refused}`)
      break
    }
  }
  s = await snap()
  if (s.phase !== 'ship-fire') fail(`did not reach ship-fire (stuck at '${s.phase}')`)
  else ok('reached phase 11 (ship-fire)')

  await page.waitForTimeout(300)
  await selectDemo()
  // The stock "Tilt" preset frames the whole fleet, the way a player actually
  // opens phase 11 — a fairer look at the rose's scale than a close focusShip.
  await page.evaluate(() => window.__battle3d.setPreset('tilt', true))
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(SHOT_DIR, '02-fire-rose.png') })
  await page.evaluate((id) => window.__battle3d.focusShip(id, 14, true), demoId)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(SHOT_DIR, '02b-fire-rose-close.png') })

  const roseButtons = await page.evaluate(() => document.querySelectorAll('.battle3d-rose-arc').length)
  if (roseButtons !== 6) fail(`expected 6 fire-rose HUD wedges, found ${roseButtons}`)
  else ok('6 fire-rose HUD wedges drawn')
  const roseLabels = await page.evaluate(() => document.querySelectorAll('.l3d-rose').length)
  if (roseLabels !== 6) fail(`expected 6 fire-rose scene labels, found ${roseLabels}`)
  else ok('6 fire-rose scene labels drawn')

  // Hovering a HUD wedge should light that arc — the 2D rose's own
  // litArcUnderPointer, reached here by a DOM hover instead of a 3D raycast.
  const forwardArc = page.locator('.battle3d-rose-arc').first()
  await forwardArc.hover()
  await page.waitForTimeout(200)
  const lit = await page.evaluate(() => document.querySelector('.battle3d-rose-arc.is-lit')?.textContent ?? null)
  if (!lit) fail('hovering a fire-rose wedge did not light it (onHoverArc did not round-trip)')
  else ok(`hovering a wedge lit it (${lit.replace(/\s+/g, ' ').trim()})`)
  await page.screenshot({ path: join(SHOT_DIR, '03-fire-rose-hover.png') })
} catch (e) {
  failed++
  console.log(`ERROR    ${e.message.split('\n')[0]}`)
  await page.screenshot({ path: join(SHOT_DIR, 'error.png') }).catch(() => {})
}

if (errors.length > 0) {
  failed++
  console.log(`Page errors:\n  ${[...new Set(errors)].join('\n  ')}`)
}

await browser.close()
if (server) await server.close()
console.log(failed === 0 ? '\noverlays visual check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
