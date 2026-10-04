import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { jump, settled } from '../tests/e2e/helpers'

const output = resolve(import.meta.dirname, '../docs/screenshots')

test('capture README screenshots', async ({ page }, testInfo) => {
	await mkdir(output, { recursive: true })
	await page.goto('/Psalm/23?version=BSB')
	await settled(page)
	await expect(page.locator('#chapter-psa-23 h2')).toBeVisible()
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

	const capture = (name: string) => page.screenshot({
		path: resolve(output, `${testInfo.project.name}-${name}.png`),
		animations: 'disabled',
		caret: 'hide',
	})
	await capture('reader')

	await page.getByRole('button', { name: 'Open reference picker' }).click()
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await expect(input).toBeFocused()
	await input.fill('John 3:16')
	await capture('reference')
	await page.getByRole('button', { name: 'Close reference picker' }).click()

	await jump(page, 'John 3:16')
	await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
	await capture('settings')
})
