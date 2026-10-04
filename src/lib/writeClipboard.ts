export async function writeClipboard(text: string) {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text)
			return
		}
	} catch {
		/* Safari/private contexts may require the synchronous platform fallback. */
	}
	const input = document.createElement('textarea')
	input.value = text
	input.style.cssText = 'position:fixed;top:0;left:-9999px'
	document.body.append(input)
	input.select()
	const success = document.execCommand('copy')
	input.remove()
	if (!success) throw new Error('Copy is unavailable in this browser.')
}
