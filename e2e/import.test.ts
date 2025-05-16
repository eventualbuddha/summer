import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

test('import Amex statement', async ({ page, pageHelpers, createCategory, surreal }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const category = await createCategory({ name: 'Test Category' });
	await surreal.query('UPDATE settings:global SET defaultCategory = $defaultCategory', {
		defaultCategory: category.id
	});

	// Connect to the database
	await pageHelpers.connect(page);

	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.locator('button', { hasText: 'Import' }).click();
	const fileChooser = await fileChooserPromise;
	// Import the JSON because I can't share the real PDF
	fileChooser.setFiles('./tests/fixtures/amex/skymiles.json');

	// Wait for the import to finish
	await waitFor(async () => {
		const [statementCount] = await surreal.query<[number]>('(SELECT 1 FROM statement).len();');
		return statementCount === 1;
	});

	await expect(page.getByText('NETFLIX.COM')).toBeVisible();
	await expect(page.getByLabel('Transaction Count')).toHaveText('95');
	await expect(page.getByLabel('Transaction Sum')).toHaveText('+$10,060');
});

test('import Schwab statement', async ({ page, pageHelpers, createCategory, surreal }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const category = await createCategory({ name: 'Test Category' });
	await surreal.query('UPDATE settings:global SET defaultCategory = $defaultCategory', {
		defaultCategory: category.id
	});

	// Connect to the database
	await pageHelpers.connect(page);

	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await page.locator('button', { hasText: 'Import' }).click();
	const fileChooser = await fileChooserPromise;
	// Import the JSON because I can't share the real PDF
	fileChooser.setFiles('./tests/fixtures/schwab/checking.json');

	// Wait for the import to finish
	await waitFor(async () => {
		const [statementCount] = await surreal.query<[number]>('(SELECT 1 FROM statement).len();');
		return statementCount === 1;
	});

	await expect(page.getByText('Electronic Withdrawal HOGWARTS SCHOOL WWPAY')).toBeVisible();
	await expect(page.getByLabel('Transaction Count')).toHaveText('18');
	await expect(page.getByLabel('Transaction Sum')).toHaveText('$2,189');
});
