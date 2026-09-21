import { chromium } from 'playwright'

/**
 * A campaign played through the real console: set up from the menu, the
 * turn ended phase by phase, a course plotted on the chart, a meeting fought
 * by the computers, another opened on the battle table and brought back,
 * and the whole thing surviving a reload.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_campaign.mjs
 *
 * Reads the campaign through `window.__fullThrustCampaign`, the handle the
 * store exposes in development only. Screenshots go to DRIVE_SHOT_DIR if set.
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('dialog', (d) => d.accept())

const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1 }
const snap = () =>
  page.evaluate(() => {
    const s = window.__fullThrustCampaign.currentCampaign()
    if (!s) return null
    return {
      turn: s.turn,
      phase: s.phase,
      players: s.players.map((p) => p.id),
      forces: s.taskForces.map((tf) => ({ id: tf.id, owner: tf.owner, hex: tf.hex, ships: tf.ships.length, plot: tf.plot.length })),
      colonies: s.colonies.map((c) => ({ id: c.id, rp: c.stockpileRp })),
      battles: s.battles.map((b) => ({ id: b.id, resolved: b.resolved, winner: b.winner ?? null })),
      log: s.log.length,
      last: s.log.slice(-3).map((l) => l.text),
    }
  })

await page.goto(URL, { waitUntil: 'networkidle' })

// ── Setup from the menu ───────────────────────────────────────────────────
await page.getByRole('button', { name: 'Campaign', exact: true }).click()
await page.waitForSelector('.campaign-setup')
const start = page.getByRole('button', { name: 'Start the campaign' })
if (!(await start.isDisabled())) fail('start enabled with no fleets')
// A fixed sky, so a run is the same run every time.
await page.getByLabel('Seed').fill('12345')
const chips = page.locator('.campaign-setup .design-chip')
for (let i = 0; i < 3; i += 1) await chips.nth(i).click()
await page.locator('.campaign-setup .fleet-picker .panel-row button', { hasText: 'Eurasia' }).first().click()
for (let i = 0; i < 3; i += 1) await chips.nth(i).click()
await shot('campaign-setup')
if (await start.isDisabled()) fail(`start still disabled: ${await start.getAttribute('title')}`)
await start.click()
await page.waitForSelector('.campaign-screen')
let s = await snap()
console.log('created', s.turn, s.phase, s.forces.length, 'forces', s.colonies.length, 'colonies')
if (s.turn !== 1 || s.phase !== 'ftl-movement') fail('did not open on turn 1')
if (s.forces.some((f) => f.ships !== 3)) fail('starting fleets are not three ships each')
if (!(await page.locator('.campaign-map').isVisible())) fail('no map')
if (!(await page.locator('.campaign-hex').isVisible())) fail('no hex panel')
await shot('campaign-turn1')

// ── The turn, phase by phase ──────────────────────────────────────────────
for (let i = 0; i < 7; i += 1) await page.locator('header .end-phase').click()
s = await snap()
if (s.turn !== 2 || s.phase !== 'ftl-movement') fail(`after seven phases: turn ${s.turn} ${s.phase}`)
if (!(await page.locator('header').textContent()).includes('TURN 2')) fail('header does not read TURN 2')

// ── A plot on the chart ───────────────────────────────────────────────────
const home = s.forces.find((f) => f.owner === 'p1')
await page.getByRole('button', { name: 'Plot course' }).first().click()
await page.waitForSelector('.campaign-drafting')
const to = { q: home.hex.q + 1, r: home.hex.r }
const to2 = { q: home.hex.q + 2, r: home.hex.r }
// A star sits over its cell and takes the click itself (to the same end),
// which Playwright's hit test would otherwise refuse on the cell's behalf.
await page.locator(`.campaign-cell[data-hex="${to.q},${to.r}"]`).click({ force: true })
await page.locator(`.campaign-cell[data-hex="${to2.q},${to2.r}"]`).click({ force: true })
const legs = await page.locator('.campaign-legs li').count()
if (legs !== 2) fail(`drafted ${legs} legs, expected 2`)
await page.getByRole('button', { name: 'Undo leg' }).click()
await page.getByRole('button', { name: 'Write plot' }).click()
s = await snap()
const plotted = s.forces.find((f) => f.id === home.id)
if (plotted.plot !== 1) fail(`plot not written: ${JSON.stringify(plotted)} ${s.last.join(' | ')}`)
console.log('plotted:', s.last[s.last.length - 1])
await shot('campaign-plotted')

// ── Production on turn 4, and a purchase ──────────────────────────────────
while (!(s.turn === 4 && s.phase === 'production')) {
  await page.locator('header .end-phase').click()
  s = await snap()
  if (s.turn > 4) { fail('ran past turn 4'); break }
}
const rp = s.colonies.find((c) => c.id === 'p1-home').rp
if (rp <= 0) fail('home colony banked nothing on turn 4')
console.log('turn 4 production: home holds', rp, 'RP')
await page.locator('.campaign-hex select[aria-label="Item"]').selectOption('colony-transport')
await page.locator('.campaign-hex button', { hasText: 'Buy' }).click()
s = await snap()
if (s.colonies.find((c) => c.id === 'p1-home').rp !== rp - 50) fail(`transport did not cost 50: ${s.last.join(' | ')}`)
await page.locator('.campaign-player button', { hasText: 'Research' }).first().click()
s = await snap()
console.log('after buying:', s.last.join(' | '))
await shot('campaign-production')

// ── A meeting fought by the computers ─────────────────────────────────────
const meeting = () =>
  page.evaluate(() => {
    const h = window.__fullThrustCampaign
    const hex = (q, r) => ({ q, r })
    h.newCampaign({
      seed: 46,
      starHexes: [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)],
      radius: 4,
      bannedSystems: ['reflex-field', 'cloaking-field', 'wave-gun'],
      players: [
        { id: 'terra', name: 'Terra', faction: '', home: hex(0, 0), startingShips: [{ designId: 'intro-heavy-cruiser', name: 'Endeavour' }, { designId: 'intro-frigate', name: 'Dart' }], startingTransports: 20 },
        { id: 'esu', name: 'Eurasia', faction: '', home: hex(2, 0), startingShips: [{ designId: 'esu-light-cruiser', name: 'Kirov' }, { designId: 'esu-frigate', name: 'Storozhevoy' }], startingTransports: 20, computer: true },
      ],
    })
    h.campaignDispatch({ kind: 'plot-move', player: 'terra', taskForce: 'terra-tf-1', legs: [{ turn: 4, from: hex(0, 0), to: hex(2, 0) }] })
    let guard = 40
    while (guard-- > 0) {
      const s = h.currentCampaign()
      if (s.turn === 4 && s.phase === 'combat') break
      h.campaignDispatch({ kind: 'end-phase', player: null })
    }
    return h.currentCampaign().battles.length
  })
if ((await meeting()) !== 1) fail('no meeting at turn 4')
await page.waitForSelector('.campaign-battles')
if (await page.locator('header .end-phase').isEnabled()) fail('end phase enabled with a battle to fight')
await page.getByRole('button', { name: 'Let the computers fight it' }).click()
s = await snap()
if (!s.battles[0].resolved) fail('battle not resolved by the computers')
console.log('computers fought:', s.last.join(' | '))
if (!(await page.locator('header .end-phase').isEnabled())) fail('end phase still blocked after the battle')
await shot('campaign-fought')

// ── A meeting opened on the table and brought back ────────────────────────
await meeting()
await page.getByRole('button', { name: 'Fight on the table' }).click()
await page.waitForSelector('.campaign-banner')
const banner = await page.locator('.campaign-banner').textContent()
if (!banner.includes('Terra against Eurasia')) fail(`banner reads: ${banner}`)
const tactical = await page.evaluate(() => {
  const g = window.__fullThrust.currentGame()
  return { ships: g.ships.map((s) => `${s.side}:${s.name}`), ai: window.__fullThrust.currentSetup().aiSides }
})
console.log('on the table:', tactical.ships.join(', '), 'computer:', tactical.ai)
if (tactical.ships.length !== 4) fail('table does not hold both fleets')
if (JSON.stringify(tactical.ai) !== '["b"]') fail('computer side not set')
await shot('campaign-table')
await page.getByRole('button', { name: 'Star map' }).click()
await page.waitForSelector('.campaign-screen')
if (!(await page.getByRole('button', { name: 'Back to the table' }).isVisible())) fail('no way back to the table')
await page.getByRole('button', { name: 'Back to the table' }).click()
await page.waitForSelector('.campaign-banner')
await page.getByRole('button', { name: 'Return to campaign' }).click()
await page.waitForSelector('.campaign-screen')
s = await snap()
if (!s.battles[0].resolved) fail('battle from the table not folded back')
console.log('folded back:', s.last.join(' | '))

// ── Survives a reload, from the menu ──────────────────────────────────────
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Continue campaign/ }).click()
await page.waitForSelector('.campaign-screen')
const again = await snap()
if (again.turn !== s.turn || again.log !== s.log) fail('campaign did not come back the same after a reload')
console.log('reloaded: turn', again.turn, again.phase, again.log, 'log lines')

await browser.close()
if (errors.length > 0) {
  console.error('page errors:', errors)
  process.exitCode = 1
}
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
