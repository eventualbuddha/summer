import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: './e2e/start-test-server.sh',
		port: 3000,
		reuseExistingServer: !process.env.CI,
		timeout: 30000
	},

	testDir: 'e2e',

	use: {
		baseURL: 'http://localhost:3000'
	},

	// Use single worker since tests share a database
	workers: 1,

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
