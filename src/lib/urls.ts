import { bookById, findBook } from './books'
import { appBase, appUrl } from './base'
import {
	compress,
	fromId,
	ordered,
	parseReference,
	verseId,
} from './references'
import type { Passage } from './types'
export const slug = (book: string) => bookById(book)!.name.replace(/\s+/g, '-')
export function passageUrl(p: Passage, version: string): string {
	const refs = ordered(p.verses)
	const first = refs[0] ?? p
	const params = new URLSearchParams({ version })
	let suffix = p.verse ? `/${p.verse}` : ''
	if (
		refs.length &&
		refs.every((r) => r.book === first.book && r.chapter === first.chapter)
	)
		suffix = `/${compress(
			refs.map((r) => r.verse),
			'-',
			',',
		)}`
	else if (refs.length) {
		suffix = `/${first.verse ?? 1}`
		params.set('selection', refs.map(verseId).join(','))
	}
	return appUrl(`${slug(first.book)}/${first.chapter}${suffix}?${params}`)
}
export function parseUrl(
	url: URL,
): { passage: Passage; version: string } | undefined {
	if (!url.pathname.startsWith(appBase)) return
	const pieces = decodeURIComponent(url.pathname.slice(appBase.length))
		.split('/').filter(Boolean)
	if (pieces.length < 2 || pieces.length > 3 || !/^\d+$/.test(pieces[1]!))
		return
	const book = findBook(pieces[0]!.replace(/-/g, ' '))
	if (!book) return
	const passage = parseReference(
		`${book.name} ${pieces[1]}${pieces[2] ? ':' + pieces[2] : ''}`,
	)
	if (!passage) return
	const selection = url.searchParams.get('selection')
	if (selection) {
		const refs = selection.split(',').map(fromId)
		if (refs.some((r) => !r)) return
		passage.verses = ordered(refs.filter((r) => !!r))
		const first = passage.verses[0]!
		Object.assign(passage, first)
	}
	return {
		passage,
		version: (url.searchParams.get('version') || 'BSB').toUpperCase(),
	}
}
