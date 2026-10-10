import { test, expect } from '@playwright/test'
import { settled, theme } from './helpers'

test('reference controls follow the keyboard viewport, including browser panning and dismissal', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'Exercises the phone keyboard viewport.')
	await page.goto('/John/3/16?version=BSB')
	await settled(page)
	const position = await page.evaluate(() => ({ y: scrollY, anchor: localStorage.getItem('bible-position') }))
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await input.fill('rom 8:28')
	const panel = page.getByRole('dialog', { name: 'Go to a passage' })
	const original = await panel.boundingBox()

	// Desktop Chromium cannot show an Android IME. Reproduce its visual-only resize
	// while leaving the layout viewport intact, as in an installed mobile PWA.
	for (const offsetTop of [0, 60]) {
		const visible = await page.evaluate((offsetTop) => {
			const viewport = window.visualViewport!
			const height = innerHeight - 320
			Object.defineProperties(viewport, {
				height: { configurable: true, value: height },
				offsetTop: { configurable: true, value: offsetTop },
			})
			viewport.dispatchEvent(new Event(offsetTop ? 'scroll' : 'resize'))
			return { top: offsetTop, bottom: height + offsetTop }
		}, offsetTop)
		await expect.poll(async () => Math.round((await panel.boundingBox())!.y + (await panel.boundingBox())!.height)).toBe(Math.round(visible.bottom - 14))
		for (const control of [input, page.getByRole('button', { name: 'Go', exact: true }), page.getByRole('button', { name: 'Close reference picker' })]) {
			const rect = (await control.boundingBox())!
			expect(rect.y).toBeGreaterThanOrEqual(visible.top)
			expect(rect.y + rect.height).toBeLessThanOrEqual(visible.bottom)
		}
		await expect(input).toBeFocused()
		await expect(input).toHaveValue('rom 8:28')
	}
	await page.getByRole('button', { name: 'Close reference picker' }).click()
	await page.evaluate(() => {
		const viewport = window.visualViewport!
		Object.defineProperties(viewport, {
			height: { configurable: true, value: innerHeight },
			offsetTop: { configurable: true, value: 0 },
		})
		viewport.dispatchEvent(new Event('resize'))
	})
	expect(await page.evaluate(() => ({ y: scrollY, anchor: localStorage.getItem('bible-position') }))).toEqual(position)
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await expect.poll(async () => (await panel.boundingBox())!.y).toBe(original!.y)
	await input.fill('rom 8:28')
	await input.press('Enter')
	await expect(page).toHaveURL(/\/Romans\/8\/28\?version=BSB$/)
})

test('reference focus and navigation work without VisualViewport support', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(window, 'visualViewport', { value: undefined }))
	await page.goto('/')
	await settled(page)
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await expect(input).toBeFocused()
	await input.fill('John 3:16')
	await input.press('Enter')
	await expect(page).toHaveURL(/\/John\/3\/16\?version=BSB$/)
})

for (const mode of ['dark', 'light'] as const) {
	test(`saved ${mode} theme reaches browser metadata before the app mounts`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' })
		await page.addInitScript((theme) => localStorage.setItem('bible-settings', JSON.stringify({ theme })), mode)
		await page.route('**/*.js', (route) => route.abort())
		await page.goto('/')
		await expect(page.locator('#app')).toBeEmpty()
		await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000')
		await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', mode)
		await expect(page.locator('body')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
	})
}

