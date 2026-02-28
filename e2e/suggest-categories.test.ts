import { RecordId } from 'surrealdb';
import { expect, test } from './utils/surrealdb-test';
import { waitFor } from './utils/helpers';

test('suggest button is visible and disabled when there are no transactions', async ({ page }) => {
	await page.goto('/');

	const suggestButton = page.getByRole('button', {
		name: 'Suggest categories for uncategorized transactions'
	});
	await expect(suggestButton).toBeVisible();
	await expect(suggestButton).toBeDisabled();
});

test('suggest button is enabled when transactions exist', async ({ page, createTransaction }) => {
	await createTransaction({ statementDescription: 'SOME MERCHANT', amount: -100 });

	await page.goto('/');

	const suggestButton = page.getByRole('button', {
		name: 'Suggest categories for uncategorized transactions'
	});
	await expect(suggestButton).toBeEnabled();
});

test('suggest modal shows no-history message when there are no categorized transactions', async ({
	page,
	surreal,
	createCategory,
	createTransaction
}) => {
	const defaultCategory = await createCategory({ name: 'Uncategorized', emoji: '❓' });
	await surreal.query('UPSERT settings:global SET defaultCategory = $cat', {
		cat: defaultCategory.id
	});

	// Transaction with the default category is a candidate, but there is no history to match it
	await createTransaction({
		statementDescription: 'MYSTERY MERCHANT',
		category: defaultCategory.id,
		date: new Date(2025, 0, 1),
		amount: -150
	});

	await page.goto('/');

	await page
		.getByRole('button', { name: 'Suggest categories for uncategorized transactions' })
		.click();

	const dialog = page.getByRole('dialog', { name: 'Suggest categories' });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText('No suggestions found. Categorize more transactions to build your history.')
	).toBeVisible();

	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();
});

test('suggest modal shows high-confidence suggestions pre-checked and applies them', async ({
	page,
	surreal,
	createCategory,
	createTransaction
}) => {
	const defaultCategory = await createCategory({ name: 'Uncategorized', emoji: '❓' });
	await surreal.query('UPSERT settings:global SET defaultCategory = $cat', {
		cat: defaultCategory.id
	});
	const foodCategory = await createCategory({ name: 'Food', emoji: '🍕' });

	// Build history: 4 transactions with "STARBUCKS COFFEE" → Food
	for (let i = 0; i < 4; i++) {
		await createTransaction({
			statementDescription: 'STARBUCKS COFFEE',
			category: foodCategory.id,
			date: new Date(2025, 0, i + 1),
			amount: -500
		});
	}

	// Candidate: "SQ STARBUCKS COFFEE #9876" normalizes to "starbucks coffee" — 100% match for Food
	const candidate = await createTransaction({
		statementDescription: 'SQ STARBUCKS COFFEE #9876',
		category: defaultCategory.id,
		date: new Date(2025, 0, 10),
		amount: -450
	});

	await page.goto('/');

	const suggestButton = page.getByRole('button', {
		name: 'Suggest categories for uncategorized transactions'
	});
	await expect(suggestButton).toBeEnabled();
	await suggestButton.click();

	const dialog = page.getByRole('dialog', { name: 'Suggest categories' });
	await expect(dialog).toBeVisible();

	// Suggestion is visible and pre-checked (100% confidence ≥ 80%)
	await expect(dialog.getByText('Food')).toBeVisible();
	await expect(dialog.getByText('100%')).toBeVisible();

	const applyButton = dialog.getByRole('button', { name: 'Apply 1 Checked Suggestion' });
	await expect(applyButton).toBeEnabled();
	await applyButton.click();

	// Dialog closes after applying
	await expect(dialog).not.toBeVisible();

	// Verify category was updated in the database
	await waitFor(async () => {
		const [transactions] = await surreal.query<[{ category?: RecordId }[]]>(
			'SELECT category FROM transaction WHERE id = $id',
			{ id: candidate.id }
		);
		return transactions.length === 1 && transactions[0].category?.equals(foodCategory.id);
	});
});

test('suggest modal shows exception-range suggestions unchecked', async ({
	page,
	surreal,
	createCategory,
	createTransaction
}) => {
	const defaultCategory = await createCategory({ name: 'Uncategorized', emoji: '❓' });
	await surreal.query('UPSERT settings:global SET defaultCategory = $cat', {
		cat: defaultCategory.id
	});
	const foodCategory = await createCategory({ name: 'Food', emoji: '🍕' });
	const shoppingCategory = await createCategory({ name: 'Shopping', emoji: '🛍️' });

	// 2 Food, 1 Shopping → Food confidence = 2/3 ≈ 67% (exception range, unchecked by default)
	await createTransaction({
		statementDescription: 'MIXED MERCHANT',
		category: foodCategory.id,
		date: new Date(2025, 0, 1),
		amount: -100
	});
	await createTransaction({
		statementDescription: 'MIXED MERCHANT',
		category: foodCategory.id,
		date: new Date(2025, 0, 2),
		amount: -100
	});
	await createTransaction({
		statementDescription: 'MIXED MERCHANT',
		category: shoppingCategory.id,
		date: new Date(2025, 0, 3),
		amount: -100
	});

	// Candidate with the same description
	await createTransaction({
		statementDescription: 'MIXED MERCHANT',
		category: defaultCategory.id,
		date: new Date(2025, 0, 10),
		amount: -100
	});

	await page.goto('/');

	await page
		.getByRole('button', { name: 'Suggest categories for uncategorized transactions' })
		.click();

	const dialog = page.getByRole('dialog', { name: 'Suggest categories' });
	await expect(dialog).toBeVisible();

	// Suggestion is visible but unchecked (confidence < 80%)
	await expect(dialog.getByText('Food')).toBeVisible();

	const checkbox = dialog.getByRole('checkbox').first();
	await expect(checkbox).not.toBeChecked();

	// Apply button is disabled until user opts in
	const applyButton = dialog.getByRole('button', { name: /Apply \d+ Checked/ });
	await expect(applyButton).toBeDisabled();

	// User checks the suggestion manually
	await checkbox.check();
	await expect(dialog.getByRole('button', { name: 'Apply 1 Checked Suggestion' })).toBeEnabled();
});

test('suggest modal closes on Escape', async ({
	page,
	surreal,
	createCategory,
	createTransaction
}) => {
	const defaultCategory = await createCategory({ name: 'Uncategorized', emoji: '❓' });
	await surreal.query('UPSERT settings:global SET defaultCategory = $cat', {
		cat: defaultCategory.id
	});

	await createTransaction({
		statementDescription: 'ESCAPE TEST MERCHANT',
		category: defaultCategory.id,
		date: new Date(2025, 0, 1),
		amount: -100
	});

	await page.goto('/');

	await page
		.getByRole('button', { name: 'Suggest categories for uncategorized transactions' })
		.click();

	const dialog = page.getByRole('dialog', { name: 'Suggest categories' });
	await expect(dialog).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
});
