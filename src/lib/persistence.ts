import { fromId, verseId } from './references'
import type { Anchor } from './types'
export interface Settings {
	font: 'serif' | 'sans'
	size: number
	spacing: 'compact' | 'normal' | 'relaxed'
	theme: 'auto' | 'light' | 'dark'
}
export const defaults: Settings = {
	font: 'serif',
	size: 20,
	spacing: 'relaxed',
	theme: 'auto',
}
export function readJson(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null')
	} catch {
		return null
	}
}
export function writeJson(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch {
		/* Reading works with storage disabled. */
	}
}
export function readSettings(): Settings {
	const value = readJson('bible-settings') as Partial<Settings> | null
	return {
		font: value?.font === 'sans' ? 'sans' : 'serif',
		size: [17, 18, 20, 22, 24, 27].includes(value?.size ?? 0)
			? value!.size!
			: 20,
		spacing:
			value?.spacing === 'compact' || value?.spacing === 'normal'
				? value.spacing
				: 'relaxed',
		theme:
			value?.theme === 'light' || value?.theme === 'dark'
				? value.theme
				: 'auto',
	}
}
export function validAnchor(value: unknown): Anchor | undefined {
	if (!value || typeof value !== 'object') return
	const a = value as Anchor
	if (
		!fromId(verseId(a)) ||
		typeof a.version !== 'string' ||
		!Number.isFinite(a.fraction)
	)
		return
	return {
		book: a.book,
		chapter: a.chapter,
		verse: a.verse,
		version: a.version,
		fraction: Math.max(-16, Math.min(1, a.fraction)),
		chapterStart: !!a.chapterStart,
		fragment: Number.isInteger(a.fragment)
			? Math.max(0, Math.min(100, a.fragment!))
			: 0,
	}
}
export const readAnchor = () => validAnchor(readJson('bible-position'))
export function applyTheme(theme: Settings['theme']) {
	const dark =
		theme === 'dark' ||
		(theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
	document.documentElement.dataset.theme = dark ? 'dark' : 'light'
	document
		.querySelector('meta[name="color-scheme"]')
		?.setAttribute('content', dark ? 'dark' : 'light')
}
