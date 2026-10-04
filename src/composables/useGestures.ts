import { ref } from 'vue'
// Leave long presses, browser selection, and vertical scrolling to the platform.
export function useGestures(
	toggle: (id: string) => void,
	step: (direction: number) => void,
	hasSelection: () => boolean,
) {
	const start = ref<{
		x: number
		y: number
		time: number
		id?: string
		pointer: string
	}>()
	function down(event: PointerEvent) {
		if (event.button !== 0 || (event.target as Element).closest('button'))
			return
		start.value = {
			x: event.clientX,
			y: event.clientY,
			time: performance.now(),
			pointer: event.pointerType,
			id: (event.target as HTMLElement).closest<HTMLElement>('[data-verse]')
				?.dataset.verse,
		}
	}
	function up(event: PointerEvent) {
		const s = start.value
		start.value = undefined
		if (
			!s ||
			(event.target as Element).closest('button') ||
			window.getSelection()?.toString()
		)
			return
		const dx = event.clientX - s.x,
			dy = event.clientY - s.y
		const duration = performance.now() - s.time
		if (
			Math.abs(dx) > 85 &&
			Math.abs(dx) > Math.abs(dy) * 2.5 &&
			duration < 700 &&
			s.pointer !== 'mouse' &&
			!hasSelection()
		)
			step(dx < 0 ? 1 : -1)
		else if (Math.abs(dx) < 9 && Math.abs(dy) < 9 && duration < 350 && s.id)
			toggle(s.id)
	}
	const cancel = () => {
		start.value = undefined
	}
	return { down, up, cancel }
}
