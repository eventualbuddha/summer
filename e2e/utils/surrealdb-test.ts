/* eslint-disable no-empty-pattern */
import { expect, test as base } from '@playwright/test';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { type AddressInfo, createServer, Socket } from 'node:net';
import Surreal, { RecordId } from 'surrealdb';

export { expect };

async function getFreePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, resolve));
	const port = (server.address() as AddressInfo).port;
	server.close();
	return port;
}

async function waitForPortListening(hostname: string, port: number): Promise<void> {
	return new Promise<void>((resolve) => {
		const interval = setInterval(() => {
			const socket = new Socket();
			socket.on('error', () => {});
			socket.connect(port, hostname, () => {
				clearInterval(interval);
				socket.destroy();
				resolve();
			});
		}, 100);
	});
}

export interface Account {
	id: RecordId<'account'>;
	name: string;
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
	description?: string;
}

export const test = base.extend<{
	port: number;
	hostname: string;
	surreal: Surreal;
	surrealProcess: ChildProcessWithoutNullStreams;
	createAccount: (data?: Partial<Account>) => Promise<Account>;
	createStatement: (data?: Partial<Statement>) => Promise<Statement>;
	createFile: (data?: Partial<File>) => Promise<File>;
	createCategory: (data?: Partial<Category>) => Promise<Category>;
	createTransaction: (data?: Partial<Transaction>) => Promise<Transaction>;
}>({
	hostname: '127.0.0.1',

	port: async ({}, use) => {
		const port = await getFreePort();
		await use(port);
	},

	surrealProcess: async ({ hostname, port }, use) => {
		const surrealProcess = spawn(
			'surreal',
			['start', 'memory', '--bind', `${hostname}:${port}`, '--unauthenticated'],
			{ stdio: 'pipe' }
		);

		await waitForPortListening(hostname, port);
		await use(surrealProcess);
		surrealProcess.kill();
	},

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	surreal: async ({ surrealProcess, hostname, port }, use) => {
		const surreal = new Surreal();
		await surreal.connect(`ws://${hostname}:${port}`);
		await surreal.use({ namespace: 'ns', database: 'db' });
		await use(surreal);
		await surreal.close();
	},

	createAccount: async ({ surreal }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('account', {
						id: data.id,
						name: data.name ?? 'Credit Card',
						type: data.type ?? 'credit'
					})
				)[0] as unknown as Account
		);
	},

	createStatement: async ({ surreal, createAccount }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('statement', {
						id: data.id,
						account: data.account ?? (await createAccount({})).id,
						date: data.date ?? new Date()
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
						ordinal: data.ordinal ?? 1
					})
				)[0] as unknown as Category
		);
	},

	createTransaction: async ({ surreal, createStatement, createCategory }, use) => {
		await use(
			async (data = {}) =>
				(
					await surreal.create('transaction', {
						id: data.id,
						amount: data.amount ?? -100,
						statement: data.statement ?? (await createStatement()).id,
						category: data.category ?? (await createCategory()).id,
						date: data.date ?? new Date(),
						description: data.description,
						statementDescription: data.statementDescription ?? 'STATEMENT DESCRIPTION'
					})
				)[0] as unknown as Transaction
		);
	}
});
