import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';
import { normalizeForMatching } from '$lib/utils/normalizeForMatching';

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MIN_CONFIDENCE_THRESHOLD = 0.5;

const BODY = z.object({
	transactionIds: z.array(z.string())
});

export interface Suggestion {
	transactionId: string;
	suggestedCategoryId: string;
	confidence: number;
	matchCount: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());
	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const { transactionIds } = parsedBody.data;
	const db = await getDb();

	// Fetch default category
	const [settings] = await db.query<[{ defaultCategoryId?: string }]>(
		'SELECT defaultCategory.?.id() as defaultCategoryId FROM ONLY settings:global'
	);
	const defaultCategoryId = settings?.defaultCategoryId ?? null;

	// Fetch the requested transactions
	const [transactions] = await db.query<
		[Array<{ id: string; statementDescription: string; categoryId: string | null }>]
	>(
		'SELECT id.id() AS id, statementDescription, category AND category.id() AS categoryId FROM transaction WHERE id.id() IN $ids',
		{ ids: transactionIds }
	);

	// Filter to candidates: those whose category is the default or unset
	const candidates = (transactions ?? []).filter(
		(t) => !t.categoryId || t.categoryId === defaultCategoryId
	);

	if (candidates.length === 0) {
		return json({ suggestions: [] });
	}

	// Fetch all historically categorized transactions (not default, not NONE)
	const [history] = await db.query<[Array<{ statementDescription: string; categoryId: string }>]>(
		`SELECT statementDescription, category AND category.id() AS categoryId FROM transaction WHERE category IS NOT NONE${defaultCategoryId ? ' AND category != $defaultCategory' : ''}`,
		defaultCategoryId ? { defaultCategory: new RecordId('category', defaultCategoryId) } : {}
	);

	if (!history || history.length === 0) {
		return json({ suggestions: [] });
	}

	// Build normalized description → category frequency map
	const freqMap = new Map<string, Map<string, number>>();
	for (const tx of history) {
		const normalized = normalizeForMatching(tx.statementDescription);
		if (!normalized) continue;
		let categoryMap = freqMap.get(normalized);
		if (!categoryMap) {
			categoryMap = new Map();
			freqMap.set(normalized, categoryMap);
		}
		categoryMap.set(tx.categoryId, (categoryMap.get(tx.categoryId) ?? 0) + 1);
	}

	// Compute suggestions for each candidate
	const suggestions: Suggestion[] = [];
	for (const tx of candidates) {
		const normalized = normalizeForMatching(tx.statementDescription);
		if (!normalized) continue;

		const categoryMap = freqMap.get(normalized);
		if (!categoryMap || categoryMap.size === 0) continue;

		// Find the top category
		let topCategoryId = '';
		let topCount = 0;
		let totalCount = 0;
		for (const [catId, count] of categoryMap) {
			totalCount += count;
			if (count > topCount) {
				topCount = count;
				topCategoryId = catId;
			}
		}

		const confidence = topCount / totalCount;
		if (confidence < MIN_CONFIDENCE_THRESHOLD) continue;

		suggestions.push({
			transactionId: tx.id,
			suggestedCategoryId: topCategoryId,
			confidence,
			matchCount: totalCount
		});
	}

	// Sort: high confidence first, then by matchCount descending
	suggestions.sort((a, b) => {
		const aHigh = a.confidence >= HIGH_CONFIDENCE_THRESHOLD ? 1 : 0;
		const bHigh = b.confidence >= HIGH_CONFIDENCE_THRESHOLD ? 1 : 0;
		if (aHigh !== bHigh) return bHigh - aHigh;
		return b.confidence - a.confidence;
	});

	return json({ suggestions });
};
