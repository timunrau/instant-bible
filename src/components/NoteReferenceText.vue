<script setup lang="ts">
import { computed } from 'vue'
import { noteReferences } from '../lib/noteReferences'
import { passageUrl } from '../lib/urls'
import type { Passage } from '../lib/types'

const props = defineProps<{ text: string; version: string }>()
const parts = computed(() => noteReferences(props.text))
const emit = defineEmits<{ navigate: [passage: Passage] }>()
function follow(event: MouseEvent, passage: Passage) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
	event.preventDefault()
	emit('navigate', passage)
}
</script>
<template>
	<template v-for="(part, i) in parts" :key="i">
		<a
			v-if="part.passage"
			class="note-reference"
			:href="passageUrl(part.passage, version)"
			@click="follow($event, part.passage)"
		>{{ part.text }}</a>
		<template v-else>{{ part.text }}</template>
	</template>
</template>
