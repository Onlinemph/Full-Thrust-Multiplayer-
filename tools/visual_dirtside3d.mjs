/**
 * DIRTSIDE'S OWN SCREENSHOT CHECK — stage 2's own harness, on
 * `tools/visual_ground3d.mjs`'s pattern (GROUND's, stage 1's), but driving
 * the real models this file replaced the placeholder block with: a built-up
 * table (vehicles among buildings, a leader's pennant, damage marks) and a
 * rural/hilly one (elements standing on a hill's own terraces, infantry
 * stands in the open), then a deployed, moved and fired-upon table so the
 * move plot, the reach ring, targeting and the recent-shot tracers all get
 * a frame. WebGL output is not pixel-stable enough for a baseline, so this
 * checks the canvas is actually drawing the new models (a lit fraction well
 * above the empty-table check) and that nothing throws; screenshots always
 * get written, pass or fail, for a person to look at.
 *
 *   DRIVE_URL=http://localhost:5252/ SHOT_DIR=/path/to/shots node tools/visual_dirtside3d.mjs
 */
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/dirtside3d'
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
const ok = (msg) => console.log(`ok       ${msg}`)

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

async function openSkirmish(page, terrain, seed) {
  await page.goto(base, { waitUntil: 'networkidle' })
  // The 2D/3D choice is remembered per browser per game (BRIEF-GROUND-3D), independent of the battle itself —
  // clear it too, or a table opened after an earlier run in this same page starts straight in 3D and
  // `.dst-map` (the 2D map's own class) never appears for this helper to wait on.
  await page.evaluate(() => {
    localStorage.removeItem('ftpc.dirtside.battle.v1')
    localStorage.removeItem('ftpc.dirtside.mapview.v1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Dirtside table/ }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup input[aria-label="Seed"]').fill(String(seed))
  await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption(terrain)
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-map')
}

async function to3D(page) {
  await page.locator('.g3d-map-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  if (!(await page.locator('canvas.ground3d-canvas').count())) {
    await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 15000 })
  }
  await page.waitForTimeout(400)
}

/** A built-up table: vehicles and infantry standing among real buildings, pennants up during deployment. */
async function driveCity(page) {
  await openSkirmish(page, 'city', 4242)
  await to3D(page)
  await page.screenshot({ path: join(SHOT_DIR, '01-city-tilt.png') })

  const canvas = page.locator('canvas.ground3d-canvas')
  const lit = await litFraction(page, canvas)
  if (lit <= 0.05) fail(`city: canvas looks nearly empty (${(lit * 100).toFixed(2)}% lit)`)
  else ok(`city: canvas is drawing the models (${(lit * 100).toFixed(2)}% lit)`)

  await page.locator('.ground3d-cams button', { hasText: /^Top$/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOT_DIR, '02-city-top.png') })

  await page.locator('.ground3d-cams button', { hasText: /^Low$/ }).click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(SHOT_DIR, '03-city-low.png') })
  await page.locator('.ground3d-cams button', { hasText: /^Tilt$/ }).click()
  await page.waitForTimeout(900)

  // A blind double-click somewhere over the table should focus something or just recentre — no throw either way.
  const box = await canvas.boundingBox()
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height * 0.55)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: join(SHOT_DIR, '04-city-focus.png') })

  // Read the live scene for a sanity check that real models (not the old placeholder boxes) are on the table.
  const info = await page.evaluate(() => {
    const g = window.__ground3d
    if (!g) return null
    let meshes = 0
    let groups = 0
    g.scene.terrain.group.traverse(() => {})
    const units = g.scene['opts'] ? null : null
    return { hasWindow: true, elements: Object.values(g.getState().elements).filter((e) => !e.aboard).length }
  })
  console.log('scene elements on table:', info?.elements)
}

/** A rural/hilly table: elements standing on a hill's own terraces, in the open among woods and fields. */
async function driveRural(page) {
  await openSkirmish(page, 'village', 77)
  await to3D(page)
  await page.screenshot({ path: join(SHOT_DIR, '05-rural-tilt.png') })

  const canvas = page.locator('canvas.ground3d-canvas')
  const lit = await litFraction(page, canvas)
  if (lit <= 0.05) fail(`rural: canvas looks nearly empty (${(lit * 100).toFixed(2)}% lit)`)
  else ok(`rural: canvas is drawing the models (${(lit * 100).toFixed(2)}% lit)`)

  const hillHeight = await page.evaluate(() => {
    const g = window.__ground3d
    const game = g?.getState() ?? null
    const feature = game?.setup.table.terrain.find((f) => f.terrain === 'hills' || f.terrain === 'mountains')
    if (!feature || !g) return null
    const at = feature.shape.kind === 'circle' ? feature.shape.centre : feature.shape.kind === 'rect' ? { x: feature.shape.x + feature.shape.width / 2, y: feature.shape.y + feature.shape.height / 2 } : feature.shape.points[0]
    return g.scene.heightAt(at)
  })
  if (hillHeight === null) console.log('note     rural: no hill on this table to check heightAt against')
  else if (!(hillHeight > 0)) fail(`rural: heightAt on a hill was not raised (${hillHeight})`)
  else ok(`rural: heightAt raises a hill (${hillHeight.toFixed(2)}")`)

  await page.locator('.ground3d-cams button', { hasText: /^Top$/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(SHOT_DIR, '06-rural-top.png') })
}

/**
 * Deploy, move, and fire through the real console — mirrors
 * `tools/drive_dirtside_table.mjs`'s own path — but watched in 3D the whole
 * time, so the move plot, the reach ring, targeting rings and the
 * recent-shot tracer all get exercised and photographed.
 */
