import { test, expect } from '@playwright/test'
import { jump, settled } from './helpers'
async function swipe(
	page: import('@playwright/test').Page,
	dx: number,
	dy = 0,
) {
	await page.locator('#reader').evaluate(
		(element, { dx, dy }) => {
			element.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					pointerType: 'touch',
					clientX: 220,
					clientY: 300,
				}),
			)
			element.dispatchEvent(
				new PointerEvent('pointerup', {
					bubbles: true,
					pointerType: 'touch',
					clientX: 220 + dx,
					clientY: 300 + dy,
				}),
			)
		},
		{ dx, dy },
	)
}
test('deliberate horizontal swipes change one chapter to the top and vertical/diagonal gestures do not', async ({
	page,
	isMobile,
}) => {
	await page.goto('/')
	await settled(page)
	await jump(page, 'John3')
	await swipe(page, -130, 10)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 4')
	await expect
		.poll(() =>
			page
				.locator('#chapter-jhn-4')
				.evaluate((e) => Math.round(e.getBoundingClientRect().top)),
		)
		.toBe(isMobile ? 24 : 48)
	await swipe(page, 130, 10)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 3')
	await swipe(page, -40, 150)
	await swipe(page, -100, 80)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('John 3')
})
test('chapter swipes end naturally at Genesis 1 and Revelation 22', async ({
	page,
}) => {
	await page.goto('/')
	await settled(page)
	await swipe(page, 130)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Genesis 1')
	await jump(page, 'Rev22')
	await swipe(page, -130)
	await expect(
		page.getByRole('button', { name: 'Open reference picker' }),
	).toHaveText('Revelation 22')
})
