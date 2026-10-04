import { onMounted, onUnmounted, ref } from 'vue'

// Fixed elements use the layout viewport; the keyboard can shrink only the visible one.
export function useVisualViewport() {
	const style = ref<Record<string, string>>({})
	const viewport = window.visualViewport
	function update() {
		if (!viewport) return
		style.value = {
			'--viewport-bottom': `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
			'--viewport-height': `${viewport.height}px`,
		}
	}
	onMounted(() => {
		update()
		viewport?.addEventListener('resize', update)
		viewport?.addEventListener('scroll', update)
		window.addEventListener('resize', update)
	})
	onUnmounted(() => {
		viewport?.removeEventListener('resize', update)
		viewport?.removeEventListener('scroll', update)
		window.removeEventListener('resize', update)
	})
	return style
}
