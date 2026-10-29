import { inlineText } from './normalize'
import { formatReferences, ordered, verseId } from './references'
import type { Chapter, CopyFormat, VerseRef } from './types'
export function copyText(
	refs: VerseRef[],
	chapters: Chapter[],
	format: CopyFormat = {
		includeVerseNumbers: true,
		boldReference: false,
		superscriptNumbers: false,
	},
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
					const number = f.id.split('.')[2]!
					const digits = format.superscriptNumbers
						? number.replace(/\d/g, (digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)]!)
						: number
					const prefix = !format.includeVerseNumbers || f.id === first || numbered.has(f.id)
						? '' : `${digits} `
					numbered.add(f.id)
					return prefix + inlineText(f.nodes).trim()
				})
				.join(' ')
				.trim()
			if (body) parts.push(body)
		}
	}

	const reference = formatReferences(selection)
	return `${parts.join(' ').replace(/\s+/g, ' ')} ${format.boldReference ? `**${reference}**` : reference}`
}
