import { RecordId } from 'surrealdb';
import { waitFor } from './utils/helpers';
import { expect, test } from './utils/surrealdb-test';

// Helper: count tagged relations for a given tag name
async function countTagged(
	surreal: Parameters<Parameters<typeof test>[2]>[0]['surreal'],
	tagName: string
): Promise<number> {
	const [tags] = await surreal.query<[Array<{ id: RecordId }>]>(
		'SELECT id FROM tag WHERE name = $name',
		{ name: tagName }
	);
	if (tags.length === 0) return 0;
	const [rows] = await surreal.query<[Array<unknown>]>('SELECT * FROM tagged WHERE out = $id', {
		id: tags[0]!.id
	});
	return rows.length;
}

// Helper: find the table row containing the given tag
function tagRow(page: Parameters<Parameters<typeof test>[2]>[0]['page'], tagName: string) {
	return page
		.locator('tr')
		.filter({ has: page.getByRole('checkbox', { name: `Select ${tagName}` }) });
}

test('displays tags with transaction counts', async ({
	page,
	createTransaction,
	tagTransaction
}) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	const t3 = await createTransaction();

	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'vacation');
	await tagTransaction(t3.id, 'work');

	await page.goto('/tags');
	await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();

	// Both tags should appear
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Select work' })).toBeVisible();
});

test('rename a tag', async ({ page, createTransaction, tagTransaction, surreal }) => {
	const t1 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	// Rename inline
	const nameInput = tagRow(page, 'vacation').getByRole('textbox', { name: 'Tag name' });
	await nameInput.fill('holiday');
	await nameInput.blur();

	// UI updates: old label gone, new one appears
	await expect(page.getByRole('checkbox', { name: 'Select holiday' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).not.toBeVisible();

	// Database reflects the rename
	await waitFor(async () => {
		const [tags] = await surreal.query<[Array<{ name: string }>]>(
			'SELECT name FROM tag WHERE name = $name',
			{ name: 'holiday' }
		);
		return tags.length === 1;
	});
});

test('Delete and Merge buttons are disabled with no selection', async ({
	page,
	createTransaction,
	tagTransaction
}) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'work');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Merge' })).toBeDisabled();

	// Select one: Delete enabled, Merge still disabled (need 2+)
	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Merge' })).toBeDisabled();

	// Select second: both enabled
	await page.getByRole('checkbox', { name: 'Select work' }).check();
	await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Merge' })).toBeEnabled();
});

test('select all and deselect all via header checkbox', async ({
	page,
	createTransaction,
	tagTransaction
}) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'work');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	const headerCheckbox = page.getByRole('checkbox', { name: 'Select all tags' });

	// Check all
	await headerCheckbox.check();
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeChecked();
	await expect(page.getByRole('checkbox', { name: 'Select work' })).toBeChecked();
	await expect(page.getByText('2 selected')).toBeVisible();

	// Uncheck all
	await headerCheckbox.uncheck();
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).not.toBeChecked();
	await expect(page.getByRole('checkbox', { name: 'Select work' })).not.toBeChecked();
	await expect(page.getByText('2 selected')).not.toBeVisible();
});

test('delete selected tags', async ({ page, createTransaction, tagTransaction, surreal }) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	const t3 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'vacation');
	await tagTransaction(t3.id, 'work');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	// Select vacation
	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await page.getByRole('button', { name: 'Delete' }).click();

	// Dialog appears listing the tag and count
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('vacation');
	await expect(dialog).toContainText('2 transactions');

	// Confirm deletion
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).not.toBeVisible();

	// Tag gone from UI
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).not.toBeVisible();

	// work tag still present
	await expect(page.getByRole('checkbox', { name: 'Select work' })).toBeVisible();

	// Database: tag and its relations are gone
	await waitFor(async () => {
		const [tags] = await surreal.query<[Array<unknown>]>(
			'SELECT * FROM tag WHERE name = "vacation"'
		);
		return tags.length === 0;
	});
	await waitFor(async () => (await countTagged(surreal, 'vacation')) === 0);
});

test('delete multiple selected tags at once', async ({
	page,
	createTransaction,
	tagTransaction,
	surreal
}) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'work');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	await page.getByRole('checkbox', { name: 'Select all tags' }).check();
	await page.getByRole('button', { name: 'Delete' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('vacation');
	await expect(dialog).toContainText('work');

	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).not.toBeVisible();

	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).not.toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Select work' })).not.toBeVisible();

	await waitFor(async () => {
		const [tags] = await surreal.query<[Array<unknown>]>('SELECT * FROM tag');
		return tags.length === 0;
	});
});

