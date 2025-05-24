import { expect, test } from './utils/surrealdb-test';

test('existing tags', async ({ page, pageHelpers, createTransaction, tagTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await tagTransaction(transaction.id, 'hawaii', 2025);
	await tagTransaction(transaction.id, 'gelato');
	await pageHelpers.connect(page);

	// Check for the tag
	await expect(page.getByText('#gelato #hawaii-2025')).toBeVisible();
});

test('adding tag without a year', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await pageHelpers.connect(page);

	await page.getByRole('button', { name: 'ONO GELATO' }).click();
	const $description = page.getByRole('textbox', { name: 'Transaction description' });
	await $description.fill('#hawaii');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii' }]);
});

test('adding tag with a year', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await pageHelpers.connect(page);

	await page.getByRole('button', { name: 'ONO GELATO' }).click();
	const $description = page.getByRole('textbox', { name: 'Transaction description' });
	await $description.fill('#hawaii-2025');
	await $description.blur();

	await pageHelpers.waitForTaggedTransaction(transaction.id, [{ name: 'hawaii', year: 2025 }]);
});

test('editing tags', async ({ page, pageHelpers, createTransaction }) => {
	await page.goto('/');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const transaction = await createTransaction({
		statementDescription: 'ONO GELATO',
		date: new Date(2025, 0, 1),
		amount: -123
	});

	await pageHelpers.connect(page);
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
