import { chromium } from 'playwright'

/**
 * The Firing Range through the real console: open the Motor Pool, pick the
 * DEIMOS, open the range, read the plan for its MDC/4 against the Medium
 * Battle Tank, move the range through the bands, fire a few shots and
 * read the log, then turn the gun on infantry and watch the refusals.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_firing_range.mjs
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
await page.locator('.ds-shelf select').selectOption({ label: 'DEIMOS/SO · 356' })
await page.getByRole('button', { name: 'Firing range' }).click()
await page.waitForSelector('.ds-range')

const plan = page.locator('.ds-range .ds-plan')
const planText = async () => (await plan.textContent()) ?? ''
const firer = page.locator('.ds-range select[aria-label="Firer"]')
const weapon = page.locator('.ds-range select[aria-label="Weapon"]')
const target = page.locator('.ds-range select[aria-label="Target"]')
const range = page.locator('.ds-range input[aria-label="Range"]')
const pick = async (select, re) => {
  const options = await select.locator('option').evaluateAll((els) => els.map((el) => ({ value: el.value, text: el.textContent ?? '' })))
  const found = options.find((o) => re.test(o.text))
  if (!found) throw new Error(`no option matching ${re}`)
  await select.selectOption(found.value)
}

console.log('firer:', await firer.locator('option:checked').textContent(), '| weapon:', await weapon.locator('option:checked').textContent())
if (!/DEIMOS/.test(await firer.locator('option:checked').textContent())) fail('the bench design is not the firer')
await pick(target, /Medium Battle Tank/)
await range.fill('24')
let text = await planText()
console.log('plan at 24":', text.replace(/\s+/g, ' ').slice(0, 220))
// The DEIMOS has superior fire control and an MDC/4: 24" is close range, so a D12 against the MBT's signature die.
if (!/close range/.test(text)) fail('24" for an MDC/4 is not shown as close range')
if (!/FirerrollsD12/.test(text.replace(/\s+/g, ''))) fail('close range with superior fire control is not a D12')
if (!/4 chits, all colours/.test(text)) fail('an MDC/4 at close range does not draw 4 chits of every colour')
await shot('firing-range-plan')

// Out past the long band: the plan becomes a refusal naming the page.
await range.fill('61')
const refused = await page.locator('.ds-range .yard-side .faults').textContent()
console.log('at 61":', refused?.trim())
if (!/p\. 28/.test(refused ?? '')) fail('a shot beyond long range is not refused with p. 28')

// Long range, hull down: two target dice, red only.
await range.fill('50')
await page.locator('.ds-range select[aria-label="Posture"]').selectOption('hull-down')
text = await planText()
if (!/long range/.test(text)) fail('50" for an MDC/4 is not long range')
if (!/and D10, the higher/.test(text)) fail('hull down does not add a D10')
if (!/red only/.test(text)) fail('an MDC at long range is not red only')

// Fire five shots with a fixed seed at a target in the open, and read the log.
await page.locator('.ds-range select[aria-label="Posture"]').selectOption('none')
await page.locator('.ds-range input[aria-label="Seed"]').fill('4242')
await range.fill('30')
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Fire', exact: true }).click()
const entries = page.locator('.ds-log-entry')
const count = await entries.count()
console.log('log entries:', count)
if (count !== 5) fail(`expected 5 log entries, got ${count}`)
const first = await entries.first().textContent()
console.log('latest:', first?.replace(/\s+/g, ' ').slice(0, 240))
if (!/Firer rolled \d+; target rolled/.test(first ?? '')) fail('the log does not show the dice')
const verdicts = await page.locator('.ds-log-entry .ds-verdict').allTextContents()
console.log('verdicts:', verdicts.join(' | '))
if (!verdicts.every((v) => /Miss|Knocked out|BOOM|Damaged|damaged|immobilised|systems down|No effect/i.test(v))) fail('a verdict is not one of the book\'s outcomes')
const chips = await page.locator('.ds-log-entry .ds-chit').count()
if (verdicts.some((v) => !/Miss/.test(v)) && chips === 0) fail('a hit shows no chits')
await shot('firing-range-log')

// Rewinding the seed gives the same five shots again.
await page.getByRole('button', { name: 'Rewind' }).click()
await page.getByRole('button', { name: 'Clear the log' }).click()
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Fire', exact: true }).click()
const again = await page.locator('.ds-log-entry .ds-verdict').allTextContents()
if (again.join('|') !== verdicts.join('|')) fail('the same seed did not replay the same shots')

// Infantry: the HEL on the MBT? No — turn the DEIMOS's MDC on line infantry in the open: 2 chits, yellow only, no roll.
await page.getByRole('radio', { name: 'Infantry' }).check()
await range.fill('30')
text = await planText()
console.log('infantry plan:', text.replace(/\s+/g, ' ').slice(0, 200))
if (!/the hit is automatic/.test(text)) fail('fire on infantry still rolls')
if (!/2 chits, yellow only/.test(text)) fail('an MDC on infantry is not 2 chits, yellow only')
await page.locator('.ds-range select[aria-label="Infantry validity"]').selectOption('position')
text = await planText()
if (!/red and yellow/.test(text)) fail('the firefight reading in the open is not red and yellow')
// Beyond the medium band the MDC cannot fire on infantry at all.
await range.fill('45')
const inf = await page.locator('.ds-range .yard-side .faults').textContent()
console.log('MDC/4 at 45" on infantry:', inf?.trim())
if (!/p\. 36/.test(inf ?? '')) fail('an MDC beyond its medium band on infantry is not refused with p. 36')
await shot('firing-range-infantry')

// The Medium Battle Tank's HKP has no effect on infantry.
await pick(firer, /Medium Battle Tank/)
await range.fill('10')
const hkp = await page.locator('.ds-range .yard-side .faults').textContent()
console.log('HKP on infantry:', hkp?.trim())
if (!/not effective against infantry/.test(hkp ?? '')) fail('an HKP on infantry is not refused')

await page.locator('.ds-range').getByRole('button', { name: 'Close' }).click()
if (await page.locator('.ds-range').count()) fail('the range did not close')

if (errors.length) fail(`console errors: ${errors.join(' | ')}`)
await browser.close()
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
