import type { Inline } from './types'

export function inlineText(nodes: Inline[], includeNotes = false): string {
	return nodes
		.map((node) =>
			node.kind === 'text'
				? node.text
				: node.kind === 'note' && !includeNotes
					? ''
					: inlineText(node.children, includeNotes),
		)
		.join('')
}
