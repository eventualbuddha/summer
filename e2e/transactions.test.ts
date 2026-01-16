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

test('filter by category', async ({ page, pageHelpers, createTransaction, createCategory }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const unknownCategory = await createCategory({
		name: 'Unknown',
		emoji: '❓'
	});
	const generalCategory = await createCategory({
		name: 'General',
		emoji: '🛍️'
	});
	const transaction1 = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Transaction #1',
		date: new Date(2025, 0, 1),
		amount: -123
	});
	const transaction2 = await createTransaction({
		category: unknownCategory.id,
		statementDescription: 'Transaction #2',
		date: new Date(2025, 0, 2),
		amount: -321
	});

	// Connect to the database
	await pageHelpers.connect(page);

	await expect(page.getByText('Jan 01 2025')).toBeVisible();
	await expect(page.getByText('Jan 02 2025')).toBeVisible();
	await expect(page.getByText(transaction1.statementDescription)).toBeVisible();
	await expect(page.getByText(transaction2.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();
	await expect(page.getByText('$3.21')).toBeVisible();

	await page.getByRole('button', { name: 'Category Filter' }).click();
	await page.getByRole('checkbox', { name: generalCategory.name }).click();

	await expect(page.getByText(transaction1.statementDescription)).not.toBeVisible();
	await expect(page.getByText(transaction2.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).not.toBeVisible();
	await expect(page.getByText('$3.21')).toBeVisible();
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

	// Wait for auto-connect to complete
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

test('bulk category editing', async ({
	page,
	pageHelpers,
	createCategory,
	createTransaction,
	surreal
}) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const unknownCategory = await createCategory({
		name: 'Unknown',
		emoji: '❓'
	});
	const generalCategory = await createCategory({
		name: 'General',
		emoji: '🛍️'
	});
	const utilitiesCategory = await createCategory({
		name: 'Utilities',
		emoji: '⚡'
	});

	// Create multiple transactions with different categories
	const transaction1 = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Transaction 1',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	const transaction2 = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Transaction 2',
		date: new Date(2025, 0, 2),
		amount: -200
	});
	const transaction3 = await createTransaction({
		category: unknownCategory.id,
		statementDescription: 'Transaction 3',
		date: new Date(2025, 0, 3),
		amount: -300
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Check initial state
	await expect(page.getByText('Transaction 1')).toBeVisible();
	await expect(page.getByText('Transaction 2')).toBeVisible();
	await expect(page.getByText('Transaction 3')).toBeVisible();

	// Should show bulk edit button with transaction count
	const bulkEditButton = page.getByRole('button', { name: /Edit category for all/ });
	await expect(bulkEditButton).toBeVisible();

	// Click bulk edit button
	await bulkEditButton.click();

	// Should show category selection dropdown
	await page.getByRole('button', { name: 'Utilities' }).click();

	// Should show confirmation modal
	await expect(page.getByText('Update Category')).toBeVisible();
	await expect(
		page.getByText('You are about to change the category of 3 transactions to ⚡ Utilities.')
	).toBeVisible();

	// Should show current category summary
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await expect(dialog.getByText('🛍️ General')).toBeVisible();
	await expect(dialog.getByText('2 transactions, $3')).toBeVisible(); // transaction1 + transaction2
	await expect(dialog.getByText('❓ Unknown')).toBeVisible();
	await expect(dialog.getByText('1 transaction, $3')).toBeVisible(); // transaction3

	// Confirm the update
	const confirmButton = page.getByRole('button', { name: 'Update 3 transactions' });
	await confirmButton.click();
	// Wait for database updates to complete
	await waitFor(async () => {
		const [transactions] = await surreal.query<[{ category?: RecordId }[]]>(
			'select id, category from transaction where id IN [$id1, $id2, $id3] ORDER BY id',
			{
				id1: transaction1.id,
				id2: transaction2.id,
				id3: transaction3.id
			}
		);
		return transactions.every((t) => t.category?.equals(utilitiesCategory.id));
	});

	// Check that all transactions are still visible (sticky)
	await expect(page.getByText('Transaction 1')).toBeVisible();
	await expect(page.getByText('Transaction 2')).toBeVisible();
	await expect(page.getByText('Transaction 3')).toBeVisible();

	// Check updated category summaries
	const generalSummaryValue = page.getByTestId(`${generalCategory.id}-summary-value`);
	const utilitiesSummaryValue = page.getByTestId(`${utilitiesCategory.id}-summary-value`);
	await expect(generalSummaryValue).toHaveText('$0');
	await expect(utilitiesSummaryValue).toHaveText('$6');
});

test('bulk category editing with filtered transactions', async ({
	page,
	pageHelpers,
	createCategory,
	createTransaction,
	surreal
}) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const unknownCategory = await createCategory({
		name: 'Unknown',
		emoji: '❓'
	});
	const foodCategory = await createCategory({
		name: 'Food',
		emoji: '🍕'
	});
	const utilitiesCategory = await createCategory({
		name: 'Utilities',
		emoji: '⚡'
	});

	// Create transactions with different descriptions
	await createTransaction({
		category: unknownCategory.id,
		statementDescription: 'First Coffee Shop',
		date: new Date(2025, 0, 1),
		amount: -500
	});
	await createTransaction({
		category: unknownCategory.id,
		statementDescription: 'Other Coffee Shop',
		date: new Date(2025, 0, 2),
		amount: -1200
	});
	await createTransaction({
		category: utilitiesCategory.id,
		statementDescription: 'Electric Bill',
		date: new Date(2025, 0, 3),
		amount: -8000
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Filter transactions by category
	await page.getByLabel('Category Filter').click();
	await page.getByRole('checkbox', { name: 'All' }).click();
	await page.getByRole('checkbox', { name: 'Unknown' }).click();
	await page.getByRole('heading', { name: 'Transactions' }).click();

	// Should only show 2 filtered transactions
	await expect(page.getByText('First Coffee Shop')).toBeVisible();
	await expect(page.getByText('Other Coffee Shop')).toBeVisible();
	await expect(page.getByText('Electric Bill')).not.toBeVisible();

	// Click on the bulk edit button
	const bulkEditButton = page.getByRole('button', { name: /Edit category for all/ });
	await expect(bulkEditButton).toBeVisible();

	// Perform bulk edit
	await bulkEditButton.click();
	const categoryList = page.getByRole('listbox');
	await categoryList.waitFor({ state: 'visible' });
	await categoryList.getByRole('button', { name: 'Food' }).click();

	// Should show confirmation for 2 transactions
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await expect(
		dialog.getByText('You are about to change the category of 2 transactions to 🍕 Food.')
	).toBeVisible();

	const confirmButton = page.getByRole('button', { name: 'Update 2 transactions' });
	await confirmButton.click();

	// Wait for updates
	await waitFor(async () => {
		const [transactions] = await surreal.query<[{ category?: RecordId }[]]>(
			'select category from transaction'
		);
		const foodTransactions = transactions.filter((t) => t.category?.equals(foodCategory.id));
		const otherTransactions = transactions.filter((t) => !t.category?.equals(foodCategory.id));

		return foodTransactions.length === 2 && otherTransactions.length === 1;
	});

	// Both filtered transactions should still be visible (sticky)
	await expect(page.getByText('First Coffee Shop')).toBeVisible();
	await expect(page.getByText('Other Coffee Shop')).toBeVisible();

	// Clear filter to see all transactions
	await page.getByLabel('Category Filter').click();
	await page.getByRole('checkbox', { name: 'All' }).click();

	// All transactions should be visible, with correct categories
	await expect(page.getByText('First Coffee Shop')).toBeVisible();
	await expect(page.getByText('Other Coffee Shop')).toBeVisible();
	await expect(page.getByText('Electric Bill')).toBeVisible();
});

test('bulk category editing disabled when no transactions', async ({ page, pageHelpers }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	// Connect to database with no transactions
	await pageHelpers.connect(page);

	// Bulk edit button should be disabled
	const bulkEditButton = page.getByRole('button', { name: /Edit category for all/ });
	await expect(bulkEditButton).toBeVisible();
	await expect(bulkEditButton).toBeDisabled();
});

test('bulk category editing modal cancel', async ({
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

	const transaction = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Test Transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Open bulk edit and select category
	const bulkEditButton = page.getByRole('button', { name: /Edit category for all/ });
	await bulkEditButton.click();

	const listbox = page.getByRole('listbox');
	await listbox.getByRole('button', { name: 'General' }).click();

	// Modal should be visible
	await expect(page.getByText('Update Category')).toBeVisible();

	// Cancel the operation
	await page.getByRole('button', { name: 'Cancel' }).click();

	// Modal should be closed
	await expect(page.getByText('Update Category')).not.toBeVisible();

	// Transaction should still have original category
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(generalCategory.id);
	});
});

test('actions row visibility', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	await createTransaction({
		statementDescription: 'Test Transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Should see both Filters and Actions rows
	await expect(page.getByText('Filters:')).toBeVisible();
	await expect(page.getByText('Actions:')).toBeVisible();

	// Actions row should contain the bulk edit button
	const actionsSection = page.locator('text=Actions:').locator('..');
	await expect(actionsSection.getByRole('button', { name: /Edit category for all/ })).toBeVisible();
});

test('bulk category editing modal keyboard accessibility', async ({
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

	const transaction = await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Test Transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Open bulk edit modal
	const bulkEditButton = page.getByRole('button', { name: /Edit category for all/ });
	await bulkEditButton.click();
	await page.getByRole('button', { name: 'Utilities' }).click();

	// Modal should be visible with focused confirmation button
	const modal = page.getByText('Update Category').locator('..');
	await expect(modal).toBeVisible();

	const confirmButton = page.getByRole('button', { name: 'Update 1 transaction' });
	await expect(confirmButton).toBeFocused();

	// Test Escape key dismisses modal
	await page.keyboard.press('Escape');
	await expect(modal).not.toBeVisible();

	// Transaction should still have original category
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(generalCategory.id);
	});

	// Test Enter key on focused button confirms action
	await bulkEditButton.click();
	await page.getByRole('button', { name: 'Utilities' }).click();

	// Confirm button should be focused again
	await expect(confirmButton).toBeFocused();

	// Press Enter to confirm
	await page.keyboard.press('Enter');

	// Wait for database updates to complete
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(utilitiesCategory.id);
	});
});

