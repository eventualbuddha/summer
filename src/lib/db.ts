import { Surreal } from 'surrealdb';

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

export async function getTransactions(
	filters: FilterOptions,
	surreal: Surreal
): Promise<Transactions> {
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
					 AND (
						  (!$searchTerm AND !$amounts)
						  OR (description AND description.lowercase().contains($searchTerm))
						  OR (statementDescription AND statementDescription.lowercase().contains($searchTerm))
							OR (amount IN $amounts)
			     )
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
				accounts: filters.accounts.map((account) => account.id),
				searchTerm: filters.searchTerm.toLowerCase(),
				amounts: amountsToMatchForSearchTerm(filters.searchTerm)
			}
		);

	return {
		count: transactions.length,
		total,
		totalByYear: filters.years.map((year) => ({
			year,
			total: totalByYear.find((item) => item.year === year)?.total ?? 0
		})),
		totalByCategory: filters.categories.map((category) => ({
			category,
			total: totalByCategoryId.find((item) => item.categoryId === category.id)?.total ?? 0
		})),
		totalByAccount: filters.accounts.map((account) => ({
			account,
			total: totalByAccountId.find((item) => item.accountId === account.id)?.total ?? 0
		})),
		list: transactions.map((t) => ({
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
	searchTerm: string;
}

export async function getFilterOptions(surreal: Surreal): Promise<FilterOptions> {
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
		accounts,
		searchTerm: ''
	};
}
