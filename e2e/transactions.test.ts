import { RecordId } from 'surrealdb';
import { expect, test } from './utils/surrealdb-test';

test('view transactions', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Check for the transaction
	await expect(page.getByText('Jan 1 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();
});

test('clear category', async ({
	page,
	pageHelpers,
	createCategory,
	createTransaction,
	surreal
}) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const category = await createCategory();
	const transaction = await createTransaction({
		category: category.id,
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Check for the transaction
	await expect(page.getByText('Jan 1 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();

	// Remove the category from the transaction
	await page.getByRole('button', { name: category.emoji }).click();
	await page.getByRole('button', { name: 'None' }).click();

	const [refreshedTransaction] = await surreal.query<[{ category: RecordId }]>(
		'select category from transaction where id = $id',
		{ id: transaction.id }
	);
	expect(refreshedTransaction.category).toBeUndefined();

	// Updates the sums before reloading.
	await expect(page.getByText('$').first()).toHaveText('$0');

	await page.reload();

	// Connect to the database
	await page.getByRole('button', { name: 'Last Connection' }).click();

	// The transaction should no longer appear
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	await expect(page.getByText('Jan 1 2025')).not.toBeVisible();
	await expect(page.getByText('$').first()).toHaveText('$0');
	for (const locator of await page.getByText('$').all()) {
		await expect(locator).toHaveText('$0');
	}
});
