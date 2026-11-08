<script setup lang="ts">
import { computed } from 'vue'
import { parseReference } from '../lib/references'
import { passageUrl } from '../lib/urls'
import type { Passage } from '../lib/types'
const props = defineProps<{ target: string }>()
const passage = computed(() => parseReference(props.target)!)
const emit = defineEmits<{ navigate: [passage: Passage] }>()
function follow(event: MouseEvent) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
	event.preventDefault()
	event.stopPropagation()
	emit('navigate', passage.value)
}
</script>
<template>
	<a class="note-reference" :href="passageUrl(passage)" @click="follow"><slot /></a>
</template>
