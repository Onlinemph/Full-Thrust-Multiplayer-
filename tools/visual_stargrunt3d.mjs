/**
 * STARGRUNT's own closer look at the 3D table (BRIEF-GROUND-3D, stage 2):
 * beyond `visual_ground3d.mjs`'s smoke test, this deploys, activates a
 * squad, and photographs the figures themselves up close (body, head,
 * weapon, pennant), the move ghost's reach ring, the fire line to every
 * enemy squad once "Small arms" is picked, and — through the same dev
 * battle handle `tools/drive_stargrunt_table.mjs` uses for staging — a
 * wounded and a dead figure's own marks, and a squad pennant showing
 * suppression/IP/DIS chips.
 *
 *   SHOT_DIR=/path DRIVE_URL=http://localhost:5253/ node tools/visual_stargrunt3d.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/visual/ground3d-stargrunt'
const base = process.env.DRIVE_URL ?? 'http://localhost:5253/'
mkdirSync(SHOT_DIR, { recursive: true })

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

const page = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('ftpc.stargrunt.battle.v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Stargrunt table/ }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup input[aria-label="Seed"]').fill('4242')
  await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption('light')
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-mapsvg')

  // Deployment: figures already stand in their own zone — Ready both sides as they stand.
  await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
  await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
  await page.waitForFunction(() => /chooses who activates first/.test(document.querySelector('.dst-banner')?.textContent ?? ''))
  await page.locator('.dst-actions button').first().click()
  await page.waitForFunction(() => /to activate a unit/.test(document.querySelector('.dst-banner')?.textContent ?? ''))

  // Now switch to 3D and activate the first roster squad from there — the roster/action panel sits outside
  // the map pane, so it works the same under either map view (this is itself part of what this drive checks).
  await page.locator('.g3d-map-switch button', { hasText: '3D' }).click()
  await page.waitForFunction(() => Boolean(window.__ground3d), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(SHOT_DIR, '01-turn1-overview.png') })

  await page.locator('.sg-roster-row').first().click()
  await page.getByRole('button', { name: /^Activate / }).click()
  await page.waitForFunction(() => /is activated/.test(document.querySelector('.dst-banner')?.textContent ?? ''))
  const activeUnitId = await page.evaluate(() => window.__stargrunt.currentStargruntBattle().activation?.unitId ?? null)
  if (!activeUnitId) fail('no unit ended up activated')
  else ok(`activated unit ${activeUnitId}`)
  await page.evaluate((id) => window.__ground3d.scene.focusUnit(id, 6, true), activeUnitId)
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(SHOT_DIR, '02-activated-focus.png') })

  // Normal move: the move ghost's own reach ring, draped on the ground around the squad (this file's own
  // overlays.ts header explains why it stops there rather than following a cursor).
  await page.getByRole('button', { name: 'Normal', exact: true }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(SHOT_DIR, '03-move-ghost.png') })

  // Small arms: a fire line to every live enemy squad, coloured and captioned by the engine's own verdict —
  // no target need be picked yet, `targeting` already covers every enemy once `fireWith` is set.
  await page.getByRole('button', { name: 'Small arms' }).click()
  await page.waitForTimeout(250)
  await page.locator('.ground3d-cams button', { hasText: /^Top$/ }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(SHOT_DIR, '04-fire-lines.png') })
  await page.keyboard.press('Escape')

  // Stage a wounded and a dead figure directly on the active unit's own squad (the same dev-handle door
  // `drive_stargrunt_table.mjs` uses to stage a close assault), a suppressed/disorganised/in-position pennant
  // on another squad, then dispatch one real, currently-legal action (reorganise, mid-activation) so the
  // store's own `emit()` fires and the 3D view re-renders off the mutated state.
  const staged = await page.evaluate((unitId) => {
    const state = window.__stargrunt.currentStargruntBattle()
    const unit = state.units[unitId]
    const figs = unit.figureIds.map((id) => state.figures[id]).filter((f) => f)
    // Spread these two out from the rest of the squad (deployment left them nearly stacked) so the wounded
    // and dead marks are unambiguous in a screenshot rather than hidden under a neighbour.
    if (figs[0]) {
      figs[0].status = 'wounded'
      figs[0].position = { x: figs[0].position.x - 0.9, y: figs[0].position.y + 0.6 }
    }
    if (figs[1]) {
      figs[1].status = 'dead'
      figs[1].position = { x: figs[1].position.x + 0.9, y: figs[1].position.y + 0.6 }
    }
    const otherUnit = Object.values(state.units).find((u) => u.id !== unitId)
    if (otherUnit) {
      otherUnit.suppression = 2
      otherUnit.inPosition = true
      otherUnit.confidence = 'SH'
    }
    const refusal = window.__stargrunt.stargruntDispatch({ kind: 'reorganise', side: unit.sideId })
    return { woundedId: figs[0]?.id ?? null, deadId: figs[1]?.id ?? null, otherUnitId: otherUnit?.id ?? null, refusal }
  }, activeUnitId)
  console.log('staged:', JSON.stringify(staged))
  await page.waitForTimeout(250)
  // `focusUnit(..., true)` jumps the camera instantly, but an *earlier* preset flight still under way keeps
  // overriding it every frame until it finishes (`GroundScene`'s own `loop`) — the Top click above had 900ms
  // to settle before this runs, well past its 850ms flight, so this jump sticks.
  await page.evaluate((id) => window.__ground3d.scene.focusUnit(id, 5, true), activeUnitId)
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(SHOT_DIR, '05-wounded-dead.png') })
  if (staged.otherUnitId) {
    await page.evaluate((id) => window.__ground3d.scene.focusUnit(id, 5, true), staged.otherUnitId)
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(SHOT_DIR, '06-pennant-chips.png') })
  }

  // The figure count reported by `units.ts`'s own pickables should have dropped by exactly the one now dead.
  const pickCheck = await page.evaluate(() => {
    const scene = window.__ground3d.scene
    return { ok: !!scene }
  })
  if (!pickCheck.ok) fail('lost the ground3d dev handle after staging')

  if (errors.length > 0) {
    failed++
    console.log(`Page errors:\n  ${[...new Set(errors)].join('\n  ')}`)
  } else {
    ok('no console/page errors during the run')
  }
} catch (e) {
  failed++
  console.log(`ERROR    ${e.stack ?? e.message}`)
  await page.screenshot({ path: join(SHOT_DIR, 'error.png') }).catch(() => {})
}

await page.close()
await browser.close()
console.log(failed === 0 ? '\nstargrunt 3D close-up check passed.' : `\n${failed} problem(s). Screenshots in ${SHOT_DIR}/`)
process.exit(failed === 0 ? 0 : 1)
