import { expect, test } from './utils/surrealdb-test';

test('budget reports with actual spending data', async ({
	page,
	pageHelpers,
	createBudget,
	createCategory,
	createTransaction,
	createStatement
}) => {
	await page.goto('/reports');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	// Create test categories
	const foodCategory = await createCategory({ name: 'Food', emoji: '🍕' });

	// Create budgets (stored as negative cents)
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

	// Connect to the database
	await pageHelpers.connect(page);

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Verify budget name appears in a heading
	await expect(page.getByRole('heading', { name: 'Food Budget' })).toBeVisible();
});

test('view budget reports with filtering', async ({
	page,
	pageHelpers,
	createBudget,
	createCategory
}) => {
	await page.goto('/reports');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

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

	// Connect to the database
	await pageHelpers.connect(page);

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Check that filters are available
	await expect(page.getByLabel('Year')).toBeVisible();
	await expect(page.getByLabel('Budget')).toBeVisible();

	// Check that "All Budgets" is selected by default
	await expect(page.getByLabel('Budget')).toHaveValue('all');

	// Verify both budgets appear on the page as headings
	await expect(page.getByRole('heading', { name: 'Food Budget' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Transportation Budget' })).toBeVisible();

	// Test budget filtering
	await page.getByLabel('Budget').selectOption('Food Budget');

	// Food Budget should still be visible
	await expect(page.getByRole('heading', { name: 'Food Budget' })).toBeVisible();

	// Reset filter
	await page.getByLabel('Budget').selectOption('all');

	// Both should be visible again
	await expect(page.getByRole('heading', { name: 'Food Budget' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Transportation Budget' })).toBeVisible();
});

test('reports page with no data', async ({ page, pageHelpers }) => {
	await page.goto('/reports');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	// Connect to the database
	await pageHelpers.connect(page);

	// Check that we're on the reports page
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();

	// Should show no data message
	await expect(page.getByText('No budget data available')).toBeVisible();
	await expect(page.getByText('Create some budgets to see reports')).toBeVisible();
});

test('budget report basic functionality', async ({
	page,
	pageHelpers,
	createBudget,
	createCategory
}) => {
	await page.goto('/reports');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	// Create test data
	const category = await createCategory({ name: 'Test Category' });
	const currentYear = new Date().getFullYear();

	await createBudget({
		name: 'Test Budget',
		year: currentYear,
		amount: -100000, // $1,000
		categories: [category.id]
	});

	// Connect to the database
	await pageHelpers.connect(page);

	// Wait for data to load
	await expect(page.getByText('Loading budget data...')).not.toBeVisible();

	// Verify the budget is displayed
	await expect(page.getByRole('heading', { name: 'Test Budget' })).toBeVisible();

	// Verify the page heading is visible
	await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();
});