test('merge tags', async ({ page, createTransaction, tagTransaction, surreal }) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	const t3 = await createTransaction();

	// t1 and t3 tagged with "vacation", t2 tagged with "holiday"
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'holiday');
	await tagTransaction(t3.id, 'vacation');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	// Select both tags
	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await page.getByRole('checkbox', { name: 'Select holiday' }).check();
	await page.getByRole('button', { name: 'Merge' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	// Select "vacation" as the merge target
	await dialog.getByRole('combobox').selectOption({ label: 'vacation' });

	// "holiday" should appear as a tag to be removed
	await expect(dialog).toContainText('holiday');

	// Confirm merge
	await dialog.getByRole('button', { name: 'Merge' }).click();
	await expect(dialog).not.toBeVisible();

	// "vacation" remains, "holiday" is gone
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Select holiday' })).not.toBeVisible();

	// All 3 transactions should now be tagged with "vacation"
	await waitFor(async () => (await countTagged(surreal, 'vacation')) === 3);
	await waitFor(async () => (await countTagged(surreal, 'holiday')) === 0);
});

test('merge deduplicates when transaction has both tags', async ({
	page,
	createTransaction,
	tagTransaction,
	surreal
}) => {
	const t1 = await createTransaction();

	// Tag t1 with both "vacation" AND "holiday"
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t1.id, 'holiday');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await page.getByRole('checkbox', { name: 'Select holiday' }).check();
	await page.getByRole('button', { name: 'Merge' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByRole('combobox').selectOption({ label: 'vacation' });
	await dialog.getByRole('button', { name: 'Merge' }).click();
	await expect(dialog).not.toBeVisible();

	// t1 should only have ONE "vacation" tag (no duplicate)
	await waitFor(async () => (await countTagged(surreal, 'vacation')) === 1);
	await waitFor(async () => (await countTagged(surreal, 'holiday')) === 0);
});

test('cancel delete dialog keeps tags intact', async ({
	page,
	createTransaction,
	tagTransaction,
	surreal
}) => {
	const t1 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');

	await page.goto('/tags');
	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await page.getByRole('button', { name: 'Delete' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();

	// Tag still present
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();
	await waitFor(async () => (await countTagged(surreal, 'vacation')) === 1);
});

test('cancel merge dialog keeps tags intact', async ({
	page,
	createTransaction,
	tagTransaction,
	surreal
}) => {
	const t1 = await createTransaction();
	const t2 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');
	await tagTransaction(t2.id, 'holiday');

	await page.goto('/tags');
	await page.getByRole('checkbox', { name: 'Select vacation' }).check();
	await page.getByRole('checkbox', { name: 'Select holiday' }).check();
	await page.getByRole('button', { name: 'Merge' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();

	// Both tags still present
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Select holiday' })).toBeVisible();
	await waitFor(async () => (await countTagged(surreal, 'vacation')) === 1);
	await waitFor(async () => (await countTagged(surreal, 'holiday')) === 1);
});

test('pressing Escape cancels rename and reverts the value', async ({
	page,
	createTransaction,
	tagTransaction,
	surreal
}) => {
	const t1 = await createTransaction();
	await tagTransaction(t1.id, 'vacation');

	await page.goto('/tags');
	await expect(page.getByRole('checkbox', { name: 'Select vacation' })).toBeVisible();

	const nameInput = tagRow(page, 'vacation').getByRole('textbox', { name: 'Tag name' });

	// Simulate realistic user typing: click to focus, select all, type new text, then Escape
	await nameInput.click({ clickCount: 3 });
	await page.keyboard.type('partially-typed');
	await page.keyboard.press('Escape');

	// Input value should be reverted to original
	await expect(nameInput).toHaveValue('vacation');

	// Database should still have the original name
	await waitFor(async () => {
		const [tags] = await surreal.query<[Array<{ name: string }>]>(
			'SELECT name FROM tag WHERE name = $name',
			{ name: 'vacation' }
		);
		return tags.length === 1;
	});

	// No tag named 'partially-typed' should exist
	const [wrongTags] = await surreal.query<[Array<unknown>]>(
		'SELECT * FROM tag WHERE name = $name',
		{ name: 'partially-typed' }
	);
	expect(wrongTags.length).toBe(0);
});
