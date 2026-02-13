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

	// Check for the tag
	await expect(page.getByText('#gelato #hawaii-2025')).toBeVisible();
});

test('adding tag without a year', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'ONO GELATO' }).click();
	const $description = page.getByRole('textbox', { name: 'Transaction description' });
	await $description.fill('#hawaii');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii' }]);
});

test('adding tag with a year', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');

	await page.getByRole('button', { name: 'ONO GELATO' }).click();
	const $description = page.getByRole('textbox', { name: 'Transaction description' });
	await $description.fill('#hawaii-2025');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii', year: 2025 }]);
});

test('editing tags', async ({ page, pageHelpers, createTransaction }) => {
	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await page.goto('/');
	const $description = page.getByRole('textbox', { name: 'Transaction description' });

	await page.getByRole('button', { name: 'ONO GELATO' }).click();
	await $description.fill('Gelato #hawaii');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii' }]);
	await page.getByRole('button', { name: 'Gelato #hawaii' }).click();
	await $description.fill('Gelato #maui');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'maui' }]);
	await page.getByRole('button', { name: 'Gelato #maui' }).click();
	await $description.fill('Gelato #hawaii-2025');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii', year: 2025 }]);
	await page.getByRole('button', { name: 'Gelato #hawaii-2025' }).click();
	await $description.fill('Gelato #hawaii-2025 #maui #gelato');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [
		{ name: 'hawaii', year: 2025 },
		{ name: 'maui' },
		{ name: 'gelato' }
	]);
	await page.getByRole('button', { name: 'Gelato #gelato #hawaii-2025 #maui' }).click();
	await $description.fill('Gelato #maui');
	await $description.blur();

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

	const $search = page.getByRole('textbox', { name: 'Search' });

	// Filter by tag without year
	$search.fill('#hawaii');
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();

	// Filter by tag with year
	$search.fill('#hawaii-2025');
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();

	// Filter by tag that has no year
	$search.fill('#gelato');
	await expect(page.getByText(taggedTransaction.statementDescription)).toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();

	// Filter by tag that has no transactions
	$search.fill('#nothing');
	await expect(page.getByText(taggedTransaction.statementDescription)).not.toBeVisible();
	await expect(page.getByText(untaggedTransaction.statementDescription)).not.toBeVisible();
});
