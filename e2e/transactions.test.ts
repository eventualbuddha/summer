import { RecordId } from 'surrealdb';
import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

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
	await expect(page.getByText('Jan 01 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();
});

test('adding a description', async ({ page, pageHelpers, createTransaction, surreal }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'Bank Description',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Update the description
	await page.getByText(transaction.statementDescription).click();
	await page.getByRole('textbox', { name: 'Transaction description' }).fill('Custom Description');
	await page.getByRole('textbox', { name: 'Transaction description' }).press('Enter');

	// Check for the updated description
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[{ description: string }[]]>(
			'SELECT description FROM transaction WHERE id = $id',
			{ id: transaction.id }
		);
		return refreshedTransaction.description === 'Custom Description';
	});

	await expect(page.getByText('Custom Description Bank Description')).toBeVisible();
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
	await expect(page.getByText('Jan 01 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();

	const categorySummaryValue = page.getByTestId(`${category.id}-summary-value`);
	await expect(categorySummaryValue).toHaveText('$1');

	// Remove the category from the transaction
	await page.getByRole('button', { name: category.name }).click();
	await page.getByRole('button', { name: 'None' }).click();

	await waitFor(async () => {
		const [refreshedTransaction] = await surreal.query<[{ category?: RecordId }]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toBeUndefined();
	});

	// Updates the sums before reloading.
	await expect(categorySummaryValue).toHaveText('$0');

	await page.reload();

	// Connect to the database
	await page.getByRole('button', { name: 'Last Connection' }).click();

	// The transaction should no longer appear
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	await expect(page.getByText('Jan 01 2025')).not.toBeVisible();
	await expect(page.getByText('$').first()).toHaveText('$0');
	for (const locator of await page.getByText('$').all()) {
		await expect(locator).toHaveText('$0');
	}
});

test('update category', async ({
	page,
	pageHelpers,
	createCategory,
	createTransaction,
	surreal
}) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const category1 = await createCategory({
		name: 'General',
		emoji: '🛍️'
	});
	const category2 = await createCategory({
		name: 'Utilities',
		emoji: '⚡'
	});
	const transaction = await createTransaction({
		category: category1.id,
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await pageHelpers.connect(page);

	const category1SummaryValue = page.getByTestId(`${category1.id}-summary-value`);
	const category2SummaryValue = page.getByTestId(`${category2.id}-summary-value`);

	// Initially, transaction is assigned to category1.
	await expect(category1SummaryValue).toHaveText('$1');
	await expect(category2SummaryValue).toHaveText('$0');

	// Change the category
	await page.getByRole('button', { name: category1.name }).click();
	await page.getByRole('button', { name: category2.name }).click();

	await waitFor(async () => {
		const [refreshedTransaction] = await surreal.query<[{ category?: RecordId }]>(
			'select category from only transaction where id = $id limit 1',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(category2.id);
	});

	// Now, transaction is assigned to category2.
	await expect(category1SummaryValue).toHaveText('$0');
	await expect(category2SummaryValue).toHaveText('$1');
});

test('updating to hidden category', async ({
	page,
	pageHelpers,
	createCategory,
	createTransaction,
	surreal
}) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const generalCategory = await createCategory({
		name: 'General',
		emoji: '🛍️'
	});
	const utilitiesCategory = await createCategory({
		name: 'Utilities',
		emoji: '⚡'
	});
	const generalTransaction = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	await createTransaction({
		category: utilitiesCategory.id,
		statementDescription: '"Utilities" transaction',
		date: new Date(2024, 0, 1),
		amount: -100
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Hide "Utilities".
	await page.getByLabel('Category Filter').click();
	await expect(page.getByRole('checkbox', { name: 'General' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Utilities' })).toBeVisible();
	await page.getByRole('checkbox', { name: 'Utilities' }).click();

	// Change the category
	await page.getByRole('button', { name: 'General' }).click();
	await page.getByRole('button', { name: 'Utilities' }).click();

	await waitFor(async () => {
		const [refreshedTransaction] = await surreal.query<[{ category?: RecordId }]>(
			'select category from only transaction where id = $id limit 1',
			{ id: generalTransaction.id }
		);
		expect(refreshedTransaction.category).toEqual(utilitiesCategory.id);
	});

	// Check that the transaction is still shown.
	await expect(page.getByText(generalTransaction.statementDescription)).toBeVisible();

	// Update the filters.
	await page.getByPlaceholder('Search (/)').fill('test');

	// Check that the transaction is now hidden.
	await expect(page.getByText(generalTransaction.statementDescription)).not.toBeVisible();
});

test('search keyboard shortcuts', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	await createTransaction({
		statementDescription: 'Keyboard shortcut test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	// Connect to the database
	await pageHelpers.connect(page);

	const searchInput = page.getByPlaceholder('Search (/)');

	// Verify the placeholder includes the keyboard shortcut hint
	await expect(searchInput).toHaveAttribute('placeholder', 'Search (/)');

	// Verify search input is not focused initially
	await expect(searchInput).not.toBeFocused();

	// Press "/" key to focus search input
	await page.keyboard.press('/');

	// Verify search input is focused and "/" character is not typed
	await expect(searchInput).toBeFocused();
	await expect(searchInput).toHaveValue('');

	// Type a search term to verify functionality
	await page.keyboard.type('keyboard');
	await expect(searchInput).toHaveValue('keyboard');

	// Press Escape to blur the search input
	await page.keyboard.press('Escape');

	// Verify search input is no longer focused
	await expect(searchInput).not.toBeFocused();

	// Verify search term is still there
	await expect(searchInput).toHaveValue('keyboard');

	// Clear and test "/" doesn't focus when already focused in the search input
	await searchInput.focus();
	await searchInput.fill('');
	await expect(searchInput).toBeFocused();

	// Type "/" while focused in search input - should add the character
	await page.keyboard.press('/');
	await expect(searchInput).toHaveValue('/');

	// Clear the input and test the shortcut works again when not focused
	await searchInput.fill('');
	await page.keyboard.press('Escape'); // blur the input
	await expect(searchInput).not.toBeFocused();

	// Press "/" again to test the shortcut still works
	await page.keyboard.press('/');
	await expect(searchInput).toBeFocused();
	await expect(searchInput).toHaveValue('');

	// Test that it selects existing text when using the shortcut
	await page.keyboard.type('existing text');
	await expect(searchInput).toHaveValue('existing text');
	await page.keyboard.press('Escape'); // blur
	await page.keyboard.press('/'); // focus with shortcut

	// When using shortcut, existing text should be selected
	// We can test this by typing, which should replace selected text
	await page.keyboard.type('replaced');
	await expect(searchInput).toHaveValue('replaced');
});
