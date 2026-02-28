import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

// Helper: open modal and effective date picker for a single transaction
async function openPicker(page: import('@playwright/test').Page) {
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();
	await modal.getByTestId('effective-date-button').click();
	const picker = page.getByTestId('month-year-picker');
	await expect(picker).toBeVisible();
	return { modal, picker };
}

test('set effective date via modal', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile,
	surreal
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'COFFEE SHOP',
		date: new Date(2025, 0, 10),
		amount: -550
	});

	await page.goto('/');

	// Open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Click effective date button — should show "Same as statement" initially
	const effectiveDateBtn = modal.getByTestId('effective-date-button');
	await expect(effectiveDateBtn).toContainText('Same as statement');
	await effectiveDateBtn.click();

	// Picker should be visible, defaulting to current year (2026)
	const picker = page.getByTestId('month-year-picker');
	await expect(picker).toBeVisible();

	// Select March (month 3)
	await picker.getByTestId('month-option-3').click();

	// Verify the effective date button now shows Mar 2025
	await expect(effectiveDateBtn).toContainText('Mar 2025');

	// Verify the transaction row date shows the effective date with blue styling
	await page.keyboard.press('Escape');
	const dateCell = page.getByTestId('transaction-date');
	await expect(dateCell).toContainText('Mar');
	await expect(dateCell).toContainText('2025');

	// Verify persisted in DB
	await waitFor(async () => {
		const [[refreshed]] = await surreal.query<[{ effectiveDate: string }[]]>(
			'SELECT effectiveDate FROM transaction'
		);
		return refreshed.effectiveDate !== undefined && refreshed.effectiveDate !== null;
	});
});

test('effective date affects year/month filtering', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile,
	createCategory
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const category = await createCategory({ name: 'Food', emoji: '🍕' });

	// Create a Jan 2025 statement with a transaction
	const statement2025 = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement2025.id,
		statementDescription: 'MOVED TRANSACTION',
		date: new Date(2025, 0, 10),
		amount: -1000,
		category: category.id
	});

	// Also create a 2024 statement so the year 2024 appears in filters
	await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2024, 11, 15)
	});

	await page.goto('/');

	// Transaction should be visible under 2025 (default/max year)
	await expect(page.getByText('MOVED TRANSACTION')).toBeVisible();

	// Open modal and set effective date to Dec 2024
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	await modal.getByTestId('effective-date-button').click();
	const picker = page.getByTestId('month-year-picker');

	// Navigate back from 2025 to 2024
	await picker.getByLabel('Previous year').click();

	// Wait for the year-change animation to finish so only one grid is in the DOM
	await expect(picker.getByTestId('month-option-12')).toHaveCount(1);

	// Select December
	await picker.getByTestId('month-option-12').click();
	await expect(modal.getByTestId('effective-date-button')).toContainText('Dec 2024');
	await page.keyboard.press('Escape');

	// Transaction should now NOT be visible under 2025 (it moved to 2024)
	// It may still be visible via sticky, so let's reload to clear sticky state
	await page.reload();

	// Open year filter dropdown
	await page.getByRole('button', { name: 'Year Filter' }).click();
	// Select 2024 and deselect 2025
	await page.getByRole('checkbox', { name: '2024' }).click();
	await page.getByRole('checkbox', { name: '2025' }).click();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	await expect(page.getByText('MOVED TRANSACTION')).toBeVisible();
});

test('clear effective date', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile,
	surreal
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	const transaction = await createTransaction({
		statement: statement.id,
		statementDescription: 'CLEARABLE',
		date: new Date(2025, 0, 10),
		amount: -200
	});

	await page.goto('/');

	// Open modal, set effective date to Feb 2025
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	await modal.getByTestId('effective-date-button').click();
	const picker = page.getByTestId('month-year-picker');
	await picker.getByTestId('month-option-2').click(); // Feb

	await expect(modal.getByTestId('effective-date-button')).toContainText('Feb 2025');

	// Now clear the effective date
	await modal.getByTestId('effective-date-button').click();
	await page.getByTestId('clear-effective-date').click();

	// Should revert to "Same as statement"
	await expect(modal.getByTestId('effective-date-button')).toContainText('Same as statement');

	// Verify DB is cleared
	await waitFor(async () => {
		const [[refreshed]] = await surreal.query<[{ effectiveDate?: string }[]]>(
			'SELECT effectiveDate FROM transaction WHERE id = $id',
			{ id: transaction.id }
		);
		return refreshed.effectiveDate === undefined || refreshed.effectiveDate === null;
	});
});

// ─── Keyboard navigation tests ────────────────────────────────────────────────

