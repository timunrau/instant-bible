import { bookById, books, findBook } from './books'
import type { Passage, VerseRef } from './types'

export const verseId = (ref: VerseRef) =>
	`${ref.book}.${ref.chapter}.${ref.verse}`
export function validVerse(ref: VerseRef) {
	const count = bookById(ref.book)?.verses[ref.chapter - 1]
	return (
		Number.isInteger(ref.chapter) &&
		Number.isInteger(ref.verse) &&
		!!count &&
		ref.verse > 0 &&
		ref.verse <= count
	)
}
export function fromId(id: string): VerseRef | undefined {
	const [book, chapter, verse, extra] = id.split('.')
	const ref = {
		book: book ?? '',
		chapter: Number(chapter),
		verse: Number(verse),
	}
	return !extra && validVerse(ref) ? ref : undefined
}
export const compareVerses = (a: VerseRef, b: VerseRef) =>
	books.findIndex((x) => x.id === a.book) -
		books.findIndex((x) => x.id === b.book) ||
	a.chapter - b.chapter ||
	a.verse - b.verse
export const ordered = (refs: VerseRef[]) =>
	[...new Map(refs.map((r) => [verseId(r), r])).values()].sort(compareVerses)

function span(
	book: string,
	ch: number,
	start: number,
	endCh: number,
	end: number,
): VerseRef[] | undefined {
	if (
		!validVerse({ book, chapter: ch, verse: start }) ||
		!validVerse({ book, chapter: endCh, verse: end }) ||
		endCh < ch ||
		(endCh === ch && end < start)
	)
		return
	const verses: VerseRef[] = []
	for (let c = ch; c <= endCh; c++) {
		for (
			let v = c === ch ? start : 1;
			v <= (c === endCh ? end : bookById(book)!.verses[c - 1]!);
			v++
		)
			verses.push({ book, chapter: c, verse: v })
	}
	return verses
}

export function parseReference(input: string): Passage | undefined {
	const normalized = input.trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
	if (!normalized) return
	let contextBook = ''
	let contextChapter = 1
	let first: Passage | undefined
	const refs: VerseRef[] = []
	for (const segment of normalized.split(';')) {
		const match = segment
			.trim()
			.match(
				/^((?:(?:[123]|i{1,3}|first|second|third)[ .]*)?[a-z][a-z .]*?)(?=\d|$)(.*)$/i,
			)
		let numbers = segment.trim()
		if (match) {
			const book = findBook(match[1]!)
			if (!book) return
			contextBook = book.id
			numbers = match[2]!.trim()
			contextChapter = 1
		} else if (!contextBook) return
		const book = bookById(contextBook)!
		numbers = numbers
			.replace(/\./g, ':')
			.replace(/(\d)\s+(\d)/g, '$1:$2')
			.replace(/\s/g, '')
		if (numbers.endsWith(':')) numbers = numbers.slice(0, -1)
		if (!numbers) {
			if (first) return
			first = { book: book.id, chapter: 1, verses: [] }
			continue
		}
		const chapterOnly = /^\d+(?:-\d+)?$/.test(numbers) && (!!match || !first)
		if (chapterOnly && !(book.verses.length === 1 && Number(numbers) > 1)) {
			const [start, end = start] = numbers.split('-').map(Number)
			if (
				!start ||
				!end ||
				!book.verses[start - 1] ||
				!book.verses[end - 1] ||
				end < start
			)
				return
			contextChapter = start
			first ??= { book: book.id, chapter: start, verses: [] }
			if (end > start)
				refs.push(...span(book.id, start, 1, end, book.verses[end - 1]!)!)
			continue
		}
		for (const part of numbers.split(',')) {
			const m = part.match(/^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$/)
			if (!m) return
			const ch = m[1] ? Number(m[1]) : contextChapter
			const v = Number(m[2])
			const endCh = m[3] ? Number(m[3]) : ch
			const end = m[4] ? Number(m[4]) : v
			const expanded = span(book.id, ch, v, endCh, end)
			if (!expanded) return
			refs.push(...expanded)
			contextChapter = endCh
			first ??= { book: book.id, chapter: ch, verse: v, verses: [] }
		}
	}
	if (!first) return
	first.verses = ordered(refs)
	if (first.verses.length) {
		const earliest = first.verses[0]!
		return { ...earliest, verses: first.verses }
	}
	return first
}

export function compress(
	numbers: number[],
	dash = '–',
	separator = ', ',
): string {
	const list = [...new Set(numbers)].sort((a, b) => a - b)
	const parts: string[] = []
	for (let i = 0; i < list.length; i++) {
		const start = list[i]!
		let end = start
		while (list[i + 1] === end + 1) end = list[++i]!
		parts.push(start === end ? `${start}` : `${start}${dash}${end}`)
	}
	return parts.join(separator)
}
export function formatReferences(refs: VerseRef[]): string {
	const groups = new Map<string, VerseRef[]>()
	for (const ref of ordered(refs)) {
		const k = `${ref.book}.${ref.chapter}`
		groups.set(k, [...(groups.get(k) ?? []), ref])
	}
	let previous = ''
	return [...groups.values()]
		.map((group) => {
			const r = group[0]!
			const name = r.book === previous ? '' : `${bookById(r.book)!.name} `
			previous = r.book
			return `${name}${r.chapter}:${compress(group.map((v) => v.verse))}`
		})
		.join('; ')
}
export const chapterLabel = (book: string, chapter: number) =>
	`${bookById(book)?.name ?? 'Genesis'} ${chapter}`
export const passageLabel = (p: Passage) =>
	p.verses.length ? formatReferences(p.verses) : chapterLabel(p.book, p.chapter)
