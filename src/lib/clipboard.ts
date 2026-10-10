import { inlineText } from './normalize'
import { formatReferences, ordered, verseId } from './references'
import type { Chapter, VerseRef } from './types'
export function copyText(
	refs: VerseRef[],
	chapters: Chapter[],
): string {
	const selection = ordered(refs)
	const ids = new Set(selection.map(verseId))
	const first = verseId(selection[0]!)
	const numbered = new Set<string>()
	const parts: string[] = []
	for (const chapter of chapters) {
		for (const block of chapter.blocks) {
			if (block.kind === 'heading' || block.kind === 'break') continue
			const body = block.fragments
				.filter((f) => ids.has(f.id))
				.map((f) => {
					const prefix =
						f.id === first || numbered.has(f.id) ? '' : `${f.id.split('.')[2]} `
					numbered.add(f.id)
					return prefix + inlineText(f.nodes).trim()
				})
				.join(' ')
				.trim()
			if (body) parts.push(body)
		}
	}

	return (
		parts.join(' ').replace(/\s+/g, ' ') +
		'\n' +
		formatReferences(selection) +
		' BSB'
	)
}
