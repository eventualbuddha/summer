import { expect, test } from 'bun:test';
import {
	flattenMonthlySpending,
	createBudgetLookupMap,
	createActualSpendingLookupMap,
	createMonthlySpendingLookupMap,
	type MonthlySpendingRaw,
	type Budget,
	type ActualSpending,
	type Category
} from '../db';

test('flattenMonthlySpending - empty array', () => {
	const result = flattenMonthlySpending([]);
	expect(result).toEqual([]);
});

test('flattenMonthlySpending - single budget with multiple months', () => {
	const raw: MonthlySpendingRaw[] = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			monthlyData: [
				{ month: 1, monthlyAmount: -10000 },
				{ month: 2, monthlyAmount: -15000 },
				{ month: 3, monthlyAmount: -12000 }
			]
		}
	];

	const result = flattenMonthlySpending(raw);

	expect(result).toHaveLength(3);
	expect(result[0]).toEqual({
		budgetName: 'Food Budget',
		budgetYear: 2024,
		month: 1,
		monthlyAmount: -10000
	});
	expect(result[1]).toEqual({
		budgetName: 'Food Budget',
		budgetYear: 2024,
		month: 2,
		monthlyAmount: -15000
	});
	expect(result[2]).toEqual({
		budgetName: 'Food Budget',
		budgetYear: 2024,
		month: 3,
		monthlyAmount: -12000
	});
});

test('flattenMonthlySpending - multiple budgets', () => {
	const raw: MonthlySpendingRaw[] = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			monthlyData: [{ month: 1, monthlyAmount: -10000 }]
		},
		{
			budgetName: 'Transportation Budget',
			budgetYear: 2024,
			monthlyData: [
				{ month: 1, monthlyAmount: -5000 },
				{ month: 2, monthlyAmount: -6000 }
			]
		}
	];

	const result = flattenMonthlySpending(raw);

	expect(result).toHaveLength(3);
	expect(result[0]!.budgetName).toBe('Food Budget');
	expect(result[1]!.budgetName).toBe('Transportation Budget');
	expect(result[2]!.budgetName).toBe('Transportation Budget');
});

test('createBudgetLookupMap - empty arrays', () => {
	const result = createBudgetLookupMap([], [], []);
	expect(result).toEqual({});
});

test('createBudgetLookupMap - single budget', () => {
	const category: Category = {
		id: 'cat1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	const budgets: Budget[] = [
		{
			id: 'budget1',
			name: 'Food Budget',
			year: 2024,
			amount: -100000,
			categories: [category]
		}
	];

	const result = createBudgetLookupMap(budgets, ['Food Budget'], [2024]);

	expect(result['Food Budget']).toBeDefined();
	expect(result['Food Budget']![2024]).toEqual(budgets[0]);
});

test('createBudgetLookupMap - fills in missing budget with null', () => {
	const category: Category = {
		id: 'cat1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	const budgets: Budget[] = [
		{
			id: 'budget1',
			name: 'Food Budget',
			year: 2024,
			amount: -100000,
			categories: [category]
		}
	];

	// Request 2023 and 2024, but only 2024 exists
	const result = createBudgetLookupMap(budgets, ['Food Budget'], [2023, 2024]);

	expect(result['Food Budget']![2023]).toBeNull();
	expect(result['Food Budget']![2024]).toEqual(budgets[0]);
});

test('createBudgetLookupMap - multiple budgets across years', () => {
	const category: Category = {
		id: 'cat1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	const budgets: Budget[] = [
		{
			id: 'budget1',
			name: 'Food Budget',
			year: 2023,
			amount: -100000,
			categories: [category]
		},
		{
			id: 'budget2',
			name: 'Food Budget',
			year: 2024,
			amount: -120000,
			categories: [category]
		},
		{
			id: 'budget3',
			name: 'Transportation Budget',
			year: 2024,
			amount: -80000,
			categories: [category]
		}
	];

	const result = createBudgetLookupMap(
		budgets,
		['Food Budget', 'Transportation Budget'],
		[2023, 2024]
	);

	expect(result['Food Budget']![2023]).toEqual(budgets[0]);
	expect(result['Food Budget']![2024]).toEqual(budgets[1]);
	expect(result['Transportation Budget']![2023]).toBeNull();
	expect(result['Transportation Budget']![2024]).toEqual(budgets[2]);
});

test('createActualSpendingLookupMap - empty arrays', () => {
	const result = createActualSpendingLookupMap([], [], []);
	expect(result).toEqual({});
});

test('createActualSpendingLookupMap - single entry', () => {
	const spending: ActualSpending[] = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			actualAmount: -50000
		}
	];

	const result = createActualSpendingLookupMap(spending, ['Food Budget'], [2024]);

	expect(result['Food Budget']![2024]).toBe(-50000);
});

test('createActualSpendingLookupMap - missing data defaults to 0', () => {
	const spending: ActualSpending[] = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			actualAmount: -50000
		}
	];

	const result = createActualSpendingLookupMap(spending, ['Food Budget'], [2023, 2024]);

	expect(result['Food Budget']![2023]).toBe(0);
	expect(result['Food Budget']![2024]).toBe(-50000);
});

test('createMonthlySpendingLookupMap - empty arrays', () => {
	const result = createMonthlySpendingLookupMap([], [], []);
	expect(result).toEqual({});
});

test('createMonthlySpendingLookupMap - single budget with some months', () => {
	const spending = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			month: 1,
			monthlyAmount: -10000
		},
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			month: 3,
			monthlyAmount: -12000
		}
	];

	const result = createMonthlySpendingLookupMap(spending, ['Food Budget'], [2024]);

	// Months with data
	expect(result['Food Budget']![2024]![1]).toBe(-10000);
	expect(result['Food Budget']![2024]![3]).toBe(-12000);

	// Months without data should default to 0
	expect(result['Food Budget']![2024]![2]).toBe(0);
	expect(result['Food Budget']![2024]![12]).toBe(0);

	// All 12 months should exist
	expect(Object.keys(result['Food Budget']![2024]!)).toHaveLength(12);
});

test('createMonthlySpendingLookupMap - multiple budgets and years', () => {
	const spending = [
		{
			budgetName: 'Food Budget',
			budgetYear: 2024,
			month: 1,
			monthlyAmount: -10000
		},
		{
			budgetName: 'Transportation Budget',
			budgetYear: 2024,
			month: 1,
			monthlyAmount: -5000
		},
		{
			budgetName: 'Food Budget',
			budgetYear: 2023,
			month: 12,
			monthlyAmount: -8000
		}
	];

	const result = createMonthlySpendingLookupMap(
		spending,
		['Food Budget', 'Transportation Budget'],
		[2023, 2024]
	);

	expect(result['Food Budget']![2024]![1]).toBe(-10000);
	expect(result['Transportation Budget']![2024]![1]).toBe(-5000);
	expect(result['Food Budget']![2023]![12]).toBe(-8000);

	// Missing data should default to 0
	expect(result['Transportation Budget']![2023]![1]).toBe(0);
	expect(result['Food Budget']![2023]![1]).toBe(0);
});
