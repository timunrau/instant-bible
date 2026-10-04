import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync('package.json', 'utf8'))
	.version as string
let commit = process.env.BUILD_SHA?.slice(0, 7) || 'dev'
try {
	if (commit === 'dev')
		commit = execSync('git rev-parse --short HEAD', {
			stdio: ['ignore', 'pipe', 'ignore'],
		})
			.toString()
			.trim()
} catch {
	/* Before initial commit. */
}
export default defineConfig({
	plugins: [
		vue(),
		VitePWA({
			registerType: 'prompt',
			injectRegister: null,
			manifest: {
				name: 'Bible',
				short_name: 'Bible',
				description: 'A fast, offline-first Bible reader.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#FFFFFF',
				theme_color: '#FFFFFF',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: [
					'**/*.{js,css,html,woff2,json,png,svg,ico,txt,webmanifest}',
				],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				navigateFallback: '/index.html',
				cleanupOutdatedCaches: true,
				skipWaiting: false,
				clientsClaim: false,
			},
		}),
	],
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__BUILD_SHA__: JSON.stringify(commit),
	},
	build: { target: 'es2022' },
})
