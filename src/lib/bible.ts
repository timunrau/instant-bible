import bsb from '../data/bsb-metadata.json'
import assets from '../data/bsb-assets.json'
import catalogData from '../data/catalog.json'
import genesis from '../data/genesis-one.json'
import { books, bookById } from './books'
import { FORMAT, type BibleBook, type Chapter, type Translation } from './types'
import { normalizeBook } from './normalize'
import { appUrl } from './base'

export const catalog: Translation[] = [
	bsb,
	...catalogData.filter((t) => t.abbreviation !== 'BSB'),
]
export const translationFor = (version: string) =>
	catalog.find((t) => t.abbreviation === version)
const PREFIX = 'bible-data-'
const cacheName = (id: string) => `${PREFIX}v${FORMAT}-${id}`
const bookUrl = (version: string, book: string) =>
	version === 'BSB'
		? appUrl((assets as Record<string, string>)[book]!)
		: appUrl(`bibles/v${FORMAT}/${version}/${book}.json`)
const markerUrl = (version: string) =>
	appUrl(`bibles/v${FORMAT}/${version}/metadata.json`)
export const firstChapter = genesis as Chapter

export class BibleRepository {
	private memory = new Map<string, Promise<BibleBook>>()
	private installations = new Map<string, Promise<void>>()
	constructor(private storage: CacheStorage | undefined = globalThis.caches) {}

	async installed(translation: Translation): Promise<boolean> {
		if (translation.abbreviation === 'BSB') return true
		if (!this.storage) return false
		const name = cacheName(translation.id)
		if (!(await this.storage.keys()).includes(name)) return false
		const cache = await this.storage.open(name)
		const marker = await cache.match(markerUrl(translation.abbreviation))
		if (!marker) return false
		try {
			const meta = (await marker.json()) as { format: number; books: string[] }
			if (
				meta.format !== FORMAT ||
				meta.books.length !== books.length ||
				!books.every((b) => meta.books.includes(b.id))
			)
				return false
			const keys = new Set(
				(await cache.keys()).map((r) => new URL(r.url).pathname),
			)
			return books.every((b) =>
				keys.has(bookUrl(translation.abbreviation, b.id)),
			)
		} catch {
			return false
		}
	}

	async installedVersions() {
		const installed = await Promise.all(
			catalog.map(async (t) =>
				(await this.installed(t)) ? t.abbreviation : '',
			),
		)
		return installed.filter(Boolean)
	}

	async cleanup() {
		if (!this.storage) return
		for (const name of await this.storage.keys()) {
			if (!name.startsWith(PREFIX)) continue
			const translation = catalog.find((t) => cacheName(t.id) === name)
			if (!translation || !(await this.installed(translation)))
				await this.storage.delete(name)
		}
	}

	async loadBook(version: string, book: string): Promise<BibleBook> {
		const key = `${version}:${book}`
		if (!this.memory.has(key)) {
			const request = (async () => {
				let response: Response | undefined
				if (version === 'BSB') response = await fetch(bookUrl(version, book))
				else {
					const translation = translationFor(version)
					if (!translation || !this.storage)
						throw new Error('Translation is unavailable offline.')
					response = await (
						await this.storage.open(cacheName(translation.id))
					).match(bookUrl(version, book))
				}
				if (!response?.ok)
					throw new Error('This Bible is unavailable. Please retry.')
				const data = (await response.json()) as BibleBook
				if (
					data.format !== FORMAT ||
					data.book !== book ||
					!data.chapters?.length
				)
					throw new Error('Incompatible Bible data.')
				return data
			})()
			this.memory.set(key, request)
			request.catch(() => this.memory.delete(key))
			// Keep enough books for the chapter window; Cache Storage remains the durable store.
			if (this.memory.size > 6)
				this.memory.delete(this.memory.keys().next().value!)
		}
		return this.memory.get(key)!
	}

	async chapter(version: string, book: string, chapter: number) {
		const data = await this.loadBook(version, book)
		return data.chapters[chapter - 1] ?? data.chapters[0]!
	}

	install(
		translation: Translation,
		progress: (completed: number, total: number) => void,
	): Promise<void> {
		if (this.installations.has(translation.id))
			return this.installations.get(translation.id)!
		const promise = this.download(translation, progress).finally(() =>
			this.installations.delete(translation.id),
		)
		this.installations.set(translation.id, promise)
		return promise
	}

	private async download(
		translation: Translation,
		progress: (completed: number, total: number) => void,
	) {
		if (await this.installed(translation)) return
		if (!this.storage)
			throw new Error('Offline storage is unavailable in this browser.')
		const { FetchClient } = await import('@gracious.tech/fetch-client')
		const client = new FetchClient({
			usage: { limitless: true, derivatives: true },
			remember_fetches: false,
		})
		const collection = await client.fetch_collection()
		const resource = collection.bibles
			.get_resources({ language: 'eng', exclude_incomplete: true })
			.find((t) => t.id === translation.id)
		if (
			!resource ||
			collection.bibles.get_books(resource.id).length !== books.length
		)
			throw new Error('This translation is not available for whole-Bible use.')
		const name = cacheName(translation.id)
		await this.storage.delete(name)
		const cache = await this.storage.open(name)
		const controller = new AbortController()
		client.requester.request = async (url) => {
			const response = await fetch(url, { signal: controller.signal })
			if (!response.ok) throw new Error('Could not download this Bible.')
			return response.text()
		}
		let next = 0
		let completed = 0
		progress(0, books.length)
		const workers = Array.from({ length: 4 }, async () => {
			while (next < books.length && !controller.signal.aborted) {
				const book = books[next++]!
				const source = await collection.bibles.fetch_book(
					resource.id,
					book.id,
					'html',
				)
				const chapters = book.verses.map((_, i) =>
					source.get_chapter(i + 1, { attribute: false }),
				)
				const data = normalizeBook(book.id, book.name, chapters, (html) =>
					new DOMParser().parseFromString(html, 'text/html'),
				)
				if (controller.signal.aborted) return
				await cache.put(
					bookUrl(translation.abbreviation, book.id),
					Response.json(data),
				)
				progress(++completed, books.length)
			}
		})
		try {
			await Promise.all(workers)
			const metadata = {
				...translation,
				format: FORMAT,
				attribution: resource.attribution,
				attributionUrl: resource.attribution_url,
				licenses: resource.licenses,
			}
			await cache.put(
				markerUrl(translation.abbreviation),
				Response.json(metadata),
			)
			void navigator.storage?.persist?.().catch(() => false)
		} catch (error) {
			controller.abort()
			await Promise.allSettled(workers)
			await this.storage.delete(name)
			throw error
		}
	}

	async remove(version: string) {
		const t = translationFor(version)
		if (!t || version === 'BSB' || !this.storage) return
		await this.storage.delete(cacheName(t.id))
		for (const key of this.memory.keys())
			if (key.startsWith(version + ':')) this.memory.delete(key)
	}

	async metadata(version: string): Promise<Translation> {
		const t = translationFor(version) ?? bsb
		if (version !== 'BSB' && this.storage) {
			const r = await (
				await this.storage.open(cacheName(t.id))
			).match(markerUrl(version))
			if (r) return r.json() as Promise<Translation>
		}
		return t
	}
}
export const repository = new BibleRepository()
export const nearestVerse = (chapter: Chapter, verse: number) => {
	const numbers = chapter.blocks.flatMap((b) =>
		b.fragments.map((f) => f.number).filter((n): n is number => !!n),
	)
	return numbers.find((n) => n >= verse) ?? numbers.at(-1) ?? 1
}
export const nameOf = (id: string) => bookById(id)!.name
