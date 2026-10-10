import assets from '../data/bsb-assets.json'
import genesis from '../data/genesis-one.json'
import { bookById } from './books'
import { FORMAT, type BibleBook, type Chapter } from './types'
import { appUrl } from './base'

export const firstChapter = genesis as Chapter

export class BibleRepository {
	private memory = new Map<string, Promise<BibleBook>>()
	constructor(private storage: CacheStorage | undefined = globalThis.caches) {}

	async cleanup() {
		if (!this.storage) return
		// Release optional translations left behind by earlier app versions.
		for (const name of await this.storage.keys())
			if (name.startsWith('bible-data-')) await this.storage.delete(name)
	}

	async loadBook(book: string): Promise<BibleBook> {
		if (!this.memory.has(book)) {
			const request = (async () => {
				const response = await fetch(appUrl((assets as Record<string, string>)[book]!))
				if (!response.ok)
					throw new Error('This Bible is unavailable. Please retry.')
				const data = (await response.json()) as BibleBook
				if (data.format !== FORMAT || data.book !== book || !data.chapters?.length)
					throw new Error('Incompatible Bible data.')
				return data
			})()
			this.memory.set(book, request)
			request.catch(() => this.memory.delete(book))
			// Keep enough books for the chapter window; the service worker precaches BSB.
			if (this.memory.size > 6)
				this.memory.delete(this.memory.keys().next().value!)
		}
		return this.memory.get(book)!
	}

	async chapter(book: string, chapter: number) {
		const data = await this.loadBook(book)
		return data.chapters[chapter - 1] ?? data.chapters[0]!
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
