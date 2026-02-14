import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	parseTransactionDescriptionAndTags,
	type NewTagged
} from '$lib/db/updateTransactionDescription';
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
	searchTerm: z.string(),
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

function amountsToMatchForSearchTerm(searchTerm: string): number[] {
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

function buildOrderByFields(columns: readonly SortColumn[]): string {
	return columns
		.map((col, index) => `type::field("${col.field}") as orderField${index}`)
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

	const searchTermParsed = parseTransactionDescriptionAndTags(body.searchTerm);
	const amounts = amountsToMatchForSearchTerm(body.searchTerm);

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
				amount,
				category AND category.id() as categoryId,
				category AND category.ordinal as categoryOrdinal,
				statement.account.id() as accountId,
				description,
				statementDescription,
				statement.id() as statementId,
				statement.date.year() as year,
				->(SELECT id.id() as id, ->(SELECT id.id() as id, name FROM tag LIMIT 1)[0] as tag, year FROM tagged) as tagged,
				${orderByFields}
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
		descriptionFilter: searchTermParsed.description,
		taggedFilter: searchTermParsed.tagged as NewTagged[],
		amounts
	});

	const [, , total, transactions, totalByYear, totalByCategoryId, totalByAccountId] = data as [
		unknown,
		unknown,
		number,
		Array<{ tagged?: Array<{ tag?: { name?: string } }> }>,
		Array<{ year: number; total: number }>,
		Array<{ categoryId: string; categoryOrdinal: number; total: number }>,
		Array<{ accountId: string; total: number }>
	];

	// Sort each transaction's tagged array by tag name (was previously done by SortedTaggedArraySchema)
	for (const t of transactions) {
		t.tagged?.sort((a, b) => (a.tag?.name ?? '').localeCompare(b.tag?.name ?? ''));
	}

	return json({
		total,
		transactions,
		totalByYear,
		totalByCategoryId,
		totalByAccountId
	});
};
