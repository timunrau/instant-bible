import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './scripts',
	testMatch: 'screenshots.spec.ts',
	outputDir: './test-results/screenshots',
	fullyParallel: true,
	forbidOnly: true,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4174',
		colorScheme: 'light',
		locale: 'en-US',
		reducedMotion: 'reduce',
		serviceWorkers: 'block',
	},
	projects: [
		{
			name: 'mobile',
			use: {
				...devices['iPhone 13'],
				defaultBrowserType: 'chromium',
				deviceScaleFactor: 1,
			},
		},
	],
	webServer: {
		command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
		url: 'http://127.0.0.1:4174',
		reuseExistingServer: false,
	},
})
