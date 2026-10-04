import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/><path d="M152 116h222v276H152a34 34 0 0 1-34-34V150a34 34 0 0 1 34-34Z" fill="black"/><path d="M152 352h222v18H152a14 14 0 0 0 0 28h222v18H152a32 32 0 0 1 0-64Z" fill="white"/><path d="M240 176h24v36h40v24h-40v76h-24v-76h-40v-24h40Z" fill="white"/></svg>`
await writeFile('public/icon.svg', svg + '\n')
// Leave generous room inside the maskable safe circle (radius 40% of the canvas).
// Scale only the artwork; the white background must still reach every edge.
const maskableSvg = svg.replace('<path', '<g transform="translate(76.8 76.8) scale(0.7)"><path').replace('</svg>', '</g></svg>')
for (const [file, size] of [
	['icon-192.png', 192],
	['icon-512.png', 512],
	['icon-maskable-512.png', 512],
	['apple-touch-icon.png', 180],
])
	await sharp(Buffer.from(file === 'icon-maskable-512.png' ? maskableSvg : svg))
		.resize(size, size)
		.png()
		.toFile('public/' + file)
const png = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header[6] = 32
header[7] = 32
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
await writeFile('public/favicon.ico', Buffer.concat([header, png]))
