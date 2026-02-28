import { expect, test } from 'vitest';
import { normalizeForMatching } from './normalizeForMatching';

test('lowercases and trims whitespace', () => {
	expect(normalizeForMatching('STARBUCKS COFFEE')).toBe('starbucks coffee');
	expect(normalizeForMatching('  STARBUCKS  COFFEE  ')).toBe('starbucks coffee');
});

test('strips payment processor prefixes via tidyBankDescription', () => {
	expect(normalizeForMatching('SQ STARBUCKS COFFEE')).toBe('starbucks coffee');
	expect(normalizeForMatching('TST LITTLE ITALY')).toBe('little italy');
	expect(normalizeForMatching('DD DOORDASH PIZZA')).toBe('pizza');
});

test('strips store numbers (#digits)', () => {
	expect(normalizeForMatching('STARBUCKS #1234')).toBe('starbucks');
	expect(normalizeForMatching('TRADER JOES #42')).toBe('trader joes');
});

test('strips asterisk reference codes (*UPPERCASE4+)', () => {
	expect(normalizeForMatching('STARBUCKS *ABCD1234')).toBe('starbucks');
	expect(normalizeForMatching('NETFLIX.COM *NETF1234')).toBe('netflix.com');
});

test('strips embedded dates (MM/DD)', () => {
	expect(normalizeForMatching('CHECKCARD 01/15 STARBUCKS')).toBe('checkcard starbucks');
	expect(normalizeForMatching('PURCHASE 12/31 AMAZON')).toBe('purchase amazon');
});

test('strips trailing digit-only tokens', () => {
	expect(normalizeForMatching('STARBUCKS COFFEE 98765')).toBe('starbucks coffee');
});

test('handles combined normalizations', () => {
	// SQ prefix + store number + trailing digits
	expect(normalizeForMatching('SQ STARBUCKS #123 98765')).toBe('starbucks');
	// asterisk code + embedded date
	expect(normalizeForMatching('AMAZON *ABCD1234 01/15')).toBe('amazon');
});

test('returns empty string for empty input', () => {
	expect(normalizeForMatching('')).toBe('');
});

test('collapses multiple internal spaces after stripping', () => {
	// After stripping #123, "TRADER  JOES" has a double space — should collapse
	expect(normalizeForMatching('TRADER  JOES')).toBe('trader joes');
});
