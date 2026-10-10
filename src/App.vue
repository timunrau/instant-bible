<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ScriptureChapter from './components/ScriptureChapter.vue'
import InlineNodes from './components/InlineNodes.vue'
import ReaderSettings from './components/ReaderSettings.vue'
import { useReader } from './composables/useReader'
import { useGestures } from './composables/useGestures'
import { useVisualViewport } from './composables/useVisualViewport'
import { repository } from './lib/bible'
import { chapterLabel, ordered, parseReference } from './lib/references'
import { bookCompletion } from './lib/bookCompletion'
import { passageUrl } from './lib/urls'
import { copyText } from './lib/clipboard'
import { writeClipboard } from './lib/writeClipboard'
import {
	applyTheme,
	readSettings,
	writeJson,
	type Settings,
} from './lib/persistence'
import type { Anchor, Chapter, Inline, Passage } from './lib/types'

const props = defineProps<{
	initial: Chapter
	anchor: Anchor
	initialPassage?: Passage
}>()
const reader = useReader(
	props.initial,
	props.anchor,
	props.initialPassage,
)
const {
	chapters,
	current,
	selected,
	status,
} = reader
const gestures = useGestures(
	reader.toggle,
	reader.step,
	() => selected.value.size > 0,
)
const settings = ref(readSettings())
const viewportStyle = useVisualViewport()
const referenceOpen = ref(false),
	settingsOpen = ref(false)
const picker = ref<HTMLElement>(),
	referenceForm = ref<HTMLFormElement>(),
	input = ref<HTMLInputElement>(),
	settingsPanel = ref<HTMLElement>()
const typed = ref(''),
	error = ref('')
const completionReady = ref(false), composing = ref(false)
const suppressReferenceRing = ref(false)
const completion = computed(() =>
	referenceOpen.value && completionReady.value && !composing.value
		? bookCompletion(typed.value) : undefined,
)
const confirmation = ref(''),
	copyError = ref('')
