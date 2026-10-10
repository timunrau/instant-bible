import { findBook } from './books'

export function bookCompletion(input: string) {
	if (!/^\s*(?:[123]\s*)?[a-z]+(?:\s+[a-z]+)*$/i.test(input)) return
	const book = findBook(input)
	if (!book) return
	const query = input.toLowerCase().replace(/\s/g, '')
	const name = book.name.toLowerCase().replace(/\s/g, '')
	if (query === name || !name.startsWith(query)) return
	// Count canonical letters rather than raw input characters (e.g. “1Cor”).
	let end = 0, letters = 0
	while (letters < query.length) {
		if (book.name[end] !== ' ') letters++
		end++
	}
	return { name: book.name, suffix: book.name.slice(end) }
}
