import { RecordId } from 'surrealdb';
import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

test('open modal by clicking transaction row', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	const account = await createAccount({ name: 'My Credit Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'COFFEE SHOP PURCHASE',
		date: new Date(2025, 0, 15),
		amount: -550
	});

	await page.goto('/');

	// Click the transaction row
	await page.locator('[data-transaction]').click();

	// Verify modal is visible
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Verify read-only fields
	await expect(modal.getByTestId('detail-bank-description')).toContainText('COFFEE SHOP PURCHASE');
	await expect(modal.getByTestId('detail-amount')).toContainText('$5.50');
	await expect(modal.getByTestId('detail-posted-date')).toContainText('1/15/25');

	// Verify account name and statement link load
	await expect(modal.getByTestId('detail-account')).toHaveText('My Credit Card');
	await expect(modal.getByTestId('detail-statement')).toContainText('January 2025');
});

test('category icon does not open modal', async ({ page, createCategory, createTransaction }) => {
	const category = await createCategory({ name: 'Food', emoji: '🍕' });
	await createTransaction({
		category: category.id,
		statementDescription: 'RESTAURANT',
		date: new Date(),
		amount: -2000
	});

	await page.goto('/');
	await expect(page.getByText('RESTAURANT')).toBeVisible();

	// Click the category pill
	await page.getByRole('button', { name: category.name, exact: true }).click();

	// Category dropdown should be visible, but modal should NOT be visible
	await expect(page.getByRole('listbox')).toBeVisible();
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('space on focused category button opens category picker, not modal', async ({
	page,
	createCategory,
	createTransaction
}) => {
	const category = await createCategory({ name: 'Keyboard Food', emoji: '🍔' });
	await createTransaction({
		category: category.id,
		statementDescription: 'KEYBOARD CATEGORY',
		date: new Date(),
		amount: -1200
	});

	await page.goto('/');

	const categoryButton = page.getByRole('button', { name: category.name, exact: true });
	await expect(categoryButton).toBeVisible();
	await categoryButton.focus();
	await expect(categoryButton).toBeFocused();
	await categoryButton.press('Space');

	await expect(page.getByRole('listbox')).toBeVisible();
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('vim-style row navigation and open modal shortcut', async ({ page, createTransaction }) => {
	const newerDate = new Date();
	const olderDate = new Date(newerDate.getTime() - 24 * 60 * 60 * 1000);

	await createTransaction({
		statementDescription: 'OLDER ROW',
		date: olderDate,
		amount: -1200
	});
	await createTransaction({
		statementDescription: 'NEWER ROW',
		date: newerDate,
		amount: -1300
	});

	await page.goto('/');

	const rows = page.locator('[data-transaction]');
	await expect(rows).toHaveCount(2);

	const firstRow = rows.first();
	const secondRow = rows.nth(1);

	await firstRow.focus();
	await expect(firstRow).toBeFocused();

	await page.keyboard.press('j');
	await expect(secondRow).toBeFocused();

	await page.keyboard.press('k');
	await expect(firstRow).toBeFocused();

	await page.keyboard.press('o');
	await expect(page.getByRole('dialog')).toBeVisible();
});

test('d/u page-jump focus through transaction rows', async ({ page, createTransaction }) => {
	const baseDate = new Date();
	for (let i = 0; i < 24; i += 1) {
		await createTransaction({
			statementDescription: `PAGE NAV ${i}`,
			date: new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000),
			amount: -(100 + i)
		});
	}

	await page.goto('/');

	const rows = page.locator('[data-transaction]');
	const firstRow = rows.first();
	await firstRow.focus();
	await expect(firstRow).toBeFocused();

	await page.keyboard.press('d');
	await expect(firstRow).not.toBeFocused();

	await page.keyboard.press('u');
	await expect(firstRow).toBeFocused();
});

test('g/G jump focus to top and bottom rows', async ({ page, createTransaction }) => {
	const baseDate = new Date();
	for (let i = 0; i < 120; i += 1) {
		await createTransaction({
			statementDescription: `EDGE NAV ${String(i).padStart(3, '0')}`,
			date: new Date(baseDate.getTime() - i * 60 * 1000),
			amount: -(200 + i)
		});
	}

	await page.goto('/');

	const topRow = page.locator('[data-is-first-transaction="true"]');
	const bottomRow = page.locator('[data-is-last-transaction="true"]');
	const currentRow = page.locator('[data-transaction]').first();
	await currentRow.focus();
	await expect(currentRow).toBeFocused();

	await page.keyboard.press('Shift+G');
	await expect(bottomRow).toBeVisible();
	await expect(bottomRow).toBeFocused();

	// At true bottom, moving down should have no effect.
	await page.keyboard.press('j');
	await expect(bottomRow).toBeFocused();

	await page.keyboard.press('g');
	await expect(topRow).toBeVisible();
	await expect(topRow).toBeFocused();

	// At true top, moving up should have no effect.
	await page.keyboard.press('k');
	await expect(topRow).toBeFocused();

	// Boundary shortcuts are no-ops when already at the boundary.
	await page.keyboard.press('Shift+G');
	await expect(bottomRow).toBeFocused();
	await page.keyboard.press('g');
	await expect(topRow).toBeFocused();
});

test('j from initial load focuses first transaction row', async ({ page, createTransaction }) => {
	const newerDate = new Date();
	const olderDate = new Date(newerDate.getTime() - 24 * 60 * 60 * 1000);

	await createTransaction({
		statementDescription: 'ROW A',
		date: olderDate,
		amount: -100
	});
	await createTransaction({
		statementDescription: 'ROW B',
		date: newerDate,
		amount: -200
	});

	await page.goto('/');

	const firstRow = page.locator('[data-transaction]').first();
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('j');
	await expect(firstRow).toBeFocused();
});

test('k from initial load focuses last transaction row', async ({ page, createTransaction }) => {
	const newerDate = new Date();
	const olderDate = new Date(newerDate.getTime() - 24 * 60 * 60 * 1000);

	await createTransaction({
		statementDescription: 'ROW A',
		date: olderDate,
		amount: -100
	});
	await createTransaction({
		statementDescription: 'ROW B',
		date: newerDate,
		amount: -200
	});

	await page.goto('/');

	const rows = page.locator('[data-transaction]');
	const lastRow = rows.nth(1);
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('k');
	await expect(lastRow).toBeFocused();
});

test('d from initial load focuses first transaction row', async ({ page, createTransaction }) => {
	const newerDate = new Date();
	const olderDate = new Date(newerDate.getTime() - 24 * 60 * 60 * 1000);

	await createTransaction({
		statementDescription: 'ROW A',
		date: olderDate,
		amount: -100
	});
	await createTransaction({
		statementDescription: 'ROW B',
		date: newerDate,
		amount: -200
	});

	await page.goto('/');

	const firstRow = page.locator('[data-transaction]').first();
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('d');
	await expect(firstRow).toBeFocused();
});

test('u from initial load focuses last transaction row', async ({ page, createTransaction }) => {
	const newerDate = new Date();
	const olderDate = new Date(newerDate.getTime() - 24 * 60 * 60 * 1000);

	await createTransaction({
		statementDescription: 'ROW A',
		date: olderDate,
		amount: -100
	});
	await createTransaction({
		statementDescription: 'ROW B',
		date: newerDate,
		amount: -200
	});

	await page.goto('/');

	const rows = page.locator('[data-transaction]');
	const lastRow = rows.nth(1);
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('u');
	await expect(lastRow).toBeFocused();
});

test('g from initial load focuses first transaction row in full list', async ({
	page,
	createTransaction
}) => {
	const baseDate = new Date();
	for (let i = 0; i < 120; i += 1) {
		await createTransaction({
			statementDescription: `INITIAL G ${String(i).padStart(3, '0')}`,
			date: new Date(baseDate.getTime() - i * 60 * 1000),
			amount: -(100 + i)
		});
	}

	await page.goto('/');

	const firstRow = page.locator('[data-is-first-transaction="true"]');
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('g');
	await expect(firstRow).toBeVisible();
	await expect(firstRow).toBeFocused();
});

test('G from initial load focuses last transaction row in full list', async ({
	page,
	createTransaction
}) => {
	const baseDate = new Date();
	for (let i = 0; i < 120; i += 1) {
		await createTransaction({
			statementDescription: `INITIAL SHIFT G ${String(i).padStart(3, '0')}`,
			date: new Date(baseDate.getTime() - i * 60 * 1000),
			amount: -(100 + i)
		});
	}

	await page.goto('/');

	const lastRow = page.locator('[data-is-last-transaction="true"]');
	await page.getByRole('heading', { name: 'Transactions' }).click();
	await page.keyboard.press('Shift+G');
	await expect(lastRow).toBeVisible();
	await expect(lastRow).toBeFocused();
});

test('c opens category picker from focused row', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'CATEGORY SHORTCUT ROW',
		date: new Date(),
		amount: -900
	});

	await page.goto('/');

	const row = page.locator('[data-transaction]').first();
	await row.focus();
	await expect(row).toBeFocused();

	await page.keyboard.press('c');

	await expect(page.getByRole('listbox')).toBeVisible();
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('c does not typeahead-select category when opening picker', async ({
	page,
	createCategory,
	createTransaction,
	surreal
}) => {
	const food = await createCategory({ name: 'Food', emoji: '🍕' });
	await createCategory({ name: 'Childcare', emoji: '👶' });
	const transaction = await createTransaction({
		category: food.id,
		statementDescription: 'C SHORTCUT TYPEAHEAD',
		date: new Date(),
		amount: -500
	});

	await page.goto('/');

	const row = page.locator('[data-transaction]').first();
	await row.focus();
	await expect(row).toBeFocused();

	await page.keyboard.press('c');
	await expect(page.getByRole('listbox')).toBeVisible();

	// Enter should not pick "Childcare" from the opening "c" keystroke.
	await page.keyboard.press('Enter');

	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(food.id);
	});

	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('keyboard category selection returns focus to edited row', async ({
	page,
	createCategory,
	createTransaction,
	surreal
}) => {
	const food = await createCategory({ name: 'Food', emoji: '🍕' });
	const utilities = await createCategory({ name: 'Utilities', emoji: '⚡' });
	const transaction = await createTransaction({
		category: food.id,
		statementDescription: 'CATEGORY KEYBOARD FOCUS RETURN',
		date: new Date(),
		amount: -300
	});

	await page.goto('/');

	const row = page.locator('[data-transaction]').first();
	await row.focus();
	await expect(row).toBeFocused();

	await page.keyboard.press('c');
	await expect(page.getByRole('listbox')).toBeVisible();

	await page.keyboard.press('u');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('listbox')).not.toBeVisible();
	await expect(row).toBeFocused();

	await waitFor(async () => {
		const [[refreshedTransaction]] = await surreal.query<[[{ category?: RecordId }]]>(
			'select category from transaction where id = $id',
			{ id: transaction.id }
		);
		expect(refreshedTransaction.category).toEqual(utilities.id);
	});
});

test('j is ignored by global row bootstrap while category picker is open', async ({
	page,
	createTransaction
}) => {
	await createTransaction({
		statementDescription: 'ROW 1',
		date: new Date(),
		amount: -100
	});
	await createTransaction({
		statementDescription: 'ROW 2',
		date: new Date(Date.now() - 24 * 60 * 60 * 1000),
		amount: -200
	});

	await page.goto('/');

	const row = page.locator('[data-transaction]').first();
	await row.focus();
	await expect(row).toBeFocused();

	await page.keyboard.press('c');
	const listbox = page.getByRole('listbox');
	await expect(listbox).toBeVisible();

	await page.keyboard.press('j');

	await expect(listbox).toBeVisible();
	await expect(row).not.toBeFocused();
});

test('edit description in modal', async ({ page, createTransaction, surreal }) => {
	const transaction = await createTransaction({
		statementDescription: 'GROCERY STORE',
		date: new Date(2025, 0, 1),
		amount: -4500
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Edit description
	const descriptionInput = modal.getByRole('textbox', { name: 'Transaction description' });
	await descriptionInput.fill('Weekly groceries');
	await descriptionInput.blur();

	// Verify persisted in DB
	await waitFor(async () => {
		const [[refreshed]] = await surreal.query<[{ description: string }[]]>(
			'SELECT description FROM transaction WHERE id = $id',
			{ id: transaction.id }
		);
		return refreshed.description === 'Weekly groceries';
	});

	// Verify the row behind the modal reflects the change
	await page.keyboard.press('Escape');
	await expect(page.getByText('Weekly groceries')).toBeVisible();
});

test('add tag via token input', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'SOUVENIR SHOP',
		date: new Date(2025, 0, 1),
		amount: -3000
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Add a tag
	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('Vacation');
	await tagInput.press('Enter');

	// Verify chip appears (without # prefix)
	await expect(modal.getByText('Vacation')).toBeVisible();

	// Verify persisted
	await pageHelpers.waitForTaggedTransaction(transaction.id, ['Vacation']);
});

test('remove tag', async ({ page, pageHelpers, createTransaction, tagTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'TAGGED ITEM',
		date: new Date(2025, 0, 1),
		amount: -500
	});

	await tagTransaction(transaction.id, 'Remove Me');
	await tagTransaction(transaction.id, 'Keep Me');

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Remove the tag
	await modal.getByRole('button', { name: 'Remove tag Remove Me' }).click();

	// Verify tag is removed from DB
	await pageHelpers.waitForTaggedTransaction(transaction.id, ['Keep Me']);
});

test('tag autocomplete', async ({ page, createTransaction, tagTransaction }) => {
	// Create a transaction with existing tags to populate the tag list
	const setupTransaction = await createTransaction({
		statementDescription: 'SETUP',
		date: new Date(2025, 0, 1),
		amount: -100
	});
	await tagTransaction(setupTransaction.id, 'Vacation');
	await tagTransaction(setupTransaction.id, 'Food');

	await createTransaction({
		statementDescription: 'NEW PURCHASE',
		date: new Date(2025, 0, 2),
		amount: -200
	});

	await page.goto('/');

	// Open modal on second transaction
	await page.locator('[data-transaction]').nth(0).click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Type to trigger autocomplete
	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('Vac');

	// Verify autocomplete dropdown shows (without # prefix)
	await expect(modal.getByRole('option', { name: 'Vacation' })).toBeVisible();

	// Use arrow key to select and Enter to confirm
	await tagInput.press('ArrowDown');
	await tagInput.press('Enter');

	// Verify chip appears (without # prefix)
	await expect(modal.getByText('Vacation')).toBeVisible();
});

test('change category in modal', async ({ page, createCategory, createTransaction, surreal }) => {
	const category1 = await createCategory({ name: 'Food', emoji: '🍕' });
	const category2 = await createCategory({ name: 'Travel', emoji: '✈️' });
	const transaction = await createTransaction({
		category: category1.id,
		statementDescription: 'RESTAURANT BILL',
		date: new Date(2025, 0, 1),
		amount: -3500
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Click category dropdown in modal
	await modal.getByRole('button', { name: category1.name }).click();
	await modal.getByRole('button', { name: category2.name }).click();

	// Verify persisted
	await waitFor(async () => {
		const [refreshed] = await surreal.query<[{ category?: RecordId }]>(
			'SELECT category FROM ONLY transaction WHERE id = $id',
			{ id: transaction.id }
		);
		return refreshed.category?.equals(category2.id);
	});
});

test('close modal with Escape', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'TEST TRANSACTION',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	await expect(page.getByRole('dialog')).toBeVisible();

	// Press Escape
	await page.keyboard.press('Escape');

	// Verify modal is closed
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('q closes modal when not typing', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'Q CLOSE MODAL',
		date: new Date(),
		amount: -100
	});

	await page.goto('/');

	await page.locator('[data-transaction]').click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	const descriptionInput = dialog.getByRole('textbox', { name: 'Transaction description' });
	await expect(descriptionInput).toBeFocused();

	await page.keyboard.press('q');
	await expect(dialog).toBeVisible();

	const closeButton = dialog.getByRole('button', { name: 'Close' });
	await closeButton.focus();
	await expect(closeButton).toBeFocused();

	await page.keyboard.press('q');
	await expect(dialog).not.toBeVisible();
});

test('close modal by clicking backdrop', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'TEST TRANSACTION',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Click outside the modal content (on the backdrop)
	// Use the fixed backdrop overlay, clicking at its top-left corner
	const backdrop = page.locator('.fixed.inset-0.z-50');
	await backdrop.click({ position: { x: 1, y: 1 } });

	// Verify modal is closed
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('keyboard navigation through modal fields', async ({ page, createTransaction }) => {
	await createTransaction({
		statementDescription: 'KEYBOARD NAV TEST',
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Verify description input is focused on open
	const descriptionInput = modal.getByRole('textbox', { name: 'Transaction description' });
	await expect(descriptionInput).toBeFocused();

	// Tab to tag input
	await page.keyboard.press('Tab');
	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await expect(tagInput).toBeFocused();
});
