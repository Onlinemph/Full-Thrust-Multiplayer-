import { chromium } from 'playwright'

/**
 * The Dirtside table through the real console: set up a skirmish from the
 * menu, deploy, choose who goes first, activate a platoon, plot a move,
 * answer the opportunity window, fire a volley, end the activation, and
 * read the log; then reload and find the battle still on the table.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_dirtside_table.mjs
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1 }
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const banner = async () => (await page.locator('.dst-banner').textContent()) ?? ''
const logText = async () => (await page.locator('.dst-log').textContent()) ?? ''

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.removeItem('ftpc.dirtside.battle.v1'))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Dirtside table/ }).click()
await page.waitForSelector('.dst-setup')
await page.locator('.dst-setup input[aria-label="Seed"]').fill('4242')
await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption('light')
const rows = await page.locator('.dst-unit-row').count()
console.log('skirmish rows:', rows)
if (rows !== 8) fail(`expected 8 unit rows, got ${rows}`)
await shot('dirtside-skirmish')

// Every style offers a preview, including a built-up one: a city table's own square footage keeps the
// deployment strips clear (BRIEF-TERRAIN), which the two grey wash bands top and bottom should still show.
await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption('city')
await page.waitForTimeout(150)
const cityFeatures = await page.locator('.dss-preview .dst-feature').count()
console.log('city preview features:', cityFeatures)
if (cityFeatures < 50) fail(`expected a built-up preview with many features, got ${cityFeatures}`)
await shot('dirtside-skirmish-city')
await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption('light')
await page.getByRole('button', { name: 'To the table' }).click()
await page.waitForSelector('.dst-map')
console.log('banner:', await banner())
if (!/Deployment/.test(await banner())) fail('the table did not open in deployment')
const counters = await page.locator('.dst-counter').count()
console.log('counters:', counters)
if (counters < 20) fail(`expected the two forces on the table, got ${counters} counters`)

// Deploy: pick a northern tank and put it on the baseline strip.
const svg = page.locator('.dst-map')
await page.locator('.dst-counter.is-north.is-vehicle').first().click()
if (!(await page.locator('.dst-element').isVisible())) fail('clicking a counter did not select it')
await shot('dirtside-deploy')
await page.getByRole('button', { name: 'Northern force: ready' }).click()
await page.getByRole('button', { name: 'Southern force: ready' }).click()
console.log('banner:', await banner())
if (!/chooses who activates first/.test(await banner())) fail('turn 1 did not start')
await page.locator('.dst-actions button').first().click()
console.log('banner:', await banner())
if (!/to activate a unit/.test(await banner())) fail('no side is to activate')

// Activate the first unit of whoever is up, select its first element, plot a move straight ahead.
const activate = page.getByRole('button', { name: 'Activate' }).first()
await activate.click()
console.log('banner:', await banner())
if (!/is activated/.test(await banner())) fail('the unit did not activate')
const active = page.locator('.dst-counter.is-active').first()
await active.click()
await page.getByRole('button', { name: 'Plot a move' }).click()
const ab = await active.boundingBox()
const north = (await page.locator('.dst-counter.is-active.is-north').count()) > 0
// Click 5" ahead: the map's scale is read off the SVG, whose user units are inches.
const pxPerInch = await svg.evaluate((el) => el.getScreenCTM().a)
await page.mouse.click(ab.x + ab.width / 2, ab.y + ab.height / 2 + (north ? 1 : -1) * 5 * pxPerInch)
const plotText = await page.locator('.dst-element .dst-row .num').first().textContent()
console.log('plot:', plotText)
if (!/factors/.test(plotText ?? '')) fail('the plotted move shows no cost')
await shot('dirtside-plot')
await page.getByRole('button', { name: 'Move', exact: true }).click()
let text = await logText()
if (!/moves .* for .* factors/.test(text)) fail('the move is not in the log')
// The other side may be offered opportunity fire at 20"+; decline it if so.
if (/opportunity fire/.test(await banner())) {
  console.log('window:', await banner())
  await page.getByRole('button', { name: 'Decline for this activation' }).click()
}
await shot('dirtside-moved')

// Fire: pick the moved element's main gun and click the nearest enemy; expect a refusal (out of range) or a shot.
await active.click()
const gunButton = page.locator('.dst-fire button').first()
console.log('weapon:', await gunButton.textContent())
await gunButton.click()
const enemy = page.locator(north ? '.dst-counter.is-south:not(.is-destroyed)' : '.dst-counter.is-north:not(.is-destroyed)').first()
await enemy.click()
const refusal = page.locator('.dst-refusal')
if (await refusal.count()) console.log('refusal:', (await refusal.textContent())?.trim())
if (await page.locator('.dst-shots li').count()) {
  console.log('volley:', (await page.locator('.dst-shots').textContent())?.trim())
  await page.getByRole('button', { name: 'Fire the volley' }).click()
  text = await logText()
  if (!/against D|Drew/.test(text)) fail('the volley is not in the log')
} else if (!(await refusal.count())) fail('clicking an enemy neither added a shot nor refused')
await shot('dirtside-fire')
await page.getByRole('button', { name: /End .* activation/ }).click()
console.log('banner:', await banner())
if (!/to activate a unit|opportunity/.test(await banner())) fail('the activation did not end')

// Play a couple more activations quickly through the buttons.
for (let i = 0; i < 3; i++) {
  const b = await banner()
  if (/opportunity fire/.test(b)) { await page.getByRole('button', { name: 'Decline', exact: true }).click(); continue }
  if (/to activate a unit/.test(b)) {
    const btn = page.getByRole('button', { name: 'Activate' }).first()
    if (await btn.count()) { await btn.click(); await page.getByRole('button', { name: /End .* activation/ }).click() }
  }
}
await shot('dirtside-table')

// The battle survives a reload and the menu offers to continue it.
await page.reload({ waitUntil: 'networkidle' })
const cont = page.getByRole('button', { name: /Continue the ground battle/ })
if (!(await cont.count())) fail('the menu does not offer to continue the ground battle')
await cont.click()
await page.waitForSelector('.dst-map')
const after = await logText()
if (!/moves .* for .* factors/.test(after)) fail('the reloaded battle lost its log')
await page.getByRole('button', { name: 'Menu' }).click()

if (errors.length) fail(`console errors: ${errors.join(' | ')}`)
await browser.close()
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
