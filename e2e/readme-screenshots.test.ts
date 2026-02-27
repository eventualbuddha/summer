import assert from 'node:assert';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { Surreal, Table } from 'surrealdb';
import { createDemoDataset } from '../bin/create-demo';
import { applyMigrations } from '../src/lib/server/migrations';

const SURREALDB_URL = process.env.SURREALDB_URL;
const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE;
const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE;

assert(SURREALDB_URL, 'SURREALDB_URL is not set');
assert(SURREALDB_NAMESPACE, 'SURREALDB_NAMESPACE is not set');
assert(SURREALDB_DATABASE, 'SURREALDB_DATABASE is not set');

const SCREENSHOT_OUTPUT_DIR =
	process.env.SUMMER_SCREENSHOT_DIR ?? 'test-results/readme-screenshots';

const previousCompleteYear = new Date().getFullYear() - 1;
const demoStartDate = `${previousCompleteYear - 1}-01-01`;
const demoEndDate = `${previousCompleteYear}-12-31`;

async function writeScreenshot(page: Page, filename: string): Promise<void> {
	await mkdir(SCREENSHOT_OUTPUT_DIR, { recursive: true });
	await page.screenshot({
		path: path.join(SCREENSHOT_OUTPUT_DIR, filename),
		fullPage: true
	});
}

async function seedDemoData(): Promise<void> {
	const db = new Surreal();
	await db.connect(SURREALDB_URL);
	await db.query(`DEFINE NAMESPACE IF NOT EXISTS \`${SURREALDB_NAMESPACE}\`;`);
	await db.use({ namespace: SURREALDB_NAMESPACE });
	await db.query(`DEFINE DATABASE IF NOT EXISTS \`${SURREALDB_DATABASE}\`;`);
	await db.use({ namespace: SURREALDB_NAMESPACE, database: SURREALDB_DATABASE });
	await applyMigrations(db);
	await db.query(
		'DELETE account; DELETE statement; DELETE file; DELETE category; DELETE transaction; DELETE tag; DELETE tagged; DELETE budget; DELETE settings;'
	);
	await createDemoDataset(db, {
		transactions: 320,
		startDate: DateTime.fromISO(demoStartDate),
		endDate: DateTime.fromISO(demoEndDate),
		includeIncome: true,
		includeChildcare: true
	});

	const budgets = [
		{
			name: 'Core Living',
			year: previousCompleteYear,
			amount: 70_000 * 100,
			categoryNames: ['Housing', 'Utilities', 'Groceries']
		},
		{
			name: 'Transport',
			year: previousCompleteYear,
			amount: 12_000 * 100,
			categoryNames: ['Auto', 'Gas & Fuel']
		},
		{
			name: 'Lifestyle',
			year: previousCompleteYear,
			amount: 18_000 * 100,
			categoryNames: ['Dining Out', 'Entertainment', 'Shopping']
		},
		{
			name: 'Family + Health',
			year: previousCompleteYear,
			amount: 35_000 * 100,
			categoryNames: ['Childcare', 'Healthcare', 'Fitness']
		}
	];

	await db.query('DELETE budget;');
	const [allCategories] = await db.query<[Array<{ id: unknown; name: string }>]>(
		'SELECT id, name FROM category;'
	);
	const categoryIdByName = new Map(allCategories.map((category) => [category.name, category.id]));

	for (const budget of budgets) {
		const categories = budget.categoryNames
			.map((name) => categoryIdByName.get(name))
			.filter((value): value is NonNullable<typeof value> => value !== undefined);
		await db.create(new Table('budget')).content({
			name: budget.name,
			year: budget.year,
			amount: budget.amount,
			categories
		});
	}

	await db.close();
}

test.describe('README screenshots', () => {
	test.beforeAll(async () => {
		await seedDemoData();
	});

	test('@screenshots capture README app screenshots', async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1000 });

		// 1) Transactions with filters + category dropdown open
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
		await page.getByRole('button', { name: 'Month Filter' }).click();
		await page.getByRole('checkbox', { name: 'January' }).click({ modifiers: ['Alt'] });
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-dropdown-overlay]')).not.toBeAttached();
		await page.getByRole('button', { name: 'Category Filter' }).click();
		await expect(page.getByRole('menu')).toBeVisible();
		await writeScreenshot(page, 'transactions-filtered-with-category-dropdown.png');
		await page.keyboard.press('Escape');

		// 2) Transactions in dark mode
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
		await writeScreenshot(page, 'transactions-dark-mode.png');
		await page.emulateMedia({ colorScheme: 'light' });

		// 3) Bulk edit modal
		await page.getByRole('button', { name: 'Bulk edit filtered transactions' }).click();
		await expect(page.getByRole('dialog', { name: 'Bulk edit transactions' })).toBeVisible();
		await writeScreenshot(page, 'transactions-bulk-edit-modal.png');
		await page.keyboard.press('Escape');

		// 4) Budget chart screen for previous complete year (monthly)
		await page.goto('/reports');
		await expect(page.getByRole('heading', { name: 'Budget Reports' })).toBeVisible();
		await expect(page.getByText('Core Living').first()).toBeVisible();
		await page.getByRole('button', { name: 'Monthly' }).click();
		await expect(page.getByText('Monthly Spending')).toBeVisible();
		await expect(page.locator('#year-filter')).toBeVisible();
		await page.selectOption('#year-filter', `${previousCompleteYear}`);
		await writeScreenshot(page, 'budget-reports-monthly.png');
	});
});
