import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { POST } from './+server';

describe('POST /api/transactions/query', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('builds null-safe statement/account projections for sticky transactions', async () => {
		const query = vi.fn().mockResolvedValue([null, null, 0, [], [], [], []]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await POST({
			request: new Request('http://localhost/api/transactions/query', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					years: [2026],
					months: [1],
					categories: ['cat-1'],
					accounts: ['acct-1'],
					searchText: '',
					searchFilters: [],
					stickyTransactionIds: ['tx-without-statement'],
					sort: { columns: [{ field: 'date', direction: 'desc' }] }
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(query).toHaveBeenCalledTimes(1);

		const [surrealql] = query.mock.calls[0]!;
		expect(String(surrealql)).toContain(
			'statement AND statement.account AND statement.account.id() as accountId'
		);
		expect(String(surrealql)).toContain('statement AND statement.id() as statementId');
		expect(String(surrealql)).toContain(
			'(effectiveDate ?? statement.date) AND (effectiveDate ?? statement.date).year() as year'
		);
	});
});
