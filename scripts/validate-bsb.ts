import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assets from '../src/data/bsb-assets.json'
import { books } from '../src/lib/books'
import { FORMAT, type BibleBook } from '../src/lib/types'
import { inlineText } from '../src/lib/normalize'
const directory = 'public/bibles/v1/BSB'
const meta = JSON.parse(
	await readFile(`${directory}/metadata.json`, 'utf8'),
) as {
	format: number
	books: string[]
	checksums: Record<string, string>
	omittedCanonicalVerses: string[]
}
if (meta.format !== FORMAT || meta.books.length !== 66)
	throw new Error('Invalid BSB metadata')
let total = 0
for (const book of books) {
	const raw = await readFile(
		`public${(assets as Record<string, string>)[book.id]}`,
		'utf8',
	)
	if (
		createHash('sha256').update(raw).digest('hex') !== meta.checksums[book.id]
	)
		throw new Error(`Checksum failed: ${book.id}`)
	const data = JSON.parse(raw) as BibleBook
	if (
		data.format !== FORMAT ||
		data.book !== book.id ||
		data.chapters.length !== book.verses.length
	)
		throw new Error(`Invalid book: ${book.id}`)
	for (const [i, chapter] of data.chapters.entries()) {
		const numbers = chapter.blocks.flatMap((b) =>
			b.fragments.filter((f) => f.number).map((f) => f.number!),
		)
		const expected = Array.from(
			{ length: book.verses[i]! },
			(_, n) => n + 1,
		).filter(
			(n) => !meta.omittedCanonicalVerses.includes(`${book.id}.${i + 1}.${n}`),
		)
		if (JSON.stringify(numbers) !== JSON.stringify(expected))
			throw new Error(
				`Missing/duplicate verses: ${book.id} ${i + 1}: ${numbers.length}/${book.verses[i]}`,
			)
		for (const n of numbers) {
			const content = chapter.blocks
				.flatMap((b) =>
					b.fragments.filter((f) => f.id === `${book.id}.${i + 1}.${n}`),
				)
				.map((f) => inlineText(f.nodes))
				.join('')
			if (!content.trim())
				throw new Error(`Empty verse: ${book.id} ${i + 1}:${n}`)
		}
		total += numbers.length
	}
}
console.log(
	`Verified 66 books, 1,189 chapters, ${total.toLocaleString()} real BSB verses and all SHA-256 checksums.`,
)
