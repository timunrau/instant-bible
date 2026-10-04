<script setup lang="ts">
import { computed } from 'vue'
import { catalog } from '../lib/bible'
const props = defineProps<{
	installed: string[]
	active: string
	disabled: boolean
}>()
defineEmits<{ choose: [version: string] }>()
const translations = computed(() =>
	[...catalog].sort(
		(a, b) =>
			Number(props.installed.includes(b.abbreviation)) -
			Number(props.installed.includes(a.abbreviation)),
	),
)
</script>
<template>
	<div class="translation-list" aria-label="Bible translations">
		<h2>Translation</h2>
		<button
			v-for="t in translations"
			:key="t.id"
			:disabled="disabled"
			:aria-label="`Use ${t.name}`"
			:aria-pressed="active === t.abbreviation"
			@click="$emit('choose', t.abbreviation)"
		>
			<span class="translation-abbr">{{ t.abbreviation }}</span
			><span
				>{{ t.name
				}}<small>{{
					installed.includes(t.abbreviation)
						? 'Installed'
						: 'Available offline after download'
				}}</small></span
			><span v-if="active === t.abbreviation" aria-hidden="true">✓</span>
		</button>
	</div>
</template>