const copyShortcut = /Mac/.test(navigator.platform) ? '⌘C' : 'Ctrl+C'
const note = ref<{
	node: Extract<Inline, { kind: 'note' }>
	left: number
	bottom: number
	trigger: HTMLElement
}>()
const dialog = computed(
	() => referenceOpen.value || settingsOpen.value || !!note.value,
)
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
	completionReady.value = false
	composing.value = false
	referenceOpen.value = true
	// Already mounted. Reveal and focus in the original tap's synchronous call stack (iOS).
	picker.value!.hidden = false
	referenceForm.value!.hidden = false
	for (const control of picker.value!.querySelectorAll<HTMLElement>('[data-idle-control]')) control.hidden = true
	input.value!.value = typed.value
	input.value!.focus({ preventScroll: true })
	input.value!.select()
}
function updateCompletion() {
	const field = input.value!
	completionReady.value = document.activeElement === field &&
		field.selectionStart === field.value.length &&
		field.selectionEnd === field.value.length && field.scrollLeft === 0
}
function acceptCompletion() {
	if (!completion.value) return
	typed.value = completion.value.name + ' '
	error.value = ''
	// Keep mobile keyboard focus in the tap handler, before Vue renders.
	input.value!.value = typed.value
	input.value!.focus({ preventScroll: true })
	input.value!.setSelectionRange(typed.value.length, typed.value.length)
	updateCompletion()
}
function referenceKeydown(event: KeyboardEvent) {
	if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey &&
		!event.metaKey && !event.altKey && !event.isComposing && completion.value) {
		event.preventDefault()
		acceptCompletion()
	}
}
function close() {
	if (referenceOpen.value) {
		referenceForm.value!.hidden = true
		for (const control of picker.value!.querySelectorAll<HTMLElement>('[data-idle-control]')) control.hidden = false
		picker.value!.hidden = selected.value.size > 0
	}
	note.value?.trigger.focus({ preventScroll: true })
	note.value = undefined
	referenceOpen.value = false
	settingsOpen.value = false
	focusReturn?.focus({ preventScroll: true })
}
async function openSettings(event: Event) {
	focusReturn = event.currentTarget as HTMLElement
	settingsOpen.value = true
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
	suppressReferenceRing.value = true
	close()
	await reader.navigate(passage)
}
async function followNoteReference(passage: Passage) {
	close()
	await reader.navigate(passage)
	suppressReferenceRing.value = true
	document.getElementById('reference-control')?.focus({ preventScroll: true })
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
		groups.map((r) => repository.chapter(r.book, r.chapter)),
	)
	return { text: copyText(refs, data), refs }
}
async function copy(share = false) {
	copyError.value = ''
	const returnFocus = document.activeElement?.closest('.selection-tray')
	try {
		const { text, refs } = await selectionText()
		const url =
			location.origin + passageUrl({ ...refs[0]!, verses: refs })
		const payload = share ? `${text}\n${url}` : text
		let didShare = false
		if (share && navigator.share) {
			try {
				await navigator.share({ text: payload })
				didShare = true
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') return
			}
		}
		if (!didShare) await writeClipboard(payload)
		selected.value = new Set()
		confirmation.value = didShare ? 'Shared' : 'Copied'
		if (returnFocus) {
			await nextTick()
			document.getElementById('reference-control')?.focus({ preventScroll: true })
		}
		clearTimeout(confirmationTimer)
		confirmationTimer = setTimeout(() => {
			confirmation.value = ''
		}, 1800)
	} catch {
		copyError.value = 'Copy unavailable. Try again.'
	}
}
function keydown(event: KeyboardEvent) {
	if (event.defaultPrevented || event.isComposing) return
	if (event.key === 'Tab') suppressReferenceRing.value = false
	if (event.key === 'Escape' && dialog.value) {
		event.preventDefault()
		close()
		return
	}
	if (event.key === 'Escape' && selected.value.size) {
		event.preventDefault()
		selected.value = new Set()
		return
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
		if (settingsOpen.value) {
			const toggle = document.getElementById('settings-control')
			if (toggle) controls.unshift(toggle)
		}
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
	const target = event.target
	if (
		dialog.value || event.altKey || event.shiftKey ||
		(target instanceof HTMLElement && (
			target.isContentEditable || target.closest('input,textarea,select')
		)) || window.getSelection()?.toString()
	) return
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selected.value.size) {
		event.preventDefault()
		void copy()
		return
	}
	if (event.ctrlKey || event.metaKey) return
	if (event.key === '/') {
		event.preventDefault()
		openReference()
	} else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
		event.preventDefault()
		reader.step(event.key === 'ArrowRight' ? 1 : -1)
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
			:key="`${chapter.book}:${chapter.number}`"
			:chapter="chapter"
			:selected="selected"
			@note="openNote"
		/>
	</main>
	<footer
		ref="picker"
		class="bottom-bar reader-bar"
		:class="{ 'reference-open': referenceOpen, 'settings-open': settingsOpen }"
		:style="viewportStyle"
		:hidden="!!selected.size && !referenceOpen"
		:inert="!!note || undefined"
		:role="referenceOpen ? 'dialog' : undefined"
		:aria-modal="referenceOpen ? true : undefined"
		:aria-label="referenceOpen ? 'Go to a passage' : undefined"
	>
		<button
			v-if="!selected.size"
			id="reference-control"
			class="reference-control glass-control"
			:class="{ 'suppress-focus-ring': suppressReferenceRing }"
			data-idle-control
			:hidden="referenceOpen"
			aria-label="Open reference picker"
			:inert="settingsOpen || undefined"
			@click="openReference"
			@blur="suppressReferenceRing = false"
		>
			<span>{{ chapterLabel(current.book, current.chapter) }}</span>
		</button>
		<form ref="referenceForm" class="reference-editor glass-control" :hidden="!referenceOpen" @submit.prevent="submit">
			<div class="reference-field">
				<input
					ref="input"
					v-model="typed"
					aria-label="Bible reference"
					:aria-invalid="!!error"
					:aria-describedby="error ? 'reference-error' : undefined"
					:aria-description="completion ? `Tab to complete ${completion.name}` : undefined"
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					:spellcheck="false"
					enterkeyhint="go"
					@input="error = ''; updateCompletion()"
					@select="updateCompletion"
					@keyup="updateCompletion"
					@click="updateCompletion"
					@focus="updateCompletion"
					@blur="completionReady = false"
					@scroll="updateCompletion"
					@compositionstart="composing = true"
					@compositionend="composing = false; updateCompletion()"
					@keydown="referenceKeydown"
				/>
				<div v-if="completion" class="reference-completion">
					<span aria-hidden="true">{{ typed }}</span><button
						type="button"
						tabindex="-1"
						:aria-label="`Complete ${completion.name}`"
						@pointerdown.prevent
						@click="acceptCompletion"
					>
						{{ completion.suffix }}
					</button>
				</div>
			</div>
			<button type="submit" class="go" aria-label="Go">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
			</button>
		</form>
		<button v-if="referenceOpen" class="reference-close glass-control" aria-label="Close reference picker" @click="close">✕</button>
		<span v-if="status && !referenceOpen" class="reader-status" role="status">{{ status }}</span>
		<button
			v-if="!selected.size"
			id="settings-control"
			class="settings-control glass-control"
			data-idle-control
			:hidden="referenceOpen"
			aria-label="Reader settings"
			:aria-expanded="settingsOpen"
			aria-controls="settings-panel"
			@click="settingsOpen ? close() : openSettings($event)"
		>
			Aa
		</button>
		<p v-if="referenceOpen && error" id="reference-error" class="reference-error" role="alert">{{ error }}</p>
	</footer>
	<footer
		v-if="selected.size"
		class="bottom-bar selection-tray"
		:inert="dialog || undefined"
		aria-label="Verse selection"
	>
		<span class="selection-count" role="status">{{
			copyError || `${selected.size} selected`
		}}</span>
		<button aria-keyshortcuts="Control+C Meta+C" @click="copy()">Copy</button>
		<kbd class="copy-shortcut">{{ copyShortcut }}</kbd>
		<button @click="copy(true)">Share</button
		><button @click="selected = new Set()">Clear</button>
	</footer>
	<div v-if="confirmation" class="copy-confirmation" role="status">{{ confirmation }}</div>
	<div v-if="dialog" class="backdrop" :class="{ 'reference-backdrop': referenceOpen }" aria-hidden="true" @click="close"></div>
	<section
		v-if="settingsOpen"
		id="settings-panel"
		ref="settingsPanel"
		class="panel settings-panel"
		role="dialog"
		aria-modal="true"
		aria-label="Reader settings"
		aria-owns="settings-control"
	>
		<button class="panel-close" aria-label="Close settings" @click="close">
			✕
		</button>
		<ReaderSettings
			v-model="settings"
			@before-reload="reader.save(false)"
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
		<p>
			<InlineNodes
				:nodes="note.node.children"
				:notes="false"
				link-references
				@navigate="followNoteReference"
			/>
		</p>
	</section>
</template>