test('PWA chrome stays black while the reader color scheme follows settings and Auto', async ({ page }) => {
	await page.goto('/')
	await settled(page)
	const manifest = await page.evaluate(async () => {
		const url = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href
		return fetch(url).then((response) => response.json())
	})
	expect(manifest.theme_color).toBe('#000000')
	for (const mode of ['Dark', 'Light', 'Auto'] as const) {
		await theme(page, mode)
		await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', mode === 'Dark' ? 'dark' : 'light')
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000')
	}
	for (const colorScheme of ['dark', 'light'] as const) {
		await page.emulateMedia({ colorScheme })
		await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', colorScheme)
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000')
		await expect(page.locator('.reader')).toHaveCSS('background-color', colorScheme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
		await expect(page.locator('.reader-bar')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		for (const control of ['.reference-control', '.settings-control'])
			await expect(page.locator(control)).toHaveCSS('color', colorScheme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)')
	}
})

test('reduced transparency makes reader and selection pills solid in the active theme', async ({ page, context }) => {
	await page.goto('/')
	await settled(page)
	const session = await context.newCDPSession(page)
	for (const mode of ['light', 'dark']) {
		await session.send('Emulation.setEmulatedMedia', { features: [
			{ name: 'prefers-reduced-transparency', value: 'reduce' },
			{ name: 'prefers-color-scheme', value: mode },
		] })
		await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
		for (const control of ['.reference-control', '.settings-control']) {
			await expect(page.locator(control)).toHaveCSS('background-color', mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
			await expect(page.locator(control)).toHaveCSS('background-image', 'none')
			await expect(page.locator(control)).toHaveCSS('backdrop-filter', 'none')
		}
		await page.locator('[data-verse="gen.1.1"]').first().click()
		for (const control of ['.selection-count', '.selection-copy', '.selection-tray button[aria-label="Share"]', '.selection-clear']) {
			await expect(page.locator(control)).toHaveCSS('background-color', mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
			await expect(page.locator(control)).toHaveCSS('background-image', 'none')
			await expect(page.locator(control)).toHaveCSS('backdrop-filter', 'none')
		}
		await page.getByRole('button', { name: 'Clear', exact: true }).click()
	}
})

for (const mode of ['Light', 'Dark'] as const) {
	test(`settings float above the pills, select Aa and dim the reference in ${mode}`, async ({ page }) => {
		await page.goto('/')
		await settled(page)
		await theme(page, mode)
		const reference = page.locator('#reference-control')
		const toggle = page.locator('#settings-control')
		const position = await page.evaluate(() => ({ y: scrollY, url: location.href, anchor: localStorage.getItem('bible-position') }))
		const before = await reference.evaluate((element) => ({ opacity: getComputedStyle(element).opacity, background: getComputedStyle(element).background }))
		await toggle.click()
		const modal = page.getByRole('dialog', { name: 'Reader settings' })
		await expect(modal).toBeVisible()
		await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		await expect(reference).toBeVisible()
		await expect(reference).toHaveAttribute('inert', '')
		expect(await reference.evaluate((element) => ({ opacity: getComputedStyle(element).opacity, background: getComputedStyle(element).background }))).toEqual(before)
		await expect.poll(() => reference.evaluate((element) => getComputedStyle(element, '::after').backgroundColor)).toBe(mode === 'Dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.18)')
		await expect(toggle).toHaveCSS('background-color', mode === 'Dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)')
		await expect.poll(async () => {
			const panel = (await modal.boundingBox())!
			const button = (await toggle.boundingBox())!
			return Math.round(button.y - panel.y - panel.height)
		}).toBe(10)
		await toggle.click()
		await expect(modal).toHaveCount(0)
		await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		await expect(reference).not.toHaveAttribute('inert')
		await expect(reference).toHaveCSS('opacity', '1')
		await expect.poll(() => reference.evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none')
		expect(await page.evaluate(() => ({ y: scrollY, url: location.href, anchor: localStorage.getItem('bible-position') }))).toEqual(position)
	})
}

test('Aa participates in the settings focus trap and toggles with the keyboard', async ({ page }) => {
	await page.goto('/')
	await settled(page)
	const toggle = page.locator('#settings-control')
	await toggle.click()
	await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(toggle).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(page.getByRole('button', { name: 'Update app' })).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(toggle).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toHaveCount(0)
	await expect(toggle).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toHaveCount(0)
	await expect(toggle).toBeFocused()
})

test('the floating settings modal scrolls on a short viewport and respects reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 500 })
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/')
	await settled(page)
	await page.locator('#settings-control').click()
	const modal = page.getByRole('dialog', { name: 'Reader settings' })
	await expect(modal).toHaveCSS('animation-name', 'none')
	const bounds = (await modal.boundingBox())!
	expect(bounds.y).toBeGreaterThanOrEqual(16)
	expect(bounds.y + bounds.height).toBeLessThan(430)
	expect(await modal.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
	await modal.getByRole('button', { name: 'Update app' }).scrollIntoViewIfNeeded()
	await expect(modal.getByRole('button', { name: 'Update app' })).toBeInViewport()
	await page.locator('#settings-control').click()
	await expect(modal).toHaveCount(0)
})
