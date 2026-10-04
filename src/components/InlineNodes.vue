<script setup lang="ts">
import type { Inline, Passage } from '../lib/types'
import NoteReferenceText from './NoteReferenceText.vue'
withDefaults(
	defineProps<{ nodes: Inline[]; notes?: boolean; referenceVersion?: string }>(),
	{ notes: true, referenceVersion: undefined },
)
const emit = defineEmits<{
	note: [node: Extract<Inline, { kind: 'note' }>, element: HTMLElement]
	navigate: [passage: Passage]
}>()
</script>
<template>
	<template v-for="(node, i) in nodes" :key="i">
		<template v-if="node.kind === 'text'">
			<NoteReferenceText
				v-if="referenceVersion"
				:text="node.text"
				:version="referenceVersion"
				@navigate="(passage) => emit('navigate', passage)"
			/>
			<template v-else>{{ node.text }}</template>
		</template>
		<button
			v-else-if="node.kind === 'note' && notes !== false"
			class="note-marker"
			:aria-label="'Footnote ' + node.marker"
			@click.stop="emit('note', node, $event.currentTarget as HTMLElement)"
		>
			{{ node.marker }}
		</button>
		<component
			:is="
				node.kind === 'em' ? 'em' : node.kind === 'strong' ? 'strong' : 'span'
			"
			v-else-if="node.kind !== 'note'"
			:class="{ smallcaps: node.kind === 'smallcaps' }"
		>
			<InlineNodes
				:nodes="node.children"
				:notes="notes"
				:reference-version="referenceVersion"
				@note="(n, e) => emit('note', n, e)"
				@navigate="(passage) => emit('navigate', passage)"
		/>
		</component>
	</template>
</template>
