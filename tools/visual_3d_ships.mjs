/**
 * SHIPS's own screenshot check for the 3D battle view.
 *
 * `tools/visual_3d.mjs` (BASE's own harness) imports Playwright as a bare
 * specifier, which this sandbox never installs into the project's
 * `node_modules` — only a global copy under `/opt/node22/lib/node_modules`
 * that Node's ESM resolver does not consult for a bare import. Rather than
 * edit BASE's file, this is its own script, pointed at that install by an
 * absolute path, running the same opening moves and then a few closer looks
 * `ships.ts`/`hulls.ts` need eyes on: hull variety across designs, screens
 * live from turn one, and, forced by mutating the live `GameState`
 * `window.__fullThrust` exposes (the engine mutates it in place) and
 * re-running `window.__battle3d`'s own `update` directly rather than through
 * `dispatch` (which also runs the computer's turn and a full journal/autosave
 * pass — a much bigger hammer than a screenshot needs), a crippled wash, a
 * drifting wreck and a cloak's ghost, none of which a fresh battle shows on
 * its own.
 *
 *   SHOT_DIR=/path/to/shots DRIVE_URL=http://localhost:5242/ node tools/visual_3d_ships.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/three-ships'
const base = process.env.DRIVE_URL ?? 'http://localhost:5242/'
mkdirSync(SHOT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

let failed = 0
const fail = (msg) => {
  failed++
  console.log(`FAIL     ${msg}`)
}
const shot = (name) => page.screenshot({ path: join(SHOT_DIR, name) })

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New battle' }).click()
  // Both sides human-controlled, so a later forced `dispatch` never wakes an
  // AI turn — the same toggle `visual_3d.mjs` sets.
  const toggles = page.locator('.modal label.rule-toggle:has(.rule-detail:text-is("you"))')
  if ((await toggles.count()) > 1) await toggles.nth(1).locator('input').check()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await page.waitForSelector('.end-phase')

  await page.locator('.map-mode-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__battle3d), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await shot('01-overview.png')

  const ships = await page.evaluate(() => {
    const g = window.__fullThrust.currentGame()
    return g.ships
      .filter((s) => !s.destroyed && !s.offTable)
      .map((s) => ({ id: s.id, name: s.name, designId: s.design.id, mass: s.design.mass, screens: s.design.screens.level }))
  })
  console.log(`ok       ${ships.length} ship(s) on the table: ${[...new Set(ships.map((s) => s.designId))].join(', ')}`)

  // One close-up per distinct design, so the extruded hull's own shape is
  // actually checked rather than just "a" hull.
  const byDesign = new Map()
  for (const s of ships) if (!byDesign.has(s.designId)) byDesign.set(s.designId, s)
  let i = 0
  for (const s of byDesign.values()) {
    await page.evaluate((id) => window.__battle3d.focusShip(id, 6, true), s.id)
    await page.waitForTimeout(500)
    await shot(`02-hull-${i}-${s.designId}.png`)
    i += 1
  }

  const labels = await page.evaluate(() => document.querySelectorAll('.l3d-name').length)
  if (labels < ships.length) fail(`fewer name labels (${labels}) than ships on the table (${ships.length})`)
  else console.log(`ok       ${labels} ship label(s) drawn`)

  // A FireCon target ring: assign one directly (phase 1's ship-fire lock,
  // 4.4) if the current phase does not already let a click do it, so the
  // ring in `ships.ts` gets exercised without stepping the whole turn.
  const shielded = ships.find((s) => s.screens > 0) ?? ships[0]
  if (shielded) {
    await page.evaluate((id) => window.__battle3d.focusShip(id, 6, true), shielded.id)
    await page.waitForTimeout(500)
    await shot('03-screens.png')
  }

  // Force the states a fresh battle never shows: crippled, destroyed and
  // cloaked, by mutating the live `GameState` (the engine mutates it in
  // place already) and re-running the scene's own `update` directly —
  // `dispatch` also runs `runAi()` and a full journal/autosave pass, which
  // is a much bigger hammer than a screenshot needs and, against this
  // scenario's computer-controlled side, redraws the 2D panels without ever
  // reaching the mounted 3D scene.
  const marks = await page.evaluate(() => {
    const scene = window.__battle3d
    const g = window.__fullThrust.currentGame()
    const pick = (i) => g.ships.filter((s) => !s.offTable)[i]
    const a = pick(0)
    const b = pick(1)
    const c = pick(2)
    const out = {}
    if (a) {
      a.hullMarked = Math.max(1, Math.round(a.design.hullBoxes * 0.9))
      out.crippled = { id: a.id, name: a.name }
    }
    if (b) {
      b.destroyed = true
      out.destroyed = { id: b.id, name: b.name }
    }
    if (c) {
      c.cloaked = true
      out.cloaked = { id: c.id, name: c.name }
    }
    scene.update(g, scene.view, scene.callbacks)
    return out
  })
  await page.waitForTimeout(700)
  await shot('04-damage-states.png')
  if (marks.crippled) {
    await page.evaluate((id) => window.__battle3d.focusShip(id, 6, true), marks.crippled.id)
    await page.waitForTimeout(500)
    await shot('05-crippled.png')
  }
  if (marks.destroyed) {
    await page.evaluate((id) => window.__battle3d.focusShip(id, 6, true), marks.destroyed.id)
    await page.waitForTimeout(900) // let the wreck's tumble show it is actually turning
    await shot('06-wreck.png')
  }
  if (marks.cloaked) {
    await page.evaluate((id) => window.__battle3d.focusShip(id, 6, true), marks.cloaked.id)
    await page.waitForTimeout(500)
    await shot('07-cloaked.png')
  }

  const canvas = page.locator('canvas.battle3d-canvas')
  const shotBuf = await canvas.screenshot()
  const lit = await page.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((resolve) => {
      img.onload = resolve
      img.src = `data:image/png;base64,${b64}`
    })
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++
    return n / (d.length / 4)
  }, shotBuf.toString('base64'))
  if (lit <= 0.01) fail(`canvas looks empty (${(lit * 100).toFixed(2)}% lit)`)
  else console.log(`ok       canvas is drawing something (${(lit * 100).toFixed(2)}% lit)`)
} catch (e) {
  failed++
  console.log(`ERROR    ${e.message.split('\n')[0]}`)
  await shot('error.png').catch(() => {})
}

if (errors.length > 0) {
  failed++
  console.log(`Page errors:\n  ${[...new Set(errors)].join('\n  ')}`)
}

await browser.close()
console.log(failed === 0 ? '\nships visual check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
