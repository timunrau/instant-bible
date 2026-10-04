<script setup lang="ts">
import { ref } from 'vue'
import { updateApp } from '../lib/update'
import type { Settings } from '../lib/persistence'
import type { Translation } from '../lib/types'
const props = defineProps<{
	modelValue: Settings
	translation: Translation
}>()
const emit = defineEmits<{
	'update:modelValue': [value: Settings]
	'beforeReload': []
}>()
const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
	emit('update:modelValue', { ...props.modelValue, [key]: value })
const build = `${__APP_VERSION__} · ${__BUILD_SHA__}`
const updating = ref(false)
const updateStatus = ref('')
async function updateVersion() {
	if (updating.value) return
	updating.value = true
	try {
		updateStatus.value = await updateApp(
			() => emit('beforeReload'),
			(message) => { updateStatus.value = message },
		)
	} catch (error) {
		updateStatus.value = error instanceof Error && !(error instanceof TypeError)
			? error.message
			: 'Couldn’t check for updates. Try again.'
	} finally {
		updating.value = false
	}
}
</script>
<template>
	<div class="settings-content">
		<h2>Reading</h2>
		<fieldset>
			<legend>Typeface</legend>
			<div class="choices">
				<button
					v-for="font in ['serif', 'sans'] as const"
					:key="font"
					:aria-pressed="modelValue.font === font"
					@click="update('font', font)"
				>
					{{ font === 'serif' ? 'Serif' : 'Sans' }}
				</button>
			</div>
		</fieldset>
		<fieldset>
			<legend>Text size</legend>
			<div class="choices sizes">
				<button
					v-for="size in [17, 18, 20, 22, 24, 27]"
					:key="size"
					:aria-label="`Text size ${size}`"
					:aria-pressed="modelValue.size === size"
					:style="{ fontSize: size + 'px' }"
					@click="update('size', size)"
				>
					A
				</button>
			</div>
		</fieldset>
		<fieldset>
			<legend>Line spacing</legend>
			<div class="choices">
				<button
					v-for="spacing in ['compact', 'normal', 'relaxed'] as const"
					:key="spacing"
					:aria-pressed="modelValue.spacing === spacing"
					@click="update('spacing', spacing)"
				>
					{{ spacing.charAt(0).toUpperCase() + spacing.slice(1) }}
				</button>
			</div>
		</fieldset>
		<fieldset>
			<legend>Theme</legend>
			<div class="choices">
				<button
					v-for="theme in ['auto', 'light', 'dark'] as const"
					:key="theme"
					:aria-pressed="modelValue.theme === theme"
					@click="update('theme', theme)"
				>
					{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}
				</button>
			</div>
		</fieldset>
		<div class="attribution">
			<p>{{ translation.name }}</p>
			<a :href="translation.attributionUrl" target="_blank" rel="noreferrer">{{
				translation.attribution
			}}</a
			><span v-for="license in translation.licenses" :key="license.url">
				·
				<a :href="license.url" target="_blank" rel="noreferrer">{{
					license.name
				}}</a></span
			>
			<p class="source-credit">
				Scripture via
				<a href="https://fetch.bible" target="_blank" rel="noreferrer"
					>fetch(bible)</a
				>
			</p>
		</div>
		<button
			class="build-info"
			aria-label="Update app"
			:disabled="updating"
			@click="updateVersion"
		>
			v{{ build }}
		</button>
		<p v-if="updateStatus" class="update-status" role="status">{{ updateStatus }}</p>
	</div>
</template>
