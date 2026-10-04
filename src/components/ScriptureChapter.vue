<script setup lang="ts">
import { computed } from 'vue'
import InlineNodes from './InlineNodes.vue'
import { nameOf } from '../lib/bible'
import type { Chapter, Fragment, Inline } from '../lib/types'
const props = defineProps<{
	chapter: Chapter
	selected: Set<string>
	indicated: Set<string>
}>()
// Some source headings carry the marker for the Scripture that follows them.
// Render that number at the first reading fragment without changing source data.
const verseNumbers = computed(() => {
	const pending = new Map<string, number>()
	const numbers = new Map<Fragment, number>()
	for (const block of props.chapter.blocks) {
		for (const fragment of block.fragments) {
			if (fragment.number) pending.set(fragment.id, fragment.number)
			if (block.kind === 'heading') continue
			const number = pending.get(fragment.id)
			if (number) {
				numbers.set(fragment, number)
				pending.delete(fragment.id)
			}
		}
	}
	return numbers
})
const emit = defineEmits<{
	note: [node: Extract<Inline, { kind: 'note' }>, element: HTMLElement]
}>()
</script>
<template>
	<article
		:id="`chapter-${chapter.book}-${chapter.number}`"
		class="chapter"
		:data-book="chapter.book"
		:data-chapter="chapter.number"
		:aria-label="`${nameOf(chapter.book)} ${chapter.number}`"
	>
		<h1 v-if="chapter.number === 1" class="book-heading">
			{{ nameOf(chapter.book) }}
		</h1>
		<h2 class="chapter-number" :aria-label="`Chapter ${chapter.number}`">
			{{ chapter.number }}
		</h2>
		<component
			:is="block.kind === 'heading' ? 'h3' : 'p'"
			v-for="(block, i) in chapter.blocks"
			:key="i"
			:class="['scripture-block', block.kind, `indent-${block.indent}`]"
		>
			<template v-for="(fragment, j) in block.fragments" :key="j">
				<span
					v-if="fragment.id && block.kind !== 'heading'"
					:data-verse="fragment.id"
					class="verse"
					:class="{
						selected: selected.has(fragment.id),
						indicated: indicated.has(fragment.id),
					}"
					><sup
						v-if="verseNumbers.has(fragment)"
						class="verse-number"
						:aria-label="`Verse ${verseNumbers.get(fragment)}`"
						>{{ verseNumbers.get(fragment) }}</sup
					><InlineNodes
						:nodes="fragment.nodes"
						@note="(n, e) => emit('note', n, e)"
				/></span>
				<InlineNodes
					v-else
					:nodes="fragment.nodes"
					@note="(n, e) => emit('note', n, e)"
				/>
			</template>
		</component>
	</article>
</template>
