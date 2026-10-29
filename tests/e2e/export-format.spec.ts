import { test, expect } from '@playwright/test'
import { settled, verseTop } from './helpers'

test('format preferences persist without moving the reader and retain disabled superscripts', async ({ page }) => {
	await page.goto('/John/3/16?version=BSB')
	await settled(page)
	const top = await verseTop(page, 'jhn.3.16')
	await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Include verse numbers', exact: true })).toBeChecked()
	await expect(page.getByRole('checkbox', { name: 'Bold reference (md)', exact: true })).not.toBeChecked()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).not.toBeChecked()
	await page.getByRole('checkbox', { name: 'Bold reference (md)', exact: true }).check()
	await page.getByRole('checkbox', { name: 'Superscript numbers', exact: true }).check()
	await page.getByRole('checkbox', { name: 'Include verse numbers', exact: true }).uncheck()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeDisabled()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeChecked()
	await page.getByRole('button', { name: 'Close settings' }).click()
	expect(await verseTop(page, 'jhn.3.16')).toBeCloseTo(top, 0)
	await page.reload()
	await settled(page)
	await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Include verse numbers', exact: true })).not.toBeChecked()
	await expect(page.getByRole('checkbox', { name: 'Bold reference (md)', exact: true })).toBeChecked()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeDisabled()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeChecked()
	await page.getByRole('checkbox', { name: 'Include verse numbers', exact: true }).check()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeEnabled()
	await expect(page.getByRole('checkbox', { name: 'Superscript numbers', exact: true })).toBeChecked()
})

for (const action of ['Copy', 'keyboard', 'native share', 'unavailable share', 'failed share'] as const) {
	for (const includeVerseNumbers of [true, false]) {
		test(`${action} uses formatting with verse numbers ${includeVerseNumbers ? 'on' : 'off'}`, async ({ page }) => {
			await page.addInitScript(({ action, includeVerseNumbers }) => {
				localStorage.setItem('bible-settings', JSON.stringify({ includeVerseNumbers, boldReference: true, superscriptNumbers: true }))
				const state = window as unknown as { exported?: string; shared?: string }
				Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { state.exported = text } } })
				Object.defineProperty(navigator, 'share', { configurable: true, value: action === 'unavailable share' ? undefined : async (data: ShareData) => {
					state.shared = data.text
					if (action === 'failed share') throw new DOMException('Share failed', 'NotAllowedError')
					state.exported = data.text
				} })
			}, { action, includeVerseNumbers })
			await page.goto('/John/3/16?version=BSB')
			await settled(page)
			for (const verse of [18, 16]) await page.locator(`[data-verse="jhn.3.${verse}"]`).first().click()
			if (action === 'keyboard') await page.keyboard.press('Control+c')
			else await page.getByRole('button', { name: action === 'Copy' ? 'Copy' : 'Share', exact: true }).click()
			await expect(page.locator('.copy-confirmation')).toHaveText(action === 'native share' ? 'Shared' : 'Copied')
			await expect(page.locator('.selected')).toHaveCount(0)
			const state = await page.evaluate(() => {
				const { exported, shared } = window as unknown as { exported: string; shared?: string }
				return { exported, shared }
			})
			expect(state.exported).toMatch(/^For God so loved/)
			expect(state.exported).toContain(' **John 3:16, 18 BSB**')
			expect(state.exported.includes('¹⁸ Whoever believes')).toBe(includeVerseNumbers)
			expect(state.exported).not.toContain('18 Whoever believes')
			if (action.includes('share')) {
				expect(state.exported.split('\n')).toHaveLength(2)
				expect(state.exported.split('\n')[1]).toBe(new URL('/John/3/16,18?version=BSB', page.url()).href)
				if (action === 'failed share') expect(state.exported).toBe(state.shared)
			} else expect(state.exported).not.toContain('\n')
		})
	}
}
