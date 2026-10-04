import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { normalizeChapter, inlineText } from '../../src/lib/normalize'
import { copyText } from '../../src/lib/clipboard'
import { parseReference } from '../../src/lib/references'
import ScriptureChapter from '../../src/components/ScriptureChapter.vue'
import ReaderSettings from '../../src/components/ReaderSettings.vue'
import type { BibleBook } from '../../src/lib/types'
import { defaults } from '../../src/lib/persistence'
import metadata from '../../src/data/bsb-metadata.json'
import assets from '../../src/data/bsb-assets.json'
const book = (id: string): BibleBook =>
	JSON.parse(
		readFileSync(`public${(assets as Record<string, string>)[id]}`, 'utf8'),
	) as BibleBook
const chapter = book('jhn').chapters[2]!
const parse = (html: string) =>
	new DOMParser().parseFromString(html, 'text/html')
describe('Scripture semantic normalization', () => {
	it('preserves a verse that continues across paragraphs and poetry', () => {
		const data = normalizeChapter(
			'gen',
			1,
			parse(
				'<p><sup data-v="1:1">1</sup>In <em>the beginning</em>.</p><p class="fb-q2">God created.</p><p><sup data-v="1:2">2</sup>Next.</p>',
			),
		)
		expect(data.blocks[0]!.fragments[0]!.id).toBe('gen.1.1')
		expect(data.blocks[1]!.fragments[0]!.id).toBe('gen.1.1')
		expect(data.blocks[1]!.kind).toBe('poetry')
		expect(data.blocks[1]!.indent).toBe(2)
		expect(data.blocks[0]!.fragments[0]!.nodes[1]!.kind).toBe('em')
	})
	it('preserves Psalm verse markers inside source descriptive headings', () => {
		const c = book('psa').chapters[2]!
		expect(
			c.blocks.find(
				(b) => b.kind === 'heading' && b.fragments.some((f) => f.number === 1),
			),
		).toBeDefined()
		expect(
			c.blocks.filter((b) => b.kind === 'poetry')[0]!.fragments[0]!.id,
		).toBe('psa.3.1')
	})
	it('preserves emphasis, small caps, source note markers and note content', () => {
		const c = normalizeChapter(
			'gen',
			1,
			parse(
				'<p><sup data-v="1:1">1</sup><span class="fb-sc">LORD</span> <span class="fb-it">word</span><span class="fb-note" data-caller="a"><span>Note <i>italic</i></span></span></p>',
			),
		)
		const nodes = c.blocks[0]!.fragments[0]!.nodes
		expect(nodes.map((n) => n.kind)).toEqual([
			'smallcaps',
			'text',
			'em',
			'note',
		])
		expect(inlineText(nodes)).toBe('LORD word')
		expect(inlineText(nodes, true)).toBe('LORD wordNote italic')
		expect(nodes.at(-1)).toMatchObject({ marker: 'a' })
	})
	it('never passes arbitrary markup, scripts or source attributes to the renderer', () => {
		const c = normalizeChapter(
			'gen',
			1,
			parse(
				'<p onclick="bad()"><sup data-v="1:1">1</sup><script>bad()</script><img src="evil"><a href="javascript:bad()">Text</a></p>',
			),
		)
		expect(JSON.stringify(c)).not.toMatch(/bad|evil|onclick|href/)
		expect(inlineText(c.blocks[0]!.fragments[0]!.nodes)).toBe('Text')
	})
})
describe('plain-text Scripture copying', () => {
	it('copies skipped verses as John 3:16, 18–19 with subsequent inline numbers', () => {
		const p = parseReference('John3:19,16,18')!
		const text = copyText(p.verses, [chapter], 'BSB')
		expect(text).toMatch(/^For God so loved/)
		expect(text).toContain('18 Whoever believes')
		expect(text).toContain('19 And this is the verdict')
		expect(text).toMatch(/\n\nJohn 3:16, 18–19 BSB$/)
		expect(text).not.toContain('16 For')
		expect(text).not.toContain('God’s Love for the World')
	})
	it('keeps meaningful paragraphs without putting every verse on its own line', () => {
		const text = copyText(
			parseReference('John3:16-18')!.verses,
			[chapter],
			'BSB',
		)
		expect(text).toMatch(/17 For God/)
		expect(text).not.toMatch(/\n17 /)
	})
	it('flattens poetry and excludes notes and section headings', () => {
		const c = book('psa').chapters[22]!
		const text = copyText(parseReference('Psalm23:1-6')!.verses, [c], 'BSB')
		expect(text).toMatch(/^The LORD is my shepherd/)
		expect(text).toContain('2 He makes me lie down')
		expect(text.split('\n\n')).toHaveLength(2)
		expect(text).not.toContain('A Psalm of David')
	})
	it('numbers a split semantic verse only once', () => {
		const c = book('gen').chapters[0]!
		const text = copyText(parseReference('Gen1:26-28')!.verses, [c], 'BSB')
		expect(text.match(/27 /g)).toHaveLength(1)
		expect(text).not.toContain('Cited in Matthew')
	})
})
describe('semantic Scripture rendering', () => {
	it('keeps paragraphs inline, displays every verse number including verse 1, and renders headings', () => {
		const w = mount(ScriptureChapter, {
			props: {
				chapter,
				selected: new Set<string>(),
				indicated: new Set<string>(),
			},
		})
		expect(w.findAll('.verse-number')).toHaveLength(36)
		expect(w.find('.verse-number').text()).toBe('1')
		expect(w.find('h3').exists()).toBe(true)
		expect(w.find('p .verse + .verse').exists()).toBe(true)
		expect(w.findAll('p').length).toBeLessThan(36)
	})
	it.each([3, 23])('places Psalm %i verse 1 on Scripture rather than its descriptive heading', (number) => {
		const data = book('psa').chapters[number - 1]!
		const source = JSON.stringify(data)
		const w = mount(ScriptureChapter, {
			props: {
				chapter: data,
				selected: new Set([`psa.${number}.1`]),
				indicated: new Set([`psa.${number}.1`]),
			},
		})
		expect(w.findAll('h3 .verse-number')).toHaveLength(0)
		expect(w.findAll('h3 [data-verse]')).toHaveLength(0)
		expect(
			w.findAll('h3').some((heading) => heading.text().includes('A Psalm of David')),
		).toBe(true)
		const fragments = w.findAll(`[data-verse="psa.${number}.1"]`)
		expect(fragments[0]!.find('.verse-number').text()).toBe('1')
		expect(w.findAll('[aria-label="Verse 1"]')).toHaveLength(1)
		expect(
			fragments.every(
				(fragment) =>
					fragment.classes().includes('selected') &&
					fragment.classes().includes('indicated'),
			),
		).toBe(true)
		expect(JSON.stringify(data)).toBe(source)
	})
	it('selects every fragment of an entire semantic verse without cards', () => {
		const w = mount(ScriptureChapter, {
			props: {
				chapter: book('gen').chapters[0]!,
				selected: new Set(['gen.1.27']),
				indicated: new Set<string>(),
			},
		})
		expect(w.findAll('.selected')).toHaveLength(3)
		expect(
			w.findAll('.selected').every((f) => f.element.tagName === 'SPAN'),
		).toBe(true)
	})
	it('renders poetry indentation and a clear new-book heading', () => {
		const w = mount(ScriptureChapter, {
			props: {
				chapter: book('psa').chapters[22]!,
				selected: new Set<string>(),
				indicated: new Set<string>(),
			},
		})
		expect(w.find('.poetry.indent-2').exists()).toBe(true)
		const start = mount(ScriptureChapter, {
			props: {
				chapter: book('gen').chapters[0]!,
				selected: new Set<string>(),
				indicated: new Set<string>(),
			},
		})
		expect(start.find('h1').text()).toBe('Genesis')
	})
	it('emits an accessible footnote without selecting a verse', async () => {
		const w = mount(ScriptureChapter, {
			props: {
				chapter: book('gen').chapters[0]!,
				selected: new Set<string>(),
				indicated: new Set<string>(),
			},
		})
		const marker = w.find('button.note-marker')
		expect(marker.attributes('aria-label')).toContain('Footnote')
		await marker.trigger('click')
		expect(w.emitted('note')).toHaveLength(1)
	})
	it('exposes discrete settings and attribution', async () => {
		vi.stubGlobal('__APP_VERSION__', '0.1.0')
		vi.stubGlobal('__BUILD_SHA__', 'test')
		const w = mount(ReaderSettings, {
			props: {
				modelValue: defaults,
				translation: metadata,
			},
		})
		const b = w.findAll('button').find((b) => b.text() === 'Dark')!
		await b.trigger('click')
		expect(w.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({
			theme: 'dark',
		})
		expect(w.findAll('button[aria-label^="Text size"]')).toHaveLength(6)
		expect(w.text()).toContain('BSB Publishing')
		expect(w.text()).toContain('v0.1.0 · test')
	})
})
