import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : 4,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		serviceWorkers: 'allow',
	},
	expect: {
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.012,
			threshold: 0.05,
			animations: 'disabled',
			stylePath: './tests/e2e/visual.css',
		},
	},
	projects: [
		{
			name: 'desktop',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: 'mobile',
			use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
		},
	],
	webServer: {
		command: 'npm run preview -- --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
	},
})
