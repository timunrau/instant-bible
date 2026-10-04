import { appUrl } from './base'

const timeout = 60_000
const loadedController = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null

async function bounded<T>(promise: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('Update timed out. Try again.')), timeout)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
}

function waitFor(worker: ServiceWorker, states: ServiceWorkerState[]) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => finish(new Error('Update timed out. Try again.')), timeout)
		function finish(error?: Error) {
			clearTimeout(timer)
			worker.removeEventListener('statechange', check)
			if (error) reject(error)
			else resolve()
		}
		function check() {
			if (states.includes(worker.state)) finish()
			else if (worker.state === 'redundant') finish(new Error('Couldn’t install the update. Try again.'))
		}
		worker.addEventListener('statechange', check)
		check()
	})
}

// Only called from the version button. Background installation never reloads a reader.
export async function updateApp(beforeReload: () => void, status: (message: string) => void) {
	if (!navigator.onLine) throw new Error('You’re offline. Connect to update.')
	if (!('serviceWorker' in navigator)) throw new Error('Updates aren’t available in this browser.')
	status('Checking for updates…')
	const registration = await bounded(navigator.serviceWorker.register(appUrl('sw.js'), {
		updateViaCache: 'none',
	}))
	await bounded(registration.update())
	const worker = registration.installing ?? registration.waiting
	if (!worker) {
		// Another open reader may already have activated the update. This page
		// still runs its old JS even though its worker controller has changed.
		if (loadedController && registration.active && registration.active !== loadedController) {
			beforeReload()
			window.location.reload()
			return 'Updating…'
		}
		return 'You’re up to date.'
	}
	status('Updating…')
	await waitFor(worker, ['installed', 'activated'])
	if (worker.state !== 'activated') {
		worker.postMessage({ type: 'SKIP_WAITING' })
		await waitFor(worker, ['activated'])
	}
	beforeReload()
	window.location.reload()
	return 'Updating…'
}
