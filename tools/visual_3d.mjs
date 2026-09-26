/**
 * A screenshot check for the 3D battle view (ft3d).
 *
 *   node tools/visual_3d.mjs
 *   SHOT_DIR=/path/to/shots DRIVE_URL=http://localhost:5241/ node tools/visual_3d.mjs
 *
 * Starts a battle exactly as `drive_vs_computer.mjs` does, flips the map
 * switch to 3D, and photographs the canvas. Its own vite server on 5199 with
 * `strictPort: false` (as StarForce's own visual harness does), so it never
 * touches whatever else is already listening there — pass `DRIVE_URL` to
 * point it at a server you started yourself instead (this worktree's own
 * dev server, say).
 *
 * WebGL output is not pixel-stable enough for a baseline (hulls bob, bloom
 * is resolution-dependent), so this checks that the view *works* rather than
 * how it looks: the scene starts, draws something that is not empty space, at
 * least one hull is labelled, and a click on a hull selects it — the same bar
 * StarForce's own "three" fixture sets. Screenshots always get written, pass
 * or fail, so a person can look at them.
 */
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/three'
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
const page = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

let failed = 0
const fail = (msg) => {
  failed++
  console.log(`FAIL     ${msg}`)
}

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New battle' }).click()
  const toggles = page.locator('.modal label.rule-toggle:has(.rule-detail:text-is("you"))')
  if ((await toggles.count()) > 1) await toggles.nth(1).locator('input').check()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await page.waitForSelector('.end-phase')
  await page.screenshot({ path: join(SHOT_DIR, '01-2d-open.png') })

  const shipCount = await page.evaluate(() => {
    const g = window.__fullThrust.currentGame()
    return g.ships.filter((s) => !s.destroyed && !s.offTable).length
  })
  if (shipCount === 0) fail(`no ships on the table at battle start (${shipCount})`)

  await page.locator('.map-mode-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean((window).__battle3d), null, { timeout: 30000 })
  // Let the frame loop settle: layers built, first camera fly-to finished.
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(SHOT_DIR, '02-3d-open.png') })

  const canvas = page.locator('canvas.battle3d-canvas')
  const shot = await canvas.screenshot()
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
  }, shot.toString('base64'))
  if (lit <= 0.01) fail(`canvas looks empty (${(lit * 100).toFixed(2)}% lit)`)
  else console.log(`ok       canvas is drawing something (${(lit * 100).toFixed(2)}% lit)`)

  const labels = await page.evaluate(() => document.querySelectorAll('.l3d-name').length)
  if (labels < 1) fail(`no ship name labels found (${labels})`)
  else console.log(`ok       ${labels} ship label(s) drawn`)

  // The second ship, not the first: phase 1 auto-selects the first ship
  // awaiting orders (`selectNextOwing`), and clicking an already-selected
  // hull toggles it off (exactly as the 2D counter's own onClick does) —
  // picking a different one keeps this a plain "does a click select" check.
  const id = await page.evaluate(() => {
    const g = window.__fullThrust.currentGame()
    return g.ships.filter((s) => !s.destroyed && !s.offTable)[1]?.id ?? null
  })
  if (id) {
    await page.evaluate((shipId) => (window).__battle3d.focusShip(shipId, 6, true), id)
    await page.waitForTimeout(400)
    const xy = await page.evaluate((shipId) => {
      const s = (window).__battle3d
      const p = s.ships.drawnPosition(shipId)
      const v = s.camera.position.clone().set(p.x, 0.3, p.z).project(s.camera)
      const r = s.renderer.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }, id)
    await page.mouse.click(xy.x, xy.y)
    await page.waitForTimeout(300)
    const picked = await page.evaluate(() => (window).__battle3d.view?.selectedId ?? null)
    if (picked !== id) fail(`click on a hull did not select it (expected ${id}, got ${picked})`)
    else console.log('ok       click on a hull selects it')
    await page.screenshot({ path: join(SHOT_DIR, '03-3d-selected.png') })
  } else {
    fail('could not find a ship id to test selection with')
  }
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
console.log(failed === 0 ? '\nft3d visual check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
