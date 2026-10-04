import { defineConfig } from '@playwright/test'
import config from './playwright.config'

export default defineConfig({
	...config,
	testDir: './tests/pages',
	use: { ...config.use, baseURL: 'http://127.0.0.1:4174' },
	webServer: {
		command: 'node tests/pages/server.mjs',
		url: 'http://127.0.0.1:4174/instant-bible/',
		reuseExistingServer: false,
	},
})
