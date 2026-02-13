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

	const [, , , , budgets, actualSpending, monthlySpending, previousYearSpending] = await db.query(
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

	const actualSpendingData = z
		.array(z.object({ budgetName: z.string(), budgetYear: z.number(), actualAmount: z.number() }))
		.parse(actualSpending);

	const monthlySpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(z.object({ month: z.number(), monthlyAmount: z.number() }))
			})
		)
		.parse(monthlySpending);
	const monthlySpendingData = flattenMonthlySpending(monthlySpendingRaw as MonthlySpendingRaw[]);

	const previousYearSpendingRaw = z
		.array(
			z.object({
				budgetName: z.string(),
				budgetYear: z.number(),
				monthlyData: z.array(z.object({ month: z.number(), monthlyAmount: z.number() }))
			})
		)
		.parse(previousYearSpending);
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
