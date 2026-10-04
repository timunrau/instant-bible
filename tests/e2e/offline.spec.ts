import { test, expect } from '@playwright/test'
import { jump, settled } from './helpers'
test('installs a complete PWA and reads, parses, navigates and restarts with network disabled', async ({
	page,
	context,
}) => {
	await page.goto('/')
	await settled(page)
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready
	})
	await page.reload()
	await settled(page)
	await expect
		.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
		.toBe(true)
	const manifest = await page.evaluate(async () =>
		fetch('/manifest.webmanifest').then((r) => r.json()),
	)
	expect(manifest.name).toBe('Bible')
	expect(manifest.description).toBe('A fast, offline-first Bible reader.')
	const requests: string[] = []
	page.on('request', (r) => {
		if (!r.url().startsWith('http://127.0.0.1:4173')) requests.push(r.url())
	})
	await context.setOffline(true)
	await jump(page, 'Psalm119:176')
	await expect(
		page.locator('[data-verse="psa.119.176"]').first(),
	).toContainText('I have strayed like a lost sheep')
	await jump(page, 'Jude5')
	await jump(page, 'John3:16')
	await page.reload()
	await settled(page)
	await expect(page.locator('[data-verse="jhn.3.16"]')).toContainText(
		'For God so loved',
	)
	expect(requests).toEqual([])
})
test('does not forcibly reload a reader when a service worker update is checked', async ({
	page,
}) => {
	await page.goto('/')
	await settled(page)
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready
	})
	await jump(page, 'Romans8:28')
	await page.evaluate(async () => {
		const r = await navigator.serviceWorker.getRegistration()
		await r?.update()
	})
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Romans 8')
	await expect(page).toHaveURL(/\/Romans\/8\/28\?version=BSB/)
})
