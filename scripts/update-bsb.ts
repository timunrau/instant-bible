import { FetchClient } from '@gracious.tech/fetch-client'
import {
	books_ordered,
	book_names_english,
	last_verse,
} from '@gracious.tech/bible-references'
import { parseHTML } from 'linkedom'
import { mkdir, writeFile, cp, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { normalizeBook } from '../src/lib/normalize'
import type { Translation } from '../src/lib/types'

const client = new FetchClient({
	usage: { limitless: true, derivatives: true },
	remember_fetches: false,
})
const collection = await client.fetch_collection()
const path = 'public/bibles/v1/BSB'
await mkdir(path, { recursive: true })
const meta = collection.bibles.get_resource('eng_bsb')
if (!meta)
	throw new Error('BSB is not available under the required usage license')
const checksums: Record<string, string> = {}
const assets: Record<string, string> = {}
const omitted: string[] = []
let next = 0
await Promise.all(
	Array.from({ length: 4 }, async () => {
		while (next < books_ordered.length) {
			const book = books_ordered[next++]!
			const source = await collection.bibles.fetch_book('eng_bsb', book, 'html')
			const chapters = last_verse[book]!.map((_, i) =>
				source.get_chapter(i + 1, { attribute: false }),
			)
			const data = normalizeBook(
				book,
				book_names_english[book]!,
				chapters,
				(html) => parseHTML(`<html><body>${html}</body></html>`).document,
			)
			for (const chapter of data.chapters) {
				const actual = chapter.blocks.flatMap((b) =>
					b.fragments.filter((f) => f.number).map((f) => f.number!),
				)
				const sourceNumbers = [
					...chapters[chapter.number - 1]!.matchAll(/data-v="\d+:(\d+)"/g),
				].map((m) => Number(m[1]))
				if (JSON.stringify(actual) !== JSON.stringify(sourceNumbers))
					throw new Error(
						`Normalization lost a verse: ${book} ${chapter.number}`,
					)
				for (let n = 1; n <= last_verse[book]![chapter.number - 1]!; n++)
					if (!actual.includes(n))
						omitted.push(`${book}.${chapter.number}.${n}`)
			}
			const json = JSON.stringify(data) + '\n'
			checksums[book] = createHash('sha256').update(json).digest('hex')
			const filename = `${book}.${checksums[book]!.slice(0, 12)}.json`
			assets[book] = `/bibles/v1/BSB/${filename}`
			await writeFile(`${path}/${filename}`, json)
			if (book === 'gen')
				await writeFile(
					'src/data/genesis-one.json',
					JSON.stringify(data.chapters[0]) + '\n',
				)
			console.log(`BSB ${book}`)
		}
	}),
)
const translation: Translation = {
	id: 'eng_bsb',
	abbreviation: 'BSB',
	name: meta.name,
	attribution: meta.attribution,
	attributionUrl: meta.attribution_url,
	licenses: meta.licenses,
	books: [...books_ordered],
}
await writeFile(
	`${path}/metadata.json`,
	JSON.stringify(
		{
			format: 1,
			...translation,
			omittedCanonicalVerses: omitted.sort(),
			checksums: Object.fromEntries(
				books_ordered.map((b) => [b, checksums[b]]),
			),
		},
		null,
		2,
	) + '\n',
)
await writeFile(
	'src/data/bsb-assets.json',
	JSON.stringify(Object.fromEntries(books_ordered.map((b) => [b, assets[b]]))) +
		'\n',
)
for (const file of await readdir(path)) {
	if (
		file !== 'metadata.json' &&
		!Object.values(assets).some((url) => url.endsWith('/' + file))
	)
		await unlink(`${path}/${file}`)
}
await writeFile(
	'src/data/bsb-metadata.json',
	JSON.stringify(translation, null, 2) + '\n',
)
// Runtime reads a compact, generated canonical index; it doesn't import the library's text parser.
await writeFile(
	'src/data/canon.json',
	JSON.stringify(
		books_ordered.map((id) => ({
			id,
			name: id === 'psa' ? 'Psalm' : book_names_english[id],
			verses: last_verse[id],
		})),
	) + '\n',
)
await mkdir('public/fonts', { recursive: true })
for (const style of ['normal', 'italic'])
	await cp(
		`node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-${style}.woff2`,
		`public/fonts/source-serif-4-${style}.woff2`,
	)
await cp(
	'node_modules/@fontsource-variable/source-serif-4/LICENSE',
	'public/fonts/OFL.txt',
)
console.log(
	'Deterministic BSB assets, canonical index, metadata, and fonts written.',
)
