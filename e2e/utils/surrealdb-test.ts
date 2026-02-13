import { test as base, expect } from '@playwright/test';
import Surreal, { RecordId } from 'surrealdb';
import { waitFor } from './helpers';

export { expect };

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

export interface Tagged {
	id: RecordId<'tagged'>;
	name: string;
	year?: number;
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
	tagTransaction: (transactionId: Transaction['id'], name: string, year?: number) => Promise<void>;
	pageHelpers: {
		waitForTaggedTransaction(
			transactionId: Transaction['id'],
			tags: Array<{ name: string; year?: number }>
		): Promise<void>;
	};
}>({
	surreal: async ({ baseURL }, use) => {
		const surreal = new Surreal();
		await surreal.connect('ws://127.0.0.1:18000/rpc');
		await surreal.use({ namespace: 'ns', database: 'db' });

		// Load schema
		const schema = await (await fetch(`${baseURL}/schema.surql`)).text();
		await surreal.query(schema);

		await use(surreal);

		// Clean up: delete all data after each test
		await surreal.query('REMOVE DATABASE db');
		await surreal.close();
	},

	createAccount: async ({ surreal }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('account', {
						id: data.id,
						name: data.name ?? 'Credit Card',
						number: data.number ?? '0123456789',
						type: data.type ?? 'credit'
					})
				)[0] as unknown as Account
		);
	},

	createStatement: async ({ surreal, createAccount, createFile }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('statement', {
						id: data.id,
						account: data.account ?? (await createAccount({})).id,
						date: data.date ?? new Date(),
						file: data.file ?? (await createFile({})).id
					})
				)[0] as unknown as Statement
		);
	},

	createFile: async ({ surreal }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('file', {
						id: data.id,
						name: data.name ?? 'file.pdf',
						data: data.data ?? Uint8Array.of().buffer
					})
				)[0] as unknown as File
		);
	},

	createCategory: async ({ surreal }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('category', {
						id: data.id,
						name: data.name ?? 'General',
						color: data.color ?? 'red-200',
						emoji: data.emoji ?? '🛍️',
						ordinal: data.ordinal
					})
				)[0] as unknown as Category
		);
	},

	createTransaction: async ({ surreal, createStatement, createCategory }, use) => {
		await use(async (data = {}) => {
			const date = data.date ?? new Date();
			return (
				await surreal.create('transaction', {
					id: data.id,
					amount: data.amount ?? -100,
					statement: data.statement ?? (await createStatement({ date })).id,
					category: data.category ?? (await createCategory()).id,
					date,
					description: data.description,
					statementDescription: data.statementDescription ?? 'STATEMENT DESCRIPTION',
					type: data.type ?? 'unknown'
				})
			)[0] as unknown as Transaction;
		});
	},

	createBudget: async ({ surreal, createCategory }, use) => {
		await use(async (data = {}) => {
			const categories = data.categories ?? [(await createCategory()).id];
			return (
				await surreal.create('budget', {
					id: data.id,
					name: data.name ?? '2025 Budget',
					year: data.year ?? 2025,
					amount: data.amount ?? 1000,
					categories
				})
			)[0] as unknown as Budget;
		});
	},

	tagTransaction: async ({ surreal }, use) => {
		await use(async (transactionId, name, year) => {
			const tag =
				(await surreal.query<[[Tag]]>('SELECT * FROM tag WHERE name = $name', { name }))[0]?.[0] ??
				((await surreal.create('tag', { name }))?.[0] as unknown as Tag);
			await surreal.relate(transactionId, 'tagged', tag.id, { year });
		});
	},

	pageHelpers: async ({ surreal }, use) =>
		await use({
			async waitForTaggedTransaction(transactionId, tags) {
				await waitFor(async () => {
					const [taggedRecords] = await surreal.query<
						[Array<{ tags: Array<{ name: string; year?: number }> }>]
					>(
						`
						SELECT ->(
							SELECT ->(SELECT name FROM tag)[0].name AS name, year
								FROM tagged) AS tags
						FROM transaction
						WHERE id = $transactionId`,
						{
							transactionId
						}
					);
					return (
						taggedRecords.length === 1 &&
						taggedRecords[0].tags.length === tags.length &&
						taggedRecords[0].tags.every((tag) =>
							tags.some((t) => tag.name === t.name && tag.year === t.year)
						)
					);
				});
			}
		})
});
