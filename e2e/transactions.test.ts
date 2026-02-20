import { RecordId } from 'surrealdb';
import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

test('view transactions', async ({ page, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Check for the transaction
	await expect(page.getByText('Jan 01 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();
});

test('filter by category', async ({ page, createTransaction, createCategory }) => {
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

	await page.goto('/');

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

test('adding a description', async ({ page, createTransaction, surreal }) => {
	const transaction = await createTransaction({
		statementDescription: 'Bank Description',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Click the row to open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Update the description in the modal
	const descriptionInput = modal.getByRole('textbox', { name: 'Transaction description' });
	await descriptionInput.fill('Custom Description');
	await descriptionInput.blur();

	// Check for the updated description
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[{ description: string }[]]>(
			'SELECT description FROM transaction WHERE id = $id',
			{ id: transaction.id }
		);
		return refreshedTransaction.description === 'Custom Description';
	});

	// Close modal and verify the row shows the updated description
	await page.keyboard.press('Escape');
	await expect(page.getByText('Custom Description Bank Description')).toBeVisible();
});

test('clear category', async ({ page, createCategory, createTransaction, surreal }) => {
	const category = await createCategory();
	const transaction = await createTransaction({
		category: category.id,
		statementDescription: 'Just a test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Check for the transaction
	await expect(page.getByText('Jan 01 2025')).toBeVisible();
	await expect(page.getByText(transaction.statementDescription)).toBeVisible();
	await expect(page.getByText('$1.23')).toBeVisible();

	const categorySummaryValue = page.getByTestId(`${category.id}-summary-value`);
	await expect(categorySummaryValue).toHaveText('$1');

	// Remove the category from the transaction
	await page.getByRole('button', { name: category.name, exact: true }).click();
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

test('update category', async ({ page, createCategory, createTransaction, surreal }) => {
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

	await page.goto('/');

	const category1SummaryValue = page.getByTestId(`${category1.id}-summary-value`);
	const category2SummaryValue = page.getByTestId(`${category2.id}-summary-value`);

	// Initially, transaction is assigned to category1.
	await expect(category1SummaryValue).toHaveText('$1');
	await expect(category2SummaryValue).toHaveText('$0');

	// Change the category
	await page.getByRole('button', { name: category1.name, exact: true }).click();
	await page.getByRole('button', { name: category2.name, exact: true }).click();

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
	createCategory,
	createTransaction,
	surreal
}) => {
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

	await page.goto('/');

	// Hide "Utilities".
	await page.getByLabel('Category Filter').click();
	await expect(page.getByRole('checkbox', { name: 'General' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Utilities' })).toBeVisible();
	await page.getByRole('checkbox', { name: 'Utilities' }).click();

	// Close dropdown and wait for overlay to disappear
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	// Wait for transaction list to stabilize after filter change
	await expect(page.getByText(generalTransaction.statementDescription)).toBeVisible();

	// Change the category
	await page.getByRole('button', { name: 'General', exact: true }).click();
	await page.getByRole('button', { name: 'Utilities', exact: true }).click();

	await waitFor(async () => {
		const [refreshedTransaction] = await surreal.query<[{ category?: RecordId }]>(
			'select category from only transaction where id = $id limit 1',
			{ id: generalTransaction.id }
		);
		expect(refreshedTransaction.category).toEqual(utilitiesCategory.id);
	});

	// Check that the transaction is still shown.
	await expect(page.getByText(generalTransaction.statementDescription)).toBeVisible();

	// wait for a second (TODO: remove this)
	await page.waitForTimeout(1000);

	// Update the filters.
	const searchInput = page.getByPlaceholder('Search (/)');
	await searchInput.fill('test');
	await searchInput.press('Enter');
	await searchInput.blur();

	// Check that the transaction is now hidden.
	await expect(page.getByText(generalTransaction.statementDescription)).not.toBeVisible();
});

test('search keyboard shortcuts', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'Keyboard shortcut test transaction',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

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
	await searchInput.fill('keyboard');
	await expect(searchInput).toHaveValue('keyboard');

	// Press Escape to blur the search input
	await page.keyboard.press('Escape');

	// Verify search input is no longer focused
	await expect(searchInput).not.toBeFocused();

	// Verify search term is still there
	await expect(searchInput).toHaveValue('keyboard');

	// Clear and test "/" doesn't focus when already focused in the search input
	await searchInput.focus();
	await searchInput.clear();
	await expect(searchInput).toHaveValue('');
	await expect(searchInput).toBeFocused();

	// Type "/" while focused in search input - should add the character
	await page.keyboard.press('/');
	await expect(searchInput).toHaveValue('/');

	// Clear the input and test the shortcut works again when not focused
	await searchInput.clear();
	await page.keyboard.press('Escape'); // blur the input
	await expect(searchInput).not.toBeFocused();

	// Press "/" again to test the shortcut still works
	await page.keyboard.press('/');
	await expect(searchInput).toBeFocused();
	await expect(searchInput).toHaveValue('');

	// Test that it selects existing text when using the shortcut
	await searchInput.fill('existing text');
	await expect(searchInput).toHaveValue('existing text');
	await page.keyboard.press('Escape'); // blur
	await page.keyboard.press('/'); // focus with shortcut

	// When using shortcut, existing text should be selected
	// We can test this by typing, which should replace selected text
	await searchInput.fill('replaced');
	await expect(searchInput).toHaveValue('replaced');
});

test('bulk category editing', async ({ page, createCategory, createTransaction, surreal }) => {
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

	await page.goto('/');

	// Check initial state
	await expect(page.getByText('Transaction 1')).toBeVisible();
	await expect(page.getByText('Transaction 2')).toBeVisible();
	await expect(page.getByText('Transaction 3')).toBeVisible();

	// Click Bulk Edit button
	const bulkEditButton = page.getByRole('button', { name: 'Bulk edit filtered transactions' });
	await expect(bulkEditButton).toBeVisible();
	await bulkEditButton.click();

	// Bulk edit modal should be open showing transaction count
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();
	// Save button shows the count (disabled until a field is changed)
	await expect(dialog.getByRole('button', { name: 'Update 3 Transactions' })).toBeDisabled();

	// Category shows mixed values placeholder — click to open dropdown
	await dialog.getByRole('button', { name: 'Select category' }).click();
	await page.getByRole('listbox').getByRole('button', { name: 'Utilities' }).click();

	// Save the changes
	await dialog.getByRole('button', { name: 'Update 3 Transactions' }).click();

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
	createCategory,
	createTransaction,
	surreal
}) => {
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

	await page.goto('/');

	// Filter transactions by category
	await page.getByLabel('Category Filter').click();
	await page.getByRole('checkbox', { name: 'All' }).click();
	await page.getByRole('checkbox', { name: 'Unknown' }).click();

	// Close dropdown and wait for overlay to disappear
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	// Should only show 2 filtered transactions
	await expect(page.getByText('First Coffee Shop')).toBeVisible();
	await expect(page.getByText('Other Coffee Shop')).toBeVisible();
	await expect(page.getByText('Electric Bill')).not.toBeVisible();

	// Click Bulk Edit button
	const bulkEditButton = page.getByRole('button', { name: 'Bulk edit filtered transactions' });
	await expect(bulkEditButton).toBeVisible();
	await bulkEditButton.click();

	// Bulk edit modal opens showing 2 transactions
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Update 2 Transactions' })).toBeDisabled();

	// Category shows the common Unknown category — click to open dropdown
	await dialog.getByRole('button', { name: 'Select category' }).click();
	await page.getByRole('listbox').getByRole('button', { name: 'Food' }).click();

	// Save the changes
	await dialog.getByRole('button', { name: 'Update 2 Transactions' }).click();

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

test('bulk edit button disabled when no transactions', async ({ page }) => {
	await page.goto('/');

	// Bulk Edit button should be visible but disabled when there are no transactions
	const bulkEditButton = page.getByRole('button', { name: 'Bulk edit filtered transactions' });
	await expect(bulkEditButton).toBeVisible();
	await expect(bulkEditButton).toBeDisabled();
});

test('bulk edit modal cancel', async ({ page, createCategory, createTransaction, surreal }) => {
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

	await page.goto('/');

	// Open bulk edit modal
	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();

	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Cancel without making changes
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	// Modal should be closed
	await expect(dialog).not.toBeVisible();

	// Transaction should still have original category
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(generalCategory.id);
	});
});

test('bulk edit button in filter row', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'Test Transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	// No separate "Filters:" or "Actions:" labels — all controls are in one row
	await expect(page.getByText('Filters:')).not.toBeVisible();
	await expect(page.getByText('Actions:')).not.toBeVisible();

	// Bulk Edit button is present alongside the filter controls
	await expect(page.getByRole('button', { name: 'Bulk edit filtered transactions' })).toBeVisible();
});

test('bulk edit modal keyboard accessibility', async ({
	page,
	createCategory,
	createTransaction,
	surreal
}) => {
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

	await page.goto('/');

	const bulkEditButton = page.getByRole('button', { name: 'Bulk edit filtered transactions' });
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });

	// Open modal — description input should be focused
	await bulkEditButton.click();
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('textbox', { name: 'Description' })).toBeFocused();

	// Escape key should dismiss the modal without saving
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();

	// Transaction should still have original category
	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(generalCategory.id);
	});

	// Open modal again, change category, then confirm via keyboard
	await bulkEditButton.click();
	await dialog.getByRole('button', { name: 'Select category' }).click();
	await page.getByRole('listbox').getByRole('button', { name: 'Utilities' }).click();

	// Tab to the Update button and press Enter
	const updateButton = dialog.getByRole('button', { name: 'Update 1 Transaction' });
	await updateButton.focus();
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

test('bulk edit description - multiple placeholder and save', async ({
	page,
	createTransaction,
	surreal
}) => {
	const t1 = await createTransaction({
		statementDescription: 'TX 1',
		description: 'First description',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	const t2 = await createTransaction({
		statementDescription: 'TX 2',
		description: 'Second description',
		date: new Date(2025, 0, 2),
		amount: -200
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Description input should show "Multiple Descriptions" placeholder since values differ
	const descInput = dialog.getByRole('textbox', { name: 'Description' });
	await expect(descInput).toHaveAttribute('placeholder', 'Multiple Descriptions');
	await expect(descInput).toHaveValue('');

	// Type a new description
	await descInput.fill('Unified description');

	// Save button enables and reflects count
	const updateBtn = dialog.getByRole('button', { name: 'Update 2 Transactions' });
	await expect(updateBtn).toBeEnabled();
	await updateBtn.click();

	// Verify both transactions updated in DB
	await waitFor(async () => {
		const [transactions] = await surreal.query<[{ description: string }[]]>(
			'SELECT description FROM transaction WHERE id IN [$id1, $id2]',
			{ id1: t1.id, id2: t2.id }
		);
		return transactions.every((t) => t.description === 'Unified description');
	});
});

test('bulk edit description - common value pre-populated', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'TX 1',
		description: 'Shared description',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	await createTransaction({
		statementDescription: 'TX 2',
		description: 'Shared description',
		date: new Date(2025, 0, 2),
		amount: -200
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Description input should be pre-populated with the common value
	const descInput = dialog.getByRole('textbox', { name: 'Description' });
	await expect(descInput).toHaveValue('Shared description');
	await expect(descInput).toHaveAttribute('placeholder', '');
});

test('bulk edit tags', async ({ page, pageHelpers, createTransaction }) => {
	const t1 = await createTransaction({
		statementDescription: 'TX 1',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	const t2 = await createTransaction({
		statementDescription: 'TX 2',
		date: new Date(2025, 0, 2),
		amount: -200
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Add a tag via the tag input
	const tagInput = dialog.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('Vacation');
	await tagInput.press('Enter');

	// Tag chip should appear in the dialog
	await expect(dialog.getByText('Vacation')).toBeVisible();

	// Save
	await dialog.getByRole('button', { name: 'Update 2 Transactions' }).click();

	// Verify both transactions have the tag
	await pageHelpers.waitForTaggedTransaction(t1.id, ['Vacation']);
	await pageHelpers.waitForTaggedTransaction(t2.id, ['Vacation']);
});

test('bulk edit effective date', async ({ page, createTransaction, surreal }) => {
	const t1 = await createTransaction({
		statementDescription: 'TX 1',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	const t2 = await createTransaction({
		statementDescription: 'TX 2',
		date: new Date(2025, 0, 2),
		amount: -200
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Both have no effective date — shows "Same as statement" (common value)
	await dialog.getByRole('button', { name: 'Same as statement' }).click();

	// Month-year picker appears
	const picker = page.getByTestId('month-year-picker');
	await expect(picker).toBeVisible();

	// Navigate to 2025 and select March
	await picker.getByLabel('Previous year').click();
	await picker.getByTestId('month-option-3').click();

	// Save
	await dialog.getByRole('button', { name: 'Update 2 Transactions' }).click();

	// Verify both transactions have an effective date set in DB
	await waitFor(async () => {
		const [transactions] = await surreal.query<[{ effectiveDate?: string }[]]>(
			'SELECT effectiveDate FROM transaction WHERE id IN [$id1, $id2]',
			{ id1: t1.id, id2: t2.id }
		);
		return transactions.every((t) => t.effectiveDate !== undefined && t.effectiveDate !== null);
	});
});

test('bulk edit × button closes modal', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'TX 1',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
	const dialog = page.getByRole('dialog', { name: 'Bulk edit transactions' });
	await expect(dialog).toBeVisible();

	// Click the × button
	await dialog.getByRole('button', { name: 'Close' }).click();

	await expect(dialog).not.toBeVisible();
});

test('clear all filters', async ({ page, createCategory, createTransaction }) => {
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

	await page.goto('/');

	// Initially, only the most recent year (2025) is visible by default
	await expect(page.getByText('Transaction #1')).toBeVisible();
	await expect(page.getByText('Transaction #2')).not.toBeVisible();

	// Show all years to see both transactions
	await page.getByRole('button', { name: 'Year Filter' }).click();
	await page.getByRole('checkbox', { name: '2024' }).click();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();
	await expect(page.getByText('Transaction #1')).toBeVisible();
	await expect(page.getByText('Transaction #2')).toBeVisible();

	// Apply category filter
	await page.getByRole('button', { name: 'Category Filter' }).click();
	await page.getByRole('checkbox', { name: generalCategory.name }).click();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	// Only transaction #2 should be visible
	await expect(page.getByText('Transaction #1')).not.toBeVisible();
	await expect(page.getByText('Transaction #2')).toBeVisible();

	// Apply year filter
	await page.getByRole('button', { name: 'Year Filter' }).click();
	await page.getByRole('checkbox', { name: '2025' }).click();
	await page.getByRole('checkbox', { name: '2024' }).click();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

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

	// After clearing, only the most recent year (2025) should be selected
	// So only Transaction #1 should be visible
	await expect(page.getByText('Transaction #1')).toBeVisible();
	await expect(page.getByText('Transaction #2')).not.toBeVisible();

	// Verify search is cleared
	await expect(page.getByPlaceholder('Search (/)')).toHaveValue('');

	// Verify URL reflects the default filter state (only most recent year)
	await expect(page).toHaveURL('/?years=2025');
});

test('single column sorting', async ({ page, createTransaction, createCategory }) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });

	// Create transactions with different dates and descriptions
	await createTransaction({
		category: category.id,
		statementDescription: 'Alpha Transaction',
		date: new Date(2025, 0, 15),
		amount: -100
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Beta Transaction',
		date: new Date(2025, 0, 10),
		amount: -200
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Gamma Transaction',
		date: new Date(2025, 0, 20),
		amount: -300
	});

	await page.goto('/');

	// Default sort is by date descending - Gamma (20th) should be first
	const transactionRows = page.locator('[data-transaction]');
	await expect(transactionRows.first()).toContainText('Gamma Transaction');

	// Click Date header to toggle to ascending
	await page.getByRole('button', { name: 'Date' }).click();

	// Now Beta (10th) should be first
	await expect(transactionRows.first()).toContainText('Beta Transaction');

	// Click Description header to sort by description ascending
	await page.getByRole('button', { name: 'Description' }).click();

	// Alpha should be first (alphabetically)
	await expect(transactionRows.first()).toContainText('Alpha Transaction');

	// Click Description again to toggle to descending
	await page.getByRole('button', { name: 'Description' }).click();

	// Gamma should be first now
	await expect(transactionRows.first()).toContainText('Gamma Transaction');
});

test('multi-column sorting with shift+click', async ({
	page,
	createTransaction,
	createCategory
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });

	// Create transactions where grouping matters
	// Two "Coffee" transactions on different dates
	await createTransaction({
		category: category.id,
		statementDescription: 'Coffee Shop',
		date: new Date(2025, 0, 15),
		amount: -500
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Coffee Shop',
		date: new Date(2025, 0, 10),
		amount: -600
	});
	// Two "Grocery" transactions on different dates
	await createTransaction({
		category: category.id,
		statementDescription: 'Grocery Store',
		date: new Date(2025, 0, 20),
		amount: -2000
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Grocery Store',
		date: new Date(2025, 0, 5),
		amount: -1500
	});

	await page.goto('/');

	// Sort by description first
	await page.getByRole('button', { name: 'Description' }).click();

	// Now shift+click date to add secondary sort
	await page.getByRole('button', { name: 'Date' }).click({ modifiers: ['Shift'] });

	// Verify both columns show sort indicators
	const descriptionButton = page.getByRole('button', { name: 'Description' });
	const dateButton = page.getByRole('button', { name: 'Date' });

	// Both should have sort icons visible
	await expect(descriptionButton.locator('svg')).toBeVisible();
	await expect(dateButton.locator('svg')).toBeVisible();

	// Priority numbers should be shown (1 for description, 2 for date)
	await expect(descriptionButton.getByText('1')).toBeVisible();
	await expect(dateButton.getByText('2')).toBeVisible();

	// Transactions should be grouped by description, then sorted by date within groups
	// Coffee Shop entries should be together, Grocery Store entries together
	const transactionRows = page.locator('[data-transaction]');
	const firstRow = transactionRows.nth(0);
	const secondRow = transactionRows.nth(1);
	const thirdRow = transactionRows.nth(2);
	const fourthRow = transactionRows.nth(3);

	// First two should be Coffee Shop (sorted by date desc within group)
	await expect(firstRow).toContainText('Coffee Shop');
	await expect(secondRow).toContainText('Coffee Shop');
	// Last two should be Grocery Store
	await expect(thirdRow).toContainText('Grocery Store');
	await expect(fourthRow).toContainText('Grocery Store');
});

test('shift+click existing sorted column toggles direction', async ({
	page,
	createTransaction,
	createCategory
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });

	await createTransaction({
		category: category.id,
		statementDescription: 'Alpha',
		date: new Date(2025, 0, 10),
		amount: -100
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Beta',
		date: new Date(2025, 0, 20),
		amount: -200
	});

	await page.goto('/');

	const transactionRows = page.locator('[data-transaction]');

	// Sort by description ascending
	await page.getByRole('button', { name: 'Description' }).click();
	await expect(transactionRows.first()).toContainText('Alpha');

	// Add date as secondary sort
	await page.getByRole('button', { name: 'Date' }).click({ modifiers: ['Shift'] });

	// Shift+click description to toggle its direction (should go to descending)
	await page.getByRole('button', { name: 'Description' }).click({ modifiers: ['Shift'] });

	// Now Beta should be first (description descending)
	await expect(transactionRows.first()).toContainText('Beta');

	// Both columns should still show sort indicators
	const descriptionButton = page.getByRole('button', { name: 'Description' });
	const dateButton = page.getByRole('button', { name: 'Date' });
	await expect(descriptionButton.locator('svg')).toBeVisible();
	await expect(dateButton.locator('svg')).toBeVisible();
});

test('regular click resets to single column sort', async ({
	page,
	createTransaction,
	createCategory
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });

	await createTransaction({
		category: category.id,
		statementDescription: 'Test',
		date: new Date(2025, 0, 10),
		amount: -100
	});
	await createTransaction({
		category: category.id,
		statementDescription: 'Test',
		date: new Date(2025, 0, 20),
		amount: -200
	});

	await page.goto('/');

	// Set up multi-column sort
	await page.getByRole('button', { name: 'Description' }).click();
	await page.getByRole('button', { name: 'Date' }).click({ modifiers: ['Shift'] });

	// Verify both have indicators
	const descriptionButton = page.getByRole('button', { name: 'Description' });
	const dateButton = page.getByRole('button', { name: 'Date' });
	await expect(descriptionButton.getByText('1')).toBeVisible();
	await expect(dateButton.getByText('2')).toBeVisible();

	// Regular click on Amount - should reset to single column
	await page.getByRole('button', { name: 'Amount' }).click();

	// Now only Amount should have sort indicator, no priority numbers
	const amountButton = page.getByRole('button', { name: 'Amount' });
	await expect(amountButton.locator('svg')).toBeVisible();
	await expect(descriptionButton.locator('svg')).not.toBeVisible();
	await expect(dateButton.locator('svg')).not.toBeVisible();

	// Priority numbers should not be visible (single column sort)
	await expect(amountButton.getByText('1')).not.toBeVisible();
});

test('tag totals appear for tagged transactions', async ({
	page,
	createCategory,
	createTransaction,
	tagTransaction
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });
	const t1 = await createTransaction({
		category: category.id,
		statementDescription: 'Tagged transaction A',
		date: new Date(2025, 0, 1),
		amount: -500
	});
	const t2 = await createTransaction({
		category: category.id,
		statementDescription: 'Tagged transaction B',
		date: new Date(2025, 0, 2),
		amount: -300
	});

	await tagTransaction(t1.id, 'food');
	await tagTransaction(t2.id, 'transport');

	await page.goto('/');

	// Each tag should appear with its correct total
	await expect(page.getByTestId('tag:food-summary-value')).toHaveText('$5');
	await expect(page.getByTestId('tag:transport-summary-value')).toHaveText('$3');
});

test('tag shows per-year breakdown when multiple years selected', async ({
	page,
	createCategory,
	createTransaction,
	tagTransaction
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });
	const t2024 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2024',
		date: new Date(2024, 0, 1),
		amount: -1000
	});
	const t2025 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2025',
		date: new Date(2025, 0, 1),
		amount: -2000
	});

	await tagTransaction(t2024.id, 'vacation');
	await tagTransaction(t2025.id, 'vacation');

	// Navigate with both years selected
	await page.goto('/?years=2024,2025');

	// Tag total should show
	await expect(page.getByTestId('tag:vacation-summary-value')).toBeVisible();

	// Per-year sub-rows should appear
	await expect(page.getByTestId('tag:vacation-year-2024-value')).toBeVisible();
	await expect(page.getByTestId('tag:vacation-year-2025-value')).toBeVisible();
});

test('tag shows no per-year breakdown when single year selected', async ({
	page,
	createCategory,
	createTransaction,
	tagTransaction
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });
	const t2024 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2024',
		date: new Date(2024, 0, 1),
		amount: -1000
	});
	const t2025 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2025',
		date: new Date(2025, 0, 1),
		amount: -2000
	});

	await tagTransaction(t2024.id, 'vacation');
	await tagTransaction(t2025.id, 'vacation');

	// Navigate with only 2025 selected (default: most recent year)
	await page.goto('/');

	// Tag total should show (only 2025 data)
	await expect(page.getByTestId('tag:vacation-summary-value')).toBeVisible();

	// Per-year sub-rows should NOT appear when only one year is selected
	await expect(page.getByTestId('tag:vacation-year-2025-value')).not.toBeVisible();
	await expect(page.getByTestId('tag:vacation-year-2024-value')).not.toBeVisible();
});

