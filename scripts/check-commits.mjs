import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// Preserve the already-pushed README correction without relaxing rules for new commits.
const historicalExceptions = new Set(['715fda502cfaad16cddb14727f9f9fcf2e9fd73e'])
const commits = execFileSync('git', ['rev-list', '--reverse', '9b3e387..HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
for (const commit of commits) {
	if (historicalExceptions.has(commit)) continue
	const message = execFileSync('git', ['show', '-s', '--format=%B', commit], { encoding: 'utf8' })
	const result = spawnSync(process.execPath, [resolve('node_modules/@commitlint/cli/cli.js'), '--verbose'], {
		input: message,
		stdio: ['pipe', 'inherit', 'inherit'],
	})
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}
