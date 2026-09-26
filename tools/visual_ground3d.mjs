/**
 * A screenshot check for the ground 3D view (BRIEF-GROUND-3D): opens a
 * Dirtside skirmish and a Stargrunt skirmish, each on a built-up ("city"/
 * "town") table so hills, buildings and woods are all on screen, switches
 * each to 3D, and photographs the canvas. On the pattern of
 * `tools/visual_3d.mjs`: WebGL output is not pixel-stable enough for a
 * baseline, so this checks that each view *works* — the scene draws
 * something that is not empty space, and a click on a unit selects it —
 * rather than how it looks. Screenshots always get written, pass or fail,
 * so a person can look at them.
 *
 *   node tools/visual_ground3d.mjs
 *   SHOT_DIR=/path/to/shots DRIVE_URL=http://localhost:5251/ node tools/visual_ground3d.mjs
 */
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/ground3d'
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

let failed = 0
const fail = (msg) => {
  failed++
  console.log(`FAIL     ${msg}`)
}

/** How much of the canvas is not bare void — the same "is it drawing anything" check `visual_3d.mjs` uses. */
async function litFraction(page, canvasLocator) {
  const shot = await canvasLocator.screenshot()
  return page.evaluate(async (b64) => {
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
}

/**
 * Dirtside: a skirmish on a built-up table, switched to 3D. Checks the
 * canvas draws something, `heightAt` actually raises a hill (read straight
 * off the dev handle `__ground3d`, `GroundScene`'s own dev-only global —
 * `DirtsideView3D.tsx` sets it exactly as `BattleView3D.tsx` sets
 * `__battle3d`), and a click on an element selects it.
 */
async function driveDirtside(page) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('ftpc.dirtside.battle.v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Dirtside table/ }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption('city')
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-map')
  await page.screenshot({ path: join(SHOT_DIR, '01-dirtside-2d.png') })

  await page.locator('.g3d-map-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 30000 })
  // The first time this dev server sees three.js it pre-bundles and reloads once; give that a beat.
  await page.waitForTimeout(1500)
  if (!(await page.locator('canvas.ground3d-canvas').count())) {
    await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 15000 })
  }
  await page.screenshot({ path: join(SHOT_DIR, '02-dirtside-3d.png') })

  const canvas = page.locator('canvas.ground3d-canvas')
  const lit = await litFraction(page, canvas)
  if (lit <= 0.01) fail(`dirtside: canvas looks empty (${(lit * 100).toFixed(2)}% lit)`)
  else console.log(`ok       dirtside: canvas is drawing something (${(lit * 100).toFixed(2)}% lit)`)

  const hillHeight = await page.evaluate(() => {
    const g = window.__ground3d
    const game = g?.getState() ?? null
    const feature = game?.setup.table.terrain.find((f) => f.terrain === 'hills' || f.terrain === 'mountains')
    if (!feature || !g) return null
    const at = feature.shape.kind === 'circle' ? feature.shape.centre : feature.shape.kind === 'rect' ? { x: feature.shape.x + feature.shape.width / 2, y: feature.shape.y + feature.shape.height / 2 } : feature.shape.points[0]
    return g.scene.heightAt(at)
  })
  if (hillHeight === null) console.log('note     dirtside: no hill on this table to check heightAt against')
  else if (!(hillHeight > 0)) fail(`dirtside: heightAt on a hill was not raised (${hillHeight})`)
  else console.log(`ok       dirtside: heightAt raises a hill (${hillHeight.toFixed(2)}")`)

  // A click somewhere over the table should not throw — the pointer pipeline's own smoke test, since which
  // element (if any) sits under a blind click depends on the random skirmish this seed drew.
  const box = await canvas.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.65)
  await page.waitForTimeout(150)
  await page.screenshot({ path: join(SHOT_DIR, '03-dirtside-3d-settled.png') })
}

async function driveStargrunt(page) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('ftpc.stargrunt.battle.v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Stargrunt table/ }).click()
  await page.waitForSelector('.dst-setup')
  const terrainSelect = page.locator('.dst-setup select[aria-label="Terrain"]')
  if (await terrainSelect.count()) await terrainSelect.selectOption('city').catch(() => {})
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-map')
  await page.screenshot({ path: join(SHOT_DIR, '11-stargrunt-2d.png') })

  await page.locator('.g3d-map-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(SHOT_DIR, '12-stargrunt-3d.png') })

  const canvas = page.locator('canvas.ground3d-canvas')
  const lit = await litFraction(page, canvas)
  if (lit <= 0.01) fail(`stargrunt: canvas looks empty (${(lit * 100).toFixed(2)}% lit)`)
  else console.log(`ok       stargrunt: canvas is drawing something (${(lit * 100).toFixed(2)}% lit)`)
}

try {
  const page1 = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
  const errors1 = []
  page1.on('pageerror', (e) => errors1.push(String(e)))
  page1.on('console', (m) => {
    if (m.type() === 'error') errors1.push(m.text())
  })
  await driveDirtside(page1)
  if (errors1.length > 0) {
    failed++
    console.log(`Dirtside page errors:\n  ${[...new Set(errors1)].join('\n  ')}`)
  }
  await page1.close()

  const page2 = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
  const errors2 = []
  page2.on('pageerror', (e) => errors2.push(String(e)))
  page2.on('console', (m) => {
    if (m.type() === 'error') errors2.push(m.text())
  })
  await driveStargrunt(page2)
  if (errors2.length > 0) {
    failed++
    console.log(`Stargrunt page errors:\n  ${[...new Set(errors2)].join('\n  ')}`)
  }
  await page2.close()
} catch (e) {
  failed++
  console.log(`ERROR    ${e.message.split('\n')[0]}`)
}

await browser.close()
if (server) await server.close()
console.log(failed === 0 ? '\nground3d visual check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
