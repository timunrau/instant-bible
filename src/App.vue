<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ScriptureChapter from './components/ScriptureChapter.vue'
import InlineNodes from './components/InlineNodes.vue'
import ReaderSettings from './components/ReaderSettings.vue'
import TranslationPicker from './components/TranslationPicker.vue'
import { useReader } from './composables/useReader'
import { useGestures } from './composables/useGestures'
import { repository } from './lib/bible'
import {
	chapterLabel,
	ordered,
	parseReference,
	passageLabel,
} from './lib/references'
import { passageUrl } from './lib/urls'
import { copyText } from './lib/clipboard'
import { writeClipboard } from './lib/writeClipboard'
import {
	applyTheme,
	readSettings,
	writeJson,
	type Settings,
} from './lib/persistence'
import type { Anchor, Chapter, Inline, Passage, Translation } from './lib/types'

const props = defineProps<{
	initial: Chapter
	anchor: Anchor
	pendingVersion?: string
	initialPassage?: Passage
}>()
const reader = useReader(
	props.initial,
	props.anchor,
	props.pendingVersion,
	props.initialPassage,
)
const {
	chapters,
	current,
	version,
	selected,
	indicated,
	status,
	retry,
	downloading,
} = reader
const gestures = useGestures(
	reader.toggle,
	reader.step,
	() => selected.value.size > 0,
)
const settings = ref(readSettings())
const referenceOpen = ref(false),
	settingsOpen = ref(false),
	translationsOpen = ref(false)
const picker = ref<HTMLElement>(),
	input = ref<HTMLInputElement>(),
	settingsPanel = ref<HTMLElement>()
const typed = ref(''),
	error = ref('')
const installed = ref<string[]>(['BSB'])
const metadata = ref<Translation>()
const copied = ref(false),
	shared = ref(false),
	copyError = ref('')
const note = ref<{
	node: Extract<Inline, { kind: 'note' }>
	left: number
	bottom: number
	trigger: HTMLElement
}>()
const dialog = computed(
	() => referenceOpen.value || settingsOpen.value || !!note.value,
)
const interpretation = computed(() => parseReference(typed.value))
const readingStyle = computed(() => ({
	'--text-size': settings.value.size / 16 + 'rem',
	'--line-height': { compact: 1.5, normal: 1.7, relaxed: 1.85 }[
		settings.value.spacing
	],
	'--reading-font':
		settings.value.font === 'sans'
			? 'system-ui, sans-serif'
			: '"Source Serif 4", Georgia, serif',
}))
let confirmationTimer: ReturnType<typeof setTimeout>
let focusReturn: HTMLElement | null = null

