<script setup lang="ts">
import type { Inline } from '../lib/types'
withDefaults(defineProps<{ nodes: Inline[]; notes?: boolean }>(), {
	notes: true,
})
const emit = defineEmits<{
	note: [node: Extract<Inline, { kind: 'note' }>, element: HTMLElement]
}>()
</script>
<template>
	<template v-for="(node, i) in nodes" :key="i">
		<template v-if="node.kind === 'text'">{{ node.text }}</template>
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
				@note="(n, e) => emit('note', n, e)"
		/>
		</component>
	</template>
</template>
