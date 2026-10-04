import {
	FORMAT,
	type BibleBook,
	type Block,
	type Fragment,
	type Inline,
} from './types'

const text = (node: Node): string => node.textContent ?? ''
function inline(node: Node): Inline[] {
	if (node.nodeType === 3) return [{ kind: 'text', text: text(node) }]
	if (node.nodeType !== 1) return []
	const element = node as Element
	if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG'].includes(element.tagName))
		return []
	const children = Array.from(node.childNodes).flatMap(inline)
	const classes = element.classList
	if (classes.contains('fb-note'))
		return [
			{
				kind: 'note',
				marker: element.getAttribute('data-caller') || '*',
				children,
			},
		]
	if (
		['I', 'EM'].includes(element.tagName) ||
		['fb-it', 'fb-add', 'fb-em', 'fb-fqa'].some((c) => classes.contains(c))
	) {
		return [{ kind: 'em', children }]
	}
	if (['B', 'STRONG'].includes(element.tagName) || classes.contains('fb-bd'))
		return [{ kind: 'strong', children }]
	if (classes.contains('fb-sc') || classes.contains('fb-nd'))
		return [{ kind: 'smallcaps', children }]
	if (element.tagName === 'BR') return [{ kind: 'text', text: ' ' }]
	return children
}

// fetch(bible)'s get_chapter reassembles the original paragraph boundaries.
// Only allowlisted semantic nodes survive; no remote markup or attributes reach Vue.
export function normalizeChapter(
	book: string,
	number: number,
	document: Document,
) {
	let currentId = ''
	const blocks: Block[] = []
	for (const element of Array.from(
		document.body.querySelectorAll('p,h4,h5,h6'),
	)) {
		const cls = element.getAttribute('class') ?? ''
		const poetry = /fb-q\d?|fb-qm\d?/.test(cls)
		const indent = Number(cls.match(/fb-(?:qm?|li)(\d)/)?.[1] ?? 0)
		const heading =
			element.tagName !== 'P' || /fb-(?:d|sp|ms\d?|s\d?)(?:\s|$)/.test(cls)
		const block: Block = {
			kind: heading
				? 'heading'
				: poetry
					? 'poetry'
					: /fb-b(?:\s|$)/.test(cls)
						? 'break'
						: 'paragraph',
			indent,
			fragments: [],
		}
		if (heading && !element.querySelector('[data-v]')) {
			block.fragments.push({
				id: '',
				nodes: Array.from(element.childNodes).flatMap(inline),
			})
		} else {
			let fragment: Fragment | undefined
			for (const node of Array.from(element.childNodes)) {
				if (node.nodeType === 1 && (node as Element).hasAttribute('data-v')) {
					const pair = (node as Element)
						.getAttribute('data-v')!
						.split(':')
						.map(Number)
					if (pair[0] !== number || !pair[1])
						throw new Error(`Invalid source verse in ${book} ${number}`)
					currentId = `${book}.${number}.${pair[1]}`
					fragment = { id: currentId, number: pair[1], nodes: [] }
					block.fragments.push(fragment)
				} else {
					const nodes = inline(node)
					if (!fragment) {
						fragment = { id: currentId, nodes: [] }
						block.fragments.push(fragment)
					}
					fragment.nodes.push(...nodes)
				}
			}
		}
		blocks.push(block)
	}
	return { book, number, blocks }
}

export function normalizeBook(
	book: string,
	name: string,
	chapters: string[],
	parse: (html: string) => Document,
): BibleBook {
	return {
		format: FORMAT,
		book,
		name,
		chapters: chapters.map((html, i) =>
			normalizeChapter(book, i + 1, parse(html)),
		),
	}
}

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
