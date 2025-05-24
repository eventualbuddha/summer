import { Result } from '@badrap/result';
import { Gap, PreparedQuery, RecordId, Surreal } from 'surrealdb';
import { z } from 'zod';
import type { Sorting, SortingDirection } from './state.svelte';
import { NEVER_PROMISE } from './utils/promises';
import type { StatementMetadata } from './import/StatementMetadata';
import type { ImportedTransaction } from './import/ImportedTransaction';

export interface Transactions {
	count: number;
	total: number;
	totalByYear: Array<{ year: number; total: number }>;
	totalByCategory: Array<{ category: Category; total: number }>;
	totalByAccount: Array<{ account: Account; total: number }>;
	list: Transaction[];
}

function amountsToMatchForSearchTerm(searchTerm: string): Array<number> {
	const match = searchTerm.match(/^([-+])?(\d{1,10}\.\d{2})$/);
	if (!match) return [];
	const [, sign, amount] = match;
	const amountNumber = parseFloat(amount as string) * 100;
	return sign === '-'
		? [-amountNumber]
		: sign === '+'
			? [amountNumber]
			: [-amountNumber, amountNumber];
}

export async function use(
	surreal: Surreal,
	{ namespace, database, init }: { namespace: string; database: string; init: boolean }
): Promise<boolean> {
	let hasNamespace = false;
	let hasDatabase = false;

	const [{ namespaces }] =
		await surreal.query<[{ namespaces: Record<string, string> }]>('INFO FOR ROOT;');

	if (Object.prototype.hasOwnProperty.call(namespaces, namespace)) {
		hasNamespace = true;
		await surreal.use({ namespace });

		const [{ databases }] =
			await surreal.query<[{ databases: Record<string, string> }]>('INFO FOR NS;');
		if (Object.prototype.hasOwnProperty.call(databases, database)) {
			hasDatabase = true;
		}
	}

	await surreal.use({ namespace, database });

	if ((init && !hasNamespace) || !hasDatabase) {
		const schema = await (await fetch('/schema.surql')).text();
		await surreal.query(schema);
	}

	return true;
}

const getTransactionsQueryBindings = {
	years: new Gap<number[]>(),
	months: new Gap<number[]>(),
	categories: new Gap<Category['id'][]>(),
	accounts: new Gap<Account['id'][]>(),
	searchTerm: new Gap<string>(),
	amounts: new Gap<number[]>(),
	stickyTransactionIds: new Gap<Transaction['id'][]>(),
	orderByField: new Gap<string>()
} as const;

function buildGetTransactionQuery(sortDirection: SortingDirection) {
	return new PreparedQuery(
		`
		let $transactions = (
          SELECT id.id(),
							 date,
							 amount,
							 category AND category.id() as categoryId,
							 category AND category.ordinal as categoryOrdinal,
							 statement.account.id() as accountId,
							 description,
							 statementDescription,
							 statement.id() as statementId,
							 statement.date.year() as year,
							 type::field($orderByField) as orderField
            FROM transaction
           WHERE id.id() IN $stickyTransactionIds
              OR (
                statement.date.year() IN $years
                AND statement.date.month() IN $months
                AND category AND category.id() IN $categories
      					AND statement.account AND statement.account.id() IN $accounts
      					AND (
      					  (!$searchTerm AND !$amounts)
      					  OR (description AND description.lowercase().contains($searchTerm.lowercase()))
      					  OR (statementDescription AND statementDescription.lowercase().contains($searchTerm.lowercase()))
     							OR (amount IN $amounts)
      			    )
              )
     		ORDER BY orderField COLLATE ${sortDirection === 'asc' ? 'ASC' : 'DESC'}
		);

		let $countable = $transactions.filter(|$transaction| $transaction.categoryId != none);

		$countable.fold(0, |$amount, $transaction| $amount + $transaction.amount);
		$transactions;

		SELECT year, math::sum(amount) as total FROM $countable GROUP BY year;
		SELECT categoryId, categoryOrdinal, math::sum(amount) as total FROM $countable GROUP BY categoryId;
		SELECT accountId, math::sum(amount) as total FROM $countable GROUP BY accountId;
    `,
		getTransactionsQueryBindings
	);
}

const getTransactionsAscendingQuery = buildGetTransactionQuery('asc');
const getTransactionsDescendingQuery = buildGetTransactionQuery('desc');

