import { books } from './books'
import { parseReference } from './references'
import type { Passage } from './types'

export interface NotePart {
	text: string
	passage?: Passage
}

// Recognize explicit citations in source notes, then validate every destination
// with the same local parser as typed navigation. Never interpret note prose as HTML.
const names = [...books.map((book) => book.name), 'Psalms', 'Song of Songs']
	.sort((a, b) => b.length - a.length)
	.map((name) => name.replace(/ /g, '\\s+'))
	.join('|')
const range = '(?:\\s*[-–—]\\s*\\d+(?::\\d+)?)?'
const citation = new RegExp(
	`\\b(?:${names})\\s+\\d+(?::\\d+${range}(?:,\\s*(?!\\d+\\s+[A-Za-z])\\d+(?::\\d+)?${range})*|${range})`,
	'g',
)

export function noteReferences(text: string): NotePart[] {
	const parts: NotePart[] = []
	let end = 0
	for (const match of text.matchAll(citation)) {
		const start = match.index
		// Avoid linking a valid suffix of an unsupported or malformed citation.
		if (/(?:^|[^\w:])\d+\s*$/.test(text.slice(0, start)) || /^[\d:–—-]/.test(text.slice(start + match[0].length)))
			continue
		const passage = parseReference(match[0])
		if (!passage) continue
		if (start > end) parts.push({ text: text.slice(end, start) })
		parts.push({ text: match[0], passage })
		end = start + match[0].length
	}
	if (end < text.length) parts.push({ text: text.slice(end) })
	return parts
}
