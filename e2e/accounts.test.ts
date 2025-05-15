import { waitFor } from './utils/helpers';
import { expect, test } from './utils/surrealdb-test';

test('view & update accounts', async ({ page, pageHelpers, createAccount, surreal }) => {
	await page.goto('/accounts');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const account = await createAccount({ name: 'MyBank Checking' });

	// Connect to the database
	await pageHelpers.connect(page);

	// Check for the account
	const $accountType = page.getByRole('cell', { name: 'Account Type' }).getByRole('combobox');
	const $accountName = page.getByRole('cell', { name: 'Account Name' }).getByRole('textbox');
	const $accountNumber = page.getByRole('cell', { name: 'Account Number' }).getByRole('textbox');
	const $accountId = page.getByRole('cell', { name: 'Account ID' });
	await expect(page.getByRole('heading')).toHaveText('Accounts');
	await expect($accountName).toHaveValue(account.name);
	await expect($accountType).toHaveValue(account.type);
	await expect($accountNumber).toHaveValue(account.number!);
	await expect($accountId).toHaveText(account.id.id.toString());

	// Update the name
	await $accountName.fill('My New Name');
	await $accountName.blur();
	await waitFor(async () => {
		const updatedAccount = await surreal.select(account.id);
		console.log(updatedAccount.name);
		return updatedAccount.name === 'My New Name';
	});

	await page.getByRole('navigation').click();
	await page.getByText('Transactions').click();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	await expect(page.getByText('My New Name')).toBeVisible();
});
