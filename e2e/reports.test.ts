import { expect, test } from './utils/surrealdb-test';

test('budget reports with actual spending data', async ({
	page,
	createBudget,
	createCategory,
	createTransaction,
	createStatement
}) => {
	// Create test categories
	const foodCategory = await createCategory({ name: 'Food', emoji: '🍕' });

	// Create budgets (stored as negative cents) for 2024
	await createBudget({
		name: 'Food Budget',
		year: 2024,
		amount: -120000, // $1,200 annual budget
		categories: [foodCategory.id]
	});

	// Create transactions for 2024 (negative amounts = spending)
	const statement2024 = await createStatement({ date: new Date('2024-01-15') });

	// Food spending in 2024: $300 total
	await createTransaction({
		statement: statement2024.id,
		category: foodCategory.id,
		amount: -30000, // $300
		date: new Date('2024-01-15'),
		statementDescription: 'Groceries Jan'
	});

	await page.goto('/reports');

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Verify budget name appears
	// Since we created budget for 2024 but it's 2025, the page should auto-select 2024
	await expect(page.getByText('Food Budget').first()).toBeVisible();

	// Verify that 2024 was auto-selected in the year dropdown
	await expect(page.locator('#year-filter')).toHaveValue('2024');
});

test('view budget reports with filtering', async ({ page, createBudget, createCategory }) => {
	// Create test categories
	const category1 = await createCategory({ name: 'Food', emoji: '🍕' });
	const category2 = await createCategory({ name: 'Transportation', emoji: '🚗' });

	const currentYear = new Date().getFullYear();

	// Create test budgets (stored as negative cents)
	await createBudget({
		name: 'Food Budget',
		year: currentYear,
		amount: -100000, // $1,000
		categories: [category1.id]
	});

	await createBudget({
		name: 'Transportation Budget',
		year: currentYear,
		amount: -80000, // $800
		categories: [category2.id]
	});

	await page.goto('/reports');

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Check that filters are available
	await expect(page.getByLabel('Year')).toBeVisible();
	await expect(page.getByLabel('Budget filter')).toBeVisible();

	// Check that "All Budgets" is displayed by default in the multi-select button
	const budgetButton = page.getByLabel('Budget filter');
	await expect(budgetButton).toContainText('All Budgets');

	// Verify both budgets appear on the page
	await expect(page.getByText('Food Budget').first()).toBeVisible();
	await expect(page.getByText('Transportation Budget').first()).toBeVisible();

	// Test budget filtering by opening the multi-select dropdown
	await budgetButton.click();

	// Uncheck "Food Budget" to filter it out (using label selector for checkbox)
	await page.locator('label').filter({ hasText: 'Food Budget' }).click();

	// Close the dropdown
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	// Food Budget should not be visible anymore
	await expect(page.getByText('Food Budget')).not.toBeVisible();
	// Transportation Budget should still be visible
	await expect(page.getByText('Transportation Budget').first()).toBeVisible();

	// Open dropdown again and select all
	await budgetButton.click();
	await page.locator('label').filter({ hasText: 'All' }).click();

	// Close the dropdown
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();

	// Both should be visible again
	await expect(page.getByText('Food Budget').first()).toBeVisible();
	await expect(page.getByText('Transportation Budget').first()).toBeVisible();
});

test('current-year progress fill is capped at the current month, ignoring future effective dates', async ({
	page,
	createBudget,
	createCategory,
	createTransaction,
	createStatement,
	surreal
}) => {
	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;

	const category = await createCategory({ name: 'Food', emoji: '🍕' });

	await createBudget({
		name: 'Food Budget',
		year: currentYear,
		amount: -120000, // $1,200 annual budget
		categories: [category.id]
	});

	// A normal transaction early in the year.
	const janStatement = await createStatement({ date: new Date(currentYear, 0, 15) });
	await createTransaction({
		statement: janStatement.id,
		category: category.id,
		amount: -10000,
		date: new Date(currentYear, 0, 15),
		statementDescription: 'Groceries Jan'
	});

	// A transaction whose *effective date* is in December of the current year — i.e. the
	// future. This must NOT inflate the year-progress fill beyond where we are in the year.
	const decStatement = await createStatement({ date: new Date(currentYear, 11, 15) });
	const futureTx = await createTransaction({
		statement: decStatement.id,
		category: category.id,
		amount: -10000,
		date: new Date(currentYear, 11, 15),
		statementDescription: 'Future Groceries'
	});
	await surreal.query('UPDATE $id SET effectiveDate = <datetime>$date', {
		id: futureTx.id,
		date: `${currentYear}-12-31T00:00:00.000Z`
	});

	await page.goto('/reports');

	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// The fill should reflect progress through the year (current month), not be pushed to
	// December (12 of 12) by the future-dated transaction.
	const fill = page.locator('[title$="based on latest transaction"]').first();
	await expect(fill).toHaveAttribute('title', new RegExp(`^${currentMonth} of 12 months`));
});

test('reports page with no data', async ({ page }) => {
	await page.goto('/reports');

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Should show no data message
	await expect(page.getByText('No budget data available')).toBeVisible();
	await expect(page.getByText('Create some budgets to see reports')).toBeVisible();
});

test('budget report basic functionality', async ({ page, createBudget, createCategory }) => {
	// Create test data
	const category = await createCategory({ name: 'Test Category' });
	const currentYear = new Date().getFullYear();

	await createBudget({
		name: 'Test Budget',
		year: currentYear,
		amount: -100000, // $1,000
		categories: [category.id]
	});

	await page.goto('/reports');

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Verify the budget is displayed (use first() to handle multiple matches - chart label and legend)
	await expect(page.getByText('Test Budget').first()).toBeVisible();

	// Verify the page heading is visible
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();
});
