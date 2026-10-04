<script setup lang="ts">
import { catalog } from '../lib/bible'
import type { Settings } from '../lib/persistence'
import type { Translation } from '../lib/types'
const props = defineProps<{
	modelValue: Settings
	installed: string[]
	translation: Translation
	active: string
}>()
const emit = defineEmits<{
	'update:modelValue': [value: Settings]
	remove: [version: string]
}>()
const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
	emit('update:modelValue', { ...props.modelValue, [key]: value })
const build = `${__APP_VERSION__} · ${__BUILD_SHA__}`
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
		<div
			v-for="t in catalog.filter(
				(t) => installed.includes(t.abbreviation) && t.abbreviation !== 'BSB',
			)"
			:key="t.id"
			class="installed-row"
		>
			<span>{{ t.abbreviation }} · Installed</span
			><button
				:disabled="t.abbreviation === active"
				:aria-label="`Remove ${t.abbreviation}`"
				@click="emit('remove', t.abbreviation)"
			>
				Remove
			</button>
		</div>
		<p class="build-info">v{{ build }}</p>
	</div>
</template>
