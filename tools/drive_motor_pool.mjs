import { chromium } from 'playwright'

/**
 * The Motor Pool through the real console: open it from the menu, pick the
 * book's DEIMOS off the shelf and read its card, change the design and
 * watch the capacity, faults and points follow, save a copy, reload and
 * find it still on the shelf.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_motor_pool.mjs
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

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Motor Pool/ }).click()
await page.waitForSelector('.ds-pool')

const shelf = page.locator('.ds-shelf select')
const options = await shelf.locator('option').allTextContents()
console.log('shelf:', options.length, 'entries;', options.slice(0, 3).join(' | '))
if (!options.some((o) => o.startsWith('DEIMOS/SO · 356'))) fail('the DEIMOS is not on the shelf at 356')
await shelf.selectOption({ label: 'DEIMOS/SO · 356' })
const card = page.locator('.ds-sheet .ds-card')
const cardText = await card.textContent()
for (const expected of ['DEIMOS/SO', 'MDC/4', 'GMS/H (ENH)', '356', 'D8', '30"', '42"', '54"']) {
  if (!cardText.includes(expected)) fail(`card lacks ${expected}`)
}
if (!(await page.locator('.yard-legal').isVisible())) fail('the DEIMOS is not shown as legal')
await shot('motor-pool-deimos')

// A second big gun on the DEIMOS: over capacity, and the card and points follow.
await page.getByRole('button', { name: 'Add a weapon' }).click()
const readout = await page.locator('.mass-readout').textContent()
console.log('after adding a weapon:', readout.trim())
const faults = await page.locator('.faults li').allTextContents()
console.log('faults:', faults.join(' | '))
if (!faults.some((f) => /Capacity/.test(f))) fail('no capacity fault after over-filling the hull')
const points = await page.locator('.cost-sheet summary b').textContent()
if (Number(points) <= 356) fail(`points did not rise: ${points}`)

await page.getByRole('button', { name: 'Save a copy' }).click()
const after = await shelf.locator('option').allTextContents()
if (!after.some((o) => o.startsWith('DEIMOS/SO (copy)'))) fail('the copy is not on the shelf')
console.log('saved copy:', after.find((o) => o.startsWith('DEIMOS/SO (copy)')))
await shot('motor-pool-copy')

// A fresh hull from scratch: nothing on it, legal, 15 + 9 + 10 + 10 = 44 (p. 52).
await page.getByRole('button', { name: 'New hull' }).click()
const fresh = await page.locator('.cost-sheet summary b').textContent()
if (fresh !== '44') fail(`a bare medium hull should cost 44, got ${fresh}`)

await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Motor Pool/ }).click()
await page.waitForSelector('.ds-pool')
const again = await page.locator('.ds-shelf select option').allTextContents()
if (!again.some((o) => o.startsWith('DEIMOS/SO (copy)'))) fail('the copy did not survive a reload')

await browser.close()
if (errors.length > 0) { console.error('page errors:', errors); process.exitCode = 1 }
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
