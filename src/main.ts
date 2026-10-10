import { createApp } from 'vue'
import App from './App.vue'
import { firstChapter, repository } from './lib/bible'
import { readAnchor, validAnchor } from './lib/persistence'
import { parseUrl } from './lib/urls'
import { appUrl } from './lib/base'
import type { Anchor } from './lib/types'
import './style.css'

async function start() {
	history.scrollRestoration = 'manual'
	const route = parseUrl(new URL(location.href))
	const saved = validAnchor(history.state?.anchor) ?? readAnchor()
	const sameLocation =
		saved &&
		route &&
		saved.book === route.passage.book &&
		saved.chapter === route.passage.chapter &&
		saved.verse === (route.passage.verse ?? 1) &&
		saved.version === route.version
	const desired: Anchor = sameLocation
		? saved
		: route
			? {
					...route.passage,
					verse: route.passage.verse ?? 1,
					fraction: 0,
					version: route.version,
					chapterStart: !route.passage.verse,
				}
			: (saved ?? {
					book: 'gen',
					chapter: 1,
					verse: 1,
					fraction: 0,
					chapterStart: true,
					version: 'BSB',
				})
	const anchor = { ...desired, version: 'BSB' as const }
	let initial = firstChapter
	try {
		if (anchor.book !== 'gen' || anchor.chapter !== 1)
			initial = await repository.chapter(anchor.book, anchor.chapter)
	} catch {
		Object.assign(anchor, {
			book: 'gen',
			chapter: 1,
			verse: 1,
			fraction: 0,
			chapterStart: true,
			version: 'BSB',
		})
	}
	createApp(App, {
		initial,
		anchor,
		initialPassage: route?.passage,
	}).mount('#app')
	// SW registration waits until Scripture has painted and never reloads an active reader.
	if (import.meta.env.PROD && 'serviceWorker' in navigator)
		requestAnimationFrame(() => {
			void navigator.serviceWorker.register(appUrl('sw.js'), { updateViaCache: 'none' }).catch(() => {})
		})
}
void start()
