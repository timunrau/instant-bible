import { test, expect } from '@playwright/test'
import { jump, settled } from './helpers'

test('offers only bundled BSB and makes no external Scripture requests', async ({ page }) => {
	const external: string[] = []
	page.on('request', (request) => { if (request.url().startsWith('https://')) external.push(request.url()) })
	await page.goto('/')
	await settled(page)
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await expect(page.getByRole('button', { name: 'Choose translation' })).toHaveCount(0)
	await expect(page.locator('.translation-list')).toHaveCount(0)
	await page.getByRole('textbox', { name: 'Bible reference' }).fill('John3:16')
	await page.getByRole('textbox', { name: 'Bible reference' }).press('Enter')
	await expect(page).toHaveURL(/\/John\/3\/16\?version=BSB$/)
	await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
	await expect(page.locator('.attribution')).toContainText('Berean Standard Bible')
	await expect(page.getByRole('button', { name: /Remove|Download/ })).toHaveCount(0)
	await page.getByRole('button', { name: 'Close settings' }).click()
	await jump(page, 'Psalm23')
	expect(external).toEqual([])
})

test('old translation links open their passage and range in BSB without downloads', async ({ page }) => {
	const external: string[] = []
	page.on('request', (request) => { if (request.url().startsWith('https://')) external.push(request.url()) })
	await page.goto('/John/3/16-18?version=WEB')
	await settled(page)
	await expect(page).toHaveURL(/\/John\/3\/16-18\?version=BSB$/)
	await expect(page.locator('[data-verse="jhn.3.16"]')).toContainText('For God so loved')
	await expect(page.locator('[data-verse="jhn.3.18"]')).toHaveClass(/indicated/)
	await expect(page.locator('.selection-tray')).toHaveCount(0)
	await jump(page, 'Romans8:28')
	await page.goBack()
	await expect(page.getByRole('button', { name: 'Open reference picker' })).toHaveText('John 3')
	await expect(page).toHaveURL(/version=BSB/)
	expect(external).toEqual([])
})

test('restores old saved positions in BSB and removes optional caches without touching the precache', async ({ page, context }) => {
	await page.goto('/')
	await settled(page)
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
	const retained = await page.evaluate(async () => {
		localStorage.setItem('bible-settings', JSON.stringify({ size: 24, spacing: 'relaxed', theme: 'dark' }))
		await caches.open('bible-data-v1-eng_web')
		await caches.open('bible-data-v0-eng_kjv')
		return (await caches.keys()).filter((name) => !name.startsWith('bible-data-'))
	})
	// Seed the old anchor on the next launch, after the current reader's pagehide save.
	await page.addInitScript(() => localStorage.setItem('bible-position', JSON.stringify({ book: 'rom', chapter: 8, verse: 28, fraction: 0.2, version: 'WEB' })))
	await context.setOffline(true)
	await page.goto('/')
	await settled(page)
	await expect(page).toHaveURL(/\/Romans\/8\/28\?version=BSB$/)
	await expect(page.locator('[data-verse="rom.8.28"]')).toContainText('And we know')
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
	await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(retained)
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bible-settings')!))).toMatchObject({ size: 24, spacing: 'relaxed' })
	await jump(page, 'Jude5')
	await page.reload()
	await settled(page)
	await expect(page).toHaveURL(/\/Jude\/1\/5\?version=BSB$/)
})
