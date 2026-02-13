import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { z } from 'zod';

export const GET: RequestHandler = async () => {
	const db = await getDb();

	const [tagSpending] = await db.query(`
		SELECT
			->tagged[WHERE year IS NOT NONE].out.name AS tagNames,
			->tagged[WHERE year IS NOT NONE].year AS tagYears,
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
				tagYears: z.union([z.number(), z.array(z.number())]),
				amount: z.number()
			})
		)
		.parse(tagSpending);

	interface TagYearAmount {
		tagName: string;
		year: number;
		amount: number;
	}

	const flatData: TagYearAmount[] = [];
	rawData.forEach((item) => {
		const tagNames = Array.isArray(item.tagNames) ? item.tagNames : [item.tagNames];
		const tagYears = Array.isArray(item.tagYears) ? item.tagYears : [item.tagYears];

		tagNames.forEach((tagName, index) => {
			const year = tagYears[index];
			if (tagName && year !== undefined) {
				flatData.push({ tagName, year, amount: item.amount });
			}
		});
	});

	const aggregated = new Map<string, number>();
	flatData.forEach((item) => {
		const key = `${item.tagName}|${item.year}`;
		aggregated.set(key, (aggregated.get(key) || 0) + item.amount);
	});

	const parsedSpending = Array.from(aggregated.entries()).map(([key, total]) => {
		const [tagName, yearStr] = key.split('|');
		return { tagName: tagName!, year: parseInt(yearStr!), total };
	});

	const tagNames = Array.from(new Set(parsedSpending.map((s) => s.tagName))).sort();
	const years = Array.from(new Set(parsedSpending.map((s) => s.year))).sort((a, b) => b - a);

	const spendingByTagAndYear: Record<string, Record<number, number>> = {};
	tagNames.forEach((tagName) => {
		spendingByTagAndYear[tagName] = {};
		years.forEach((year) => {
			const spending = parsedSpending.find((s) => s.tagName === tagName && s.year === year);
			spendingByTagAndYear[tagName]![year] = spending?.total || 0;
		});
	});

	return json({ tagNames, years, spendingByTagAndYear });
};
