import { afterEach, expect, it, vi } from 'vitest'
import { parseReference } from '../../src/lib/references'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.resetModules()
})

it.each([
	'John 3', 'John 3:16-18', '1 Corinthians 13:4', 'John21:25;Acts1:1-2',
])('round-trips %s under a deployment base without accepting another site path', async (reference) => {
	vi.stubEnv('BASE_URL', '/instant-bible/')
	vi.resetModules()
	const { passageUrl, parseUrl } = await import('../../src/lib/urls')
	const passage = parseReference(reference)!
	const path = passageUrl(passage)
	expect(path).toMatch(/^\/instant-bible\//)
	expect(parseUrl(new URL(path, 'https://bible.test'))).toEqual({ passage, version: 'BSB' })
	expect(parseUrl(new URL(path.replace('/instant-bible/', '/'), 'https://bible.test'))).toBeUndefined()
	expect(parseUrl(new URL(path.replace('/instant-bible/', '/instant-bible-other/'), 'https://bible.test'))).toBeUndefined()
})
