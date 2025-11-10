import { Gap, PreparedQuery, RecordId, Surreal } from 'surrealdb';
import { z } from 'zod';
import type { Sorting, SortingDirection } from './state.svelte';
import { NEVER_PROMISE } from './utils/promises';
import {
	parseTransactionDescriptionAndTags,
	type NewTagged
} from './db/updateTransactionDescription';

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
	descriptionFilter: new Gap<string>(),
	taggedFilter: new Gap<NewTagged[]>(),
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
							 ->(SELECT id.id() as id, ->(SELECT id.id() as id, name FROM tag LIMIT 1)[0] as tag, year FROM tagged) as tagged,
							 type::field($orderByField) as orderField
            FROM transaction
           WHERE id.id() IN $stickyTransactionIds
              OR (
                statement.date.year() IN $years
                AND statement.date.month() IN $months
                AND category AND category.id() IN $categories
      					AND statement.account AND statement.account.id() IN $accounts
      					AND (
      					  (!$descriptionFilter AND $taggedFilter.len() == 0 AND !$amounts)
      					  OR (description AND $descriptionFilter AND description.lowercase().contains($descriptionFilter.lowercase()))
      					  OR (statementDescription AND $descriptionFilter AND statementDescription.lowercase().contains($descriptionFilter.lowercase()))
     							OR (amount IN $amounts)
									OR count(->(tagged WHERE $taggedFilter.any(|$tag| out.name.lowercase().contains($tag.name.lowercase()) AND (!$tag.year OR year == $tag.year)))) > 0
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

	const searchTermAsDescriptionAndTagged = parseTransactionDescriptionAndTags(options.searchTerm);

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
			b.descriptionFilter.fill(searchTermAsDescriptionAndTagged.description),
			b.taggedFilter.fill(searchTermAsDescriptionAndTagged.tagged),
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
	tagged: Tagged[];
}

export const TransactionRecordSchema = z.object({
	id: z.string().nonempty(),
	date: z.instanceof(Date),
	amount: z.number(),
	categoryId: z.string().optional(),
	statementId: z.string(),
	description: z.string().optional(),
	statementDescription: z.string(),
	tagged: z.lazy(() => SortedTaggedArraySchema)
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

export interface Tag {
	id: string;
	name: string;
}

export const TagSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty()
});

export interface Tagged {
	id: string;
	tag: Tag;
	year?: number;
}

export const TaggedSchema = z.object({
	id: z.string().nonempty(),
	tag: TagSchema,
	year: z.number().min(0).optional()
});

export const SortedTaggedArraySchema = TaggedSchema.array().transform((tagged) =>
	tagged.sort((a, b) => a.tag.name.localeCompare(b.tag.name))
);

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

export async function getTags(surreal: Surreal): Promise<Tag[]> {
	const [tags] = await surreal.query('SELECT id.id() AS id, name FROM tag ORDER BY name ASC');
	return TagSchema.array().parse(tags);
}

export interface Budget {
	id: string;
	name: string;
	year: number;
	amount: number;
	categories: Category[];
}

export const BudgetSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	year: z.number(),
	amount: z.number(),
	categories: z.array(CategorySchema)
});

export async function getBudgets(surreal: Surreal): Promise<Budget[]> {
	const [budgets] = await surreal.query(
		'SELECT id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal} FROM budget ORDER BY year DESC'
	);
	return BudgetSchema.array().parse(budgets);
}

export async function getBudget(surreal: Surreal, id: string): Promise<Budget | null> {
	const [budget] = await surreal.query(
		'SELECT id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal} FROM ONLY budget:$id',
		{ id }
	);
	if (!budget) return null;
	return BudgetSchema.parse(budget);
}

export async function createBudget(surreal: Surreal, budget: Omit<Budget, 'id'>): Promise<Budget> {
	const categoryRecords = budget.categories.map((cat) => new RecordId('category', cat.id));
	const [created] = await surreal.query(
		`
		CREATE budget SET name = $name, year = $year, amount = $amount, categories = $categories
		RETURN id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal}
		`,
		{
			name: budget.name,
			year: budget.year,
			amount: budget.amount,
			categories: categoryRecords
		}
	);
	return BudgetSchema.array().parse(created)[0]!;
}

export async function updateBudget(surreal: Surreal, budget: Budget): Promise<Budget> {
	const categoryRecords = budget.categories.map((cat) => new RecordId('category', cat.id));
	const [updated] = await surreal.query(
		'UPDATE $id SET name = $name, year = $year, amount = $amount, categories = $categories RETURN id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal}',
		{
			id: new RecordId('budget', budget.id),
			name: budget.name,
			year: budget.year,
			amount: budget.amount,
			categories: categoryRecords
		}
	);
	return BudgetSchema.array().parse(updated)[0]!;
}

