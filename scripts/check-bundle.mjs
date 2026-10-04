import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
const files = (await readdir('dist/assets')).filter((f) => f.endsWith('.js'))
const sizes = await Promise.all(
	files.map(async (file) => ({
		file,
		size: gzipSync(await readFile('dist/assets/' + file)).length,
	})),
)
const total = sizes.reduce((sum, f) => sum + f.size, 0)
const budget = 75 * 1024
console.log(
	sizes
		.map((f) => `${f.file}: ${(f.size / 1024).toFixed(1)} KiB gzip`)
		.join('\n'),
)
console.log(
	`All application JS: ${(total / 1024).toFixed(1)} / ${budget / 1024} KiB gzip. Bible assets, fonts, and SW excluded.`,
)
if (total > budget)
	throw new Error(
		'Application JavaScript exceeded the documented 75 KiB gzip budget.',
	)
