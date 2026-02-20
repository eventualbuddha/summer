import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { z } from 'zod';

interface SortColumn {
	field: string;
	direction: 'asc' | 'desc';
}

const BODY = z.object({
	years: z.array(z.number()),
	months: z.array(z.number()),
	categories: z.array(z.string()),
	accounts: z.array(z.string()),
	searchText: z.string(),
	searchTags: z.array(z.string()),
	stickyTransactionIds: z.array(z.string()),
	sort: z.object({
		columns: z.array(
			z.object({
				field: z.string(),
				direction: z.enum(['asc', 'desc'])
			})
		)
	})
});

function amountsToMatchForSearchTerm(searchText: string): number[] {
	const match = searchText.match(/^([-+])?(\d{1,10}\.\d{2})$/);
	if (!match) return [];
	const [, sign, amount] = match;
	const amountNumber = parseFloat(amount as string) * 100;
	return sign === '-'
		? [-amountNumber]
		: sign === '+'
			? [amountNumber]
			: [-amountNumber, amountNumber];
}

function buildOrderByFields(columns: readonly SortColumn[]): string {
	return columns
		.map((col, index) => {
			if (col.field === 'date') {
				return `(effectiveDate ?? date) as orderField${index}`;
			}
			return `type::field("${col.field}") as orderField${index}`;
		})
		.join(',\n\t\t\t\t\t\t\t ');
}

function buildOrderByClause(columns: readonly SortColumn[]): string {
	return columns
		.map((col, index) => {
			const fieldAlias = `orderField${index}`;
			return `${fieldAlias} COLLATE ${col.direction === 'asc' ? 'ASC' : 'DESC'}`;
		})
		.join(', ');
}

export const POST: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const body = parsedBody.data;

	const descriptionFilter = body.searchText.trim();
	const tagsFilter = body.searchTags;
	const amounts = amountsToMatchForSearchTerm(body.searchText);

	const columns = body.sort.columns;
	if (columns.length === 0) {
		return json({ error: 'At least one sort column required' }, { status: 400 });
	}

	const orderByFields = buildOrderByFields(columns);
	const orderByClause = buildOrderByClause(columns);

	const db = await getDb();
	const query = `
		let $transactions = (
			SELECT id.id(),
				date,
				effectiveDate,
				amount,
				category AND category.id() as categoryId,
				category AND category.ordinal as categoryOrdinal,
				statement.account.id() as accountId,
				description,
				statementDescription,
				statement.id() as statementId,
				(effectiveDate ?? statement.date).year() as year,
        ->tagged->tag.name as tags,
				${orderByFields}
			FROM transaction
			WHERE id.id() IN $stickyTransactionIds
				OR (
					(effectiveDate ?? statement.date).year() IN $years
					AND (effectiveDate ?? statement.date).month() IN $months
					AND category AND category.id() IN $categories
					AND statement.account AND statement.account.id() IN $accounts
					AND (
						(!$descriptionFilter AND $tagsFilter.len() == 0 AND !$amounts)
						OR (description AND $descriptionFilter AND description.lowercase().contains($descriptionFilter.lowercase()))
						OR (statementDescription AND $descriptionFilter AND statementDescription.lowercase().contains($descriptionFilter.lowercase()))
						OR (amount IN $amounts)
						OR ($tagsFilter.len() > 0 AND $tagsFilter ALLINSIDE ->tagged->tag.name)
					)
				)
			ORDER BY ${orderByClause}
		);

		let $countable = $transactions.filter(|$transaction| $transaction.categoryId != none);

		$countable.fold(0, |$amount, $transaction| $amount + $transaction.amount);
		$transactions;

		SELECT year, math::sum(amount) as total FROM $countable GROUP BY year;
		SELECT categoryId, categoryOrdinal, math::sum(amount) as total FROM $countable GROUP BY categoryId;
		SELECT accountId, math::sum(amount) as total FROM $countable GROUP BY accountId;
	`;

	const data = await db.query(query, {
		stickyTransactionIds: body.stickyTransactionIds,
		years: body.years,
		months: body.months,
		categories: body.categories,
		accounts: body.accounts,
		descriptionFilter,
		tagsFilter: tagsFilter as string[],
		amounts
	});

	const [, , total, transactions, totalByYear, totalByCategoryId, totalByAccountId] = data as [
		unknown,
		unknown,
		number,
		Array<{ tags?: string[]; year?: number; categoryId?: string; amount: number }>,
		Array<{ year: number; total: number }>,
		Array<{ categoryId: string; categoryOrdinal: number; total: number }>,
		Array<{ accountId: string; total: number }>
	];

	// Sort each transaction's tagged array by tag name
	for (const t of transactions) {
		t.tags?.sort((a, b) => a.localeCompare(b));
	}

	// Compute tag totals from countable transactions (those with a categoryId)
	const tagTotalsMap = new Map<string, { total: number; byYear: Map<number, number> }>();
	for (const t of transactions) {
		if (!t.categoryId) continue;
		for (const tag of t.tags ?? []) {
			if (!tagTotalsMap.has(tag)) tagTotalsMap.set(tag, { total: 0, byYear: new Map() });
			const entry = tagTotalsMap.get(tag)!;
			entry.total += t.amount;
			const year = t.year ?? 0;
			entry.byYear.set(year, (entry.byYear.get(year) ?? 0) + t.amount);
		}
	}
	const totalByTag = Array.from(tagTotalsMap.entries())
		.map(([name, tagData]) => ({
			name,
			total: tagData.total,
			totalByYear: Array.from(tagData.byYear.entries())
				.map(([year, total]) => ({ year, total }))
				.sort((a, b) => b.year - a.year)
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return json({
		total,
		transactions,
		totalByYear,
		totalByCategoryId,
		totalByAccountId,
		totalByTag
	});
};