export async function deleteBudget(surreal: Surreal, id: string): Promise<void> {
	await surreal.query('DELETE $id', { id: new RecordId('budget', id) });
}

export interface BudgetReportData {
	budgetNames: string[];
	years: number[];
	budgetsByNameAndYear: Record<string, Record<number, Budget | null>>;
	actualSpendingByNameAndYear: Record<string, Record<number, number>>;
	monthlySpendingByNameYearMonth: Record<string, Record<number, Record<number, number>>>;
	previousYearSpendingByNameYearMonth: Record<string, Record<number, Record<number, number>>>;
}

export interface MonthlySpendingRaw {
	budgetName: string;
	budgetYear: number;
	monthlyData: Array<{
		month: number;
		monthlyAmount: number;
	}>;
}

export interface MonthlySpendingFlat {
	budgetName: string;
	budgetYear: number;
	month: number;
	monthlyAmount: number;
}

/**
 * Flattens nested monthly spending data from database query into a flat array
 */
export function flattenMonthlySpending(raw: MonthlySpendingRaw[]): MonthlySpendingFlat[] {
	const flattened: MonthlySpendingFlat[] = [];
	raw.forEach((budget) => {
		budget.monthlyData.forEach((monthData) => {
			flattened.push({
				budgetName: budget.budgetName,
				budgetYear: budget.budgetYear,
				month: monthData.month,
				monthlyAmount: monthData.monthlyAmount
			});
		});
	});
	return flattened;
}

export interface ActualSpending {
	budgetName: string;
	budgetYear: number;
	actualAmount: number;
}

/**
 * Creates a lookup map: budgetName -> year -> Budget | null
 */
export function createBudgetLookupMap(
	budgets: Budget[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, Budget | null>> {
	const lookup: Record<string, Record<number, Budget | null>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			const budget = budgets.find((b) => b.name === name && b.year === year);
			lookup[name]![year] = budget || null;
		});
	});
	return lookup;
}

/**
 * Creates a lookup map: budgetName -> year -> actualAmount
 */
export function createActualSpendingLookupMap(
	actualSpending: ActualSpending[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, number>> {
	const lookup: Record<string, Record<number, number>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			const spending = actualSpending.find((s) => s.budgetName === name && s.budgetYear === year);
			lookup[name]![year] = spending?.actualAmount || 0;
		});
	});
	return lookup;
}

/**
 * Creates a lookup map: budgetName -> year -> month -> amount
 */
export function createMonthlySpendingLookupMap(
	monthlySpending: MonthlySpendingFlat[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, Record<number, number>>> {
	const lookup: Record<string, Record<number, Record<number, number>>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			lookup[name]![year] = {};
			for (let month = 1; month <= 12; month++) {
				const spending = monthlySpending.find(
					(s) => s.budgetName === name && s.budgetYear === year && s.month === month
				);
				lookup[name]![year]![month] = spending?.monthlyAmount || 0;
			}
		});
	});
	return lookup;
}

export async function getBudgetYears(surreal: Surreal): Promise<number[]> {
	const results = await surreal.query(`
		SELECT year FROM budget
	`);

	const budgets = results[0];
	const parsedBudgets = z.array(z.object({ year: z.number() })).parse(budgets);
	const years = Array.from(new Set(parsedBudgets.map((b) => b.year))).sort((a, b) => b - a);

	return years;
}

