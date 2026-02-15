import { expect, test } from './utils/surrealdb-test';

test('existing tags', async ({ page, createTransaction, tagTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await tagTransaction(transaction.id, 'hawaii', 2025);
	await tagTransaction(transaction.id, 'gelato');

	await page.goto('/');

	// Check for the tags (displayed as individual chips without # prefix)
	const tagChips = page.locator('[data-transaction] .bg-blue-100');
	await expect(tagChips).toHaveCount(2);
	await expect(tagChips.filter({ hasText: 'gelato' })).toBeVisible();
	await expect(tagChips.filter({ hasText: 'hawaii' })).toBeVisible();
});

test('adding tag without a year', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Click the row to open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Use the tag input in the modal
	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('hawaii');
	await tagInput.press('Enter');

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii' }]);
});

test('adding tag with a year', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Click the row to open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Use the tag input in the modal — year is now space-separated
	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('hawaii 2025');
	await tagInput.press('Enter');

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii', year: 2025 }]);
});

test('editing tags', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	// Click the row to open modal
	await page.locator('[data-transaction]').click();
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Add description and a tag
	const descriptionInput = modal.getByRole('textbox', { name: 'Transaction description' });
	await descriptionInput.fill('Gelato');
	await descriptionInput.blur();

	const tagInput = modal.getByRole('textbox', { name: 'Tag input' });
	await tagInput.fill('hawaii');
	await tagInput.press('Enter');
	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii' }]);

	// Remove existing tag and add new one
	await modal.getByRole('button', { name: 'Remove tag hawaii' }).click();
	await tagInput.fill('maui');
	await tagInput.press('Enter');
	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'maui' }]);

	// Replace with a year-tagged version — year is now space-separated
	await modal.getByRole('button', { name: 'Remove tag maui' }).click();
	await tagInput.fill('hawaii 2025');
	await tagInput.press('Enter');
	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii', year: 2025 }]);

	// Add multiple tags
	await tagInput.fill('maui');
	await tagInput.press('Enter');
	await tagInput.fill('gelato');
	await tagInput.press('Enter');
	await pageHelpers.waitForTaggedTransaction(transaction.id, [
		{ name: 'hawaii', year: 2025 },
		{ name: 'maui' },
		{ name: 'gelato' }
	]);

	// Remove all but one
	await modal.getByRole('button', { name: 'Remove tag hawaii' }).click();
	await modal.getByRole('button', { name: 'Remove tag gelato' }).click();
	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'maui' }]);
});

test('searching by tag', async ({ page, createTransaction, tagTransaction }) => {
	const taggedTransaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});
	const untaggedTransaction = await createTransaction({
		statementDescription: 'PARKING',
		date: new Date(2025, 0, 1),
		amount: -1800
	});

	await tagTransaction(taggedTransaction.id, 'hawaii', 2025);
	await tagTransaction(taggedTransaction.id, 'gelato');

	await page.goto('/');

	// Check for both transactions
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).toBeVisible();

	const $search = page.getByRole('textbox', { name: 'Search input' });

	// Type a tag name — autocomplete should appear, select it
	await $search.fill('hawaii');
	const hawaiiOption = page.getByRole('option', { name: 'hawaii' });
	await expect(hawaiiOption).toBeVisible();
	await hawaiiOption.click();

	// Verify the tag chip was added
	const removeHawaii = page.getByRole('button', { name: 'Remove tag hawaii' });
	await expect(removeHawaii).toBeVisible();

	// Only the tagged transaction should be visible
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();

	// Remove the tag chip — both transactions should be visible again
	await removeHawaii.click();
	await expect(removeHawaii).not.toBeVisible();
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).toBeVisible();

	// Search by text for something that doesn't match
	await $search.fill('nothing');
	await expect(page.getByText(taggedTransaction.statementDescription)).not.toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();
});
