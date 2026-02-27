import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { z } from 'zod';

export const GET: RequestHandler = async () => {
	const db = await getDb();

	const [tagSpending] = await db.query(`
		SELECT
			->tagged->tag.name AS tagNames,
			(effectiveDate ?? statement.date).year() AS year,
			amount
		FROM transaction
		WHERE statement.date IS NOT NONE
		AND category IS NOT NONE
		AND count(->tagged) > 0
	`);

	const rawData = z
		.array(
			z.object({
				tagNames: z.union([z.string(), z.array(z.string())]),
				year: z.number(),
				amount: z.number()
			})
		)
		.parse(tagSpending);

	const spendingByTagAndYear: Record<string, Record<number, number>> = {};
	const tagNameSet = new Set<string>();
	const yearSet = new Set<number>();

	rawData.forEach((item) => {
		const tagNames = Array.isArray(item.tagNames) ? item.tagNames : [item.tagNames];
		yearSet.add(item.year);

		tagNames.forEach((tagName) => {
			if (!tagName) return;
			tagNameSet.add(tagName);
			spendingByTagAndYear[tagName] ??= {};
			spendingByTagAndYear[tagName]![item.year] =
				(spendingByTagAndYear[tagName]![item.year] ?? 0) + item.amount;
		});
	});

	const tagNames = Array.from(tagNameSet).sort();
	const years = Array.from(yearSet).sort((a, b) => b - a);
	for (const tagName of tagNames) {
		spendingByTagAndYear[tagName] ??= {};
		for (const year of years) {
			spendingByTagAndYear[tagName]![year] ??= 0;
		}
	}

	return json({ tagNames, years, spendingByTagAndYear });
};
