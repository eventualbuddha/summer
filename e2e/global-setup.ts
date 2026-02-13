import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

	// Launch a browser and verify the app is fully connected
	const browser = await chromium.launch();
	const page = await browser.newPage();

	try {
		console.log('Waiting for application to be ready...');
		await page.goto(baseURL);

		// Wait for the app to finish connecting to the database
		// The page should either show content or show "Unable to connect"
		// Give it plenty of time for the first connection
		await page.waitForFunction(
			() => {
				const connectingText = document.body.textContent?.includes('Connecting to database');
				return !connectingText;
			},
			{ timeout: 60000 }
		);

		// Additional verification - make a second connection to ensure it's stable
		const page2 = await browser.newPage();
		await page2.goto(baseURL);
		await page2.waitForFunction(
			() => {
				const connectingText = document.body.textContent?.includes('Connecting to database');
				return !connectingText;
			},
			{ timeout: 30000 }
		);
		await page2.close();

		console.log('Application is ready!');
	} finally {
		await browser.close();
	}
}

export default globalSetup;
