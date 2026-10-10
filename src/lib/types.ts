export const FORMAT = 1
export interface VerseRef {
	book: string
	chapter: number
	verse: number
}
export interface Passage {
	book: string
	chapter: number
	verse?: number
	verses: VerseRef[]
}
export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'em' | 'strong' | 'smallcaps'; children: Inline[] }
	| { kind: 'note'; marker: string; children: Inline[] }
export interface Fragment {
	id: string
	number?: number
	nodes: Inline[]
}
export interface Block {
	kind: 'paragraph' | 'poetry' | 'heading' | 'break'
	indent: number
	fragments: Fragment[]
}
export interface Chapter {
	book: string
	number: number
	blocks: Block[]
}
export interface BibleBook {
	format: number
	book: string
	name: string
	chapters: Chapter[]
}
export interface License {
	name: string
	url: string
	restrictions: object
}
export interface Translation {
	id: string
	abbreviation: string
	name: string
	attribution: string
	attributionUrl: string
	licenses: License[]
	books: string[]
}
export interface Anchor extends VerseRef {
	fraction: number
	version: 'BSB'
	chapterStart?: boolean
	fragment?: number
}
