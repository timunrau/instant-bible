import { test, expect } from '@playwright/test'
import { jump, settled, theme, verseTop } from './helpers'
test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await settled(page)
})
test('opens to Genesis 1 on the first launch', async ({ page }) => {
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Genesis 1')
	await expect(page.locator('[data-verse="gen.1.1"]')).toContainText(
		'In the beginning God created',
	)
	await expect(page).toHaveURL(/\/Genesis\/1\?version=BSB$/)
	await expect(page).toHaveTitle('Genesis 1 — Bible')
	expect(await page.locator('h1').count()).toBe(1)
})
test('focuses and selects the reference synchronously in the original tap gesture', async ({
	page,
}) => {
	const result = await page
		.getByRole('button', { name: 'Open reference picker' })
		.evaluate((button) => {
			;(button as HTMLButtonElement).click()
			const input = document.querySelector('input')!
			return {
				focused: document.activeElement === input,
				start: input.selectionStart,
				end: input.selectionEnd,
				value: input.value,
			}
		})
	expect(result).toEqual({
		focused: true,
		start: 0,
		end: 9,
		value: 'Genesis 1',
	})
})
test('does not show validation errors before an invalid reference is submitted', async ({
	page,
}) => {
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await input.fill('John 3:99')
	await expect(page.getByRole('alert')).toHaveCount(0)
	await input.press('Enter')
	await expect(page.getByRole('alert')).toHaveText(
		'Enter a valid Bible reference.',
	)
	await input.fill('rom 8:')
	await expect(page.getByRole('alert')).toHaveCount(0)
	await page.getByRole('button', { name: 'Go', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Romans 8')
})
test('the reference sheet has no duplicate interpretation or hint row', async ({
	page,
}) => {
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const panel = page.getByRole('dialog', { name: 'Go to a passage' })
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	for (const draft of ['Genesis 1', 'rom 8:28', '']) {
		await input.fill(draft)
		await expect(panel.locator('.interpretation, .input-hint')).toHaveCount(0)
		await expect(panel.getByRole('button')).toHaveCount(3)
	}
})
test('Psalm verse 1 navigation and selection start with Scripture after the descriptive heading', async ({
	page,
	isMobile,
}) => {
	await jump(page, 'Psalm3:1')
	const chapter = page.locator('#chapter-psa-3')
	await expect(
		chapter.locator('h3').filter({ hasText: 'A Psalm of David' }),
	).toHaveText('A Psalm of David, when he fled from his son Absalom.')
	await expect(chapter.locator('h3 [data-verse], h3 .verse-number')).toHaveCount(0)
	const verse = chapter.locator('[data-verse="psa.3.1"]')
	await expect(verse.first()).toContainText('1O LORD, how my foes have increased!')
	await expect(chapter.locator('[aria-label="Verse 1"]')).toHaveCount(1)
	await expect
		.poll(async () => Math.round(await verseTop(page, 'psa.3.1')))
		.toBe(isMobile ? 24 : 48)
	await verse.first().click()
	await expect(page.getByRole('status')).toHaveText('1 selected')
	await expect(chapter.locator('h3 .selected')).toHaveCount(0)
	await expect(chapter.locator('[data-verse="psa.3.1"].selected')).toHaveCount(
		await verse.count(),
	)
})
test('navigates chapter starts and individual verses to the top reading origin', async ({
	page,
	isMobile,
}) => {
	const origin = isMobile ? 24 : 48
	await jump(page, 'Psalm23')
	await expect
		.poll(() =>
			page
				.locator('#chapter-psa-23')
				.evaluate((e) => Math.round(e.getBoundingClientRect().top)),
		)
		.toBe(origin)
	await jump(page, 'John3:16')
	await expect
		.poll(async () => Math.round(await verseTop(page, 'jhn.3.16')))
		.toBe(origin)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 3')
})
test('temporary range indication never opens verse selection', async ({
	page,
}) => {
	await jump(page, 'John3:16,18-19')
	await expect(page.locator('[data-verse="jhn.3.16"]')).toHaveClass(/indicated/)
	await expect(page.locator('[data-verse="jhn.3.17"]')).not.toHaveClass(
		/indicated/,
	)
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
	await expect(page).toHaveURL(/\/John\/3\/16,18-19\?version=BSB/)
})
test('navigating an installed Bible and opening its reference picker performs no external network request', async ({
	page,
}) => {
	const requests: string[] = []
	page.on('request', (r) => {
		if (!r.url().startsWith('http://127.0.0.1:4173')) requests.push(r.url())
	})
	await jump(page, 'Psalm119:176')
	await jump(page, 'Jude5')
	await jump(page, 'Rev22:21')
	expect(requests).toEqual([])
})
test('restores the last semantic reading position on later launches', async ({
	page,
}) => {
	await jump(page, 'Romans8:28')
	await page.evaluate(() => window.scrollBy(0, 90))
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('bible-position')!).verse,
			),
		)
		.toBeGreaterThanOrEqual(28)
	const before = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('bible-position')!),
	)
	await page.reload()
	await settled(page)
	const top = await verseTop(page, `rom.8.${before.verse}`)
	expect(Math.abs(top)).toBeLessThan(220)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Romans 8')
})
test('browser Back restores the reading position from before a reference jump', async ({
	page,
}) => {
	await jump(page, 'Romans8:28')
	const original = await page.evaluate(() => localStorage.getItem('bible-position'))
	await page.evaluate(() => window.scrollBy(0, 65))
	await expect.poll(() => page.evaluate(() => localStorage.getItem('bible-position'))).not.toBe(original)
	const before = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('bible-position')!),
	)
	const top = await verseTop(page, `rom.8.${before.verse}`)
	await jump(page, 'Psalm23')
	await page.goBack()
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Romans 8')
	await expect
		.poll(async () =>
			Math.abs((await verseTop(page, `rom.8.${before.verse}`)) - top),
		)
		.toBeLessThan(3)
})
test('continuous scrolling extends a bounded chapter window without moving the visual anchor', async ({
	page,
}) => {
	await jump(page, 'John3')
	await page.evaluate(() =>
		document.getElementById('chapter-jhn-7')!.scrollIntoView(),
	)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 7')
	await expect(page.locator('#chapter-jhn-11')).toHaveCount(1)
	expect(await page.locator('.chapter').count()).toBeLessThanOrEqual(9)
	const position = await page
		.locator('#chapter-jhn-7')
		.evaluate((e) => e.getBoundingClientRect().top)
	expect(Math.abs(position)).toBeLessThan(60)
	await page.evaluate(() =>
		document.getElementById('chapter-jhn-4')!.scrollIntoView(),
	)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 4')
	await expect(page.locator('#chapter-jhn-1')).toHaveCount(1)
})
test('continues naturally across Malachi 4 into Matthew 1', async ({
	page,
}) => {
	await jump(page, 'Malachi4')
	await expect(page.locator('#chapter-mat-1 h1')).toHaveText('Matthew')
	await page.evaluate(() =>
		document.getElementById('chapter-mat-1')!.scrollIntoView(),
	)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Matthew 1')
})
test('selects and toggles arbitrary semantic verses and replaces the normal tray', async ({
	page,
}) => {
	await jump(page, 'John3:16')
	for (const id of ['jhn.3.19', 'jhn.3.16', 'jhn.3.18'])
		await page.locator(`[data-verse="${id}"]`).first().click()
	await expect(page.getByRole('status')).toHaveText('3 selected')
	await expect(page.locator('[data-verse="jhn.3.16"]')).toHaveCSS('animation-name', 'none')
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveCount(0)
	await page.locator('[data-verse="jhn.3.18"]').click()
	await expect(page.getByRole('status')).toHaveText('2 selected')
	await page.getByRole('button', { name: 'Clear', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toBeVisible()
	await page.locator('[data-verse="jhn.3.16"]').click()
	await page.locator('[data-verse="jhn.3.16"]').click()
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
})
test('copies skipped verses in canonical order as prose and shares a full deep link', async ({
	page,
}) => {
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: async (text: string) => {
					;(window as unknown as { lastCopy: string }).lastCopy = text
				},
			},
			configurable: true,
		})
		Object.defineProperty(navigator, 'share', {
			value: undefined,
			configurable: true,
		})
	})
	await jump(page, 'John3:16')
	for (const id of ['jhn.3.19', 'jhn.3.16', 'jhn.3.18'])
		await page.locator(`[data-verse="${id}"]`).click()
	await page.getByRole('button', { name: 'Copy', exact: true }).click()
	await expect(
		page.getByRole('button', { name: 'Copied', exact: true }),
	).toBeVisible()
	const content = await page.evaluate(
		() => (window as unknown as { lastCopy: string }).lastCopy,
	)
	expect(content).toMatch(/^For God so loved/)
	expect(content).toMatch(/John 3:16, 18–19 BSB$/)
	await page.getByRole('button', { name: 'Share', exact: true }).click()
	const share = await page.evaluate(
		() => (window as unknown as { lastCopy: string }).lastCopy,
	)
	expect(share).toContain(content)
	expect(share).toContain('/John/3/16,18-19?version=BSB')
})
test('preserves native text selection and ignores drag and long-press verse gestures', async ({
	page,
}) => {
	await jump(page, 'John3:16')
	await page.locator('[data-verse="jhn.3.16"]').evaluate((e) => {
		const range = document.createRange()
		range.selectNodeContents(e)
		const s = getSelection()!
		s.removeAllRanges()
		s.addRange(range)
		e.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: 100,
				clientY: 100,
			}),
		)
		e.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: 100,
				clientY: 100,
			}),
		)
	})
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
	await page.evaluate(() => getSelection()!.removeAllRanges())
	await page.locator('[data-verse="jhn.3.16"]').evaluate((e) => {
		e.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: 100,
				clientY: 100,
			}),
		)
		e.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: 101,
				clientY: 180,
			}),
		)
	})
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
})
test('opens a subtle footnote without changing the reading position or selection', async ({
	page,
}) => {
	const y = await page.evaluate(() => scrollY)
	await page.locator('.note-marker').first().click()
	await expect(
		page.getByRole('dialog', { name: 'Scripture footnote' }),
	).toContainText('Cited in 2 Corinthians 4:6')
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
	await page.getByRole('button', { name: 'Close footnote' }).click()
	expect(await page.evaluate(() => scrollY)).toBe(y)
})
test('persists reader settings and AMOLED uses exact black and white', async ({
	page,
}) => {
	await theme(page, 'Dark')
	await expect(page.locator('#reader')).toHaveCSS(
		'background-color',
		'rgb(0, 0, 0)',
	)
	await expect(page.locator('#reader')).toHaveCSS('color', 'rgb(255, 255, 255)')
	await page
		.getByRole('button', { name: 'Reader settings', exact: true })
		.click()
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toHaveCSS(
		'background-color',
		'rgb(0, 0, 0)',
	)
	await page.getByRole('button', { name: 'Sans', exact: true }).click()
	await page.getByRole('button', { name: 'Text size 24', exact: true }).click()
	await page.getByRole('button', { name: 'Compact', exact: true }).click()
	await page.getByRole('button', { name: 'Close settings' }).click()
	await page.reload()
	await settled(page)
	await expect(page.locator('#reader')).toHaveCSS('font-size', '24px')
	await expect(page.locator('#reader')).toHaveCSS('color', 'rgb(255, 255, 255)')
})
test('font changes and viewport resize preserve the same semantic reading anchor', async ({
	page,
}) => {
	await jump(page, 'Romans8:28')
	await page
		.getByRole('button', { name: 'Reader settings', exact: true })
		.click()
	await page.getByRole('button', { name: 'Text size 27', exact: true }).click()
	await page.getByRole('button', { name: 'Close settings' }).click()
	const anchor = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('bible-position')!),
	)
	expect(anchor.verse).toBe(28)
	await page.setViewportSize({ width: 600, height: 850 })
	await expect
		.poll(async () => Math.abs((await verseTop(page, 'rom.8.28')) - 24))
		.toBeLessThan(5)
})
test('opens incoming deep links directly to the selected reference', async ({
	page,
	isMobile,
}) => {
	await page.goto('/John/3/16,18,20-21?version=BSB')
	await settled(page)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 3')
	await expect
		.poll(async () => Math.round(await verseTop(page, 'jhn.3.16')))
		.toBe(isMobile ? 24 : 48)
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
})

test('restores the same fragment when a semantic verse spans multiple poetry lines', async ({
	page,
	isMobile,
}) => {
	await jump(page, 'Psalm23:4')
	const part = page.locator('[data-verse="psa.23.4"]').nth(1)
	await part.evaluate(
		(e, origin) => {
			e.scrollIntoView()
			window.scrollBy(0, -origin + 3)
		},
		isMobile ? 24 : 48,
	)
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('bible-position')!).fragment,
			),
		)
		.toBe(1)
	const before = await part.evaluate((e) => e.getBoundingClientRect().top)
	await page.reload()
	await settled(page)
	await expect
		.poll(() => part.evaluate((e) => e.getBoundingClientRect().top))
		.toBeCloseTo(before, 0)
})


test('a long press does not toggle verse selection', async ({ page }) => {
  await jump(page, 'John3:16')
  const verse = page.locator('[data-verse="jhn.3.16"]')
  await verse.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 })
  await page.waitForTimeout(500)
  await verse.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 100 })
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toHaveCount(0)
})
