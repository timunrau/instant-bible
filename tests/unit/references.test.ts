import { describe, expect, it } from 'vitest'
import { books } from '../../src/lib/books'
import { bookCompletion } from '../../src/lib/bookCompletion'
import {
	fromId,
	parseReference,
	passageLabel,
	formatReferences,
	verseId,
	ordered,
} from '../../src/lib/references'
import { parseUrl, passageUrl } from '../../src/lib/urls'

// Extend this table whenever reference behavior changes. Inputs must be consumed completely.
const valid: [string, string][] = [
	['john', 'John 1'],
	['joh', 'John 1'],
	['1Cor', '1 Corinthians 1'],
	['john 3', 'John 3'],
	['john3', 'John 3'],
	['john 3:', 'John 3'],
	['john 3:16', 'John 3:16'],
	['jn 3 16', 'John 3:16'],
	['ps 23', 'Psalm 23'],
	['Ps23', 'Psalm 23'],
	['rom 8:', 'Romans 8'],
	['1cor13', '1 Corinthians 13'],
	['1 cor 13:4', '1 Corinthians 13:4'],
	['jude 5', 'Jude 1:5'],
	['Jude', 'Jude 1'],
	['Jude 1', 'Jude 1'],
	['jude 1:5', 'Jude 1:5'],
	['Philemon 6', 'Philemon 1:6'],
	['2jn 7', '2 John 1:7'],
	['3 John 14', '3 John 1:14'],
	['obad 9', 'Obadiah 1:9'],
	['  JOHN   3 : 16 ', 'John 3:16'],
	['Jn. 3.16', 'John 3:16'],
	['john 3:16–18', 'John 3:16–18'],
	['john3:16,18,20', 'John 3:16, 18, 20'],
	['John 3:16,18-19,21', 'John 3:16, 18–19, 21'],
	['John 3:36-4:2', 'John 3:36; 4:1–2'],
	['John 3:36; 4:1,2', 'John 3:36; 4:1–2'],
	['John 21:25; Acts 1:1-2', 'John 21:25; Acts 1:1–2'],
	['Psalm 119:176', 'Psalm 119:176'],
	['Rev22:21', 'Revelation 22:21'],
	['first cor 13:4', '1 Corinthians 13:4'],
	['II Timothy 2:2', '2 Timothy 2:2'],
	['song of songs 2:1', 'Song of Solomon 2:1'],
	['phil 4:4', 'Philippians 4:4'],
	['Psalm 1-2', 'Psalm 1:1–6; 2:1–12'],
	['John 3:18,16,18,17', 'John 3:16–18'],
	['jhn3:16', 'John 3:16'],
	['Romans8:28', 'Romans 8:28'],
]
const invalid = [
	'',
	' ',
	'John 3:99',
	'John 99',
	'John 0',
	'John 3:0',
	'John 3:-1',
	'John 3:18-16',
	'Psalm151',
	'Psalm 119:177',
	'Jude26',
	'Revelation23',
	'John 3:16 trailing',
	'John3:16,,18',
	'John3:16-',
	'John3:16-4',
	'John3:36-4:99',
	'Ph 1',
	'Jo 1',
	'1 13',
	'xyz 1',
	'John3:16;',
	';John3:16',
	'John3/16',
	'John3:16:18',
	'John 3:16; garbage',
	'John 3:16; Matthew 99',
]
describe('inline book completion', () => {
	it.each([
		['joh', 'John', 'n'],
		['JOH', 'John', 'n'],
		['ps', 'Psalm', 'alm'],
		['1 Cor', '1 Corinthians', 'inthians'],
		['1Cor', '1 Corinthians', 'inthians'],
		['  2   Cor', '2 Corinthians', 'inthians'],
		['phil', 'Philippians', 'ippians'],
		['phile', 'Philemon', 'mon'],
		['song of', 'Song of Solomon', ' Solomon'],
	])('completes %s as %s with suffix %s', (input, name, suffix) => {
		expect(bookCompletion(input!)).toEqual({ name, suffix })
	})
	it.each([
		'', 'j', 'jo', 'ph', '1', 'John', 'John 3', 'John3', 'John 3:16',
		'John 3:16-18', 'John 3:16,18', 'joh ', 'jn', '1jn', 'first john',
		'John 3; Act', 'xyz', 'j.o.h',
	])('leaves %s alone', (input) => {
		expect(bookCompletion(input)).toBeUndefined()
	})
})
describe('local Bible reference interpretation', () => {
	it.each(valid)('interprets "%s" as %s', (input, canonical) =>
		expect(passageLabel(parseReference(input)!)).toBe(canonical),
	)
	it.each(invalid)('rejects "%s" without inventing a location', (input) =>
		expect(parseReference(input)).toBeUndefined(),
	)
	it.each(
		books.flatMap((b) => [b.name, b.id, ...b.aliases].map((a) => [a, b.id])),
	)('accepts the canonical book/alias %s', (input, book) =>
		expect(parseReference(input!)?.book).toBe(book),
	)
	it.each(books)('strictly validates chapter/verse limits in $name', (book) => {
		const lastCh = book.verses.length,
			lastV = book.verses.at(-1)!
		expect(parseReference(`${book.name} ${lastCh}:${lastV}`)).toBeDefined()
		expect(
			parseReference(`${book.name} ${lastCh}:${lastV + 1}`),
		).toBeUndefined()
		expect(parseReference(`${book.name} ${lastCh + 1}:1`)).toBeUndefined()
	})
})
describe('canonical IDs and formatting', () => {
	it('round-trips and validates canonical verse IDs', () => {
		expect(fromId('jhn.3.16')).toEqual({ book: 'jhn', chapter: 3, verse: 16 })
		for (const id of [
			'jhn.99.1',
			'jhn.3.99',
			'bad.1.1',
			'jhn.3.0',
			'jhn.3.16.extra',
		])
			expect(fromId(id)).toBeUndefined()
		expect(verseId(fromId('jhn.3.16')!)).toBe('jhn.3.16')
	})
	it.each([
		['John 3:16,17,18', 'John 3:16–18'],
		['John3:16,18,19,21', 'John 3:16, 18–19, 21'],
		['John3:36;4:1,2', 'John 3:36; 4:1–2'],
		['John21:25;Acts1:1,2', 'John 21:25; Acts 1:1–2'],
	])('compresses %s as %s', (input, output) =>
		expect(formatReferences(parseReference(input)!.verses)).toBe(output),
	)
	it('orders verses canonically rather than by tap order and removes duplicates', () => {
		const ids = ['act.1.1', 'jhn.3.19', 'gen.1.1', 'jhn.3.16', 'jhn.3.19'].map(
			(id) => fromId(id)!,
		)
		expect(ordered(ids).map(verseId)).toEqual([
			'gen.1.1',
			'jhn.3.16',
			'jhn.3.19',
			'act.1.1',
		])
	})
})
describe('explicit translation deep links', () => {
	it.each([
		'John 3',
		'John 3:16',
		'John 3:16-18',
		'John3:16,18,20-21',
		'John21:25;Acts1:1,2',
		'1Cor13:4',
		'Jude5',
	])('round-trips %s with explicit BSB', (input) => {
		const p = parseReference(input)!,
			url = passageUrl(p)
		expect(url).toContain('version=BSB')
		expect(parseUrl(new URL(url, 'https://bible.test'))).toEqual({
			passage: p,
			version: 'BSB',
		})
	})
	it('uses canonical human-readable URL paths', () =>
		expect(passageUrl(parseReference('1cor13:4-7')!)).toBe(
			'/1-Corinthians/13/4-7?version=BSB',
		))
	it('never loses multi-book noncontiguous selections', () =>
		expect(passageUrl(parseReference('John21:25;Acts1:1,2')!)).toContain(
			'selection=jhn.21.25%2Cact.1.1%2Cact.1.2',
		))
	it.each([
		'/John/99',
		'/John/3/99',
		'/John/3/16/extra',
		'/Xyz/1',
		'/John/3?selection=oops',
	])('rejects invalid deep link %s', (path) =>
		expect(parseUrl(new URL(path, 'https://bible.test'))).toBeUndefined(),
	)
})

it.each(['WEB', 'KJV', 'unknown'])('opens an old %s URL at the same passage in BSB', (version) => {
	expect(parseUrl(new URL(`/John/3/16-18?version=${version}`, 'https://bible.test'))).toEqual({ passage: parseReference('John3:16-18'), version: 'BSB' })
})
