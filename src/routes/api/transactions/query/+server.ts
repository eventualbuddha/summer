import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { z } from 'zod';
import type { AmountFilter } from '$lib/types';

interface SortColumn {
	field: string;
	direction: 'asc' | 'desc';
}

const AmountFilterSchema = z.discriminatedUnion('op', [
	z.object({ op: z.literal('exact'), value: z.number().int() }),
	z.object({ op: z.literal('approx'), value: z.number().int() }),
	z.object({ op: z.literal('lt'), value: z.number().int() }),
	z.object({ op: z.literal('gt'), value: z.number().int() }),
	z.object({ op: z.literal('range'), min: z.number().int(), max: z.number().int() })
]);

const SearchFilterSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('tag'), value: z.string() }),
	z.object({ type: z.literal('amount'), filter: AmountFilterSchema }),
	z.object({ type: z.literal('desc'), value: z.string() }),
	z.object({ type: z.literal('bank'), value: z.string() })
]);

const BODY = z.object({
	years: z.array(z.number()),
	months: z.array(z.number()),
	categories: z.array(z.string()),
	accounts: z.array(z.string()),
	searchText: z.string(),
	searchFilters: z.array(SearchFilterSchema),
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

function buildAmountCondition(f: AmountFilter, i: number): string {
	switch (f.op) {
		case 'exact':
			return `(amount == $amtVal${i} OR amount == -$amtVal${i})`;
		case 'approx':
			return `((amount >= $amtMin${i} AND amount <= $amtMax${i}) OR (amount >= -$amtMax${i} AND amount <= -$amtMin${i}))`;
		case 'lt':
			return `(math::abs(amount) < $amtVal${i})`;
		case 'gt':
			return `(math::abs(amount) > $amtVal${i})`;
		case 'range':
			return `(math::abs(amount) >= $amtMin${i} AND math::abs(amount) <= $amtMax${i})`;
	}
}

function buildSearchCondition(
	searchText: string,
	tagFilters: string[],
	descFilter: string | null,
	bankFilter: string | null,
	amountFilters: AmountFilter[]
): string {
	if (!searchText && !tagFilters.length && !descFilter && !bankFilter && !amountFilters.length) {
		return 'true';
	}
	const parts: string[] = [];
	if (searchText) {
		parts.push(
			`((description AND description.lowercase().contains($searchText.lowercase())) OR (statementDescription AND statementDescription.lowercase().contains($searchText.lowercase())) OR string::contains(string::lowercase(array::join(->tagged->tag.name ?? [], " ")), string::lowercase($searchText)))`
		);
	}
	if (tagFilters.length) {
		parts.push(`$tagFilters ALLINSIDE ->tagged->tag.name`);
	}
	if (descFilter) {
		parts.push(`(description AND description.lowercase().contains($descFilter.lowercase()))`);
	}
	if (bankFilter) {
		parts.push(
			`(statementDescription AND statementDescription.lowercase().contains($bankFilter.lowercase()))`
		);
	}
	for (let i = 0; i < amountFilters.length; i++) {
		parts.push(buildAmountCondition(amountFilters[i]!, i));
	}
	return parts.join(' AND ');
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

	// Separate search filters by type
	const tagFilters: string[] = [];
	let descFilter: string | null = null;
	let bankFilter: string | null = null;
	const amountFilters: AmountFilter[] = [];

	for (const f of body.searchFilters) {
		switch (f.type) {
			case 'tag':
				tagFilters.push(f.value);
				break;
			case 'desc':
				if (!descFilter) descFilter = f.value;
				break;
			case 'bank':
				if (!bankFilter) bankFilter = f.value;
				break;
			case 'amount':
				amountFilters.push(f.filter);
				break;
		}
	}

	const searchText = body.searchText.trim();
	const searchCondition = buildSearchCondition(
		searchText,
		tagFilters,
		descFilter,
		bankFilter,
		amountFilters
	);

	const columns = body.sort.columns;
	if (columns.length === 0) {
		return json({ error: 'At least one sort column required' }, { status: 400 });
	}

	const orderByFields = buildOrderByFields(columns);
	const orderByClause = buildOrderByClause(columns);

	// Build query params
	const queryParams: Record<string, unknown> = {
		stickyTransactionIds: body.stickyTransactionIds,
		years: body.years,
		months: body.months,
		categories: body.categories,
		accounts: body.accounts,
		searchText,
		tagFilters,
		descFilter,
		bankFilter
	};

	// Add amount filter parameters
	for (let i = 0; i < amountFilters.length; i++) {
		const f = amountFilters[i]!;
		if (f.op === 'exact') {
			queryParams[`amtVal${i}`] = f.value;
		} else if (f.op === 'approx') {
			queryParams[`amtMin${i}`] = f.value - 100;
			queryParams[`amtMax${i}`] = f.value + 100;
		} else if (f.op === 'lt') {
			queryParams[`amtVal${i}`] = f.value;
		} else if (f.op === 'gt') {
			queryParams[`amtVal${i}`] = f.value;
		} else if (f.op === 'range') {
			queryParams[`amtMin${i}`] = f.min;
			queryParams[`amtMax${i}`] = f.max;
		}
	}

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
					AND (${searchCondition})
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

	const data = await db.query(query, queryParams);

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
