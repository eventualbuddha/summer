import { expect, test } from './utils/surrealdb-test';

test('view transactions', async ({ page, createTransaction, port }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await page.getByRole('textbox', { name: 'URL' }).fill(`ws://127.0.0.1:${port}`);
	await page.getByRole('textbox', { name: 'Namespace' }).fill('ns');
	await page.getByRole('textbox', { name: 'Database' }).fill('db');
	await page.getByRole('button').click();

	// Check for the transaction
	await expect(page.getByText('Jan 1 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();
});
