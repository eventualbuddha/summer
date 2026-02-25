import { test as base, expect } from '@playwright/test';
import { Surreal, Table, RecordId } from 'surrealdb';
import { waitFor } from './helpers';
import { applyMigrations } from '../../src/lib/server/migrations';
import assert from 'node:assert';

export { expect };

const SURREALDB_URL = process.env.SURREALDB_URL;
assert(SURREALDB_URL, 'SURREALDB_URL is not set');

async function clearAllData(surreal: Surreal) {
	await surreal.query(
		'DELETE account; DELETE statement; DELETE file; DELETE category; DELETE transaction; DELETE tag; DELETE tagged; DELETE budget; DELETE settings;'
	);
}

export interface Account {
	id: RecordId<'account'>;
	name: string;
	number?: string;
	type: string;
}

export interface Statement {
	id: RecordId<'statement'>;
	account: RecordId<'account'>;
	file: RecordId<'file'>;
	date: Date;
}

export interface File {
	id: RecordId<'file'>;
	name: string;
	data: ArrayBuffer;
}

export interface Category {
	id: RecordId<'category'>;
	name: string;
	color: string;
	emoji: string;
	ordinal: number;
}

export interface Transaction {
	id: RecordId<'transaction'>;
	statement: RecordId<'statement'>;
	category: RecordId<'category'>;
	amount: number;
	date: Date;
	statementDescription: string;
	type: string;
	description?: string;
}

export interface Tag {
	id: RecordId<'tag'>;
	name: string;
}

export interface Budget {
	id: RecordId<'budget'>;
	name: string;
	year: number;
	amount: number;
	categories: RecordId<'category'>[];
}

export const test = base.extend<{
	surreal: Surreal;
	createAccount: (data?: Partial<Account>) => Promise<Account>;
	createStatement: (data?: Partial<Statement>) => Promise<Statement>;
	createFile: (data?: Partial<File>) => Promise<File>;
	createCategory: (data?: Partial<Category>) => Promise<Category>;
	createTransaction: (data?: Partial<Transaction>) => Promise<Transaction>;
	createBudget: (data?: Partial<Budget>) => Promise<Budget>;
	tagTransaction: (transactionId: Transaction['id'], name: string) => Promise<void>;
	pageHelpers: {
		waitForTaggedTransaction(transactionId: Transaction['id'], tags: string[]): Promise<void>;
		waitForConnection(): Promise<void>;
	};
}>({
	// eslint-disable-next-line no-empty-pattern
	surreal: async ({}, use) => {
		const surreal = new Surreal();
		await surreal.connect(SURREALDB_URL);
		await surreal.query('DEFINE NAMESPACE IF NOT EXISTS e2e');
		await surreal.use({ namespace: 'e2e' });
		await surreal.query('DEFINE DATABASE IF NOT EXISTS e2e');
		await surreal.use({ namespace: 'e2e', database: 'e2e' });

		// Apply migrations to set up schema (idempotent)
		await applyMigrations(surreal);

		// Clear all data for a clean test start
		await clearAllData(surreal);

		await use(surreal);

		// Clear data after test (leave namespace/schema intact for tests without surreal fixture)
		await clearAllData(surreal);
		await surreal.close();
	},

	createAccount: async ({ surreal }, use) => {
		await use(async (data = {}) => {
			const record: Record<string, unknown> = {
				name: data.name ?? 'Credit Card',
				number: data.number ?? '0123456789',
				type: data.type ?? 'credit'
			};
			if (data.id !== undefined) record.id = data.id;
			return (
				(await surreal.create(new Table('account')).content(record)) as unknown as Account[]
			)[0];
		});
	},

	createStatement: async ({ surreal, createAccount, createFile }, use) => {
		await use(async (data = {}) => {
			const record: Record<string, unknown> = {
				account: data.account ?? (await createAccount({})).id,
				date: data.date ?? new Date(),
				file: data.file ?? (await createFile({})).id
			};
			if (data.id !== undefined) record.id = data.id;
			return (
				(await surreal.create(new Table('statement')).content(record)) as unknown as Statement[]
			)[0];
		});
	},

	createFile: async ({ surreal }, use) => {
		await use(async (data = {}) => {
			const record: Record<string, unknown> = {
				name: data.name ?? 'file.pdf',
				data: data.data ?? Uint8Array.of().buffer
			};
			if (data.id !== undefined) record.id = data.id;
			return ((await surreal.create(new Table('file')).content(record)) as unknown as File[])[0];
		});
	},

	createCategory: async ({ surreal }, use) => {
		await use(async (data = {}) => {
			const record: Record<string, unknown> = {
				name: data.name ?? 'General',
				color: data.color ?? 'red-200',
				emoji: data.emoji ?? '🛍️'
			};
			if (data.id !== undefined) record.id = data.id;
			if (data.ordinal !== undefined) record.ordinal = data.ordinal;
			return (
				(await surreal.create(new Table('category')).content(record)) as unknown as Category[]
			)[0];
		});
	},

	createTransaction: async ({ surreal, createStatement, createCategory }, use) => {
		await use(async (data = {}) => {
			const date = data.date ?? new Date();
			const record: Record<string, unknown> = {
				amount: data.amount ?? -100,
				statement: data.statement ?? (await createStatement({ date })).id,
				category: data.category ?? (await createCategory()).id,
				date,
				statementDescription: data.statementDescription ?? 'STATEMENT DESCRIPTION',
				type: data.type ?? 'unknown'
			};
			if (data.id !== undefined) record.id = data.id;
			if (data.description !== undefined) record.description = data.description;
			return (
				(await surreal.create(new Table('transaction')).content(record)) as unknown as Transaction[]
			)[0];
		});
	},

	createBudget: async ({ surreal, createCategory }, use) => {
		await use(async (data = {}) => {
			const categories = data.categories ?? [(await createCategory()).id];
			const record: Record<string, unknown> = {
				name: data.name ?? '2025 Budget',
				year: data.year ?? 2025,
				amount: data.amount ?? 1000,
				categories
			};
			if (data.id !== undefined) record.id = data.id;
			return (
				(await surreal.create(new Table('budget')).content(record)) as unknown as Budget[]
			)[0];
		});
	},

	tagTransaction: async ({ surreal }, use) => {
		await use(async (transactionId, name) => {
			const tag =
				(await surreal.query<[[Tag]]>('SELECT * FROM tag WHERE name = $name', { name }))[0]?.[0] ??
				((await surreal.create(new Table('tag')).content({ name })) as unknown as Tag[])[0];
			await surreal.relate(transactionId, new Table('tagged'), tag.id);
			const result = await surreal.query<[[{ tags: string[] }]]>(
				'SELECT ->tagged->tag.name as tags FROM $transactionId',
				{ transactionId }
			);
			const [[{ tags }]] = result;
			expect(tags).toContain(name);
		});
	},

	pageHelpers: async ({ surreal, page }, use) =>
		await use({
			async waitForConnection() {
				await page.waitForFunction(
					() => {
						const connectingText = document.body.textContent?.includes('Connecting to database');
						return !connectingText;
					},
					{ timeout: 30000 }
				);
			},
			async waitForTaggedTransaction(transactionId, tags) {
				await waitFor(async () => {
					const [taggedRecords] = await surreal.query<[Array<{ tags: string[] }>]>(
						`SELECT ->tagged->tag.name AS tags FROM $transactionId;`,
						{ transactionId }
					);
					return (
						taggedRecords.length === 1 &&
						taggedRecords[0].tags.length === tags.length &&
						taggedRecords[0].tags.every((tag) => tags.some((t) => tag === t))
					);
				});
			}
		})
});
