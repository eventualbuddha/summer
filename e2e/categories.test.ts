import Surreal, { RecordId } from 'surrealdb';
import { waitFor } from './utils/helpers';
import { type Category, expect, test } from './utils/surrealdb-test';

async function expectDefaultCategory(surreal: Surreal, categoryId?: RecordId) {
	await waitFor(async () => {
		const [globalSettings] = await surreal.query<[{ defaultCategory?: RecordId }]>(
			'SELECT defaultCategory FROM ONLY settings:global;'
		);
		return globalSettings?.defaultCategory?.toString() === categoryId?.toString();
	});
}

test('view & update categories', async ({ page, pageHelpers, createCategory, surreal }) => {
	await page.goto('/categories');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const category = await createCategory({ name: 'General' });

	// Connect to the database
	await pageHelpers.connect(page);

	// Check for the category
	const $categoryName = page.getByRole('cell', { name: 'Category Name' }).getByRole('textbox');
	const $categoryEmoji = page.getByRole('cell', { name: 'Category Emoji' }).getByRole('textbox');
	const $categoryColor = page.getByRole('cell', { name: 'Category Color' }).getByRole('combobox');
	await expect(page.getByRole('heading')).toHaveText('Categories');
	await expect($categoryName).toHaveValue(category.name);
	await expect($categoryEmoji).toHaveValue(category.emoji);

	// Update the name
	await $categoryName.fill('My New Name');
	await $categoryName.blur();
	await waitFor(async () => {
		const updatedCategory = await surreal.select(category.id);
		return updatedCategory.name === 'My New Name';
	});

	// Update the emoji
	await $categoryEmoji.fill('😱');
	await $categoryEmoji.blur();
	await waitFor(async () => {
		const updatedCategory = await surreal.select(category.id);
		return updatedCategory.emoji === '😱';
	});

	// Update the color
	await $categoryColor.selectOption('amber-400');
	await $categoryColor.blur();
	await waitFor(async () => {
		const updatedCategory = await surreal.select(category.id);
		return updatedCategory.color === 'amber-400';
	});

	await page.getByLabel('Open Navigation').click();
	await page.getByText('Transactions').click();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	await expect(page.getByText('My New Name')).toBeVisible();
	await expect(page.getByText('😱')).toBeVisible();
});

test('create new category', async ({ page, pageHelpers, surreal }) => {
	await page.goto('/categories');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	// Connect to the database
	await pageHelpers.connect(page);

	// On the "Categories" page
	await expect(page.getByRole('heading')).toHaveText('Categories');
	const $newCategoryName = page
		.getByRole('cell', { name: 'New Category Name' })
		.getByRole('textbox');
	const $newCategoryEmoji = page
		.getByRole('cell', { name: 'New Category Emoji' })
		.getByRole('textbox');
	const $newCategoryColor = page
		.getByRole('cell', { name: 'New Category Color' })
		.getByRole('combobox');

	// Create a new category
	await page.getByRole('button', { name: 'New Category' }).click();
	const $newCategoryId = page.getByRole('cell', { name: 'New Category ID' }).getByRole('textbox');
	await $newCategoryEmoji.fill('😁');
	await $newCategoryName.fill('My New Category');
	await $newCategoryColor.selectOption('blue-200');
	await $newCategoryId.fill('my-new-category');
	await page.getByRole('button', { name: 'Save Category' }).click();

	await waitFor(async () => {
		const category = await surreal.select(new RecordId('category', 'my-new-category'));
		return (
			category.emoji === '😁' &&
			category.name === 'My New Category' &&
			category.color === 'blue-200' &&
			category.id.id.toString() === 'my-new-category' &&
			category.ordinal === 1
		);
	});

	// Create another category
	await page.getByRole('button', { name: 'New Category' }).click();
	await $newCategoryEmoji.fill('🧄');
	await $newCategoryName.fill('Food');
	await $newCategoryColor.selectOption('green-200');
	await $newCategoryId.fill(''); // let it automatically pick
	await page.getByRole('button', { name: 'Save Category' }).click();

	await waitFor(async () => {
		const [categories] = await surreal.query<[Category[]]>('SELECT * FROM category');
		const category = categories.find(({ name }) => name === 'Food')!;
		console.log(categories);
		return (
			category.emoji === '🧄' &&
			category.name === 'Food' &&
			category.color === 'green-200' &&
			category.id.id.toString() !== '' &&
			category.ordinal === 2 // automatic next value
		);
	});

	await page.getByLabel('Open Navigation').click();
	await page.getByText('Transactions').click();
	await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
	await expect(page.getByText('My New Category')).toBeVisible();
	await expect(page.getByText('😁')).toBeVisible();
	await expect(page.getByText('Food')).toBeVisible();
	await expect(page.getByText('🧄')).toBeVisible();
});

test('set default category', async ({ page, pageHelpers, createCategory, surreal }) => {
	await page.goto('/categories');
	const newConnectionButton = page.locator('button', { hasText: 'New Connection' });
	await newConnectionButton.click();

	const general = await createCategory({ name: 'General', emoji: '🛍️' });
	const utilities = await createCategory({ name: 'Utilities', emoji: '⚡' });

	// Connect to the database
	await pageHelpers.connect(page);

	// No default category yet
	await expectDefaultCategory(surreal, undefined);

	// Set a default category
	const $defaultCategory = page.getByRole('combobox', { name: 'Default category' });
	await expect(page.getByRole('heading')).toHaveText('Categories');
	await expect($defaultCategory).toBeVisible();

	await $defaultCategory.selectOption(general.id.id.toString());
	await expectDefaultCategory(surreal, general.id);

	// Change the default category
	await $defaultCategory.selectOption(utilities.id.id.toString());
	await expectDefaultCategory(surreal, utilities.id);
});