export async function getBudgetReportData(
	surreal: Surreal,
	year?: number
): Promise<BudgetReportData> {
	const [, , , , budgets, actualSpending, monthlySpending, previousYearSpending] =
		await surreal.query(
			`
		let $budgets = (
			SELECT
				id.id() AS id,
				name,
				year,
				amount,
				categories[*].{id: id.id(), name, emoji, color, ordinal} AS categories,
				categories[*].id.id() AS categoryIds
			FROM budget
			${year ? 'WHERE year == $year' : ''}
			ORDER BY name ASC, year ASC
		);

		let $actualSpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				math::sum((
					SELECT VALUE amount
					FROM transaction
					WHERE statement.date IS NOT NONE
					AND statement.date.year() == $parent.year
					AND category IS NOT NONE
					AND category.id() IN $parent.categories[*].id.id()
				)) AS actualAmount
			FROM budget
			${year ? 'WHERE year == $year' : ''}
		);

		let $monthlySpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				(
					SELECT
						month,
						math::sum(amount) AS monthlyAmount
					FROM (
						SELECT
							statement.date.month() AS month,
							amount
						FROM transaction
						WHERE statement.date IS NOT NONE
						AND statement.date.year() == $parent.year
						AND category IS NOT NONE
						AND category.id() IN $parent.categories[*].id.id()
					)
					GROUP BY month
					ORDER BY month
				) AS monthlyData
			FROM budget
			${year ? 'WHERE year == $year' : ''}
		);

		let $previousYearSpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				categories[*].id.id() AS categoryIds,
				(
					SELECT
						month,
						math::sum(amount) AS monthlyAmount
					FROM (
						SELECT
							statement.date.month() AS month,
							amount
						FROM transaction
						WHERE statement.date IS NOT NONE
						AND statement.date.year() == $parent.year - 1
						AND category IS NOT NONE
						AND category.id() IN $parent.categories[*].id.id()
					)
					GROUP BY month
					ORDER BY month
				) AS monthlyData
			FROM budget
			${year ? 'WHERE year == $year' : ''}
		);

		$budgets;
		$actualSpending;
		$monthlySpending;
		$previousYearSpending;
	`,
			{ year }
		);

	const parsedBudgets = BudgetSchema.array().parse(budgets);

	// Parse actual spending data
	const actualSpendingData = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				actualAmount: z.number()
			})
		)
		.parse(actualSpending);

	// Parse and flatten monthly spending data
	const monthlySpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(
					z.object({
						month: z.number(),
						monthlyAmount: z.number()
					})
				)
			})
		)
		.parse(monthlySpending);
	const monthlySpendingData = flattenMonthlySpending(monthlySpendingRaw);

	// Parse and flatten previous year spending data
	const previousYearSpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(
					z.object({
						month: z.number(),
						monthlyAmount: z.number()
					})
				)
			})
		)
		.parse(previousYearSpending);
	const previousYearSpendingData = flattenMonthlySpending(previousYearSpendingRaw);

	// Get unique budget names and years
	const budgetNames = Array.from(new Set(parsedBudgets.map((b) => b.name))).sort();
	const years = Array.from(new Set(parsedBudgets.map((b) => b.year))).sort();

	// Create lookup maps using extracted functions
	const budgetsByNameAndYear = createBudgetLookupMap(parsedBudgets, budgetNames, years);
	const actualSpendingByNameAndYear = createActualSpendingLookupMap(
		actualSpendingData,
		budgetNames,
		years
	);
	const monthlySpendingByNameYearMonth = createMonthlySpendingLookupMap(
		monthlySpendingData,
		budgetNames,
		years
	);
	const previousYearSpendingByNameYearMonth = createMonthlySpendingLookupMap(
		previousYearSpendingData,
		budgetNames,
		years
	);

	return {
		budgetNames,
		years,
		budgetsByNameAndYear,
		actualSpendingByNameAndYear,
		monthlySpendingByNameYearMonth,
		previousYearSpendingByNameYearMonth
	};
}

/**
 * Get budget report data for a single budget name across all years
 * This is optimized for the Budget view which only needs data for one budget at a time
 */
export async function getSingleBudgetReportData(
	surreal: Surreal,
	budgetName: string
): Promise<BudgetReportData> {
	const [, , , , budgets, actualSpending, monthlySpending, previousYearSpending] =
		await surreal.query(
			`
		let $budgets = (
			SELECT
				id.id() AS id,
				name,
				year,
				amount,
				categories[*].{id: id.id(), name, emoji, color, ordinal} AS categories,
				categories[*].id.id() AS categoryIds
			FROM budget
			WHERE name == $budgetName
			ORDER BY name ASC, year ASC
		);

		let $actualSpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				math::sum((
					SELECT VALUE amount
					FROM transaction
					WHERE statement.date IS NOT NONE
					AND statement.date.year() == $parent.year
					AND category IS NOT NONE
					AND category.id() IN $parent.categories[*].id.id()
				)) AS actualAmount
			FROM budget
			WHERE name == $budgetName
		);

		let $monthlySpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				(
					SELECT
						month,
						math::sum(amount) AS monthlyAmount
					FROM (
						SELECT
							statement.date.month() AS month,
							amount
						FROM transaction
						WHERE statement.date IS NOT NONE
						AND statement.date.year() == $parent.year
						AND category IS NOT NONE
						AND category.id() IN $parent.categories[*].id.id()
					)
					GROUP BY month
					ORDER BY month
				) AS monthlyData
			FROM budget
			WHERE name == $budgetName
		);

		let $previousYearSpending = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				categories[*].id.id() AS categoryIds,
				(
					SELECT
						month,
						math::sum(amount) AS monthlyAmount
					FROM (
						SELECT
							statement.date.month() AS month,
							amount
						FROM transaction
						WHERE statement.date IS NOT NONE
						AND statement.date.year() == $parent.year - 1
						AND category IS NOT NONE
						AND category.id() IN $parent.categories[*].id.id()
					)
					GROUP BY month
					ORDER BY month
				) AS monthlyData
			FROM budget
			WHERE name == $budgetName
		);

		$budgets;
		$actualSpending;
		$monthlySpending;
		$previousYearSpending;
	`,
			{ budgetName }
		);

	const parsedBudgets = BudgetSchema.array().parse(budgets);

	// Parse actual spending data
	const actualSpendingData = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				actualAmount: z.number()
			})
		)
		.parse(actualSpending);

	// Parse and flatten monthly spending data
	const monthlySpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(
					z.object({
						month: z.number(),
						monthlyAmount: z.number()
					})
				)
			})
		)
		.parse(monthlySpending);
	const monthlySpendingData = flattenMonthlySpending(monthlySpendingRaw);

	// Parse and flatten previous year spending data
	const previousYearSpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(
					z.object({
						month: z.number(),
						monthlyAmount: z.number()
					})
				)
			})
		)
		.parse(previousYearSpending);
	const previousYearSpendingData = flattenMonthlySpending(previousYearSpendingRaw);

	// Get unique budget names and years
	const budgetNames = Array.from(new Set(parsedBudgets.map((b) => b.name))).sort();
	const years = Array.from(new Set(parsedBudgets.map((b) => b.year))).sort();

	// Create lookup maps using extracted functions
	const budgetsByNameAndYear = createBudgetLookupMap(parsedBudgets, budgetNames, years);
	const actualSpendingByNameAndYear = createActualSpendingLookupMap(
		actualSpendingData,
		budgetNames,
		years
	);
	const monthlySpendingByNameYearMonth = createMonthlySpendingLookupMap(
		monthlySpendingData,
		budgetNames,
		years
	);
	const previousYearSpendingByNameYearMonth = createMonthlySpendingLookupMap(
		previousYearSpendingData,
		budgetNames,
		years
	);

	return {
		budgetNames,
		years,
		budgetsByNameAndYear,
		actualSpendingByNameAndYear,
		monthlySpendingByNameYearMonth,
		previousYearSpendingByNameYearMonth
	};
}

