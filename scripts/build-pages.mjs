import { spawnSync } from 'node:child_process'
import { copyFileSync, writeFileSync } from 'node:fs'

const result = spawnSync('npm', ['run', 'build'], {
	stdio: 'inherit',
	env: { ...process.env, BASE_PATH: process.env.BASE_PATH || '/instant-bible/' },
})
if (result.status !== 0) process.exit(result.status ?? 1)
// Pages serves this shell for missing passage paths, preserving the original URL.
copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
