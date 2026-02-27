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

export const GET: RequestHandler = async ({ params }) => {
	const budgetName = decodeURIComponent(params.name!);
	const db = await getDb();

	const [, , budgets, spendingData] = await db.query(
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

		let $transactions = (
			SELECT
				category.id() AS categoryId,
				(effectiveDate ?? statement.date).year() AS year,
				(effectiveDate ?? statement.date).month() AS month,
				amount
			FROM transaction
			WHERE statement.date IS NOT NONE
			AND category IS NOT NONE
		);

		let $spendingData = (
			SELECT
				name AS budgetName,
				year AS budgetYear,

				math::sum((
					SELECT VALUE amount
					FROM $transactions
					WHERE year == $parent.year
					AND categoryId IN $parent.categoryIds
				)) AS actualAmount,

				(SELECT
					month,
					math::sum(amount) AS monthlyAmount
				FROM $transactions
				WHERE year == $parent.year
				AND categoryId IN $parent.categoryIds
				GROUP BY month
				ORDER BY month
				) AS monthlyData,

				(SELECT
					month,
					math::sum(amount) AS monthlyAmount
				FROM $transactions
				WHERE year == $parent.year - 1
				AND categoryId IN $parent.categoryIds
				GROUP BY month
				ORDER BY month
				) AS previousYearMonthlyData
			FROM $budgets
		);

		$budgets;
		$spendingData;
	`,
		{ budgetName }
	);

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
