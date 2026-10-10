import { test, expect } from '@playwright/test'
import { jump, settled, theme } from './helpers'
test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await settled(page)
})
test('canonical reading visual states', async ({ page }) => {
	await expect(page).toHaveScreenshot('book-start-light.png')
	await jump(page, 'John3')
	await expect(page).toHaveScreenshot('chapter-start-light.png')
	await jump(page, 'Psalm23')
	await expect(page).toHaveScreenshot('poetry-light.png')
	await theme(page, 'Dark')
	await expect(page).toHaveScreenshot('poetry-amoled.png')
})
test('canonical selection visual states', async ({ page }) => {
	await theme(page, 'Dark')
	await jump(page, 'John3:16')
	await page.locator('[data-verse="jhn.3.16"]').click()
	await page.locator('[data-verse="jhn.3.18"]').click()
	await expect(page.locator('.selection-tray')).toHaveScreenshot('selection-tray.png')
	await expect(page).toHaveScreenshot('selected-amoled.png')
})
test('canonical dialog visual states', async ({ page }) => {
	await theme(page, 'Dark')
	await jump(page, 'John3:16')
	await page.locator('[data-verse="jhn.3.16"]').click()
	await page.locator('[data-verse="jhn.3.18"]').click()
	await page.getByRole('button', { name: 'Clear', exact: true }).click()
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await expect(page).toHaveScreenshot('reference-picker-amoled.png')
	await page.getByRole('button', { name: 'Close reference picker' }).click()
	await page
		.getByRole('button', { name: 'Reader settings', exact: true })
		.click()
	await expect(page).toHaveScreenshot('settings-amoled.png')
})
