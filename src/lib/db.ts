import { z } from 'zod';

export interface Transactions {
	count: number;
	total: number;
	totalByYear: Array<{ year: number; total: number }>;
	totalByCategory: Array<{ category: Category; total: number }>;
	totalByAccount: Array<{ account: Account; total: number }>;
	totalByTag: Array<{
		tagName: string;
		total: number;
		totalByYear: Array<{ year: number; total: number }>;
	}>;
	list: Transaction[];
}

export const FileSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	data: z.instanceof(ArrayBuffer)
});

export interface File extends z.infer<typeof FileSchema> {}

export const StatementSchema = z.object({
	id: z.string().nonempty(),
	account: z.string().nonempty(),
	date: z.instanceof(Date),
	file: z.string().nonempty()
});

export interface Statement extends z.infer<typeof StatementSchema> {}

export const TransactionRecordSchema = z.object({
	id: z.string().nonempty(),
	date: z.instanceof(Date),
	effectiveDate: z.instanceof(Date).optional(),
	amount: z.number(),
	categoryId: z.string().optional(),
	statementId: z.string(),
	description: z.string().optional(),
	statementDescription: z.string(),
	tags: z.array(z.string())
});

export interface Transaction extends z.infer<typeof TransactionRecordSchema> {}

export const AccountSchema = z.object({
	id: z.string().nonempty(),
	type: z.string().nonempty(),
	number: z.string().nonempty().optional(),
	name: z.string().nonempty()
});

export interface Account extends z.infer<typeof AccountSchema> {}

export const CategorySchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	emoji: z.string(),
	color: z.string(),
	ordinal: z.number().min(0)
});

export interface Category extends z.infer<typeof CategorySchema> {}

export const TagSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	transactionCount: z.number()
});

export interface Tag extends z.infer<typeof TagSchema> {}

export const FilterOptionsSchema = z.object({
	years: z.array(z.number().min(0)),
	months: z.array(z.number().min(0)),
	categories: z.array(CategorySchema),
	accounts: z.array(AccountSchema)
});

export interface FilterOptions extends z.infer<typeof FilterOptionsSchema> {}

export const BudgetSchema = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	year: z.number(),
	amount: z.number(),
	categories: z.array(CategorySchema)
});

export interface Budget extends z.infer<typeof BudgetSchema> {}

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

export function createBudgetLookupMap(
	budgets: Budget[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, Budget | null>> {
	const budgetsByNameYear = new Map<string, Budget>();
	for (const budget of budgets) {
		budgetsByNameYear.set(`${budget.name}\0${budget.year}`, budget);
	}

	const lookup: Record<string, Record<number, Budget | null>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			lookup[name]![year] = budgetsByNameYear.get(`${name}\0${year}`) ?? null;
		});
	});
	return lookup;
}

export function createActualSpendingLookupMap(
	actualSpending: ActualSpending[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, number>> {
	const spendingByNameYear = new Map<string, number>();
	for (const spending of actualSpending) {
		spendingByNameYear.set(`${spending.budgetName}\0${spending.budgetYear}`, spending.actualAmount);
	}

	const lookup: Record<string, Record<number, number>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			lookup[name]![year] = spendingByNameYear.get(`${name}\0${year}`) ?? 0;
		});
	});
	return lookup;
}

export function createMonthlySpendingLookupMap(
	monthlySpending: MonthlySpendingFlat[],
	budgetNames: string[],
	years: number[]
): Record<string, Record<number, Record<number, number>>> {
	const spendingByNameYearMonth = new Map<string, number>();
	for (const spending of monthlySpending) {
		spendingByNameYearMonth.set(
			`${spending.budgetName}\0${spending.budgetYear}\0${spending.month}`,
			spending.monthlyAmount
		);
	}

	const lookup: Record<string, Record<number, Record<number, number>>> = {};
	budgetNames.forEach((name) => {
		lookup[name] = {};
		years.forEach((year) => {
			lookup[name]![year] = {};
			for (let month = 1; month <= 12; month++) {
				lookup[name]![year]![month] =
					spendingByNameYearMonth.get(`${name}\0${year}\0${month}`) ?? 0;
			}
		});
	});
	return lookup;
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
