import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { chapterIndex, chapterNumber } from '../lib/books'
import { nearestVerse, repository, translationFor } from '../lib/bible'
import { chapterLabel, fromId, verseId } from '../lib/references'
import { parseUrl, passageUrl } from '../lib/urls'
import { validAnchor, writeJson } from '../lib/persistence'
import type { Anchor, Chapter, Passage, VerseRef } from '../lib/types'

export function useReader(
	initial: Chapter,
	initialAnchor: Anchor,
	pendingVersion?: string,
	initialPassage?: Passage,
) {
	const chapters = shallowRef<Chapter[]>([initial])
	const version = ref(initialAnchor.version)
	const current = ref({ book: initial.book, chapter: initial.number })
	const selected = ref(new Set<string>())
	const indicated = ref(new Set<string>())
	const status = ref('')
	const retry = shallowRef<(() => void) | undefined>()
	const downloading = ref(false)
	let operation = 0
	let balancing = false
	let moving = false
	let lastUrl = 0
	let programmaticScrollY: number | undefined
	let scrollFrame = 0
	let resizeTimer: ReturnType<typeof setTimeout>
	let indicationTimer: ReturnType<typeof setTimeout>
	let stableAnchor = initialAnchor
	const origin = () => (window.innerWidth >= 768 ? 48 : 24)
	const verseElements = (id: string) =>
		Array.from(document.querySelectorAll<HTMLElement>(`[data-verse="${id}"]`))
	const chapterElement = (book: string, chapter: number) =>
		document.getElementById(`chapter-${book}-${chapter}`)

	function capture(): Anchor {
		const elements = Array.from(
			document.querySelectorAll<HTMLElement>('[data-verse]'),
		)
		const element = elements.find(
			(e) => e.getBoundingClientRect().bottom > origin() + 1,
		)
		const parsed = element && fromId(element.dataset.verse!)
		if (!element || !parsed) return stableAnchor
		const rect = element.getBoundingClientRect()
		const article = chapterElement(parsed.book, parsed.chapter)
		return {
			...parsed,
			version: version.value,
			fragment: verseElements(verseId(parsed)).indexOf(element),
			fraction: Math.max(
				-16,
				Math.min(1, (origin() - rect.top) / Math.max(1, rect.height)),
			),
			chapterStart:
				!!article && article.getBoundingClientRect().top >= origin() - 2,
		}
	}

	function restore(anchor: Anchor) {
		const article = chapterElement(anchor.book, anchor.chapter)
		let top = article?.getBoundingClientRect().top
		if (!anchor.chapterStart) {
			const chapter = chapters.value.find(
				(c) => c.book === anchor.book && c.number === anchor.chapter,
			)
			const number = chapter
				? nearestVerse(chapter, anchor.verse)
				: anchor.verse
			const parts = verseElements(verseId({ ...anchor, verse: number }))
			const element = parts[Math.min(anchor.fragment ?? 0, parts.length - 1)]
			if (element) {
				const rect = element.getBoundingClientRect()
				top = rect.top + rect.height * anchor.fraction
			}
		}
		if (top !== undefined)
			window.scrollBy({ top: top - origin(), behavior: 'instant' })
		programmaticScrollY = window.scrollY
		stableAnchor = anchor
	}

	async function windowFor(
		book: string,
		chapter: number,
		activeVersion = version.value,
	) {
		const index = chapterNumber(book, chapter)
		const refs = chapterIndex.slice(
			Math.max(0, index - 3),
			Math.min(chapterIndex.length, index + 6),
		)
		return Promise.all(
			refs.map((r) => repository.chapter(activeVersion, r.book, r.chapter)),
		)
	}

	function save(updateUrl = true) {
		if (moving) return
		const anchor = capture()
		stableAnchor = anchor
		current.value = { book: anchor.book, chapter: anchor.chapter }
		document.title = `${chapterLabel(anchor.book, anchor.chapter)} — Bible`
		writeJson('bible-position', anchor)
		if (updateUrl) {
			const passage: Passage = {
				...anchor,
				verse: anchor.chapterStart ? undefined : anchor.verse,
				verses: [],
			}
			history.replaceState({ anchor }, '', passageUrl(passage, version.value))
		} else history.replaceState({ ...history.state, anchor }, '')
	}

	async function balance() {
		if (balancing || moving) return
		const index = chapterNumber(current.value.book, current.value.chapter)
		const first = chapters.value[0]!
		const last = chapters.value.at(-1)!
		const start = chapterNumber(first.book, first.number)
		const end = chapterNumber(last.book, last.number)
		if (
			(index - start >= 2 || start === 0) &&
			(end - index >= 3 || end === chapterIndex.length - 1)
		)
			return
		balancing = true
		const token = operation
		try {
			const updated = await windowFor(current.value.book, current.value.chapter)
			if (token !== operation) return
			const anchor = capture()
			const element = chapterElement(anchor.book, anchor.chapter)
			const previousTop = element?.getBoundingClientRect().top
			// Freeze browser scroll anchoring while replacing the stable chapter window.
			moving = true
			chapters.value = updated
			await nextTick()
			const nextTop = chapterElement(
				anchor.book,
				anchor.chapter,
			)?.getBoundingClientRect().top
			if (previousTop !== undefined && nextTop !== undefined)
				window.scrollBy({ top: nextTop - previousTop, behavior: 'instant' })
			programmaticScrollY = window.scrollY
			stableAnchor = anchor
		} catch {
			/* Keep the existing chapters readable if local storage was evicted. */
		} finally {
			balancing = false
			if (token === operation) moving = false
		}
	}

	async function navigate(
		passage: Passage,
		options: {
			history?: boolean
			anchor?: Anchor
			version?: string
			indicate?: boolean
		} = {},
	) {
		const targetVersion = options.version ?? version.value
		const token = ++operation
		save(false)
		moving = true
		try {
			// Render the destination from memory/cache immediately, then extend its chapter window.
			const destination = await repository.chapter(
				targetVersion,
				passage.book,
				passage.chapter,
			)
			if (token !== operation) return
			const anchor = options.anchor ?? {
				book: passage.book,
				chapter: passage.chapter,
				verse: passage.verse ?? 1,
				fraction: 0,
				chapterStart: !passage.verse,
				version: targetVersion,
			}
			selected.value = new Set()
			indicated.value = new Set()
			clearTimeout(indicationTimer)
			if (options.indicate !== false && passage.verses.length) {
				indicated.value = new Set(passage.verses.map(verseId))
				indicationTimer = setTimeout(() => {
					indicated.value = new Set()
				}, 2400)
			}
			version.value = targetVersion
			chapters.value = [destination]
			current.value = { book: passage.book, chapter: passage.chapter }
			if (options.history !== false)
				history.pushState({ anchor }, '', passageUrl(passage, targetVersion))
			else
				history.replaceState({ anchor }, '', passageUrl(passage, targetVersion))
			await nextTick()
			restore(anchor)
			// Make the whole requested verse/top origin reachable even near the final chapter.
			const updated = await windowFor(
				passage.book,
				passage.chapter,
				targetVersion,
			)
			if (token !== operation) return
			chapters.value = updated
			await nextTick()
			restore(anchor)
			document.title = `${chapterLabel(passage.book, passage.chapter)} — Bible`
			writeJson('bible-position', anchor)
		} catch {
			status.value = 'This passage is unavailable. Try again.'
		} finally {
			if (token === operation) moving = false
		}
	}

	async function switchVersion(
		requested: string,
		passage?: Passage,
		explicit = true,
	) {
		const target = passage ?? { ...capture(), verses: [] }
		const anchor = passage ? undefined : { ...capture(), version: requested }
		const translation = translationFor(requested)
		if (!translation) {
			status.value = `${requested} is unavailable. BSB remains readable.`
			return
		}
		if (downloading.value) return
		status.value = ''
		retry.value = undefined
		try {
			if (!(await repository.installed(translation))) {
				downloading.value = true
				status.value = `${requested} · 0%`
				await repository.install(translation, (done, total) => {
					status.value = `${requested} · ${Math.round((done / total) * 100)}%`
				})
			}
			await navigate(target, {
				version: requested,
				history: explicit,
				anchor,
				indicate: !!passage,
			})
			status.value = ''
		} catch {
			status.value = `Couldn’t install ${requested}.`
			retry.value = () => {
				void switchVersion(requested, passage, explicit)
			}
		} finally {
			downloading.value = false
		}
	}

	function step(direction: number) {
		const index = chapterNumber(current.value.book, current.value.chapter)
		const target = chapterIndex[index + direction]
		if (target) void navigate({ ...target, verses: [] })
	}
	function toggle(id: string) {
		const next = new Set(selected.value)
		if (next.has(id)) next.delete(id)
		else next.add(id)
		selected.value = next
	}
	function onScroll() {
		// A delayed scroll event from our own restoration must not erase a range URL.
		if (programmaticScrollY !== undefined && Math.abs(window.scrollY - programmaticScrollY) < 1) return
		programmaticScrollY = undefined
		if (scrollFrame) return
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0
			if (moving) return
			if (performance.now() - lastUrl > 400) {
				save()
				lastUrl = performance.now()
			} else save(false)
			void balance()
		})
	}
	function onResize() {
		clearTimeout(resizeTimer)
		const anchor = stableAnchor
		resizeTimer = setTimeout(() => restore(anchor), 100)
	}
	async function onPop(event: PopStateEvent) {
		const anchor = validAnchor(event.state?.anchor)
		const route = parseUrl(new URL(location.href))
		if (!route) return
		if (anchor && anchor.version === version.value)
			await navigate(
				{ ...anchor, verses: [] },
				{ history: false, anchor, indicate: false },
			)
		else await switchVersion(route.version, route.passage, false)
	}
	const leave = () => save(false)
	const selectionRefs = (): VerseRef[] =>
		[...selected.value].map(fromId).filter((r) => !!r)

	onMounted(async () => {
		moving = true
		try {
			chapters.value = await windowFor(initial.book, initial.number)
			await nextTick()
			restore(initialAnchor)
		} finally {
			moving = false
		}
		history.replaceState(
			{ anchor: initialAnchor },
			'',
			passageUrl(
				initialPassage ?? {
					...initialAnchor,
					verse: initialAnchor.chapterStart ? undefined : initialAnchor.verse,
					verses: [],
				},
				version.value,
			),
		)
		if (initialPassage?.verses.length) {
			indicated.value = new Set(initialPassage.verses.map(verseId))
			indicationTimer = setTimeout(() => {
				indicated.value = new Set()
			}, 2400)
		}
		document.title = `${chapterLabel(initial.book, initial.number)} — Bible`
		document.fonts.ready
			.then(() => {
				if (!moving) restore(stableAnchor)
			})
			.catch(() => {})
		window.addEventListener('scroll', onScroll, { passive: true })
		window.addEventListener('resize', onResize)
		window.addEventListener('popstate', onPop)
		window.addEventListener('pagehide', leave)
		if (pendingVersion)
			void switchVersion(
				pendingVersion,
				initialPassage ?? { ...initialAnchor, verses: [] },
				false,
			)
		else void repository.cleanup()
	})
	onUnmounted(() => {
		window.removeEventListener('scroll', onScroll)
		window.removeEventListener('resize', onResize)
		window.removeEventListener('popstate', onPop)
		window.removeEventListener('pagehide', leave)
		cancelAnimationFrame(scrollFrame)
		clearTimeout(indicationTimer)
		clearTimeout(resizeTimer)
	})
	return {
		chapters,
		version,
		current,
		selected,
		indicated,
		status,
		retry,
		downloading,
		capture,
		save,
		restore,
		navigate,
		switchVersion,
		step,
		toggle,
		selectionRefs,
	}
}
