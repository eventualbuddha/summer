import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { PATCH } from './+server';

describe('PATCH /api/transactions/bulk', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('rejects invalid effectiveDate with 400', async () => {
		const query = vi.fn();
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await PATCH({
			request: new Request('http://localhost/api/transactions/bulk', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					transactionIds: ['abc'],
					effectiveDate: 'not-a-date'
				})
			})
		} as never);

		expect(response.status).toBe(400);
		expect(query).not.toHaveBeenCalled();
	});

	it('executes a single transaction query for mixed updates', async () => {
		const responses = vi.fn().mockResolvedValue([]);
		const query = vi.fn().mockReturnValue({ responses });
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await PATCH({
			request: new Request('http://localhost/api/transactions/bulk', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					transactionIds: ['a', 'b'],
					description: 'new description',
					categoryId: 'food',
					effectiveDate: '2025-01-01T00:00:00.000Z',
					tags: ['groceries']
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(query).toHaveBeenCalledTimes(1);

		const [surrealql] = query.mock.calls[0]!;
		expect(String(surrealql)).toContain('BEGIN TRANSACTION');
		expect(String(surrealql)).toContain('UPDATE $transactions SET description = $description');
		expect(String(surrealql)).toContain('UPDATE $transactions SET category = $category');
		expect(String(surrealql)).toContain(
			'UPDATE $transactions SET effectiveDate = <datetime>$effectiveDate'
		);
		expect(String(surrealql)).toContain('DELETE tagged WHERE in IN $transactions');
		expect(String(surrealql)).toContain('COMMIT TRANSACTION');
	});
});
