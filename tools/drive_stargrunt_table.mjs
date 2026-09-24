import { chromium } from 'playwright'

/**
 * The Stargrunt table through the real console: set up a skirmish from the
 * menu, deploy, choose who goes first, activate a squad, move it, fire on
 * an enemy squad, reorganise, end the activation, work through a few more
 * activations, then save and reload and find the battle still on the
 * table. On the pattern of `tools/drive_dirtside_table.mjs`.
 *
 * K1's charge flow gets its own close look: pick a target, see it refused
 * with a reason when it is out of reach, pick a target in reach and see
 * the default contact paths, odds, contact chances and the ifShort choice,
 * flip that choice, then Charge and read the result in the log. Reaching a
 * real close assault by ordinary random play is rare in a few activations
 * (REVIEW-1.md found the same when driving this table), so the two
 * squads are put in reach directly through the dev battle handle
 * (`window.__stargrunt`, the same door the review's own repros used) —
 * everything from there on is the real screen, the real `planAssault`,
 * the real dispatch. The close assault itself still resolves through this
 * worktree's own (old) handler; the new one lands in the other worktree
 * and this drive is re-run against it after the merge.
 *
 * Runs the whole thing at both 1500×1000 and 1280×800 (K2's two sizes),
 * screenshotting into `DRIVE_SHOT_DIR` for a look afterwards.
 *
 *   npx vite --port 5231 --strictPort &
 *   node tools/drive_stargrunt_table.mjs
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const errors = []
const fail = (why) => {
  console.error('FAIL:', why)
  process.exitCode = 1
}

async function runDrive(width, height) {
  const tag = `${width}x${height}`
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`)
  })
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stargrunt-${tag}-${name}.png` })
  }
  const banner = async () => (await page.locator('.dst-banner').textContent()) ?? ''
  const hint = async () => (await page.locator('.dst-hint').textContent()) ?? ''
  const logText = async () => (await page.locator('.dst-log').textContent()) ?? ''

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('ftpc.stargrunt.battle.v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Stargrunt table/ }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup input[aria-label="Seed"]').fill('4242')
  const sideCols = await page.locator('.sg-side').count()
  if (sideCols !== 2) fail(`[${tag}] expected 2 side columns in setup, got ${sideCols}`)
  await shot('skirmish')
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-mapsvg')
  if (!/Deployment/.test(await banner())) fail(`[${tag}] the table did not open in deployment`)
  const figureCount = await page.locator('.sg-figure').count()
  if (figureCount < 20) fail(`[${tag}] expected both platoons on the table, got ${figureCount} figures`)
  await shot('deploy')

  // Deploy: pick a northern figure and put it inside the deployment strip.
  await page.locator('.sg-figure.is-north').first().click()
  if (!(await page.locator('.sg-figure.is-selected').count())) fail(`[${tag}] clicking a figure did not select it`)
  const svg = page.locator('.dst-mapsvg')
  const box = await svg.boundingBox()
  const pxPerInch = await svg.evaluate((el) => el.getScreenCTM().a)
  await page.mouse.click(box.x + 4 * pxPerInch, box.y + 3 * pxPerInch)
  await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
  await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
  if (!/chooses who activates first/.test(await banner())) fail(`[${tag}] turn 1 did not start`)
  await page.locator('.dst-actions button').first().click()
  if (!/to activate a unit/.test(await banner())) fail(`[${tag}] no side is to activate`)

  // Activate whoever is up, plot a normal move toward the middle of the table.
  await page.locator('.sg-roster-row').first().click()
  await page.getByRole('button', { name: /^Activate / }).click()
  if (!/is activated/.test(await banner())) fail(`[${tag}] the squad did not activate`)
  await shot('activated')
  const north = (await page.locator('.dst-active.is-north').count()) > 0
  await page.getByRole('button', { name: 'Normal', exact: true }).click()
  const table = await svg.boundingBox()
  const midX = table.width / 2 / pxPerInch
  await page.mouse.click(table.x + midX * pxPerInch, table.y + (north ? 20 : 16) * pxPerInch)
  if (!/makes a normal move/.test(await logText())) fail(`[${tag}] the move is not in the log`)

  // Fire small arms at the nearest enemy squad if one is lit; otherwise reorganise.
  await page.getByRole('button', { name: 'Small arms' }).click()
  const enemyPennant = page.locator(north ? '.sg-pennant.is-south' : '.sg-pennant.is-north').first()
  if (await enemyPennant.count()) await enemyPennant.click({ timeout: 3000, force: true }).catch(() => {})
  await page.waitForTimeout(150)
  if (await page.locator('.dst-refusal').count()) {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Reorganise' }).click()
  } else if (!/fires small arms|fires .*support weapon/.test(await logText())) {
    fail(`[${tag}] no fire action reached the log`)
  }
  await shot('fire')
  if (await page.locator('.sg-end').count()) await page.locator('.sg-end').click()
  if (!/to activate a unit|chooses who activates first/.test(await banner())) fail(`[${tag}] the activation did not end`)

  // ---- K2: the active squad, its actions and the primary End button all sit inside the visible clip of
  // `.side-scroll`, without needing that column scrolled first — check this while there is a real active
  // unit on screen with a real action panel under it.
  if (await page.locator('.sg-active').count()) {
    const geo = await page.evaluate(() => {
      const scroll = document.querySelector('.side-scroll')
      const end = document.querySelector('.sg-end')
      if (!scroll || !end) return null
      const s = scroll.getBoundingClientRect()
      const e = end.getBoundingClientRect()
      return { clipTop: s.top, clipBottom: s.top + scroll.clientHeight, endTop: e.top, endBottom: e.bottom }
    })
    if (geo && (geo.endBottom > geo.clipBottom || geo.endTop < geo.clipTop)) {
      fail(`[${tag}] K2: the primary End button needs the side column scrolled to reach (${JSON.stringify(geo)})`)
    }
  }

  // The battle survives a reload and the menu offers to continue it. Checked before the charge below,
  // whose staging moves figures through the dev handle without a journal entry, so a battle saved after
  // it no longer replays (the engine now checks a charge's reach).
  await page.reload({ waitUntil: 'networkidle' })
  const cont = page.getByRole('button', { name: /Continue the squad battle/ })
  if (!(await cont.count())) fail(`[${tag}] the menu does not offer to continue the squad battle`)
  else {
    await cont.click()
    await page.waitForSelector('.dst-mapsvg')
    if (!/makes a normal move/.test(await logText())) fail(`[${tag}] the reloaded battle lost its log`)
  }

  // ---- K1: the charge flow. Right now the table is between activations (a side is "to activate a
  // unit", nobody picked yet) — stage a fit, unrestricted mover of that very side next to an enemy
  // squad (and leave another enemy squad at its original, far-off spot for the refused case), through
  // the dev battle handle, so its Charge is legal and its own activation is one click away.
  const placed = await page.evaluate(() => {
    const battle = window.__stargrunt?.currentStargruntBattle?.()
    if (!battle || battle.phase !== 'activation' || battle.activation || !battle.toAct) return null
    const side = battle.toAct
    const enemySide = side === 'north' ? 'south' : 'north'
    const fit = (u) => u.figureIds.some((id) => battle.figures[id].status === 'ok')
    const mover = Object.values(battle.units).find((u) => u.sideId === side && !u.activated && fit(u) && u.suppression === 0 && !u.panic && u.confidence !== 'BR' && u.confidence !== 'RO')
    const enemies = Object.values(battle.units).filter((u) => u.sideId === enemySide && fit(u))
    const target = enemies[0]
    const far = enemies.find((u) => u.id !== target?.id) ?? null
    if (!mover || !target) return null
    const anchor = battle.figures[mover.figureIds[0]].position
    target.figureIds.forEach((id, i) => {
      battle.figures[id] = { ...battle.figures[id], position: { x: anchor.x + 2 + i * 0.3, y: anchor.y + 1 } }
    })
    // Pushed to whichever corner is farthest from the mover, well beyond any combat-move reach: the
    // refused case.
    if (far) {
      const { width, depth } = battle.setup.table
      const farX = anchor.x < width / 2 ? width - 1 : 1
      const farY = anchor.y < depth / 2 ? depth - 1 : 1
      far.figureIds.forEach((id, i) => {
        battle.figures[id] = { ...battle.figures[id], position: { x: Math.min(Math.max(farX + i * 0.3, 0.5), width - 0.5), y: farY } }
      })
    }
    return { moverId: mover.id, targetId: target.id, targetSide: enemySide, farId: far?.id ?? null }
  })
  if (!placed) {
    fail(`[${tag}] K1: could not stage a mover/target pair for the charge (banner: ${await banner()})`)
  } else {
    await page.locator(`.sg-pennant[data-unit="${placed.moverId}"]`).click({ timeout: 3000, force: true })
    const activate = page.getByRole('button', { name: /^Activate / })
    let ready = false
    if (await activate.count()) {
      await activate.click()
      ready = /is activated/.test(await banner())
    }
    if (!ready) fail(`[${tag}] K1: staging did not leave the mover ready to activate (banner: ${await banner()})`)
    else {
      const chargeStart = page.getByRole('button', { name: 'Charge' })
      if (await chargeStart.isDisabled()) {
        const reason = await chargeStart.locator('xpath=..').getAttribute('title')
        const activeName = (await page.evaluate(() => window.__stargrunt.currentStargruntBattle().activation?.unitId)) ?? '?'
        fail(`[${tag}] K1: staged mover's Charge is refused (active unit: ${activeName}, wanted: ${placed.moverId}, reason: ${reason})`)
        await shot('charge-disabled-debug')
        await browser.close()
        return
      }
      await chargeStart.click()
      await page.waitForTimeout(100)
      const armedHint = await hint()
      if (!/Click an enemy squad to charge it/.test(armedHint)) fail(`[${tag}] K1: arming Charge did not prompt for a target (hint: ${armedHint})`)

      // A refused target: the enemy squad staged at the far corner, well beyond two combat moves' reach.
      const refusedPennant = page.locator(`.sg-pennant[data-unit="${placed.farId}"]`)
      const refusedCount = placed.farId ? await refusedPennant.count() : 0
      if (refusedCount === 0) {
        fail(`[${tag}] K1: no other ${placed.targetSide} squad to try as a refused target`)
      } else {
        await refusedPennant.click({ timeout: 3000, force: true })
        await page.waitForTimeout(100)
        const preview = page.locator('.sg-assault-preview')
        const previewCount = await preview.count()
        if (previewCount === 0) {
          fail(`[${tag}] K1: clicking a far-off enemy squad showed no charge preview at all (hint: ${await hint()})`)
        } else if (!(await preview.evaluate((el) => el.classList.contains('is-refused')))) {
          fail(`[${tag}] K1: an out-of-reach target's preview was not marked refused (text: ${await preview.textContent()})`)
        } else if (!(await page.locator('.sg-assault-preview-acts button', { hasText: 'Charge' }).isDisabled())) {
          fail(`[${tag}] K1: a refused plan's Charge button was not greyed out`)
        }
        await shot('assault-refused')
        if (previewCount > 0) await page.getByRole('button', { name: 'Pick another target' }).click()
      }

      // The staged, in-reach target: the full preview, the ifShort choice, then Charge.
      const target = page.locator(`.sg-pennant[data-unit="${placed.targetId}"]`)
      await target.click({ timeout: 3000, force: true }).catch(() => {})
      await shot('assault-preview')
      const previewText = (await page.locator('.sg-assault-preview').textContent()) ?? ''
      if (!/Odds \d+:1/.test(previewText) || !/Contact: \d+% on the first roll/.test(previewText)) {
        fail(`[${tag}] K1: the in-reach preview is missing odds/contact wording (${previewText})`)
      }
      const paths = await page.locator('.sg-assault-path').count()
      if (paths === 0) fail(`[${tag}] K1: no default contact paths drawn on the map`)
      if (!(await page.getByRole('button', { name: 'Stay in the open' }).evaluate((el) => el.classList.contains('is-on')))) {
        fail(`[${tag}] K1: ifShort did not default to "stay"`)
      }
      await page.getByRole('button', { name: 'Fall back' }).click()
      if (!(await page.getByRole('button', { name: 'Fall back' }).evaluate((el) => el.classList.contains('is-on')))) {
        fail(`[${tag}] K1: choosing "Fall back" did not select it`)
      }
      const chargeBtn = page.locator('.sg-assault-preview-acts button', { hasText: 'Charge' })
      if (await chargeBtn.isDisabled()) fail(`[${tag}] K1: the in-reach target's Charge button is refused`)
      else {
        await chargeBtn.click()
        await page.waitForTimeout(150)
        const afterLog = await logText()
        if (!/nerves itself to close assault|close assault/i.test(afterLog)) fail(`[${tag}] K1: the charge did not reach the log`)
        if (await page.locator('.sg-assault-preview').count()) fail(`[${tag}] K1: the preview did not clear once the charge resolved`)
      }
      await shot('assault-after')
    }
  }
  if (await page.locator('.sg-end').count()) await page.locator('.sg-end').click()
  await shot('table')


  await browser.close()
}

await runDrive(1500, 1000)
await runDrive(1280, 800)

if (errors.length) fail(`console errors: ${errors.join(' | ')}`)
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
