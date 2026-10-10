import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { noteReferences } from '../../src/lib/noteReferences'
import { passageLabel } from '../../src/lib/references'
import InlineNodes from '../../src/components/InlineNodes.vue'

const citations: [string, string[]][] = [
	['Matthew 17:5; see also Mark 9:7 and Luke 9:35.', ['Matthew 17:5', 'Mark 9:7', 'Luke 9:35']],
	['See Jude 1:18.', ['Jude 1:18']],
	['See Psalm 90:4.', ['Psalm 90:4']],
	['Cited in 1 Corinthians 6:16 and Ephesians 5:31', ['1 Corinthians 6:16', 'Ephesians 5:31']],
	['Cited in Mark 10:7–8.', ['Mark 10:7–8']],
	['Matthew 19:5, Mark 10:7–8, 1 Corinthians 6:16, and Ephesians 5:31', ['Matthew 19:5', 'Mark 10:7–8', '1 Corinthians 6:16', 'Ephesians 5:31']],
	['See John 3:36–4:2.', ['John 3:36; 4:1–2']],
	['See Matthew 1:1, 3–5.', ['Matthew 1:1, 3–5']],
	['Psalms 23 and Song of Songs 2:1', ['Psalm 23', 'Song of Solomon 2:1']],
	['See Matthew 5–7.', ['Matthew 5:1–48; 6:1–34; 7:1–29']],
	['1:17 Matthew 17:5', ['Matthew 17:5']],
	['1 Enoch 13:1–11 and 1 Enoch 20:1–4', []],
	['John 99:1; Matthew 17:99; John 3:16–99; John 3:16:18; 4 John 3:1', []],
	['Or to His own; also in verses 7, 8, and 20.', []],
]

describe('source footnote citations', () => {
	it.each(citations)('links only validated canonical references in %s', (text, labels) => {
		const parts = noteReferences(text)
		expect(parts.map((part) => part.text).join('')).toBe(text)
		expect(parts.flatMap((part) => part.passage ? [passageLabel(part.passage)] : [])).toEqual(labels)
	})
	it('preserves note emphasis and emits navigation with a versioned native link', async () => {
		const wrapper = mount(InlineNodes, {
			props: {
				nodes: [{ kind: 'em', children: [{ kind: 'text', text: 'See Mark 10:7–8.' }] }],
				notes: false,
				linkReferences: true,
			},
		})
		const link = wrapper.get('em a')
		expect(link.text()).toBe('Mark 10:7–8')
		expect(link.attributes('href')).toBe('/Mark/10/7-8?version=BSB')
		await link.trigger('click', { button: 0 })
		expect(wrapper.emitted('navigate')?.[0]?.[0]).toMatchObject({ book: 'mrk', chapter: 10, verse: 7 })
		const modified = new MouseEvent('click', { button: 0, ctrlKey: true, cancelable: true })
		link.element.dispatchEvent(modified)
		expect(modified.defaultPrevented).toBe(false)
		modified.preventDefault()
		expect(wrapper.emitted('navigate')).toHaveLength(1)
	})
	it('renders ordinary Scripture text without creating citation links', () => {
		const wrapper = mount(InlineNodes, {
			props: { nodes: [{ kind: 'text', text: 'Matthew 17:5' }] },
		})
		expect(wrapper.find('a').exists()).toBe(false)
		expect(wrapper.text()).toBe('Matthew 17:5')
	})
})
