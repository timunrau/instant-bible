import { expect, type Page } from '@playwright/test'
export async function jump(page: Page, reference: string) {
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await expect(input).toBeFocused()
	await input.fill(reference)
	const entries = await page.evaluate(() => history.length)
	await input.press('Enter')
	await expect.poll(() => page.evaluate(() => history.length)).toBe(entries + 1)
	await expect(
		page.getByRole('dialog', { name: 'Go to a passage' }),
	).toBeHidden()
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toBeEnabled()
	await page.evaluate(() => document.fonts.ready)
	await page.waitForFunction(
		() => document.querySelectorAll('.chapter').length > 1,
	)
}
export async function verseTop(page: Page, id: string) {
	return page
		.locator(`[data-verse="${id}"]`)
		.first()
		.evaluate((e) => e.getBoundingClientRect().top)
}
export async function settled(page: Page) {
	await page.evaluate(() => document.fonts.ready)
	await expect(page.locator('.chapter').first()).toBeVisible()
	await page.waitForFunction(
		() => document.querySelectorAll('.chapter').length > 1,
	)
}
export async function theme(page: Page, name: string) {
	await page
		.getByRole('button', { name: 'Reader settings', exact: true })
		.click()
	await page.getByRole('button', { name, exact: true }).click()
	await page.getByRole('button', { name: 'Close settings' }).click()
}
