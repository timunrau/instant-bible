import { bookById, books, findBook } from '../src/lib/books'
import { parseReference } from '../src/lib/references'
import { FORMAT, type BibleBook, type Block, type Inline } from '../src/lib/types'

export interface UsjNode {
	type: string
	marker?: string
	number?: string
	code?: string
	loc?: string
	caller?: string
	content?: (UsjNode | string)[]
}
const label = (node: UsjNode): string => (node.content ?? []).map(c => typeof c === 'string' ? c : label(c)).join('')

export function referenceTarget(text: string, loc?: string): string | undefined {
	// Book ranges navigate to their beginning without materializing the entire span.
	const range = text.split(/[–—-]/)
	if (range.length === 2 && findBook(range[0]!) && findBook(range[1]!)) {
		const first = findBook(range[0]!)!, last = findBook(range[1]!)!
		if (books.indexOf(first) > books.indexOf(last)) throw new Error(`Reversed book range: ${text}`)
		return first.name
	}
	const passage = parseReference(text)
	if (!passage) return
	if (loc) {
		const complete = /^[A-Z1-3]{3} /.test(loc)
		const [id, numbers] = complete ? loc.split(' ') : [passage.book, loc]
		const book = bookById(id!.toLowerCase())
		const structured = book && parseReference(`${book.name} ${book.verses.length === 1 && !numbers!.includes(':') ? '1:' : ''}${numbers}`)
		if (!structured || JSON.stringify(structured) !== JSON.stringify(passage))
			throw new Error(`Reference label/location disagree: ${text} / ${loc}`)
	}
	return text
}

export function importUsj(root: UsjNode, book: string, name: string, report: (message: string) => void = console.warn): BibleBook {
	if (root.type !== 'USJ') throw new Error('Expected USJ')
	const result: BibleBook = { format: FORMAT, book, name, chapters: [] }
	let chapter: BibleBook['chapters'][number] | undefined
	let id = ''
	const inline = (node: UsjNode | string): Inline[] => {
		if (typeof node === 'string') return node ? [{ kind: 'text', text: node }] : []
		const children = (node.content ?? []).flatMap(inline)
		if (node.type === 'ref') {
			const text = label(node), target = referenceTarget(text, node.loc)
			if (!target) { report(`Unresolved reference in ${book}: ${text}`); return children }
			return [{ kind: 'reference', target, children }]
		}
		if (node.type === 'note' && node.marker === 'f') return [{ kind: 'note', marker: node.caller === '+' ? '*' : node.caller || '*', children }]
		if (node.type === 'char') {
			if (['ft', 'fr', 'fv', 'wj'].includes(node.marker!)) return children
			if (['fqa', 'it', 'add', 'em'].includes(node.marker!)) return [{ kind: 'em', children }]
			if (['sc', 'nd'].includes(node.marker!)) return [{ kind: 'smallcaps', children }]
			if (node.marker === 'bd') return [{ kind: 'strong', children }]
		}
		throw new Error(`Unsupported inline ${node.type}/${node.marker} in ${book}`)
	}
	for (const node of root.content ?? []) {
		if (typeof node === 'string') { if (node.trim()) throw new Error('Unexpected root text'); continue }
		if (node.type === 'book') { if (node.code?.toLowerCase() !== book) throw new Error('Book code mismatch'); continue }
		if (node.type === 'chapter') {
			chapter = { book, number: Number(node.number), blocks: [] }; result.chapters.push(chapter); id = ''; continue
		}
		if (node.type !== 'para') throw new Error(`Unsupported block ${node.type}`)
		const m = node.marker!
		if (['h','toc1','toc2','toc3','mt1','mt2'].includes(m)) { if (chapter) throw new Error('Unexpected title inside chapter'); continue }
		if (!chapter) throw new Error('Paragraph before chapter')
		const kind: Block['kind'] = ['s1','s2','ms','mr','d','qa'].includes(m) ? 'heading' : m === 'r' ? 'reference' : ['q1','q2','qr'].includes(m) ? 'poetry' : m === 'b' ? 'break' : 'paragraph'
		if (!['s1','s2','ms','mr','d','qa','r','q1','q2','qr','b','p','pmo','li1','li2','pc'].includes(m)) throw new Error(`Unsupported paragraph ${m}`)
		const block: Block = { kind, indent: Number(m.match(/(?:q|li)(\d)/)?.[1] ?? 0), fragments: [] }
		let fragment: Block['fragments'][number] | undefined
		const flatten = (child: UsjNode | string): (UsjNode | string)[] => typeof child !== 'string' && child.type === 'char' && child.marker === 'wj' ? (child.content ?? []).flatMap(flatten) : [child]
		for (const child of (node.content ?? []).flatMap(flatten)) {
			if (typeof child !== 'string' && child.type === 'verse') {
				const number = Number(child.number)
				if (!Number.isInteger(number) || number < 1) throw new Error('Invalid verse')
				id = `${book}.${chapter.number}.${number}`; fragment = { id, number, nodes: [] }; block.fragments.push(fragment)
			} else {
				if (!fragment) { fragment = { id: kind === 'heading' || kind === 'reference' ? '' : id, nodes: [] }; block.fragments.push(fragment) }
				fragment.nodes.push(...inline(child))
			}
		}
		// Source paragraphs introduce whitespace before verse milestones; it is not a verse fragment.
		block.fragments = block.fragments.filter(f => f.number || f.nodes.some(n => n.kind !== 'text' || n.text.trim()))
		chapter.blocks.push(block)
	}
	return result
}
