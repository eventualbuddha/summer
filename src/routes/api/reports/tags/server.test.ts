import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { GET } from './+server';

describe('GET /api/reports/tags', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('aggregates tag spending by tag and year and fills missing years with zero', async () => {
		const query = vi.fn().mockResolvedValue([
			[
				{ tagNames: ['groceries', 'food'], year: 2024, amount: -100 },
				{ tagNames: 'groceries', year: 2024, amount: -50 },
				{ tagNames: ['food'], year: 2023, amount: -25 }
			]
		]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await GET({} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.tagNames).toEqual(['food', 'groceries']);
		expect(body.years).toEqual([2024, 2023]);
		expect(body.spendingByTagAndYear.food[2024]).toBe(-100);
		expect(body.spendingByTagAndYear.food[2023]).toBe(-25);
		expect(body.spendingByTagAndYear.groceries[2024]).toBe(-150);
		expect(body.spendingByTagAndYear.groceries[2023]).toBe(0);
	});

	it('returns empty structures for empty result sets', async () => {
		const query = vi.fn().mockResolvedValue([[]]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await GET({} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			tagNames: [],
			years: [],
			spendingByTagAndYear: {}
		});
	});
});
