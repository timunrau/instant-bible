import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { importUsj, referenceTarget, type UsjNode } from '../../scripts/import-usj'
import { inlineText } from '../../src/lib/normalize'
import { copyText } from '../../src/lib/clipboard'
import ScriptureChapter from '../../src/components/ScriptureChapter.vue'
import { parseReference } from '../../src/lib/references'
const zip = unzipSync(readFileSync('sources/bsb/bsb_usj.zip'))
const source = (book: string) => JSON.parse(new TextDecoder().decode(zip[`bsb_usj/${book.toUpperCase()}.usj`])) as UsjNode

describe('official USJ import', () => {
	it.each([
		['Song of Solomon 1:1–17', '1:1-17', 'Song of Solomon 1:1–17'],
		['Genesis 4–9', undefined, 'Genesis 4–9'],
		['Joshua–Malachi', undefined, 'Joshua'],
		['1 Enoch 13:1', undefined, undefined],
	])('resolves explicit source reference %s', (label, loc, expected) => {
		expect(referenceTarget(label!, loc)).toBe(expected)
	})
	it('rejects conflicting destinations and unknown structures', () => {
		expect(() => referenceTarget('John 3:16', 'MAT 3:16')).toThrow('disagree')
		expect(() => referenceTarget('Song of Solomon 1:1–17', '1:1-16')).toThrow('disagree')
		const root = source('gen')
		root.content!.push({ type: 'para', marker: 'unknown', content: ['Text'] })
		expect(() => importUsj(root, 'gen', 'Genesis')).toThrow('Unsupported')
	})
	it('preserves Psalm heading milestones, split poetry, note emphasis and reference punctuation', () => {
		const psalm = importUsj(source('psa'), 'psa', 'Psalm').chapters[2]!
		expect(psalm.blocks.find(b => b.kind === 'heading' && b.fragments.some(f => f.number === 1))).toBeDefined()
		expect(psalm.blocks.find(b => b.kind === 'poetry')!.fragments[0]!.id).toBe('psa.3.1')
		const matthew = importUsj(source('mat'), 'mat', 'Matthew').chapters[0]!
		expect(matthew.blocks.filter(b => b.kind === 'poetry' && b.fragments.some(f => f.id === 'mat.1.2')).length).toBe(3)
		const note = matthew.blocks.flatMap(b => b.fragments.flatMap(f => f.nodes)).find(n => n.kind === 'note')!
		expect(JSON.stringify(note)).toContain('"kind":"em"')
		expect(inlineText(matthew.blocks[1]!.fragments[0]!.nodes)).toBe('(Ruth 4:18–22; Luke 3:23–38)')
	})
	it('renders native heading links without verse targets or copied references', async () => {
		const chapter = importUsj(source('gen'), 'gen', 'Genesis').chapters[0]!
		const wrapper = mount(ScriptureChapter, { props: { chapter, selected: new Set(['gen.1.1']) } })
		const refs = wrapper.get('.reference')
		expect(refs.find('[data-verse]').exists()).toBe(false)
		expect(refs.get('a').attributes('href')).toBe('/John/1/1-5')
		const modified = new MouseEvent('click', { button: 0, ctrlKey: true, cancelable: true })
		refs.get('a').element.dispatchEvent(modified)
		expect(modified.defaultPrevented).toBe(false)
		modified.preventDefault()
		expect(wrapper.emitted('navigate')).toBeUndefined()
		await refs.get('a').trigger('click', { button: 0 })
		expect(wrapper.emitted('navigate')?.[0]?.[0]).toMatchObject({ book: 'jhn', chapter: 1, verse: 1 })
		expect(copyText(parseReference('Genesis 1:1')!.verses, [chapter])).toBe('In the beginning God created the heavens and the earth. Genesis 1:1 BSB')
	})
})
