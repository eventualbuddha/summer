import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { POST } from './+server';

function makeRequest(body: unknown) {
	return new Request('http://localhost/api/transactions/suggest-categories', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('POST /api/transactions/suggest-categories', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns 400 for invalid request body', async () => {
		const query = vi.fn();
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({ request: makeRequest({ wrong: 'field' }) } as never);

		expect(response.status).toBe(400);
		expect(query).not.toHaveBeenCalled();
	});

	it('returns empty suggestions when all transactions are already categorized', async () => {
		const query = vi
			.fn()
			// settings query
			.mockResolvedValueOnce([{ defaultCategoryId: 'default' }])
			// transactions query — all have a non-default category
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'STARBUCKS', categoryId: 'food' }]
			])
			// history query — would not be called, but provide a fallback
			.mockResolvedValueOnce([[]]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.suggestions).toHaveLength(0);
	});

	it('returns empty suggestions when history has no categorized transactions', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([null]) // settings — no default category
			.mockResolvedValueOnce([[{ id: 'tx1', statementDescription: 'STARBUCKS', categoryId: null }]])
			.mockResolvedValueOnce([[]]); // empty history
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.suggestions).toHaveLength(0);
	});

	it('returns a high-confidence suggestion when descriptions match consistently', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([null])
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'STARBUCKS COFFEE', categoryId: null }]
			])
			.mockResolvedValueOnce([
				[
					{ statementDescription: 'STARBUCKS COFFEE', categoryId: 'food' },
					{ statementDescription: 'STARBUCKS COFFEE', categoryId: 'food' },
					{ statementDescription: 'STARBUCKS COFFEE', categoryId: 'food' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.suggestions).toHaveLength(1);
		expect(body.suggestions[0]).toMatchObject({
			transactionId: 'tx1',
			suggestedCategoryId: 'food',
			confidence: 1,
			matchCount: 3
		});
	});

	it('strips payment processor prefixes when matching descriptions', async () => {
		// "SQ STARBUCKS COFFEE" normalizes to "starbucks coffee", same as "STARBUCKS COFFEE"
		const query = vi
			.fn()
			.mockResolvedValueOnce([null])
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'SQ STARBUCKS COFFEE #123', categoryId: null }]
			])
			.mockResolvedValueOnce([
				[
					{ statementDescription: 'STARBUCKS COFFEE', categoryId: 'food' },
					{ statementDescription: 'STARBUCKS COFFEE', categoryId: 'food' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].suggestedCategoryId).toBe('food');
		expect(suggestions[0].confidence).toBe(1);
	});

	it('includes exception-range suggestions (50-79% confidence)', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([null])
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'AMBIGUOUS MERCHANT', categoryId: null }]
			])
			.mockResolvedValueOnce([
				[
					{ statementDescription: 'AMBIGUOUS MERCHANT', categoryId: 'food' },
					{ statementDescription: 'AMBIGUOUS MERCHANT', categoryId: 'food' },
					{ statementDescription: 'AMBIGUOUS MERCHANT', categoryId: 'shopping' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		// 2/3 confidence = 0.667 — in exception range, still returned
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].suggestedCategoryId).toBe('food');
		expect(suggestions[0].confidence).toBeCloseTo(2 / 3);
	});

	it('filters out suggestions below the minimum confidence threshold', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([null])
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'NOISY MERCHANT', categoryId: null }]
			])
			.mockResolvedValueOnce([
				[
					// 1/3 confidence for 'food' — below 50% threshold
					{ statementDescription: 'NOISY MERCHANT', categoryId: 'food' },
					{ statementDescription: 'NOISY MERCHANT', categoryId: 'shopping' },
					{ statementDescription: 'NOISY MERCHANT', categoryId: 'utilities' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		expect(suggestions).toHaveLength(0);
	});

	it('returns high-confidence suggestions before exception-range ones', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([null])
			.mockResolvedValueOnce([
				[
					{ id: 'tx1', statementDescription: 'EXCEPTION MERCHANT', categoryId: null },
					{ id: 'tx2', statementDescription: 'SURE MERCHANT', categoryId: null }
				]
			])
			.mockResolvedValueOnce([
				[
					// tx1 match: 2/3 = 0.667 (exception)
					{ statementDescription: 'EXCEPTION MERCHANT', categoryId: 'food' },
					{ statementDescription: 'EXCEPTION MERCHANT', categoryId: 'food' },
					{ statementDescription: 'EXCEPTION MERCHANT', categoryId: 'shopping' },
					// tx2 match: 3/3 = 1.0 (high confidence)
					{ statementDescription: 'SURE MERCHANT', categoryId: 'utilities' },
					{ statementDescription: 'SURE MERCHANT', categoryId: 'utilities' },
					{ statementDescription: 'SURE MERCHANT', categoryId: 'utilities' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1', 'tx2'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		expect(suggestions).toHaveLength(2);
		// High confidence first
		expect(suggestions[0].transactionId).toBe('tx2');
		expect(suggestions[0].confidence).toBe(1);
		expect(suggestions[1].transactionId).toBe('tx1');
	});

	it('treats transactions with the default category as candidates', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([{ defaultCategoryId: 'uncategorized' }])
			// tx1 has the default category — should be treated as a candidate
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'NETFLIX', categoryId: 'uncategorized' }]
			])
			.mockResolvedValueOnce([
				[
					{ statementDescription: 'NETFLIX', categoryId: 'entertainment' },
					{ statementDescription: 'NETFLIX', categoryId: 'entertainment' }
				]
			]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].suggestedCategoryId).toBe('entertainment');
	});

	it('skips transactions with a non-default category already assigned', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce([{ defaultCategoryId: 'uncategorized' }])
			// tx1 already has a real (non-default) category
			.mockResolvedValueOnce([
				[{ id: 'tx1', statementDescription: 'NETFLIX', categoryId: 'entertainment' }]
			])
			.mockResolvedValueOnce([[]]); // history not reached in meaningful way
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: makeRequest({ transactionIds: ['tx1'] })
		} as never);

		expect(response.status).toBe(200);
		const { suggestions } = await response.json();
		expect(suggestions).toHaveLength(0);
	});
});
