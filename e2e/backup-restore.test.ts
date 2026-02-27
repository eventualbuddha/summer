import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DateTime, Surreal } from 'surrealdb';
import { backup } from '../bin/backup';
import { restore } from '../bin/restore';
import { expect, test } from './utils/surrealdb-test';

const SURREALDB_URL = process.env.SURREALDB_URL!;
const RESTORE_DB = 'e2e-restore';

// Query the restored database and return the result of a single statement.
async function queryRestoreDb<T>(query: string): Promise<T> {
	const db = new Surreal();
	await db.connect(SURREALDB_URL);
	await db.use({ namespace: 'e2e', database: RESTORE_DB });
	try {
		const [result] = await db.query<[T]>(query);
		return result;
	} finally {
		await db.close();
	}
}

test.describe('backup and restore', () => {
	let backupDir: string;

	test.beforeEach(async () => {
		backupDir = await mkdtemp(join(tmpdir(), 'summer-backup-test-'));
	});

	test.afterEach(async () => {
		await rm(backupDir, { recursive: true, force: true });

		const db = new Surreal();
		await db.connect(SURREALDB_URL);
		await db.use({ namespace: 'e2e' });
		await db.query(`REMOVE DATABASE IF EXISTS \`${RESTORE_DB}\`;`);
		await db.close();
	});

	test('round-trips records and relations', async ({
		createAccount,
		createCategory,
		createFile,
		createStatement,
		createTransaction,
		tagTransaction
	}) => {
		const category = await createCategory({ name: 'Groceries', color: 'green-200', emoji: '🛒' });
		const account = await createAccount({ name: 'Checking' });
		const file = await createFile({ name: 'june.csv', data: new Uint8Array([1, 2, 3]).buffer });
		const statement = await createStatement({
			account: account.id,
			file: file.id,
			date: new Date('2025-06-15T12:00:00Z')
		});
		const tx = await createTransaction({
			statement: statement.id,
			category: category.id,
			amount: -2500,
			date: new Date('2025-06-15T12:00:00Z'),
			statementDescription: 'WHOLE FOODS',
			type: 'Charge'
		});
		await tagTransaction(tx.id, 'groceries');

		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const accounts = await queryRestoreDb<Array<{ name: string }>>('SELECT name FROM account');
		expect(accounts).toHaveLength(1);
		expect(accounts[0].name).toBe('Checking');

		const categories = await queryRestoreDb<Array<{ name: string }>>('SELECT name FROM category');
		expect(categories).toHaveLength(1);
		expect(categories[0].name).toBe('Groceries');

		const transactions = await queryRestoreDb<Array<{ amount: number; type: string }>>(
			'SELECT amount, type FROM transaction'
		);
		expect(transactions).toHaveLength(1);
		expect(transactions[0].amount).toBe(-2500);
		expect(transactions[0].type).toBe('Charge');

		const taggedRows = await queryRestoreDb<Array<{ tags: string[] }>>(
			'SELECT ->tagged->tag.name AS tags FROM transaction'
		);
		expect(taggedRows[0].tags).toContain('groceries');
	});

	test('preserves record IDs after restore', async ({ createAccount }) => {
		const account = await createAccount({ name: 'Savings' });

		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const accounts = await queryRestoreDb<Array<{ id: string; name: string }>>(
			'SELECT id, name FROM account'
		);
		expect(accounts).toHaveLength(1);
		expect(String(accounts[0].id)).toBe(String(account.id));
	});

	test('preserves dates', async ({ createStatement }) => {
		const date = new Date('2025-03-15T12:00:00Z');
		await createStatement({ date });

		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const statements = await queryRestoreDb<Array<{ date: Date | DateTime }>>(
			'SELECT date FROM statement'
		);
		expect(statements).toHaveLength(1);
		const restored = statements[0].date;
		const restoredDate = restored instanceof DateTime ? restored.toDate() : restored;
		expect(restoredDate.toDateString()).toBe(date.toDateString());
	});

	test('preserves binary file data', async ({ createFile }) => {
		const data = new Uint8Array([0x01, 0x02, 0x03, 0xff]).buffer;
		await createFile({ name: 'document.pdf', data });

		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const files =
			await queryRestoreDb<Array<{ name: string; data: ArrayBuffer }>>('SELECT * FROM file');
		expect(files).toHaveLength(1);
		expect(files[0].name).toBe('document.pdf');
		// Wrap in Uint8Array to compare just the meaningful bytes regardless of underlying buffer size
		expect(new Uint8Array(files[0].data)).toEqual(new Uint8Array(data));
	});

	test('all migrations are applied to restored database', async () => {
		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const migrations = await queryRestoreDb<Array<{ name: string }>>(
			'SELECT name FROM migration ORDER BY name'
		);
		const names = migrations.map((m) => m.name);
		expect(names).toContain('001_initial_schema');
		expect(names).toContain('002_tag_cleanup_event');
		expect(names).toContain('003_replace_tag_year_with_effective_date');
		expect(names).toContain('004_fix_category_ordinal_default');
	});

	test('overwrites database when overwriteDatabase is true', async ({ createAccount }) => {
		await createAccount({ name: 'Original' });
		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });

		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});
		// Restore again — without overwrite this would leave duplicate data
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB,
			overwriteDatabase: true
		});

		const accounts = await queryRestoreDb<Array<{ name: string }>>('SELECT name FROM account');
		expect(accounts).toHaveLength(1);
		expect(accounts[0].name).toBe('Original');
	});

	test('empty database produces a restorable backup', async () => {
		await backup({ backupPath: backupDir, url: SURREALDB_URL, namespace: 'e2e', database: 'e2e' });
		await restore({
			backupPath: backupDir,
			url: SURREALDB_URL,
			namespace: 'e2e',
			database: RESTORE_DB
		});

		const transactions = await queryRestoreDb<unknown[]>('SELECT * FROM transaction');
		expect(transactions).toHaveLength(0);

		const migrations = await queryRestoreDb<unknown[]>('SELECT * FROM migration');
		expect(migrations.length).toBeGreaterThan(0);
	});
});
