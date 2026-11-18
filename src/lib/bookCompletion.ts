import { bookKey, books, booksWithPrefix, findBook } from './books'

const bookDraft = /^\s*(?:[123]\s*)?[a-z]+(?:\s+[a-z]+)*$/i

export function bookCompletion(input: string) {
	if (!bookDraft.test(input)) return
	const book = findBook(input)
	if (!book) return
	const query = bookKey(input)
	const name = bookKey(book.name)
	if (query === name || !name.startsWith(query)) return
	// Count canonical letters rather than raw input characters (e.g. “1Cor”).
	let end = 0, letters = 0
	while (letters < query.length) {
		if (book.name[end] !== ' ') letters++
		end++
	}
	return { name: book.name, suffix: book.name.slice(end) }
}

// Count insertions, deletions, substitutions and adjacent transpositions.
function spellingDistance(query: string, name: string) {
	let previous = Array.from({ length: name.length + 1 }, (_, i) => i)
	let beforePrevious = previous
	for (let i = 1; i <= query.length; i++) {
		const row = [i]
		for (let j = 1; j <= name.length; j++) {
			let cost = Math.min(
				row[j - 1]! + 1,
				previous[j]! + 1,
				previous[j - 1]! + Number(query[i - 1] !== name[j - 1]),
			)
			if (i > 1 && j > 1 && query[i - 1] === name[j - 2] && query[i - 2] === name[j - 1])
				cost = Math.min(cost, beforePrevious[j - 2]! + 1)
			row.push(cost)
		}
		beforePrevious = previous
		previous = row
	}
	return previous[name.length]!
}

function typoMatches(query: string) {
	const number = query.match(/^[123]/)?.[0] ?? ''
	const letters = query.slice(number.length)
	if (letters.length < 4) return []
	const limit = letters.length < 6 ? 1 : 2
	return books.flatMap((book) => {
		const name = bookKey(book.name)
		if ((name.match(/^[123]/)?.[0] ?? '') !== number || Math.abs(name.length - query.length) > limit) return []
		const distance = spellingDistance(letters, name.slice(number.length))
		return distance <= limit ? [{ book, distance }] : []
	}).sort((a, b) => a.distance - b.distance || a.book.name.localeCompare(b.book.name))
}

export function bookSuggestions(input: string) {
	if (!bookDraft.test(input) || findBook(input)) return []
	const query = bookKey(input)
	const prefixes = booksWithPrefix(query)
	return prefixes.length
		? prefixes.sort((a, b) => a.name.localeCompare(b.name))
		: typoMatches(query).map(({ book }) => book)
}

export function resolveTypedBook(input: string) {
	const known = findBook(input)
	if (known) return known
	if (!bookDraft.test(input.trim())) return
	const query = bookKey(input)
	if (booksWithPrefix(query).length) return
	const [best, next] = typoMatches(query)
	if (best && best.distance !== next?.distance) return best.book
}
