import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BibleRepository, catalog } from '../../src/lib/bible'
import { books } from '../../src/lib/books'
import {
	defaults,
	readAnchor,
	readSettings,
	validAnchor,
	writeJson,
} from '../../src/lib/persistence'
const address = (request: RequestInfo | URL) =>
	new URL(
		typeof request === 'string'
			? request
			: request instanceof URL
				? request.href
				: request.url,
		'http://localhost',
	).href
function memoryStorage() {
	const stores = new Map<string, Map<string, Response>>()
	return {
		keys: async () => [...stores.keys()],
		delete: async (name: string) => stores.delete(name),
		open: async (name: string) => {
			if (!stores.has(name)) stores.set(name, new Map())
			const store = stores.get(name)!
			return {
				keys: async () => [...store.keys()].map((url) => new Request(url)),
				match: async (url: RequestInfo) => store.get(address(url))?.clone(),
				put: async (url: RequestInfo, response: Response) => {
					store.set(address(url), response.clone())
				},
			}
		},
	} as unknown as CacheStorage
}
describe('atomic whole-Bible installed state', () => {
	it('always treats bundled BSB as installed even without Cache Storage', async () =>
		expect(await new BibleRepository(undefined).installed(catalog[0]!)).toBe(
			true,
		))
	it('never considers partial/interrupted optional data installed', async () => {
		const storage = memoryStorage(),
			repo = new BibleRepository(storage),
			web = catalog.find((t) => t.abbreviation === 'WEB')!
		const cache = await storage.open('bible-data-v1-eng_web')
		await cache.put('/bibles/v1/WEB/gen.json', Response.json({}))
		expect(await repo.installed(web)).toBe(false)
		await cache.put(
			'/bibles/v1/WEB/metadata.json',
			Response.json({ format: 1, books: books.map((b) => b.id) }),
		)
		expect(await repo.installed(web)).toBe(false)
		await repo.cleanup()
		expect(await storage.keys()).toEqual([])
	})
	it('requires all 66 books plus compatible metadata before exposing an installation', async () => {
		const storage = memoryStorage(),
			repo = new BibleRepository(storage),
			web = catalog.find((t) => t.abbreviation === 'WEB')!
		const cache = await storage.open('bible-data-v1-eng_web')
		for (const book of books)
			await cache.put(
				`/bibles/v1/WEB/${book.id}.json`,
				Response.json({ format: 1 }),
			)
		expect(await repo.installed(web)).toBe(false)
		await cache.put(
			'/bibles/v1/WEB/metadata.json',
			Response.json({ format: 1, books: books.map((b) => b.id) }),
		)
		expect(await repo.installed(web)).toBe(true)
		expect(await repo.installedVersions()).toEqual(['BSB', 'WEB'])
	})
	it('discards incompatible data rather than migrating it', async () => {
		const storage = memoryStorage(),
			repo = new BibleRepository(storage)
		await storage.open('bible-data-v0-eng_web')
		await storage.open('unrelated-app-cache')
		await repo.cleanup()
		expect(await storage.keys()).toEqual(['unrelated-app-cache'])
	})
	it('reads installed optional Scripture solely from Cache Storage', async () => {
		const storage = memoryStorage(),
			repo = new BibleRepository(storage)
		const cache = await storage.open('bible-data-v1-eng_web')
		await cache.put(
			'/bibles/v1/WEB/jhn.json',
			Response.json({
				format: 1,
				book: 'jhn',
				name: 'John',
				chapters: [{ book: 'jhn', number: 1, blocks: [] }],
			}),
		)
		const network = vi.spyOn(globalThis, 'fetch')
		expect((await repo.loadBook('WEB', 'jhn')).book).toBe('jhn')
		expect(network).not.toHaveBeenCalled()
	})
	it('cannot remove bundled BSB', async () => {
		const storage = memoryStorage(),
			repo = new BibleRepository(storage)
		await repo.remove('BSB')
		expect(await repo.installed(catalog[0]!)).toBe(true)
	})
})
describe('small defensive local persistence', () => {
	beforeEach(() => localStorage.clear())
	it('uses readable defaults on first launch or corrupt preferences', () => {
		expect(readSettings()).toEqual(defaults)
		localStorage.setItem('bible-settings', 'not json')
		expect(readSettings()).toEqual(defaults)
		writeJson('bible-settings', {
			size: 999,
			font: 'weird',
			spacing: 'bad',
			theme: 'gray',
		})
		expect(readSettings()).toEqual(defaults)
	})
	it('restores only supported settings', () => {
		writeJson('bible-settings', {
			size: 24,
			font: 'sans',
			spacing: 'normal',
			theme: 'dark',
		})
		expect(readSettings()).toEqual({
			size: 24,
			font: 'sans',
			spacing: 'normal',
			theme: 'dark',
		})
	})
	it.each(['compact', 'normal', 'relaxed'] as const)('preserves saved %s spacing', (spacing) => {
		writeJson('bible-settings', { spacing })
		expect(readSettings().spacing).toBe(spacing)
	})
	it('validates and clamps semantic reading anchors', () => {
		const a = {
			book: 'rom',
			chapter: 8,
			verse: 28,
			version: 'BSB',
			fraction: 1.8,
		}
		expect(validAnchor(a)?.fraction).toBe(1)
		expect(validAnchor({ ...a, chapter: 99 })).toBeUndefined()
		expect(validAnchor({ ...a, fraction: NaN })).toBeUndefined()
		expect(readAnchor()).toBeUndefined()
		writeJson('bible-position', a)
		expect(readAnchor()?.verse).toBe(28)
	})
	it('works when localStorage denies writes', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Denied')
		})
		expect(() => writeJson('bible-settings', defaults)).not.toThrow()
	})
})
