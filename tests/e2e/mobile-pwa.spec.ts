import { test, expect } from '@playwright/test'
import { settled, theme } from './helpers'

test('reference controls follow the keyboard viewport, including browser panning and dismissal', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'Exercises the phone sheet layout.')
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
		await expect.poll(async () => Math.round((await panel.boundingBox())!.y + (await panel.boundingBox())!.height)).toBe(Math.round(visible.bottom))
		for (const control of [input, page.getByRole('button', { name: 'Go', exact: true }), page.getByRole('button', { name: 'Close reference picker' })]) {
			const rect = (await control.boundingBox())!
			expect(rect.y).toBeGreaterThanOrEqual(visible.top)
			expect(rect.y + rect.height).toBeLessThanOrEqual(visible.bottom)
		}
		await expect(input).toBeFocused()
		await expect(input).toHaveValue('rom 8:28')
	}
	await page.getByRole('button', { name: 'Choose translation' }).click()
	await expect.poll(async () => (await panel.boundingBox())!.y).toBeGreaterThanOrEqual(60)
	await expect(input).toBeInViewport()
	await page.getByRole('button', { name: 'Close reference picker' }).click()
	await expect(input).toBeFocused()
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
		await expect(page.locator('.bottom-bar')).toHaveCSS('background-color', colorScheme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
	}
})