test('only tags with spending in filtered year appear', async ({
	page,
	createCategory,
	createTransaction,
	tagTransaction
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });
	const t2024 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2024',
		date: new Date(2024, 0, 1),
		amount: -1000
	});
	const t2025 = await createTransaction({
		category: category.id,
		statementDescription: 'Transaction 2025',
		date: new Date(2025, 0, 1),
		amount: -2000
	});

	// tag 'yearold' only appears in 2024
	await tagTransaction(t2024.id, 'yearold');
	// tag 'recent' only appears in 2025
	await tagTransaction(t2025.id, 'recent');

	// Filter to only 2025
	await page.goto('/');

	// 'recent' tag should appear (has spending in 2025)
	await expect(page.getByTestId('tag:recent-summary-value')).toBeVisible();

	// 'yearold' tag should NOT appear (no spending in 2025)
	await expect(page.getByTestId('tag:yearold-summary-value')).not.toBeVisible();
});

test('sidebar sections collapse and persist across reload', async ({
	page,
	createCategory,
	createTransaction
}) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });
	await createTransaction({
		category: category.id,
		statementDescription: 'Test transaction',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	// Sidebar year section should be visible initially
	const yearSectionButton = page.getByRole('button', { name: 'Total by Year totals section' });
	await expect(yearSectionButton).toBeVisible();
	await expect(yearSectionButton).toHaveAttribute('aria-expanded', 'true');

	// Verify year totals content is visible
	await expect(page.getByText('2025').first()).toBeVisible();

	// Click to collapse the year section
	await yearSectionButton.click();

	// Section should now be collapsed
	await expect(yearSectionButton).toHaveAttribute('aria-expanded', 'false');

	// Reload page
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

	// Section should still be collapsed after reload (localStorage persisted)
	const yearSectionButtonAfterReload = page.getByRole('button', {
		name: 'Total by Year totals section'
	});
	await expect(yearSectionButtonAfterReload).toHaveAttribute('aria-expanded', 'false');

	// Click to expand again
	await yearSectionButtonAfterReload.click();
	await expect(yearSectionButtonAfterReload).toHaveAttribute('aria-expanded', 'true');
});

