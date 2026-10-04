import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
const assets = JSON.parse(
	readFileSync('src/data/bsb-assets.json', 'utf8'),
) as Record<string, string>
const manifest = JSON.parse(
	readFileSync('tests/fixtures/fetch-manifest.json', 'utf8'),
) as unknown
import type { BibleBook, Inline } from '../../src/lib/types'
const escape = (text: string) =>
	text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
const htmlNodes = (nodes: Inline[]): string =>
	nodes
		.map((n) =>
			n.kind === 'text'
				? escape(n.text)
				: n.kind === 'note'
					? `<span class="fb-note">${htmlNodes(n.children)}</span>`
					: `<span class="fb-${n.kind === 'em' ? 'it' : n.kind === 'strong' ? 'bd' : 'sc'}">${htmlNodes(n.children)}</span>`,
		)
		.join('')
// Deterministic mock transport uses real, licensed BSB content. It is not a WEB source.
export function sourceBook(book: string) {
	const data = JSON.parse(
		readFileSync(`public${assets[book]}`, 'utf8'),
	) as BibleBook
	return {
		book,
		name: { normal: data.name },
		contents: [
			[],
			...data.chapters.map((c) => [
				[],
				[
					'',
					c.blocks
						.map(
							(b) =>
								`<${b.kind === 'heading' ? 'h4' : 'p'} class="fb-${b.kind === 'poetry' ? 'q' + b.indent : b.kind === 'break' ? 'b' : 'p'}">${b.fragments.map((f) => (f.number ? `<sup data-v="${c.number}:${f.number}">${f.number}</sup>` : '') + htmlNodes(f.nodes)).join('')}</${b.kind === 'heading' ? 'h4' : 'p'}>`,
						)
						.join(''),
					'',
				],
			]),
		],
	}
}
export async function mockDownload(
	page: Page,
	options: { fail?: boolean; gate?: Promise<void> } = {},
) {
	await page.route('https://v1.fetch.bible/**', async (route) => {
		const url = route.request().url()
		if (url.endsWith('manifest.json')) {
			await route.fulfill({
				json: manifest,
				headers: { 'access-control-allow-origin': '*' },
			})
			return
		}
		if (options.gate) await options.gate
		if (options.fail) {
			await route.abort()
			return
		}
		const book = url.match(/\/html\/(.+)\.json$/)?.[1]
		if (!book) {
			await route.abort()
			return
		}
		await route.fulfill({
			json: sourceBook(book),
			headers: { 'access-control-allow-origin': '*' },
		})
	})
}
