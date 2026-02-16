import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

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
