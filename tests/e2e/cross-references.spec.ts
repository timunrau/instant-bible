import { test, expect } from '@playwright/test'
import { jump, settled, verseTop } from './helpers'

test.beforeEach(async ({ page }) => {
	await page.goto('/')
	await settled(page)
})

test('BSB footnote citations jump to their passages and Back restores the prior position', async ({ page, isMobile }) => {
	await jump(page, '2 Peter 1:17')
	const verse = page.locator('[data-verse="2pe.1.17"]')
	await verse.click()
	const top = await verseTop(page, '2pe.1.17')
	await verse.locator('.note-marker').click()
	const note = page.getByRole('dialog', { name: 'Scripture footnote' })
	await expect(note).toContainText('1:17 Matthew 17:5; see also Mark 9:7 and Luke 9:35.')
	await expect(note.getByRole('link')).toHaveCount(3)
	await expect(note.getByRole('link', { name: 'Mark 9:7', exact: true })).toHaveAttribute('href', '/Mark/9/7?version=BSB')
	await expect(note.getByRole('link', { name: 'Luke 9:35', exact: true })).toHaveAttribute('href', '/Luke/9/35?version=BSB')
	const entries = await page.evaluate(() => history.length)
	// The dialog starts focused on Close; the citations remain accessible by keyboard.
	await page.keyboard.press('Tab')
	await expect(note.getByRole('link', { name: 'Matthew 17:5', exact: true })).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(note).toHaveCount(0)
	await expect(page).toHaveURL(/\/Matthew\/17\/5\?version=BSB$/)
	await expect.poll(() => page.evaluate(() => history.length)).toBe(entries + 1)
	await expect.poll(async () => Math.round(await verseTop(page, 'mat.17.5'))).toBe(isMobile ? 24 : 48)
	await expect(page.locator('.selection-tray')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Open reference picker' })).toBeFocused()
	await page.goBack()
	await expect(page.getByRole('button', { name: 'Open reference picker' })).toHaveText('2 Peter 1')
	await expect.poll(async () => Math.abs(await verseTop(page, '2pe.1.17') - top)).toBeLessThan(3)
})

test('footnote range links work offline and indicate the cited verses without selection', async ({ page, context, isMobile }) => {
	await page.evaluate(async () => { await navigator.serviceWorker.ready })
	await page.reload()
	await settled(page)
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
	await context.setOffline(true)
	await jump(page, 'Genesis 2:24')
	await page.locator('[data-verse="gen.2.24"] .note-marker').click()
	const note = page.getByRole('dialog', { name: 'Scripture footnote' })
	await note.getByRole('link', { name: 'Mark 10:7–8', exact: true }).click()
	await expect(page).toHaveURL(/\/Mark\/10\/7-8\?version=BSB$/)
	await expect.poll(async () => Math.round(await verseTop(page, 'mrk.10.7'))).toBe(isMobile ? 24 : 48)
	await expect(page.locator('[data-verse="mrk.10.7"]')).toHaveClass(/indicated/)
	await expect(page.locator('[data-verse="mrk.10.8"]')).toHaveClass(/indicated/)
	await expect(page.locator('.selection-tray')).toHaveCount(0)
})

test('unsupported source references stay readable without invented links', async ({ page }) => {
	await jump(page, '2 Peter 2:4')
	await page.locator('[data-verse="2pe.2.4"] .note-marker').click()
	const note = page.getByRole('dialog', { name: 'Scripture footnote' })
	await expect(note).toContainText('1 Enoch 13:1–11 and 1 Enoch 20:1–4')
	await expect(note.getByRole('link')).toHaveCount(0)
})
