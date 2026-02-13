import { waitFor } from './utils/helpers';
import { expect, test } from './utils/surrealdb-test';

test('view, create, edit, and delete budgets', async ({
	page,
	createBudget,
	createCategory,
	surreal
}) => {
	// Create test categories
	const category1 = await createCategory({ name: 'Food', emoji: '🍕' });
	const category2 = await createCategory({ name: 'Transportation', emoji: '🚗' });

	// Create a test budget (stored as negative cents)
	await createBudget({
		name: 'Test Budget',
		amount: -150000, // $1,500 in negative cents
		categories: [category1.id, category2.id]
	});

	await page.goto('/budgets');

	// Check that we're on the budgets page
	await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

	// Check that the existing budget is displayed
	await expect(page.getByText('Test Budget')).toBeVisible();
	await expect(page.getByText('$1,500')).toBeVisible();
	await expect(page.getByText('2025')).toBeVisible();

	// Test creating a new budget
	await page.getByRole('button', { name: 'New Budget' }).click();

	// Fill out the form
	await page.getByLabel('Budget Name').fill('Monthly Food Budget');
	await page.getByLabel('Budget Amount').fill('800');

	// Select a category
	await page.getByRole('checkbox', { name: 'Food' }).click();

	// Save the budget
	await page.getByRole('button', { name: 'Create Budget' }).click();

	// Verify the budget was created
	await expect(page.getByText('Monthly Food Budget')).toBeVisible();
	await expect(page.getByText('$800')).toBeVisible();

	// Verify in database (stored as negative cents)
	await waitFor(async () => {
		const budgets = await surreal.select('budget');
		return budgets.some((b) => b.name === 'Monthly Food Budget' && b.amount === -80000);
	});

	// Test editing a budget
	const editButtons = page.getByLabel(/Edit .*/);
	await editButtons.first().click();

	// Change the name and amount
	await page.getByLabel('Budget Name').fill('Updated Test Budget');
	await page.getByLabel('Budget Amount').fill('2000');

	// Save changes
	await page.getByRole('button', { name: 'Update Budget' }).click();

	// Verify changes in UI
	await expect(page.getByText('Updated Test Budget')).toBeVisible();
	await expect(page.getByText('$2,000')).toBeVisible();

	// Test deleting a budget
	const deleteButtons = page.getByLabel(/Delete .*/);

	// Set up dialog handler for confirmation
	page.on('dialog', (dialog) => dialog.accept());

	await deleteButtons.first().click();

	// Verify budget was deleted from UI
	await expect(page.getByText('Updated Test Budget')).not.toBeVisible();
});

test('budget form keyboard accessibility', async ({ page, createCategory }) => {
	// Create test category
	await createCategory({ name: 'Test Category' });

	await page.goto('/budgets');

	// Open new budget form
	await page.getByRole('button', { name: 'New Budget' }).click();

	// Test Escape key to cancel
	await page.keyboard.press('Escape');
	await expect(page.getByLabel('Budget Name')).not.toBeVisible();

	// Open form again
	await page.getByRole('button', { name: 'New Budget' }).click();

	// Fill form and test Ctrl+Enter to save
	await page.getByLabel('Budget Name').fill('Keyboard Test Budget');
	await page.getByLabel('Budget Amount').fill('500');

	// Use keyboard to navigate to category checkbox and select it
	await page.keyboard.press('Tab'); // Navigate through form
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab'); // Should be on first category checkbox
	await page.keyboard.press('Space'); // Select category

	// Save with Ctrl+Enter
	await page.keyboard.press('Control+Enter');

	// Verify budget was created
	await expect(page.getByText('Keyboard Test Budget')).toBeVisible();
});