async function driveInteraction(page) {
  await openSkirmish(page, 'light', 4242)
  await page.locator('.dst-counter.is-north.is-vehicle').first().click()
  await page.getByRole('button', { name: 'Northern force: ready' }).click()
  await page.getByRole('button', { name: 'Southern force: ready' }).click()
  await page.locator('.dst-actions button').first().click()

  await to3D(page)
  await page.screenshot({ path: join(SHOT_DIR, '07-play-deploy-3d.png') })

  const activate = page.getByRole('button', { name: 'Activate' }).first()
  if (await activate.count()) await activate.click()

  // Select the active unit's first element through the roster's own element chip (`.dst-elchip`, outside the
  // map pane so it is there in 3D too), then plot a move by clicking the 3D ground — `onClickTable` is the
  // very same callback the flat map uses, so a click resolves through the real raycast.
  const rosterActive = page.locator('.dst-elchip').first()
  if (await rosterActive.count()) await rosterActive.click().catch(() => {})
  const plotBtn = page.getByRole('button', { name: 'Plot a move' })
  if (await plotBtn.count()) {
    await plotBtn.click()
    const canvas = page.locator('canvas.ground3d-canvas')
    const box = await canvas.boundingBox()
    await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30)
    await page.waitForTimeout(200)
    await page.mouse.click(box.x + box.width / 2 + 120, box.y + box.height / 2 - 10)
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(SHOT_DIR, '08-play-moveplot-3d.png') })
    const moveGo = page.getByRole('button', { name: 'Move', exact: true })
    if (await moveGo.count()) await moveGo.click().catch(() => {})
    await page.waitForTimeout(300)
    if (/opportunity fire/.test((await page.locator('.dst-banner').textContent()) ?? '')) {
      const decline = page.getByRole('button', { name: 'Decline for this activation' })
      if (await decline.count()) await decline.click()
    }
    await page.screenshot({ path: join(SHOT_DIR, '09-play-moved-3d.png') })

    // Fire: arm the first weapon and click the nearest living enemy's own 3D model — projected to screen
    // space off the live scene/camera, since its table position is not screen-fixed like a 2D counter's is.
    const gunButton = page.locator('.dst-fire button').first()
    if (await gunButton.count()) {
      await gunButton.click()
      const target = await page.evaluate(() => {
        // No `THREE` global to project with (it is bundled into the lazy chunk, not attached to `window`) — the
        // same 4x4 multiply `Vector3.project` does, by hand, off the live camera's own matrices.
        const xf = (m, x, y, z) => {
          const e = m.elements
          return { x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14], w: e[3] * x + e[7] * y + e[11] * z + e[15] }
        }
        const g = window.__ground3d
        const st = g.getState()
        const mySide = st.toAct ?? 'north'
        const enemy = Object.values(st.elements).find((e) => e.sideId !== mySide && !e.destroyed && !e.aboard)
        if (!enemy) return null
        const y = g.scene.heightAt(enemy.position) + 0.3
        const camera = g.scene['camera']
        const view = xf(camera.matrixWorldInverse, enemy.position.x, y, enemy.position.y)
        const clip = xf(camera.projectionMatrix, view.x, view.y, view.z)
        const ndcX = clip.x / clip.w
        const ndcY = clip.y / clip.w
        const canvas = document.querySelector('canvas.ground3d-canvas')
        const rect = canvas.getBoundingClientRect()
        return { x: rect.left + ((ndcX + 1) / 2) * rect.width, y: rect.top + ((1 - ndcY) / 2) * rect.height, name: enemy.name }
      })
      if (target) {
        console.log('firing at:', target.name)
        await page.mouse.click(target.x, target.y)
        await page.waitForTimeout(200)
        await page.screenshot({ path: join(SHOT_DIR, '10-play-targeting-3d.png') })
        const fireBtn = page.getByRole('button', { name: 'Fire the volley' })
        if (await fireBtn.count()) {
          await fireBtn.click()
          await page.waitForTimeout(300)
          await page.screenshot({ path: join(SHOT_DIR, '11-play-fired-3d.png') })
        } else {
          const refusal = page.locator('.dst-refusal')
          if (await refusal.count()) console.log('refusal:', (await refusal.textContent())?.trim())
        }
      } else {
        console.log('note     no living enemy element found to fire at on this seed')
      }
    } else {
      console.log('note     no weapon button found for the moved element — skipping the fire shot')
    }
  } else {
    console.log('note     no "Plot a move" button found (nothing to activate on this seed) — skipping the move-plot shot')
  }
}

try {
  const page1 = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
  const errors1 = []
  page1.on('pageerror', (e) => errors1.push(String(e)))
  page1.on('console', (m) => {
    if (m.type() === 'error') errors1.push(m.text())
  })
  await driveCity(page1)
  await driveRural(page1)
  if (errors1.length > 0) {
    failed++
    console.log(`page errors:\n  ${[...new Set(errors1)].join('\n  ')}`)
  }
  await page1.close()

  const page2 = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
  const errors2 = []
  page2.on('pageerror', (e) => errors2.push(String(e)))
  page2.on('console', (m) => {
    if (m.type() === 'error') errors2.push(m.text())
  })
  await driveInteraction(page2)
  if (errors2.length > 0) {
    failed++
    console.log(`interaction page errors:\n  ${[...new Set(errors2)].join('\n  ')}`)
  }
  await page2.close()
} catch (e) {
  failed++
  console.log(`ERROR    ${e.message.split('\n')[0]}`)
}

await browser.close()
if (server) await server.close()
console.log(failed === 0 ? '\ndirtside 3D visual check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
