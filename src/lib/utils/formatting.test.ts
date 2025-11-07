import { expect, test } from 'bun:test';
import { formatTransactionAmount, formatWholeDollarAmount } from './formatting';

test('formatTransactionAmount', () => {
	expect(formatTransactionAmount(123456789)).toBe('+$1,234,567.89');
	expect(formatTransactionAmount(-123456789)).toBe('$1,234,567.89');
});

test('formatWholeDollarAmount', () => {
	expect(formatWholeDollarAmount(123456789)).toBe('+$1,234,568');
	expect(formatWholeDollarAmount(-123456789)).toBe('$1,234,568');
});

test('formatWholeDollarAmount with hideSign option', () => {
	// With hideSign: false (default behavior)
	expect(formatWholeDollarAmount(123456789, { hideSign: false })).toBe('+$1,234,568');
	expect(formatWholeDollarAmount(-123456789, { hideSign: false })).toBe('$1,234,568');

	// With hideSign: true (no sign for positive or negative)
	expect(formatWholeDollarAmount(123456789, { hideSign: true })).toBe('$1,234,568');
	expect(formatWholeDollarAmount(-123456789, { hideSign: true })).toBe('$1,234,568');

	// Edge cases
	expect(formatWholeDollarAmount(0, { hideSign: true })).toBe('$0');
	expect(formatWholeDollarAmount(100, { hideSign: true })).toBe('$1');
	expect(formatWholeDollarAmount(-100, { hideSign: true })).toBe('$1');
});
