// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync('.releaserc.json', 'utf8'))
const analyzer = '@semantic-release/commit-analyzer'
const { analyzeCommits } = await import(analyzer)
const notesGenerator = '@semantic-release/release-notes-generator'
const { generateNotes } = await import(notesGenerator)

describe('Conventional Commit release policy', () => {
	it.each([
		['fix: repair updates', 'patch'],
		['perf: reduce startup work', 'patch'],
		['feat: add manual updates', 'minor'],
		['feat!: change cache format', 'major'],
		['fix: change cache format\n\nBREAKING CHANGE: discard incompatible data', 'major'],
		['refactor: simplify reader', 'patch'],
		['build: change production assets', 'patch'],
		['chore(deps): update dependencies', 'patch'],
		['build!: drop a supported browser', 'major'],
		['refactor!: change the public contract', 'major'],
		['chore(deps)!: drop a supported browser', 'major'],
		['docs: explain updates', null],
		['test: cover updates', null],
		['ci: improve checks', null],
		['chore(release): 0.2.0 [skip ci]', null],
	])('%s → %s', async (message, release) => {
		expect(await analyzeCommits(config.plugins[0][1], {
			cwd: process.cwd(),
			commits: [{ hash: 'test', message }],
			logger: { log() {} },
		})).toBe(release)
	})
	it('renders release notes with the installed preset and writer', async () => {
		const notes = await generateNotes(config.plugins[1][1], {
			cwd: process.cwd(),
			options: { repositoryUrl: 'https://github.com/timunrau/instant-bible.git' },
			branch: { name: 'main' },
			lastRelease: { version: '0.1.0', gitTag: 'v0.1.0' },
			nextRelease: { version: '0.2.0', gitTag: 'v0.2.0' },
			commits: [{ hash: '1234567890', message: 'feat: add explicit app updates' }],
			logger: { log() {} },
		})
		expect(notes).toContain('0.2.0')
		expect(notes).toContain('add explicit app updates')
	})
})
