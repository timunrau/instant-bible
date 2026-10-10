import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BibleRepository } from '../../src/lib/bible'
import assets from '../../src/data/bsb-assets.json'
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
describe('bundled BSB storage', () => {
	it('loads bundled content without Cache Storage and reuses in-memory books', async () => {
		const repo = new BibleRepository(undefined)
		const data = { format: 1, book: 'jhn', chapters: [{ book: 'jhn', number: 3, blocks: [] }] }
		const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(data))
		expect(await repo.loadBook('jhn')).toEqual(data)
		expect(await repo.loadBook('jhn')).toEqual(data)
		expect(network).toHaveBeenCalledExactlyOnceWith(assets.jhn)
	})
	it('allows retry after a failed bundled-book request', async () => {
		const repo = new BibleRepository(undefined)
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(Response.json({ format: 1, book: 'jhn', chapters: [{}] }))
		await expect(repo.loadBook('jhn')).rejects.toThrow('unavailable')
		await expect(repo.loadBook('jhn')).resolves.toMatchObject({ book: 'jhn' })
	})
	it('rejects incompatible bundled content', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ format: 0, book: 'jhn', chapters: [{}] }))
		await expect(new BibleRepository(undefined).loadBook('jhn')).rejects.toThrow('Incompatible')
	})
	it('removes legacy optional caches while preserving the BSB precache and unrelated caches', async () => {
		const storage = memoryStorage(), repo = new BibleRepository(storage)
		for (const name of ['bible-data-v0-eng_web', 'bible-data-v1-eng_web', 'workbox-precache-v2', 'unrelated-app-cache'])
			await storage.open(name)
		await repo.cleanup()
		expect(await storage.keys()).toEqual(['workbox-precache-v2', 'unrelated-app-cache'])
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
	it('restores an old translation anchor in BSB at the same semantic position', () => {
		const old = { book: 'rom', chapter: 8, verse: 28, version: 'WEB', fraction: 0.2, fragment: 1 }
		writeJson('bible-position', old)
		expect(readAnchor()).toEqual({ ...old, version: 'BSB', chapterStart: false })
	})
	it('works when localStorage denies writes', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Denied')
		})
		expect(() => writeJson('bible-settings', defaults)).not.toThrow()
	})
})
