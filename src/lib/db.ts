import { Gap, PreparedQuery, Surreal } from 'surrealdb';
import type { Sorting, SortingDirection } from './state.svelte';

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
	orderByField: new Gap<string>()
} as const;

function buildGetTransactionQuery(sortDirection: SortingDirection) {
	return new PreparedQuery(
		`
		let $transactions = (
          SELECT id,
							 date,
							 amount,
							 category.id() as categoryId,
							 category.ordinal as categoryOrdinal,
							 statement.account.id() as accountId,
							 description,
							 statementDescription,
							 statement.date.year() as year,
							 type::field($orderByField) as orderField
            FROM transaction
           WHERE statement.date.year() IN $years
             AND statement.date.month() IN $months
             AND category AND category.id() IN $categories
					 AND statement.account AND statement.account.id() IN $accounts
					 AND (
						  (!$searchTerm AND !$amounts)
						  OR (description AND description.lowercase().contains($searchTerm))
						  OR (statementDescription AND statementDescription.lowercase().contains($searchTerm))
							OR (amount IN $amounts)
			     )
			ORDER BY orderField COLLATE ${sortDirection === 'asc' ? 'ASC' : 'DESC'}
		);

		$transactions.fold(0, |$amount, $transaction| $amount + $transaction.amount);
		$transactions;

		SELECT year, math::sum(amount) as total FROM $transactions GROUP BY year;
		SELECT categoryId, categoryOrdinal, math::sum(amount) as total FROM $transactions GROUP BY categoryId;
		SELECT accountId, math::sum(amount) as total FROM $transactions GROUP BY accountId;
    `,
		getTransactionsQueryBindings
	);
}

const getTransactionsAscendingQuery = buildGetTransactionQuery('asc');
const getTransactionsDescendingQuery = buildGetTransactionQuery('desc');

export async function getTransactions(
	options: GetTransactionsOptions,
	surreal: Surreal
): Promise<Transactions> {
	const b = getTransactionsQueryBindings;
	const [, total, transactions, totalByYear, totalByCategoryId, totalByAccountId] =
		await surreal.query<
			[
				void,
				number,
				TransactionRecord[],
				Array<{ year: number; total: number }>,
				Array<{ categoryId: string; categoryOrdinal: number; total: number }>,
				Array<{ accountId: string; total: number }>
			]
		>(
			options.sort.direction === 'asc'
				? getTransactionsAscendingQuery
				: getTransactionsDescendingQuery,
			[
				b.years.fill(options.years),
				b.months.fill(options.months),
				b.categories.fill(options.categories.map((c) => c.id)),
				b.accounts.fill(options.accounts.map((c) => c.id)),
				b.searchTerm.fill(options.searchTerm),
				b.amounts.fill(amountsToMatchForSearchTerm(options.searchTerm)),
				b.orderByField.fill(options.sort.field)
			]
		);

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
		list: transactions.map((t) => ({
			id: t.id,
			date: t.date,
			amount: t.amount,
			category: options.categories.find((category) => category.id === t.categoryId)!,
			account: options.accounts.find((account) => account.id === t.accountId)!,
			description: t.description,
			statementDescription: t.statementDescription
		}))
	};
}

export interface Transaction {
	id: string;
	date: Date;
	amount: number;
	category: Category;
	account: Account;
	description?: string;
	statementDescription: string;
}

interface TransactionRecord {
	id: string;
	date: Date;
	amount: number;
	categoryId: string;
	accountId: string;
	description?: string;
	statementDescription: string;
}

export interface Account {
	id: string;
	type: string;
	name: string;
}

export interface Category {
	id: string;
	name: string;
	emoji: string;
	color: string;
}

export interface FilterOptions {
	years: number[];
	months: number[];
	categories: Category[];
	accounts: Account[];
	searchTerm: string;
}

export interface GetTransactionsOptions extends FilterOptions {
	sort: Sorting;
}

const getFilterOptionsQuery = new PreparedQuery(
	`
    (SELECT date.year() as year FROM statement ORDER BY year DESC).year.distinct();
    (SELECT date.month() as month FROM statement ORDER BY month ASC).month.distinct();
    SELECT id.id(), name, emoji, color, ordinal FROM category ORDER BY ordinal ASC;
		SELECT id.id(), type, name FROM account ORDER BY type ASC, name ASC;
    `
);

export async function getFilterOptions(surreal: Surreal): Promise<FilterOptions> {
	const [years, months, categories, accounts] =
		await surreal.query<[number[], number[], Category[], Account[]]>(getFilterOptionsQuery);
	return {
		years,
		months,
		categories,
		accounts,
		searchTerm: ''
	};
}