export async function getTransactions(
	options: GetTransactionsOptions,
	surreal: Surreal,
	abortSignal: AbortSignal
): Promise<Transactions> {
	const b = getTransactionsQueryBindings;
	console.time('getTransactions: fetch from surrealdb');

	function onAbort() {
		console.timeEnd('getTransactions: fetch from surrealdb');
		abortSignal.removeEventListener('abort', onAbort);
	}
	abortSignal.addEventListener('abort', onAbort);

	const data = await surreal.query(
		options.sort.direction === 'asc'
			? getTransactionsAscendingQuery
			: getTransactionsDescendingQuery,
		[
			b.stickyTransactionIds.fill([...options.stickyTransactionIds]),
			b.years.fill(options.years),
			b.months.fill(options.months),
			b.categories.fill(options.categories.map((c) => c.id)),
			b.accounts.fill(options.accounts.map((c) => c.id)),
			b.searchTerm.fill(options.searchTerm),
			b.amounts.fill(amountsToMatchForSearchTerm(options.searchTerm)),
			b.orderByField.fill(options.sort.field)
		]
	);
	abortSignal.removeEventListener('abort', onAbort);
	if (abortSignal.aborted) return NEVER_PROMISE;

	console.timeEnd('getTransactions: fetch from surrealdb');
	console.time('getTransactions: parse response');
	const [, , total, transactions, totalByYear, totalByCategoryId, totalByAccountId] = z
		.tuple([
			z.any(),
			z.any(),
			z.number(),
			z.array(TransactionRecordSchema),
			z.array(z.object({ year: z.number(), total: z.number() })),
			z.array(z.object({ categoryId: z.string(), categoryOrdinal: z.number(), total: z.number() })),
			z.array(z.object({ accountId: z.string(), total: z.number() }))
		])
		.parse(data);
	console.timeEnd('getTransactions: parse response');

	return {
		count: transactions.length,
		total,
		totalByYear: options.years.map((year) => ({
			year,
			total: totalByYear.find((item) => item.year === year)?.total ?? 0
		})),
		totalByCategory: options.categories.map((category) => ({
			category,
			total: totalByCategoryId.find((item) => item.categoryId === category.id)?.total ?? 0
		})),
		totalByAccount: options.accounts.map((account) => ({
			account,
			total: totalByAccountId.find((item) => item.accountId === account.id)?.total ?? 0
		})),
		list: transactions
	};
}

export interface File {
	id: string;
	name: string;
	data: ArrayBuffer;
}

export const FileSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	data: z.instanceof(ArrayBuffer)
});

export interface Statement {
	id: string;
	account: Account;
	date: Date;
	file: string;
}

export const StatementSchema = z.object({
	id: z.string().nonempty(),
	account: z.string().nonempty(),
	date: z.instanceof(Date),
	file: z.string().nonempty()
});

export interface Transaction {
	id: string;
	date: Date;
	amount: number;
	categoryId?: string;
	statementId: string;
	description?: string;
	statementDescription: string;
}

export const TransactionRecordSchema = z.object({
	id: z.string().nonempty(),
	date: z.instanceof(Date),
	amount: z.number(),
	categoryId: z.string().optional(),
	statementId: z.string(),
	description: z.string().optional(),
	statementDescription: z.string()
});

export interface Account {
	id: string;
	type: string;
	number?: string;
	name: string;
}

export const AccountSchema = z.object({
	id: z.string().nonempty(),
	type: z.string().nonempty(),
	number: z.string().nonempty().optional(),
	name: z.string().nonempty()
});

export interface Category {
	id: string;
	name: string;
	emoji: string;
	color: string;
	ordinal: number;
}

export const CategorySchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	emoji: z.string(),
	color: z.string(),
	ordinal: z.number().min(0)
});

export interface FilterOptions {
	years: number[];
	months: number[];
	categories: Category[];
	accounts: Account[];
	searchTerm: string;
}

export const FilterOptionsSchema = z.object({
	years: z.array(z.number().min(0)),
	months: z.array(z.number().min(0)),
	categories: z.array(CategorySchema),
	accounts: z.array(AccountSchema),
	searchTerm: z.string()
});

export interface GetTransactionsOptions extends FilterOptions {
	sort: Sorting;
	stickyTransactionIds: Iterable<Transaction['id']>;
}

const getFilterOptionsQuery = new PreparedQuery(
	`
    (SELECT date.year() as year FROM statement ORDER BY year DESC).year.distinct();
    (SELECT date.month() as month FROM statement ORDER BY month ASC).month.distinct();
    SELECT id.id(), name, emoji, color, ordinal FROM category ORDER BY ordinal ASC;
		SELECT id.id(), type, number, name FROM account ORDER BY type ASC, name ASC;
    `
);