test('sort tooltip shows full sort order', async ({ page, createTransaction, createCategory }) => {
	const category = await createCategory({ name: 'General', emoji: '🛍️' });

	await createTransaction({
		category: category.id,
		statementDescription: 'Test',
		date: new Date(2025, 0, 10),
		amount: -100
	});

	await page.goto('/');

	const sortHeader = page.locator('.flex.w-full.flex-row.text-sm.font-bold');

	// Single column sort - tooltip should show single sort
	await page.getByRole('button', { name: 'Description' }).click();
	await expect(sortHeader).toHaveAttribute('title', 'Sorted by: Description ↑');

	// Toggle direction
	await page.getByRole('button', { name: 'Description' }).click();
	await expect(sortHeader).toHaveAttribute('title', 'Sorted by: Description ↓');

	// Add secondary sort
	await page.getByRole('button', { name: 'Date' }).click({ modifiers: ['Shift'] });
	await expect(sortHeader).toHaveAttribute('title', 'Sorted by: 1. Description ↓, 2. Date ↓');

	// Add third sort
	await page.getByRole('button', { name: 'Amount' }).click({ modifiers: ['Shift'] });
	await expect(sortHeader).toHaveAttribute(
		'title',
		'Sorted by: 1. Description ↓, 2. Date ↓, 3. Amount ↑'
	);
});
