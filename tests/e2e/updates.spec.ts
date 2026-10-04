import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { test, expect } from '@playwright/test'
import { jump, settled, verseTop } from './helpers'

// Serve two revisions of the production Workbox worker and its precached shell.
// Page routing cannot reliably intercept the browser's worker-script requests.
async function deployment() {
	let revision = 'old'
	let failInstallation = false
	let failCheck = false
	const root = resolve('dist')
	const worker = readFileSync(resolve(root, 'sw.js'), 'utf8')
	const shell = readFileSync(resolve(root, 'index.html'), 'utf8')
	const server = createServer((request, response) => {
		const path = new URL(request.url!, 'http://localhost').pathname
		response.setHeader('Cache-Control', 'no-store')
		if (path === '/sw.js') {
			response.setHeader('Content-Type', 'application/javascript')
			if (failCheck) { response.writeHead(503); response.end(); return }
			const script = worker.replace(/url:"index\.html",revision:"[^"]+"/, `url:"index.html",revision:"${revision}"`)
			response.end(`${script}\n// deployment: ${revision}`)
			return
		}
		const file = resolve(root, `.${path}`)
		const isShell = !file.startsWith(root + '/') || !existsSync(file) || path === '/index.html'
		if (isShell) {
			response.setHeader('Content-Type', 'text/html')
			if (failInstallation && path === '/index.html') { response.writeHead(503); response.end(); return }
			response.end(shell.replace('<head>', `<head><meta name="deployment" content="${revision}">`))
		} else {
			const types: Record<string, string> = {
				'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
				'.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
				'.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain',
			}
			response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
			response.end(readFileSync(file))
		}
	})
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('No deployment address')
	return {
		url: `http://127.0.0.1:${address.port}`,
		upgrade() { revision = 'new' },
		failInstallation(value: boolean) { failInstallation = value },
		failCheck(value: boolean) { failCheck = value },
		async close() {
			server.closeAllConnections()
			await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()))
		},
	}
}

test('version tap installs and activates a real update, preserving passage, settings and caches', async ({ page, context }) => {
	const site = await deployment()
	try {
		await page.goto(site.url)
		await settled(page)
		await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
		await page.reload()
		await settled(page)
		const other = await context.newPage()
		await other.goto(site.url)
		await settled(other)
		await jump(page, 'Romans8:28')
		await page.evaluate(async () => {
			const cache = await caches.open('update-test-retained-data')
			await cache.put('/retained', new Response('optional data'))
		})
		await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
		await page.getByRole('button', { name: 'Dark', exact: true }).click()
		const update = page.getByRole('button', { name: 'Update app', exact: true })
		await update.click()
		await expect(page.getByRole('status')).toHaveText('You’re up to date.')
		site.upgrade()
		// A background check installs the new revision while both readers remain open.
		await other.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
		await expect.poll(() => other.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
		await expect(page.locator('meta[name="deployment"]')).toHaveAttribute('content', 'old')
		await expect(other.locator('meta[name="deployment"]')).toHaveAttribute('content', 'old')
		await update.click()
		await expect(page.locator('meta[name="deployment"]')).toHaveAttribute('content', 'new')
		await settled(page)
		await expect(page).toHaveURL(/\/Romans\/8\/28\?version=BSB$/)
		await expect.poll(async () => Math.round(await verseTop(page, 'rom.8.28'))).toBe(await page.evaluate(() => innerWidth < 768 ? 24 : 48))
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
		expect(await page.evaluate(async () => (await (await caches.open('update-test-retained-data')).match('/retained'))?.text())).toBe('optional data')
		await expect(other.locator('meta[name="deployment"]')).toHaveAttribute('content', 'old')
		await expect(other.getByRole('button', { name: 'Open reference picker' })).toBeEnabled()
		// Its explicit version tap must pick up the already activated build too.
		await other.getByRole('button', { name: 'Reader settings', exact: true }).click()
		await other.getByRole('button', { name: 'Update app', exact: true }).click()
		await expect(other.locator('meta[name="deployment"]')).toHaveAttribute('content', 'new')
		await settled(other)
		await context.setOffline(true)
		await jump(page, 'Psalm119:176')
		await page.reload()
		await settled(page)
		await expect(page.locator('meta[name="deployment"]')).toHaveAttribute('content', 'new')
		await expect(page.locator('[data-verse="psa.119.176"]').first()).toContainText('I have strayed')
	} finally { await site.close() }
})

test('failed checks and incomplete updates keep the old reader usable and can be retried', async ({ page, context }) => {
	const site = await deployment()
	try {
		await page.goto(site.url)
		await settled(page)
		await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}))
		await page.reload()
		await settled(page)
		await jump(page, 'John3:16')
		await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
		const update = page.getByRole('button', { name: 'Update app', exact: true })
		await context.setOffline(true)
		await update.click()
		await expect(page.getByRole('status')).toContainText('offline')
		await expect(update).toBeEnabled()
		await context.setOffline(false)
		site.failCheck(true)
		await update.click()
		await expect(page.getByRole('status')).toContainText('Couldn’t check')
		site.failCheck(false)
		site.upgrade()
		site.failInstallation(true)
		await update.click()
		await expect(page.getByRole('status')).toContainText('Couldn’t install')
		await expect(update).toBeEnabled()
		await expect(page.locator('meta[name="deployment"]')).toHaveAttribute('content', 'old')
		await expect(page).toHaveURL(/\/John\/3\/16\?version=BSB$/)
		await page.getByRole('button', { name: 'Close settings' }).click()
		await jump(page, 'Jude5')
		site.failInstallation(false)
		await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
		await update.click()
		await expect(page.locator('meta[name="deployment"]')).toHaveAttribute('content', 'new')
		await settled(page)
		await expect(page).toHaveURL(/\/Jude\/1\/5\?version=BSB$/)
	} finally { await site.close() }
})
