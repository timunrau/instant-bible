import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateApp } from '../../src/lib/update'

class Worker extends EventTarget {
	state: ServiceWorkerState = 'installing'
	postMessage = vi.fn(() => this.change('activated'))
	change(state: ServiceWorkerState) {
		this.state = state
		this.dispatchEvent(new Event('statechange'))
	}
}

describe('explicit app updates', () => {
	const beforeReload = vi.fn()
	const status = vi.fn()
	const reload = vi.fn()
	const registration = {
		update: vi.fn(async () => {}),
		installing: null as Worker | null,
		waiting: null as Worker | null,
	}
	const register = vi.fn(async () => registration)
	beforeEach(() => {
		vi.clearAllMocks()
		registration.installing = null
		registration.waiting = null
		registration.update.mockResolvedValue(undefined)
		vi.stubGlobal('navigator', { onLine: true, serviceWorker: { register } })
		vi.stubGlobal('window', { location: { reload } })
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})
	it('checks the worker without clearing storage or reloading an up-to-date reader', async () => {
		expect(await updateApp(beforeReload, status)).toBe('You’re up to date.')
		expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
		expect(registration.update).toHaveBeenCalledOnce()
		expect(reload).not.toHaveBeenCalled()
	})
	it('activates an already installed update and saves the anchor before reloading once', async () => {
		const worker = new Worker()
		worker.state = 'installed'
		registration.waiting = worker
		await updateApp(beforeReload, status)
		expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
		expect(beforeReload).toHaveBeenCalledOnce()
		expect(reload).toHaveBeenCalledOnce()
		expect(beforeReload.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]!)
	})
	it('waits for every asset to install before asking for activation', async () => {
		const worker = new Worker()
		registration.installing = worker
		status.mockImplementation((message: string) => {
			if (message === 'Updating…') queueMicrotask(() => worker.change('installed'))
		})
		await updateApp(beforeReload, status)
		expect(worker.postMessage).toHaveBeenCalledOnce()
		expect(reload).toHaveBeenCalledOnce()
		status.mockReset()
	})
	it('rejects offline checks without touching the service worker', async () => {
		vi.stubGlobal('navigator', { onLine: false, serviceWorker: { register } })
		await expect(updateApp(beforeReload, status)).rejects.toThrow('offline')
		expect(register).not.toHaveBeenCalled()
		expect(reload).not.toHaveBeenCalled()
	})
	it('keeps the reader intact after a failed network check', async () => {
		registration.update.mockRejectedValue(new TypeError('Network failure'))
		await expect(updateApp(beforeReload, status)).rejects.toThrow('Network failure')
		expect(beforeReload).not.toHaveBeenCalled()
		expect(reload).not.toHaveBeenCalled()
	})
	it('never activates an incomplete or failed installation', async () => {
		const worker = new Worker()
		worker.state = 'redundant'
		registration.installing = worker
		await expect(updateApp(beforeReload, status)).rejects.toThrow('Couldn’t install')
		expect(worker.postMessage).not.toHaveBeenCalled()
		expect(reload).not.toHaveBeenCalled()
	})
	it('times out an installation and removes listeners so late completion cannot reload', async () => {
		vi.useFakeTimers()
		const worker = new Worker()
		registration.installing = worker
		const attempt = expect(updateApp(beforeReload, status)).rejects.toThrow('timed out')
		await vi.advanceTimersByTimeAsync(60_000)
		await attempt
		worker.change('installed')
		expect(worker.postMessage).not.toHaveBeenCalled()
		expect(reload).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})
})
