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
