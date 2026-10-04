import { test, expect } from '@playwright/test'
import { jump, settled } from './helpers'
import { mockDownload } from './download-fixture'
test.use({ serviceWorkers: 'block' })
test('keeps the current Bible readable while another translation downloads and preserves the typed draft', async ({
	page,
}) => {
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	await mockDownload(page, { gate })
	await page.goto('/')
	await settled(page)
	await jump(page, 'John3:16')
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await page.getByRole('textbox', { name: 'Bible reference' }).fill('rom 8:28')
	await page.getByRole('button', { name: 'Choose translation' }).click()
	await page
		.getByRole('button', { name: 'Use World English Bible', exact: true })
		.click()
	await expect(page.getByRole('status')).toContainText('WEB · 0%')
	await expect(page.locator('[data-verse="jhn.3.16"]')).toContainText(
		'For God so loved',
	)
	await expect(
		page.getByRole('textbox', { name: 'Bible reference' }),
	).toHaveValue('rom 8:28')
	expect(
		await page.evaluate(async () => {
			const c = await caches.open('bible-data-v1-eng_web')
			return !!(await c.match('/bibles/v1/WEB/metadata.json'))
		}),
	).toBe(false)
	release()
	await expect(
		page.getByRole('button', { name: 'Choose translation' }),
	).toHaveText('WEB', { timeout: 15000 })
	await expect(
		page.getByRole('textbox', { name: 'Bible reference' }),
	).toHaveValue('rom 8:28')
	await page.getByRole('textbox', { name: 'Bible reference' }).press('Enter')
	await expect(page).toHaveURL(/\/Romans\/8\/28\?version=WEB/)
	const requests: string[] = []
	page.on('request', (r) => requests.push(r.url()))
	await jump(page, 'Psalm23')
	expect(requests.filter((url) => url.startsWith('https://'))).toEqual([])
	expect(
		await page.evaluate(async () => {
			const c = await caches.open('bible-data-v1-eng_web')
			return (await c.keys()).length
		}),
	).toBe(67)
})
test('a failed optional download removes partial data and keeps BSB usable with a local retry', async ({
	page,
}) => {
	await mockDownload(page, { fail: true })
	await page.goto('/')
	await settled(page)
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await page.getByRole('button', { name: 'Choose translation' }).click()
	await page
		.getByRole('button', { name: 'Use World English Bible', exact: true })
		.click()
	await expect(
		page.getByRole('button', { name: 'Retry', exact: true }),
	).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Choose translation' }),
	).toHaveText('BSB')
	expect(await page.evaluate(async () => await caches.keys())).not.toContain(
		'bible-data-v1-eng_web',
	)
	await page.getByRole('textbox', { name: 'Bible reference' }).fill('Psalm23')
	await page.getByRole('textbox', { name: 'Bible reference' }).press('Enter')
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Psalm 23')
})
test('a shared link automatically installs its requested translation and passage', async ({
	page,
}) => {
	await mockDownload(page)
	await page.goto('/John/3/16-18?version=WEB')
	await expect(page).toHaveURL(/\/John\/3\/16-18\?version=WEB/, {
		timeout: 15000,
	})
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem('bible-position') || '{}').version,
			),
		)
		.toBe('WEB')
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 3')
	await expect(
		page.getByRole('button', { name: 'Copy', exact: true }),
	).toHaveCount(0)
})
test('falls back to bundled BSB at the same reference after optional data is evicted', async ({
	page,
}) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'bible-position',
			JSON.stringify({
				book: 'rom',
				chapter: 8,
				verse: 28,
				fraction: 0.2,
				version: 'WEB',
			}),
		),
	)
	await page.goto('/')
	await settled(page)
	await expect(page).toHaveURL(/\/Romans\/8\/28\?version=BSB/)
	await page.getByRole('button', { name: 'Open reference picker' }).click()
	await expect(
		page.getByRole('button', { name: 'Choose translation' }),
	).toHaveText('BSB')
})
