import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { PATCH } from './+server';

describe('PATCH /api/transactions/[id]/effective-date', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('rejects invalid effectiveDate with 400', async () => {
		const query = vi.fn();
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await PATCH({
			params: { id: 'tx-1' },
			request: new Request('http://localhost/api/transactions/tx-1/effective-date', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ effectiveDate: 'bad-date' })
			})
		} as never);

		expect(response.status).toBe(400);
		expect(query).not.toHaveBeenCalled();
	});

	it('updates when effectiveDate is a valid datetime string', async () => {
		const query = vi.fn().mockResolvedValue([]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await PATCH({
			params: { id: 'tx-1' },
			request: new Request('http://localhost/api/transactions/tx-1/effective-date', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ effectiveDate: '2025-01-01T00:00:00.000Z' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(query).toHaveBeenCalledWith(
			'UPDATE $transaction SET effectiveDate = <datetime>$effectiveDate',
			expect.objectContaining({ effectiveDate: '2025-01-01T00:00:00.000Z' })
		);
	});
});
