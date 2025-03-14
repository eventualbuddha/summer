import { Surreal } from 'surrealdb';

export async function connect(): Promise<Surreal> {
	const surreal = new Surreal();

	await surreal.connect('ws://localhost:8000');
	await surreal.use({ namespace: 'test', database: 'test' });

	return surreal;
}

export async function getTransactions(filters: FilterOptions): Promise<{
	count: number;
	total: number;
	totalByYear: Array<{ year: number; total: number }>;
	totalByCategory: Array<{ category: Category; total: number }>;
	totalByAccount: Array<{ account: Account; total: number }>;
	transactions: Transaction[];
}> {
	const surreal = await connect();
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
							 statement.date.year() as year
          FROM transaction
         WHERE statement.date.year() IN $years
           AND statement.date.month() IN $months
           AND category AND category.id() IN $categories
					 AND statement.account AND statement.account.id() IN $accounts
			ORDER BY date DESC
		);

		$transactions.fold(0, |$amount, $transaction| $amount + $transaction.amount);
		$transactions;

		SELECT year, math::sum(amount) as total FROM $transactions GROUP BY year;
		SELECT categoryId, categoryOrdinal, math::sum(amount) as total FROM $transactions GROUP BY categoryId;
		SELECT accountId, math::sum(amount) as total FROM $transactions GROUP BY accountId;
  `,
			{
				years: filters.years,
				months: filters.months,
				categories: filters.categories.map((category) => category.id),
				accounts: filters.accounts.map((account) => account.id)
			}
		);

	return {
		count: transactions.length,
		total,
		totalByYear: totalByYear.sort((a, b) => b.year - a.year),
		totalByCategory: totalByCategoryId
			.sort((a, b) => a.categoryOrdinal - b.categoryOrdinal)
			.map(({ categoryId, total }) => ({
				category: filters.categories.find((category) => category.id === categoryId)!,
				total
			})),
		totalByAccount: totalByAccountId
			.map(({ accountId, total }) => ({
				account: filters.accounts.find((account) => account.id === accountId)!,
				total
			}))
			.sort(
				(a, b) =>
					a.account.type.localeCompare(b.account.type) ||
					a.account.name.localeCompare(b.account.name)
			),
		transactions: transactions.map((t) => ({
			id: t.id,
			date: t.date,
			amount: t.amount,
			category: filters.categories.find((category) => category.id === t.categoryId)!,
			account: filters.accounts.find((account) => account.id === t.accountId)!,
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
}

export async function getFilterOptions(): Promise<FilterOptions> {
	const surreal = await connect();
	const [years, months, categories, accounts] = await surreal.query<
		[number[], number[], Category[], Account[]]
	>(`
    (SELECT date.year() as year FROM statement ORDER BY year DESC).year.distinct();
    (SELECT date.month() as month FROM statement ORDER BY month ASC).month.distinct();
    SELECT id.id(), name, emoji, color, ordinal FROM category ORDER BY ordinal ASC;
		SELECT id.id(), type, name FROM account ORDER BY type ASC, name ASC;
  `);
	return {
		years,
		months,
		categories,
		accounts
	};
}