export interface TagSpendingByYear {
	tagName: string;
	year: number;
	total: number;
}

export interface TagReportData {
	tagNames: string[];
	years: number[];
	spendingByTagAndYear: Record<string, Record<number, number>>;
}

/**
 * Get spending data broken down by tag and year
 * Tags with years (e.g., #santa-barbara-2025) are tracked separately by year
 */
export async function getTagReportData(surreal: Surreal): Promise<TagReportData> {
	// Query from transaction side and aggregate by tag name and year
	const [tagSpending] = await surreal.query(`
		SELECT
			->tagged[WHERE year IS NOT NONE].out.name AS tagNames,
			->tagged[WHERE year IS NOT NONE].year AS tagYears,
			amount
		FROM transaction
		WHERE statement.date IS NOT NONE
		AND category IS NOT NONE
		AND count(->tagged) > 0
	`);

	// Parse and flatten the data
	const rawData = z
		.array(
			z.object({
				tagNames: z.union([z.string(), z.array(z.string())]),
				tagYears: z.union([z.number(), z.array(z.number())]),
				amount: z.number()
			})
		)
		.parse(tagSpending);

	// Flatten and aggregate the data
	interface TagYearAmount {
		tagName: string;
		year: number;
		amount: number;
	}

	const flatData: TagYearAmount[] = [];
	rawData.forEach((item) => {
		const tagNames = Array.isArray(item.tagNames) ? item.tagNames : [item.tagNames];
		const tagYears = Array.isArray(item.tagYears) ? item.tagYears : [item.tagYears];

		// Match each tagName with its corresponding year
		tagNames.forEach((tagName, index) => {
			const year = tagYears[index];
			if (tagName && year !== undefined) {
				flatData.push({ tagName, year, amount: item.amount });
			}
		});
	});

	// Group by tagName and year, summing amounts
	const aggregated = new Map<string, number>();
	flatData.forEach((item) => {
		const key = `${item.tagName}|${item.year}`;
		aggregated.set(key, (aggregated.get(key) || 0) + item.amount);
	});

	// Convert back to array
	const parsedSpending = Array.from(aggregated.entries()).map(([key, total]) => {
		const [tagName, yearStr] = key.split('|');
		return { tagName: tagName!, year: parseInt(yearStr!), total };
	});

	// Get unique tag names and years
	const tagNames = Array.from(new Set(parsedSpending.map((s) => s.tagName))).sort();
	const years = Array.from(new Set(parsedSpending.map((s) => s.year))).sort((a, b) => b - a);

	// Create lookup map: tagName -> year -> total
	const spendingByTagAndYear: Record<string, Record<number, number>> = {};
	tagNames.forEach((tagName) => {
		spendingByTagAndYear[tagName] = {};
		years.forEach((year) => {
			const spending = parsedSpending.find((s) => s.tagName === tagName && s.year === year);
			spendingByTagAndYear[tagName]![year] = spending?.total || 0;
		});
	});

	return {
		tagNames,
		years,
		spendingByTagAndYear
	};
}
