import { chromium } from 'playwright'

/**
 * Rules presets through the real console: the editor from the menu, a
 * preset applied on the New battle form and taken off again by an edit,
 * the Shipyard greying what a preset bars, and a preset carried in a link
 * opening the editor ready to save.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_house_rules.mjs
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('dialog', (d) => d.accept())
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1 }
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }

await page.goto(URL, { waitUntil: 'networkidle' })

// ── The editor from the menu ──────────────────────────────────────────────
await page.getByRole('button', { name: /House rules/ }).click()
await page.waitForSelector('.preset-editor')
const shelf = page.locator('.preset-editor .ds-shelf select')
const shipped = await shelf.locator('option').allTextContents()
console.log('shelf:', shipped.join(' | '))
if (shipped.length < 4) fail('fewer than four shipped presets')
await shelf.selectOption({ label: 'Second edition, beams and torpedoes · shipped' })
const barredTicks = await page.locator('.preset-ticks label.is-barred').count()
const allowedTicks = await page.locator('.preset-ticks label:not(.is-barred)').count()
console.log('second edition: allowed', allowedTicks, 'barred', barredTicks)
if (allowedTicks !== 9) fail(`second edition should allow 9 items, allows ${allowedTicks}`)
if (barredTicks === 0) fail('second edition bars nothing')
await shot('house-rules-editor')
await page.locator('.preset-editor').getByRole('button', { name: 'Close' }).click()

// ── Applied on the New battle form, and taken off by an edit ─────────────
await page.getByRole('button', { name: 'New battle' }).click()
await page.waitForSelector('.modal')
const rules = page.locator('select[aria-label="Rules preset"]')
await rules.selectOption('campaign')
let barredText = await page.locator('.modal').getByText(/^Barred:/).textContent()
console.log(barredText.trim())
if (!/Wave Gun/i.test(barredText) || !/Reflex/i.test(barredText) || !/Cloaking Field/i.test(barredText)) fail('campaign bans not applied')
if ((await rules.inputValue()) !== 'campaign') fail('the select does not read the applied preset')
const cpvBox = page.locator('.modal label.rule-toggle', { hasText: 'Combat Points Value' }).locator('input')
if (await cpvBox.isChecked()) fail('the campaign preset should have turned CPV off')
await cpvBox.check()
if ((await rules.inputValue()) !== '') fail('an edit should take the table off the preset')
console.log('custom after edit:', await rules.locator('option').first().textContent())
await shot('house-rules-setup')
await page.locator('.modal').getByRole('button', { name: 'Cancel' }).click().catch(() => page.keyboard.press('Escape'))
await page.locator('.modal-backdrop').first().click({ position: { x: 5, y: 5 } }).catch(() => {})

// ── The Shipyard greys what the active preset bars ────────────────────────
await page.getByRole('button', { name: 'Shipyard', exact: true }).click()
await page.waitForSelector('.yard-modal')
await page.locator('.yard-modal select[aria-label="Rules preset"]').selectOption('second-edition')
await page.locator('.yard-modal .family-tab', { hasText: 'Kinetic' }).click()
// The second edition keeps submunition packs and nothing else kinetic.
const kineticRows = await page.locator('.yard-modal .catalogue-row').count()
const kineticBarred = await page.locator('.yard-modal .catalogue-row.is-barred').count()
const smpRows = await page.locator('.yard-modal .catalogue-row', { hasText: /Submunition/i }).count()
const smpBarred = await page.locator('.yard-modal .catalogue-row.is-barred', { hasText: /Submunition/i }).count()
console.log('kinetic rows', kineticRows, 'barred', kineticBarred, 'submunition rows', smpRows)
if (kineticRows === 0 || kineticBarred !== kineticRows - smpRows || smpBarred !== 0) fail('second edition should bar every kinetic weapon but the submunition packs')
await page.locator('.yard-modal .family-tab', { hasText: 'Beams' }).click()
const beamBarred = await page.locator('.yard-modal .catalogue-row', { hasText: /^Beam-1/ }).evaluate((el) => el.classList.contains('is-barred'))
if (beamBarred) fail('second edition should keep the beams')
await shot('house-rules-yard')
await page.locator('.yard-modal').getByRole('button', { name: 'Close' }).click()

// ── A preset carried in a link ────────────────────────────────────────────
const preset = { version: 1, id: 'club-night', name: 'Club night', author: 'drive', gear: { mode: 'ban', banned: ['nova-cannon', 'wave-gun'] }, table: { cpv: false } }
const hash = Buffer.from(JSON.stringify(preset), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
// Pasted into the open tab: a fragment navigation, no reload.
await page.evaluate((h) => { window.location.hash = h }, `preset=${hash}`)
await page.waitForSelector('.preset-editor')
const name = await page.locator('.preset-editor input').first().inputValue()
if (name !== 'Club night') fail(`the link opened "${name}", not Club night`)
if (page.url().includes('#preset=')) fail('the hash was not taken off the address')
await page.locator('.preset-editor').getByRole('button', { name: 'Save to the shelf' }).click()
const after = await page.locator('.preset-editor .ds-shelf select option').allTextContents()
if (!after.includes('Club night')) fail('the linked preset did not reach the shelf')
console.log('linked preset saved; shelf now', after.length, 'entries')

await browser.close()
if (errors.length > 0) { console.error('page errors:', errors); process.exitCode = 1 }
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