test('clear all filters', async ({ page, pageHelpers, createCategory, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const unknownCategory = await createCategory({
		name: 'Unknown',
		emoji: '❓'
	});
	const generalCategory = await createCategory({
		name: 'General',
		emoji: '🛍️'
	});

	await createTransaction({
		category: generalCategory.id,
		statementDescription: 'Transaction #1',
		date: new Date(2025, 0, 1),
		amount: -123
	});
	await createTransaction({
		category: unknownCategory.id,
		statementDescription: 'Transaction #2',
		date: new Date(2024, 0, 2),
		amount: -321
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Initially, both transactions should be visible
	await expect(page.getByText('Transaction #1')).toBeVisible();
	await expect(page.getByText('Transaction #2')).toBeVisible();

	// Apply category filter
	await page.getByRole('button', { name: 'Category Filter' }).click();
	await page.getByRole('checkbox', { name: generalCategory.name }).click();

	// Only transaction #2 should be visible
	await expect(page.getByText('Transaction #1')).not.toBeVisible();
	await expect(page.getByText('Transaction #2')).toBeVisible();

	// Apply year filter
	await page.getByRole('button', { name: 'Year Filter' }).click();
	await page.getByRole('checkbox', { name: '2025' }).click();
	await page.getByRole('checkbox', { name: '2024' }).click();

	// No transactions should be visible (filtered by both category and year)
	await expect(page.getByText('Transaction #1')).not.toBeVisible();
	await expect(page.getByText('Transaction #2')).not.toBeVisible();

	// Apply search filter
	await page.getByPlaceholder('Search (/)').fill('Transaction');

	// Still no transactions should be visible
	await expect(page.getByText('Transaction #1')).not.toBeVisible();
	await expect(page.getByText('Transaction #2')).not.toBeVisible();

	// Click the Clear button
	await page.getByRole('button', { name: 'Clear all filters' }).click();

	// Both transactions should be visible again
	await expect(page.getByText('Transaction #1')).toBeVisible();
	await expect(page.getByText('Transaction #2')).toBeVisible();

	// Verify search is cleared
	await expect(page.getByPlaceholder('Search (/)')).toHaveValue('');

	// Verify URL parameters are cleared
	await expect(page).toHaveURL('/');
});