test('picker: arrow keys navigate months and Enter selects', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15) // Jan 2025
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'KEYBOARD TEST',
		date: new Date(2025, 0, 10), // Jan 2025 → focusedIndex starts at 0 (Jan)
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);
	await expect(picker).toBeVisible();

	// ArrowRight from Jan → Feb
	await page.keyboard.press('ArrowRight');
	// ArrowDown from Feb → Jun (same column, 4 months down)
	await page.keyboard.press('ArrowDown');
	// ArrowDown again: Jun → Oct
	await page.keyboard.press('ArrowDown');
	// ArrowLeft: Oct → Sep
	await page.keyboard.press('ArrowLeft');
	// ArrowUp: Sep → May
	await page.keyboard.press('ArrowUp');
	// Press Enter to select May 2025
	await page.keyboard.press('Enter');

	await expect(picker).not.toBeVisible();
	await expect(modal.getByTestId('effective-date-button')).toContainText('May 2025');
});

test('picker: vim hjkl keys navigate months and Enter selects', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'VIM NAV TEST',
		date: new Date(2025, 0, 10), // Jan 2025 → focusedIndex starts at 0 (Jan)
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);

	// j: Jan → May (down one row)
	await page.keyboard.press('j');
	// j: May → Sep
	await page.keyboard.press('j');
	// l: Sep → Oct
	await page.keyboard.press('l');
	// k: Oct → Jun
	await page.keyboard.press('k');
	// h: Jun → May
	await page.keyboard.press('h');
	// Enter: select May 2025
	await page.keyboard.press('Enter');

	await expect(picker).not.toBeVisible();
	await expect(modal.getByTestId('effective-date-button')).toContainText('May 2025');
});

test('picker: l from right-edge month wraps to same row left edge in next year', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	// Aug is index 7, col 3 (right edge of row 1). l → May (col 0, row 1) of next year.
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 7, 15) // Aug 2025
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'YEAR WRAP RIGHT',
		date: new Date(2025, 7, 10), // Aug 2025 → focusedIndex starts at 7 (Aug, col 3 row 1)
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);

	// Year header should show 2025
	await expect(picker).toContainText('2025');

	// l from Aug (col 3) → wraps to May (col 0) of next year
	await page.keyboard.press('l');

	// Year header should now show 2026
	await expect(picker).toContainText('2026');

	// Enter: select May 2026
	await page.keyboard.press('Enter');

	await expect(picker).not.toBeVisible();
	await expect(modal.getByTestId('effective-date-button')).toContainText('May 2026');
});

test('picker: h from left-edge month wraps to same row right edge in previous year', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	// May is index 4, col 0 (left edge of row 1). h → Aug (col 3, row 1) of previous year.
	// This is the exact scenario described in the feature request.
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 4, 15) // May 2025
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'YEAR WRAP LEFT',
		date: new Date(2025, 4, 10), // May 2025 → focusedIndex starts at 4 (May, col 0 row 1)
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);

	// Year header should show 2025
	await expect(picker).toContainText('2025');

	// h from May (col 0) → wraps to Aug (col 3) of previous year
	await page.keyboard.press('h');

	// Year header should now show 2024
	await expect(picker).toContainText('2024');

	// Enter: select Aug 2024
	await page.keyboard.press('Enter');

	await expect(picker).not.toBeVisible();
	await expect(modal.getByTestId('effective-date-button')).toContainText('Aug 2024');
});

test('picker: q closes picker without closing modal or changing value', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'CANCEL TEST',
		date: new Date(2025, 0, 10),
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);

	// Navigate somewhere so we know we didn't accidentally select
	await page.keyboard.press('ArrowRight');

	// Press q to cancel
	await page.keyboard.press('q');

	// Picker should close
	await expect(picker).not.toBeVisible();
	// Modal should still be open
	await expect(modal).toBeVisible();
	// Value should be unchanged ("Same as statement")
	await expect(modal.getByTestId('effective-date-button')).toContainText('Same as statement');
});

test('picker: Escape closes picker without closing modal', async ({
	page,
	createTransaction,
	createAccount,
	createStatement,
	createFile
}) => {
	const account = await createAccount({ name: 'Test Card' });
	const file = await createFile({ name: 'statement.pdf' });
	const statement = await createStatement({
		account: account.id,
		file: file.id,
		date: new Date(2025, 0, 15)
	});
	await createTransaction({
		statement: statement.id,
		statementDescription: 'ESCAPE TEST',
		date: new Date(2025, 0, 10),
		amount: -100
	});

	await page.goto('/');
	const { modal, picker } = await openPicker(page);

	// Press Escape — should close picker but NOT the modal
	await page.keyboard.press('Escape');

	await expect(picker).not.toBeVisible();
	await expect(modal).toBeVisible();
	await expect(modal.getByTestId('effective-date-button')).toContainText('Same as statement');
});
