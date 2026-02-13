import { z } from 'zod';

export interface Transactions {
	count: number;
	total: number;
	totalByYear: Array<{ year: number; total: number }>;
	totalByCategory: Array<{ category: Category; total: number }>;
	totalByAccount: Array<{ account: Account; total: number }>;
	list: Transaction[];
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
