import { chromium } from 'playwright'

/**
 * A game against the computer, played through the real console.
 *
 * `src/engine/playtest` drives the engine; this drives the app. Every phase
 * is ended with the header button, every one of our ships is fired from the
 * phase-11 panel by clicking its counter and its weapon chips, and at each
 * step one question is asked: can the player act? A fire phase in which the
 * turn sits with the computer while our ships are still loaded is a hang; a
 * phase whose button is disabled with nothing left to do is a stall. Either
 * fails the run.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_vs_computer.mjs 6
 *
 * Reads the battle through `window.__fullThrust`, the handle the store
 * exposes in development only. The screenshot at the end goes wherever
 * DRIVE_SHOT points, or nowhere.
 */
const TURNS = Number(process.argv[2] ?? 6)
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New battle' }).click()
const toggles = page.locator('.modal label.rule-toggle:has(.rule-detail:text-is("you"))')
const fleets = await toggles.count()
await toggles.nth(1).locator('input').check()
await page.getByRole('button', { name: 'Start battle' }).click()
await page.waitForSelector('.end-phase')

const snap = () =>
  page.evaluate(() => {
    const h = window.__fullThrust
    const g = h.currentGame()
    return {
      phase: g.phase,
      turn: g.turn,
      fire: g.fire,
      sides: g.sides.map((s) => s.id),
      aiSides: h.currentSetup().aiSides ?? [],
      deployment: Boolean(g.deployment),
      ships: g.ships.map((s) => ({
        id: s.id,
        name: s.name,
        side: s.side,
        destroyed: s.destroyed,
        fired: s.hasFiredThisTurn,
        captured: Boolean(s.captured),
        order: s.order !== null && s.order !== undefined,
      })),
      log: g.log.length,
      fireLog: g.log.filter((e) => e.kind === 'fire').map((e) => e.side),
    }
  })

let s = await snap()
const mySide = s.sides.find((id) => !s.aiSides.includes(id))
const aiSide = s.aiSides[0]
console.log(`fleets ${fleets}; sides ${s.sides.join(',')}; computer flies ${aiSide}; I fly ${mySide}; deployment ${s.deployment}`)

const tally = { fired: 0, held: 0, fallback: 0, ended: 0, plotted: 0 }
const stuck = []
const hangs = []
const trail = []
let over = false
for (let step = 0; step < 900; step += 1) {
  s = await snap()
  if (s.turn > TURNS) break
  // The scenario's own end: the result is shown over the table. Close it
  // and stop — the battle is over, and that is not a stall.
  const result = page.locator('.modal-backdrop button', { hasText: /^Close$/ })
  if ((await result.count()) > 0) {
    await result.first().click()
    over = true
    break
  }
  if (s.phase === 'ship-fire') {
    const mine = s.ships.filter((x) => x.side === mySide && !x.destroyed && !x.fired && !x.captured)
    if (mine.length > 0) {
      if (s.fire.side !== null && s.fire.side !== mySide) {
        // The turn sits with the computer and the store's loop has already
        // run: this is the hang the player reported. Note it and see whether
        // ending the phase is even offered.
        hangs.push({ turn: s.turn, fire: s.fire, waiting: mine.map((m) => m.name) })
        const btn = page.locator('.end-phase')
        if (await btn.isEnabled()) { await btn.click(); tally.ended += 1; continue }
        stuck.push({ turn: s.turn, phase: s.phase, why: 'computer holds the fire turn and the phase cannot end' })
        break
      }
      const ship = mine[0]
      const counter = page.locator(`g.counter.side-${mySide}[aria-label^="${ship.name},"]`).first()
      const panel = page.locator('.panel:has(h3:text-is("Phase 11 · Fire"))')
      await counter.click()
      // A click on the ship already selected deselects it, and the ship the
      // orders phase left selected is often the first to fire: click again,
      // as a person would.
      if ((await panel.count()) === 0) await counter.click()
      const shown = (await panel.count()) > 0
      if (shown) {
        const chips = panel.locator('.target-block .weapon-fire:not(.is-blocked):not([disabled])')
        const n = await chips.count()
        for (let i = 0; i < n; i += 1) await chips.nth(i).click()
        const declared = await panel.locator('.fire-plan-list li').count()
        if (declared > 0) {
          await panel.locator('button', { hasText: /^Fire/ }).click()
          tally.fired += 1
          trail.push(`t${s.turn} ${ship.name} fired ${declared}`)
        } else {
          await panel.getByRole('button', { name: 'Hold fire' }).click()
          tally.held += 1
          trail.push(`t${s.turn} ${ship.name} held`)
        }
      }
      const after = await snap()
      const me = after.ships.find((x) => x.id === ship.id)
      if (!me.fired && !me.destroyed) {
        // The panel did not take it: act through the store so the drive goes
        // on, and count it against the console.
        await page.evaluate((id) => window.__fullThrust.dispatch({ type: 'pass-fire', shipId: id }), ship.id)
        tally.fallback += 1
        trail.push(`t${s.turn} ${ship.name} FALLBACK (panel ${shown ? 'shown' : 'absent'})`)
      }
      continue
    }
  }
  const btn = page.locator('.end-phase')
  if (await btn.isEnabled()) {
    const label = (await btn.innerText()).trim()
    await btn.click()
    tally.ended += 1
    if (label !== 'End phase') trail.push(`t${s.turn} ${s.phase}: ${label}`)
    continue
  }
  const title = (await btn.getAttribute('title')) ?? ''
  if (s.phase === 'orders' || /order/i.test(title)) {
    // 3.1: the phase wants an order for every hull. Straight ahead, no thrust.
    for (const ship of s.ships.filter((x) => x.side === mySide && !x.destroyed && !x.order)) {
      await page.evaluate((id) => window.__fullThrust.dispatch({ type: 'plot-accel', shipId: id, accel: 0 }), ship.id)
      tally.plotted += 1
    }
    const again = await snap()
    if (again.phase === s.phase && !(await btn.isEnabled())) {
      stuck.push({ turn: s.turn, phase: s.phase, why: title })
      break
    }
    continue
  }
  stuck.push({ turn: s.turn, phase: s.phase, why: title })
  break
}

s = await snap()
const byside = s.fireLog.reduce((acc, side) => ({ ...acc, [side]: (acc[side] ?? 0) + 1 }), {})
console.log('reached turn', s.turn, s.phase, over ? '(battle over)' : '')
console.log('tally', JSON.stringify(tally))
console.log('fire log lines by side', JSON.stringify(byside))
console.log('ships', s.ships.map((x) => `${x.side}:${x.name}${x.destroyed ? ' (destroyed)' : ''}`).join(' | '))
console.log('hangs', JSON.stringify(hangs))
console.log('stuck', JSON.stringify(stuck))
console.log('trail', trail.slice(0, 40).join('; '))
console.log('errors', errors)
if (process.env.DRIVE_SHOT) await page.screenshot({ path: process.env.DRIVE_SHOT })
await browser.close()
process.exit(stuck.length === 0 && hangs.length === 0 && errors.length === 0 ? 0 : 1)
