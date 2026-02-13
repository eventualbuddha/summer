import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	flattenMonthlySpending,
	createBudgetLookupMap,
	createActualSpendingLookupMap,
	createMonthlySpendingLookupMap,
	type MonthlySpendingRaw,
	type ActualSpending,
	BudgetSchema
} from '$lib/db';
import { z } from 'zod';

export const GET: RequestHandler = async ({ url }) => {
	const yearParam = url.searchParams.get('year');
	const year = yearParam ? parseInt(yearParam) : undefined;

	const db = await getDb();
	const yearFilter = year ? 'WHERE year == $year' : '';

	const currentYearFilter = year
		? `AND statement.date >= d'${year}-01-01' AND statement.date < d'${year + 1}-01-01'`
		: '';
	const prevYearFilter = year
		? `AND statement.date >= d'${year - 1}-01-01' AND statement.date < d'${year}-01-01'`
		: '';

	const results = await db.query(
		`
		-- Load all transactions into memory once
		let $currentYearTxns = (
			SELECT
				category.id() AS categoryId,
				statement.date.month() AS month,
				amount
			FROM transaction
			WHERE statement.date IS NOT NONE
			${currentYearFilter}
			AND category IS NOT NONE
		);

		let $prevYearTxns = (
			SELECT
				category.id() AS categoryId,
				statement.date.month() AS month,
				amount
			FROM transaction
			WHERE statement.date IS NOT NONE
			${prevYearFilter}
			AND category IS NOT NONE
		);

		-- Get budgets
		let $budgets = (
			SELECT
				id.id() AS id,
				name,
				year,
				amount,
				categories[*].{id: id.id(), name, emoji, color, ordinal} AS categories,
				categories[*].id.id() AS categoryIds
			FROM budget
			${yearFilter}
			ORDER BY name ASC, year ASC
		);

		-- Aggregate spending by filtering in-memory transactions
		let $spendingData = (
			SELECT
				name AS budgetName,
				year AS budgetYear,
				
				-- Current year actual amount
				math::sum((
					SELECT VALUE amount
					FROM $currentYearTxns 
					WHERE categoryId IN $parent.categoryIds
				)) AS actualAmount,
				
				-- Current year monthly breakdown
				(SELECT
					month,
					math::sum(amount) AS monthlyAmount
				 FROM $currentYearTxns
				 WHERE categoryId IN $parent.categoryIds
				 GROUP BY month
				 ORDER BY month
				) AS monthlyData,
				
				-- Previous year monthly breakdown
				(SELECT
					month,
					math::sum(amount) AS monthlyAmount
				 FROM $prevYearTxns
				 WHERE categoryId IN $parent.categoryIds
				 GROUP BY month
				 ORDER BY month
				) AS previousYearMonthlyData
				
			FROM $budgets
		);

		$budgets;
		$spendingData;
	`,
		{ year }
	);

	const [, , , , budgets, spendingData] = results;

	const parsedBudgets = BudgetSchema.array().parse(budgets);

	const parsedSpendingData = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				actualAmount: z.number(),
				monthlyData: z.array(z.object({ month: z.number(), monthlyAmount: z.number() })),
				previousYearMonthlyData: z.array(z.object({ month: z.number(), monthlyAmount: z.number() }))
			})
		)
		.parse(spendingData);

	// Extract data into expected formats
	const actualSpendingData = parsedSpendingData.map((d) => ({
		budgetName: d.budgetName,
		budgetYear: d.budgetYear,
		actualAmount: d.actualAmount
	}));

	const monthlySpendingRaw = parsedSpendingData.map((d) => ({
		budgetName: d.budgetName,
		budgetYear: d.budgetYear,
		monthlyData: d.monthlyData
	}));
	const monthlySpendingData = flattenMonthlySpending(monthlySpendingRaw as MonthlySpendingRaw[]);

	const previousYearSpendingRaw = parsedSpendingData.map((d) => ({
		budgetName: d.budgetName,
		budgetYear: d.budgetYear,
		monthlyData: d.previousYearMonthlyData
	}));
	const previousYearSpendingData = flattenMonthlySpending(
		previousYearSpendingRaw as MonthlySpendingRaw[]
	);

	const budgetNames = Array.from(new Set(parsedBudgets.map((b) => b.name))).sort();
	const years = Array.from(new Set(parsedBudgets.map((b) => b.year))).sort();

	return json({
		budgetNames,
		years,
		budgetsByNameAndYear: createBudgetLookupMap(parsedBudgets, budgetNames, years),
		actualSpendingByNameAndYear: createActualSpendingLookupMap(
			actualSpendingData as ActualSpending[],
			budgetNames,
			years
		),
		monthlySpendingByNameYearMonth: createMonthlySpendingLookupMap(
			monthlySpendingData,
			budgetNames,
			years
		),
		previousYearSpendingByNameYearMonth: createMonthlySpendingLookupMap(
			previousYearSpendingData,
			budgetNames,
			years
		)
	});
};