function openReference(event?: Event) {
	focusReturn =
		(event?.currentTarget as HTMLElement) ??
		document.getElementById('reference-control')
	typed.value = chapterLabel(current.value.book, current.value.chapter)
	error.value = ''
	referenceOpen.value = true
	// Already mounted. Reveal and focus in the original tap's synchronous call stack (iOS).
	picker.value!.hidden = false
	input.value!.value = typed.value
	input.value!.focus({ preventScroll: true })
	input.value!.select()
}
function close() {
	if (translationsOpen.value) {
		translationsOpen.value = false
		nextTick(() => input.value?.focus({ preventScroll: true }))
		return
	}
	note.value?.trigger.focus({ preventScroll: true })
	note.value = undefined
	referenceOpen.value = false
	settingsOpen.value = false
	focusReturn?.focus({ preventScroll: true })
}
async function openSettings(event: Event) {
	focusReturn = event.currentTarget as HTMLElement
	metadata.value = await repository.metadata(version.value)
	settingsOpen.value = true
	installed.value = await repository.installedVersions()
	await nextTick()
	settingsPanel.value
		?.querySelector<HTMLButtonElement>('button')
		?.focus({ preventScroll: true })
}
async function submit() {
	const passage = parseReference(typed.value)
	if (!passage) {
		error.value = 'Enter a valid Bible reference.'
		input.value?.focus()
		return
	}
	close()
	await reader.navigate(passage)
}
async function chooseVersion(target: string) {
	translationsOpen.value = false
	// Keep the draft exactly as typed. Switching doesn't submit or destroy it.
	await reader.switchVersion(target)
	installed.value = await repository.installedVersions()
	if (referenceOpen.value) input.value?.focus({ preventScroll: true })
}
function openNote(
	node: Extract<Inline, { kind: 'note' }>,
	element: HTMLElement,
) {
	focusReturn = element
	const rect = element.getBoundingClientRect()
	note.value = {
		node,
		trigger: element,
		left: Math.min(Math.max(16, rect.left - 120), window.innerWidth - 352),
		bottom: Math.max(90, window.innerHeight - rect.top + 12),
	}
	nextTick(() =>
		document
			.querySelector<HTMLButtonElement>('.note-popover button')
			?.focus({ preventScroll: true }),
	)
}
async function selectionText() {
	const refs = ordered(reader.selectionRefs())
	const groups = [
		...new Map(refs.map((r) => [`${r.book}.${r.chapter}`, r])).values(),
	]
	const data = await Promise.all(
		groups.map((r) => repository.chapter(version.value, r.book, r.chapter)),
	)
	return { text: copyText(refs, data, version.value), refs }
}
async function copy(share = false) {
	copyError.value = ''
	try {
		const { text, refs } = await selectionText()
		const url =
			location.origin + passageUrl({ ...refs[0]!, verses: refs }, version.value)
		if (share && navigator.share) {
			try {
				await navigator.share({ text, url })
				return
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') return
			}
		}
		await writeClipboard(share ? `${text}\n\n${url}` : text)
		if (share) shared.value = true
		else copied.value = true
		clearTimeout(confirmationTimer)
		confirmationTimer = setTimeout(() => {
			copied.value = false
			shared.value = false
		}, 1800)
	} catch {
		copyError.value = 'Copy unavailable. Try again.'
	}
}
async function removeVersion(v: string) {
	await repository.remove(v)
	installed.value = await repository.installedVersions()
}
function keydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && dialog.value) {
		event.preventDefault()
		close()
	}
	if (event.key === 'Tab' && dialog.value) {
		const panel = note.value
			? document.querySelector('.note-popover')
			: settingsOpen.value
				? settingsPanel.value
				: picker.value
		const controls = Array.from(
			panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a') ??
				[],
		).filter((e) => e.getClientRects().length)
		if (!controls.length) return
		const first = controls[0]!,
			last = controls.at(-1)!
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}
}
watch(
	settings,
	async (value: Settings) => {
		const anchor = reader.capture()
		writeJson('bible-settings', value)
		applyTheme(value.theme)
		await nextTick()
		reader.restore(anchor)
	},
	{ deep: true },
)
watch(selected, () => {
	copied.value = false
	shared.value = false
	copyError.value = ''
})
const systemTheme = () => applyTheme(settings.value.theme)
onMounted(() => {
	applyTheme(settings.value.theme)
	window.addEventListener('keydown', keydown)
	matchMedia('(prefers-color-scheme: dark)').addEventListener(
		'change',
		systemTheme,
	)
	void repository.installedVersions().then((v) => {
		installed.value = v
	})
})
onUnmounted(() => {
	window.removeEventListener('keydown', keydown)
	matchMedia('(prefers-color-scheme: dark)').removeEventListener(
		'change',
		systemTheme,
	)
	clearTimeout(confirmationTimer)
})
</script>
<template>
	<main
		id="reader"
		class="reader"
		:style="readingStyle"
		:inert="dialog || undefined"
		@pointerdown="gestures.down"
		@pointerup="gestures.up"
		@pointercancel="gestures.cancel"
	>
		<ScriptureChapter
			v-for="chapter in chapters"
			:key="`${version}:${chapter.book}:${chapter.number}`"
			:chapter="chapter"
			:selected="selected"
			:indicated="indicated"
			@note="openNote"
		/>
	</main>
	<footer v-if="!selected.size" class="bottom-bar" :inert="dialog || undefined">
		<button
			id="reference-control"
			class="reference-control"
			aria-label="Open reference picker"
			@click="openReference"
		>
			{{ chapterLabel(current.book, current.chapter) }}
		</button>
		<span v-if="status && !referenceOpen" class="download-status" role="status"
			>{{ status
			}}<button
				v-if="retry"
				aria-label="Retry translation download"
				@click="retry"
			>
				Retry
			</button></span
		>
		<button
			class="settings-control"
			aria-label="Reader settings"
			@click="openSettings"
		>
			Aa
		</button>
	</footer>
	<footer
		v-else
		class="bottom-bar selection-tray"
		:inert="dialog || undefined"
		aria-label="Verse selection"
	>
		<span class="selection-count" role="status">{{
			copyError || `${selected.size} selected`
		}}</span>
		<button @click="copy()">{{ copied ? 'Copied' : 'Copy' }}</button
		><button @click="copy(true)">{{ shared ? 'Copied' : 'Share' }}</button
		><button @click="selected = new Set()">Clear</button>
	</footer>
	<div v-if="dialog" class="backdrop" aria-hidden="true" @click="close"></div>
	<section
		ref="picker"
		class="panel reference-panel"
		:hidden="!referenceOpen"
		role="dialog"
		aria-modal="true"
		aria-label="Go to a passage"
	>
		<div class="panel-heading">
			<span>Go to a passage</span
			><button aria-label="Close reference picker" @click="close">✕</button>
		</div>
		<form @submit.prevent="submit">
			<button
				type="button"
				class="version-control"
				aria-label="Choose translation"
				:aria-expanded="translationsOpen"
				@click="translationsOpen = !translationsOpen"
			>
				{{ version }}
			</button>
			<input
				ref="input"
				v-model="typed"
				aria-label="Bible reference"
				:aria-invalid="!!error"
				:aria-describedby="error ? 'reference-error' : undefined"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				:spellcheck="false"
				enterkeyhint="go"
				placeholder="Romans 8:28"
				@input="error = ''"
			/>
			<button type="submit" class="go">Go</button>
		</form>
		<p v-if="error" id="reference-error" class="reference-error" role="alert">
			{{ error }}
		</p>
		<button
			v-else-if="interpretation"
			class="interpretation"
			type="button"
			@click="submit"
		>
			{{ passageLabel(interpretation) }} <span aria-hidden="true">↵</span>
		</button>
		<p v-else class="input-hint">Book, chapter, or verse</p>
		<span v-if="status" class="picker-status" role="status"
			>{{ status }} <button v-if="retry" @click="retry">Retry</button></span
		>
		<TranslationPicker
			v-if="translationsOpen"
			:installed="installed"
			:active="version"
			:disabled="downloading"
			@choose="chooseVersion"
		/>
	</section>
	<section
		v-if="settingsOpen && metadata"
		ref="settingsPanel"
		class="panel settings-panel"
		role="dialog"
		aria-modal="true"
		aria-label="Reader settings"
	>
		<button class="panel-close" aria-label="Close settings" @click="close">
			✕
		</button>
		<ReaderSettings
			v-model="settings"
			:installed="installed"
			:translation="metadata"
			:active="version"
			@remove="removeVersion"
		/>
	</section>
	<section
		v-if="note"
		class="panel note-popover"
		:style="{
			'--note-left': note.left + 'px',
			'--note-bottom': note.bottom + 'px',
		}"
		role="dialog"
		aria-modal="true"
		aria-label="Scripture footnote"
	>
		<button class="panel-close" aria-label="Close footnote" @click="close">
			✕
		</button>
		<p><InlineNodes :nodes="note.node.children" :notes="false" /></p>
	</section>
</template>
