import { expect, test } from 'bun:test';
import { BudgetSchema, type Budget, type Category } from '../db';

test('BudgetSchema validation', () => {
	const validCategory: Category = {
		id: 'category1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	const validBudget: Budget = {
		id: 'budget1',
		name: 'Monthly Budget',
		year: 2025,
		amount: 1000,
		categories: [validCategory]
	};

	// Valid budget should pass
	expect(() => BudgetSchema.parse(validBudget)).not.toThrow();

	// Missing required fields should fail
	expect(() =>
		BudgetSchema.parse({
			...validBudget,
			name: ''
		})
	).toThrow();

	expect(() =>
		BudgetSchema.parse({
			...validBudget,
			id: ''
		})
	).toThrow();

	// Invalid year type should fail
	expect(() =>
		BudgetSchema.parse({
			...validBudget,
			year: '2025' // string instead of number
		})
	).toThrow();

	// Negative amount should pass (budget schema allows any number)
	expect(() =>
		BudgetSchema.parse({
			...validBudget,
			amount: -100
		})
	).not.toThrow();

	// Empty categories array should pass
	expect(() =>
		BudgetSchema.parse({
			...validBudget,
			categories: []
		})
	).not.toThrow();
});

test('Budget amount handling', () => {
	const validCategory: Category = {
		id: 'category1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	// Test various amount values
	const testAmounts = [0, 0.01, 100, 1000.5, 999999.99];

	for (const amount of testAmounts) {
		const budget: Budget = {
			id: 'budget1',
			name: 'Test Budget',
			year: 2025,
			amount,
			categories: [validCategory]
		};

		expect(() => BudgetSchema.parse(budget)).not.toThrow();
		const parsed = BudgetSchema.parse(budget);
		expect(parsed.amount).toBe(amount);
	}
});

test('Budget year handling', () => {
	const validCategory: Category = {
		id: 'category1',
		name: 'Food',
		emoji: '🍕',
		color: 'red-200',
		ordinal: 1
	};

	const budget: Budget = {
		id: 'budget1',
		name: 'Test Budget',
		year: 2025,
		amount: 1000,
		categories: [validCategory]
	};

	const parsed = BudgetSchema.parse(budget);
	expect(parsed.year).toBe(2025);
	expect(typeof parsed.year).toBe('number');
});

test('Budget categories handling', () => {
	const categories: Category[] = [
		{
			id: 'category1',
			name: 'Food',
			emoji: '🍕',
			color: 'red-200',
			ordinal: 1
		},
		{
			id: 'category2',
			name: 'Transportation',
			emoji: '🚗',
			color: 'blue-200',
			ordinal: 2
		}
	];

	const budget: Budget = {
		id: 'budget1',
		name: 'Test Budget',
		year: 2025,
		amount: 1000,
		categories
	};

	const parsed = BudgetSchema.parse(budget);
	expect(parsed.categories).toHaveLength(2);
	expect(parsed.categories[0]!.name).toBe('Food');
	expect(parsed.categories[1]!.name).toBe('Transportation');
});
