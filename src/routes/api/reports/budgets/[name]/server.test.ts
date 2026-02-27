import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

import { getDb } from '$lib/server/db';
import { GET } from './+server';

describe('GET /api/reports/budgets/[name]', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns budget report data using pre-aggregated query result', async () => {
		const budgets = [
			{
				id: 'budget-2023',
				name: 'Food Budget',
				year: 2023,
				amount: -120000,
				categories: [{ id: 'cat-food', name: 'Food', emoji: '🍔', color: 'red-200', ordinal: 1 }]
			},
			{
				id: 'budget-2024',
				name: 'Food Budget',
				year: 2024,
				amount: -130000,
				categories: [{ id: 'cat-food', name: 'Food', emoji: '🍔', color: 'red-200', ordinal: 1 }]
			}
		];

		const spendingData = [
			{
				budgetName: 'Food Budget',
				budgetYear: 2023,
				actualAmount: -110000,
				monthlyData: [
					{ month: 1, monthlyAmount: -10000 },
					{ month: 2, monthlyAmount: -9000 }
				],
				previousYearMonthlyData: [{ month: 12, monthlyAmount: -8000 }]
			},
			{
				budgetName: 'Food Budget',
				budgetYear: 2024,
				actualAmount: -115000,
				monthlyData: [{ month: 1, monthlyAmount: -9500 }],
				previousYearMonthlyData: [{ month: 1, monthlyAmount: -10000 }]
			}
		];

		const query = vi.fn().mockResolvedValue([null, null, budgets, spendingData]);
		vi.mocked(getDb).mockResolvedValue({ query } as never);

		const response = await GET({ params: { name: encodeURIComponent('Food Budget') } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(query).toHaveBeenCalledTimes(1);
		const [surrealql] = query.mock.calls[0]!;
		expect(String(surrealql)).toContain('let $transactions');
		expect(String(surrealql)).toContain('FROM $budgets');

		expect(body.budgetNames).toEqual(['Food Budget']);
		expect(body.years).toEqual([2023, 2024]);
		expect(body.budgetsByNameAndYear['Food Budget'][2023].id).toBe('budget-2023');
		expect(body.actualSpendingByNameAndYear['Food Budget'][2024]).toBe(-115000);
		expect(body.monthlySpendingByNameYearMonth['Food Budget'][2023][1]).toBe(-10000);
		expect(body.monthlySpendingByNameYearMonth['Food Budget'][2023][3]).toBe(0);
		expect(body.previousYearSpendingByNameYearMonth['Food Budget'][2023][12]).toBe(-8000);
	});
});
