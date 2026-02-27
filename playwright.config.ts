import { defineConfig, devices } from '@playwright/test';
import z from 'zod';

const SURREALDB_PORT =
	z.number().min(1000).int().safeParse(Number(process.env.SURREALDB_PORT)).data ?? 18000;
const E2E_APP_PORT =
	z.number().min(1000).int().safeParse(Number(process.env.E2E_APP_PORT)).data ?? 3100;
const SURREALDB_URL = `http://127.0.0.1:${SURREALDB_PORT}`;
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE ?? 'e2e';
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE ?? 'e2e';

process.env.SURREALDB_PORT = `${SURREALDB_PORT}`;
process.env.SURREALDB_URL = SURREALDB_URL;
process.env.SURREALDB_NAMESPACE = SURREALDB_NAMESPACE;
process.env.SURREALDB_DATABASE = SURREALDB_DATABASE;

export default defineConfig({
	globalSetup: './e2e/global-setup.ts',

	webServer: [
		{
			command: `npx vite dev --host 127.0.0.1 --port ${E2E_APP_PORT} --strictPort`,
			port: E2E_APP_PORT,
			reuseExistingServer: false,
			timeout: 5_000
		},
		{
			command: `surreal start memory --bind 127.0.0.1:${SURREALDB_PORT} --unauthenticated`,
			port: SURREALDB_PORT,
			reuseExistingServer: false,
			timeout: 5_000
		}
	],

	testDir: 'e2e',

	use: {
		baseURL: `http://127.0.0.1:${E2E_APP_PORT}`,
		video: 'retain-on-failure'
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
