import { test, expect } from '@playwright/test'
import { jump, settled, verseTop } from './helpers'

test.beforeEach(async ({ page, isMobile }) => {
	test.skip(isMobile, 'Desktop keyboard contracts.')
	await page.goto('/')
	await settled(page)
})

test('arrow keys navigate chapters across books, preserve Back, and stop at Scripture boundaries', async ({ page }) => {
	const reference = page.getByRole('button', { name: 'Open reference picker' })
	const initialHistory = await page.evaluate(() => history.length)
	await page.keyboard.press('ArrowLeft')
	await expect(reference).toHaveText('Genesis 1')
	await expect.poll(() => page.evaluate(() => history.length)).toBe(initialHistory)
	await jump(page, 'Malachi4:6')
	const previousTop = await verseTop(page, 'mal.4.6')
	await page.keyboard.press('ArrowRight')
	await expect(page).toHaveURL(/\/Matthew\/1\?version=BSB$/)
	await expect.poll(() => page.locator('#chapter-mat-1').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(48)
	await page.goBack()
	await expect(reference).toHaveText('Malachi 4')
	await expect.poll(async () => Math.abs(await verseTop(page, 'mal.4.6') - previousTop)).toBeLessThan(2)
	await page.keyboard.press('ArrowRight')
	await expect(reference).toHaveText('Matthew 1')
	await page.keyboard.press('ArrowLeft')
	await expect(reference).toHaveText('Malachi 4')
	await jump(page, 'Revelation22')
	const lastHistory = await page.evaluate(() => history.length)
	await page.keyboard.press('ArrowRight')
	await expect(reference).toHaveText('Revelation 22')
	expect(await page.evaluate(() => history.length)).toBe(lastHistory)
})

test('slash focuses the picker in the key event and leaves input editing and dialogs alone', async ({ page }) => {
	const result = await page.evaluate(() => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))
		const input = document.querySelector<HTMLInputElement>('input')!
		return { focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd, value: input.value }
	})
	expect(result).toEqual({ focused: true, start: 0, end: 9, value: 'Genesis 1' })
	const input = page.getByRole('textbox', { name: 'Bible reference' })
	await input.fill('John 3:16')
	await input.press('ArrowLeft')
	await input.press('/')
	await expect(input).toHaveValue('John 3:1/6')
	await expect(page).toHaveURL(/\/Genesis\/1\?version=BSB$/)
	await input.fill('John 3:16')
	await input.press('Enter')
	await expect(page).toHaveURL(/\/John\/3\/16\?version=BSB$/)
	await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('/')
	await expect(page.getByRole('dialog', { name: 'Reader settings' })).toBeVisible()
	await expect(page.getByRole('dialog', { name: 'Go to a passage' })).toBeHidden()
	await expect(page).toHaveURL(/\/John\/3\/16\?version=BSB$/)
})

test('passage submission returns focus without a ring and Tab restores the keyboard indicator', async ({ page }) => {
	await jump(page, 'John3:16')
	const reference = page.getByRole('button', { name: 'Open reference picker' })
	await expect(reference).toBeFocused()
	await expect(reference).toHaveCSS('outline-style', 'none')
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Reader settings', exact: true })).toBeFocused()
	await page.keyboard.press('Shift+Tab')
	await expect(reference).toBeFocused()
	await expect(reference).toHaveCSS('outline-style', 'solid')
	await expect(reference).toHaveCSS('outline-width', '2px')
})

test('Ctrl+C and Cmd+C use semantic verse copying and preserve native copy', async ({ page }) => {
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: async (text: string) => {
				;(window as unknown as { lastCopy: string }).lastCopy = text
			} },
		})
	})
	await jump(page, 'John3:16')
	for (const shortcut of ['Control+c', 'Meta+c']) {
		for (const id of ['jhn.3.19', 'jhn.3.16', 'jhn.3.18'])
			await page.locator(`[data-verse="${id}"]`).first().click()
		await page.keyboard.press(shortcut)
		await expect(page.locator('.copy-confirmation')).toHaveText('Copied')
		await expect(page.locator('.selected')).toHaveCount(0)
		await expect(page.locator('.selection-tray')).toHaveCount(0)
		const text = await page.evaluate(() => (window as unknown as { lastCopy: string }).lastCopy)
		expect(text).toMatch(/^For God so loved/)
		expect(text).toContain('18 Whoever believes')
		expect(text).toMatch(/(?<!\n)\nJohn 3:16, 18–19 BSB$/)
		await page.evaluate(() => { (window as unknown as { lastCopy: string }).lastCopy = '' })
	}
	const native = await page.locator('[data-verse="jhn.3.16"]').evaluate((e) => {
		const range = document.createRange()
		range.selectNodeContents(e)
		getSelection()!.removeAllRanges()
		getSelection()!.addRange(range)
		const copy = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true })
		e.dispatchEvent(copy)
		return { prevented: copy.defaultPrevented, selection: getSelection()!.toString() }
	})
	expect(native.prevented).toBe(false)
	expect(native.selection).toContain('For God so loved')
	expect(await page.evaluate(() => (window as unknown as { lastCopy: string }).lastCopy)).toBe('')
})

test('shortcuts do not override composition, modified arrows or editable content', async ({ page }) => {
	const prevented = await page.evaluate(() => {
		const input = document.createElement('div')
		input.contentEditable = 'true'
		document.body.append(input)
		const edited = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
		input.dispatchEvent(edited)
		input.remove()
		const composing = new KeyboardEvent('keydown', { key: '/', isComposing: true, cancelable: true })
		window.dispatchEvent(composing)
		const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, cancelable: true })
		window.dispatchEvent(arrow)
		return [edited.defaultPrevented, composing.defaultPrevented, arrow.defaultPrevented]
	})
	expect(prevented).toEqual([false, false, false])
	await expect(page.getByRole('dialog', { name: 'Go to a passage' })).toBeHidden()
	await expect(page).toHaveURL(/\/Genesis\/1\?version=BSB$/)
})

test('Escape dismisses the picker first, then clears selected verses without moving the reader', async ({ page }) => {
	await jump(page, 'John3:16')
	await page.locator('[data-verse="jhn.3.16"]').first().click()
	await page.locator('[data-verse="jhn.3.18"]').first().click()
	await expect(page.getByRole('status')).toHaveText('2 selected')
	const before = await page.evaluate(() => ({ y: scrollY, url: location.href, history: history.length }))
	await page.keyboard.press('/')
	await expect(page.getByRole('dialog', { name: 'Go to a passage' })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: 'Go to a passage' })).toBeHidden()
	await expect(page.getByRole('status')).toHaveText('2 selected')
	await page.keyboard.press('Escape')
	await expect(page.locator('.selected')).toHaveCount(0)
	await expect(page.locator('.selection-tray')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Open reference picker' })).toHaveText('John 3')
	expect(await page.evaluate(() => ({ y: scrollY, url: location.href, history: history.length }))).toEqual(before)
	await page.keyboard.press('Escape')
	expect(await page.evaluate(() => ({ y: scrollY, url: location.href, history: history.length }))).toEqual(before)
})