export async function getFilterOptions(surreal: Surreal): Promise<FilterOptions> {
	const [years, months, categories, accounts] = await surreal.query(getFilterOptionsQuery);
	return FilterOptionsSchema.parse({
		years,
		months,
		categories,
		accounts,
		searchTerm: ''
	});
}

export async function getDefaultCategoryId(surreal: Surreal): Promise<string | undefined> {
	const [settings] = await surreal.query<[{ defaultCategoryId?: string }]>(
		'SELECT defaultCategory?.id() as defaultCategoryId FROM ONLY settings:global'
	);
	return settings?.defaultCategoryId;
}

export async function updateDefaultCategoryId(
	surreal: Surreal,
	newDefaultCategoryId: string | undefined
) {
	await surreal.query('UPSERT settings:global SET defaultCategory = $defaultCategory', {
		defaultCategory: newDefaultCategoryId ? new RecordId('category', newDefaultCategoryId) : null
	});
}

export async function importStatement(
	surreal: Surreal,
	filename: string,
	pdfData: Uint8Array,
	source: string,
	metadata: StatementMetadata,
	transactions: readonly ImportedTransaction[]
): Promise<Result<{ account: Account; statement: Statement }>> {
	const results = await surreal.queryRaw(
		`
BEGIN TRANSACTION;

LET $account = (
    SELECT * FROM ONLY account
     WHERE source = $source
       AND number = $accountNumber
       AND type = $accountType
     LIMIT 1
) ?? (
    CREATE ONLY account SET
        source = $source,
        number = $accountNumber,
        name = $accountName,
        type = $accountType
);

{
  id: $account.id.id(),
  name: $account.name,
  source: $account.source,
  number: $account.number,
  type: $account.type,
};

LET $file = CREATE ONLY file SET
    name = $filename,
    data = $pdfData;

LET $existingStatements = (
		SELECT id FROM statement
		WHERE account = $account.id
			AND date = $statementDate
).len();

IF $existingStatements == 1 {
		THROW 'Statement already exists for this account and date.';
};

LET $statement = CREATE ONLY statement SET
    account = $account.id,
    date = $statementDate,
    file = $file.id;

{
  id: $statement.id.id(),
  account: $statement.account.id(),
  date: $statement.date,
  file: $statement.file.id(),
};

LET $defaultCategory = (SELECT defaultCategory FROM ONLY settings:global).defaultCategory;

IF !$defaultCategory {
    THROW 'No default category set.';
};

FOR $t IN $transactions {
    CREATE ONLY transaction SET
        statement = $statement.id,
        date = $t.date,
        amount = $t.amount,
        statementDescription = $t.statementDescription,
        category = $defaultCategory,
        type = $t.type;
};

COMMIT TRANSACTION;
		`,
		{
			source,
			accountNumber: metadata.account,
			accountName: metadata.accountName,
			accountType: metadata.accountType,
			filename,
			pdfData,
			statementDate: metadata.closingDate.toJSDate(),
			transactions: transactions.map((t) => ({
				date: t.date.toJSDate(),
				amount: t.amount,
				statementDescription: t.statementDescription,
				type: t.kind
			}))
		}
	);

	const errors = results.filter((r) => r.status === 'ERR');
	const errorMessage = errors
		.find(({ status, result }) => status === 'ERR' && !/failed transaction/.test(result))
		?.result?.replace(/^An error occurred:\s*/, '');

	if (errors.length > 0) {
		return Result.err(new Error(errorMessage));
	}

	const [, accountResult, , , , , statementResult] = z
		.tuple([
			// LET $account = …
			z.unknown(),
			// Account record.
			z.object({ status: z.union([z.literal('OK'), z.literal('ERR')]), result: AccountSchema }),
			// LET $file = …
			z.unknown(),
			// LET $existingStatement = …
			z.unknown(),
			// IF $existingStatement { … }
			z.unknown(),
			// LET $statement = …
			z.unknown(),
			// Statement record.
			z.object({ status: z.union([z.literal('OK'), z.literal('ERR')]), result: StatementSchema }),
			// LET $defaultCategory = …
			z.unknown(),
			// IF !$defaultCategory { … }
			z.unknown(),
			// FOR $t IN $transactions { … }
			z.unknown()
		])
		.parse(results);

	if (accountResult.status !== 'OK' || statementResult.status !== 'OK') {
		throw new Error('Results should be OK');
	}

	return Result.ok({
		account: accountResult.result,
		statement: {
			...statementResult.result,
			account: accountResult.result
		}
	});
}
