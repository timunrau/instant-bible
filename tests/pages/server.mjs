import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const root = resolve('dist')
const base = '/instant-bible/'
const types = {
	'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
	'.json': 'application/json', '.webmanifest': 'application/manifest+json',
	'.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
}
// Deliberately no SPA rewrite: missing paths get the Pages 404 document/status.
createServer(async (req, res) => {
	const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
	const file = resolve(root, path.slice(base.length) || 'index.html')
	try {
		if (!path.startsWith(base) || !file.startsWith(root + '/')) throw new Error('Not found')
		const data = await readFile(file)
		res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
		res.end(data)
	} catch {
		res.writeHead(404, { 'Content-Type': 'text/html' })
		res.end(await readFile(resolve(root, '404.html')))
	}
}).listen(4174, '127.0.0.1')
