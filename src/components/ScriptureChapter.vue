<script setup lang="ts">
import InlineNodes from './InlineNodes.vue'
import { nameOf } from '../lib/bible'
import type { Chapter, Inline } from '../lib/types'
defineProps<{
	chapter: Chapter
	selected: Set<string>
	indicated: Set<string>
}>()
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
					v-if="fragment.id"
					:data-verse="fragment.id"
					class="verse"
					:class="{
						selected: selected.has(fragment.id),
						indicated: indicated.has(fragment.id),
					}"
					><sup
						v-if="fragment.number"
						class="verse-number"
						:aria-label="`Verse ${fragment.number}`"
						>{{ fragment.number }}</sup
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
