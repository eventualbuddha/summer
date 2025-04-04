import { Result } from '@badrap/result';
import { expect, test } from 'vitest';
import { parseAmount, ParseMoneyError } from './money';

test('parseAmount success', () => {
	expect(parseAmount('0')).toEqual(Result.ok(0));
	expect(parseAmount('$0.00')).toEqual(Result.ok(0));
	expect(parseAmount('$123.45')).toEqual(Result.ok(12345));
	expect(parseAmount('$9,123.45')).toEqual(Result.ok(912345));
	expect(parseAmount('($9,123.45)')).toEqual(Result.ok(-912345));
	expect(parseAmount(' (  $9,123.45 )   ')).toEqual(Result.ok(-912345));
	expect(parseAmount('-$9,123.45')).toEqual(Result.ok(-912345));
	expect(parseAmount(' -  $9,123.45    ')).toEqual(Result.ok(-912345));
	expect(parseAmount('+$123.45')).toEqual(Result.ok(12345));
});

test('parseAmount failure', () => {
	expect(parseAmount('')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format: '))
	);
	expect(parseAmount('abc')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format: abc'))
	);
	expect(parseAmount('$abc')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format: $abc'))
	);
	expect(parseAmount('$123.456')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format: $123.456'))
	);
	expect(parseAmount('($123.456)')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format: ($123.456)'))
	);
	expect(parseAmount(' (  $123.456 )   ')).toEqual(
		Result.err(new ParseMoneyError('Money does not match expected format:  (  $123.456 )   '))
	);
	expect(parseAmount(' ( 0 ')).toEqual(
		Result.err(new ParseMoneyError('Money has mismatched parentheses:  ( 0 '))
	);
	expect(parseAmount('-($123.45)')).toEqual(
		Result.err(new ParseMoneyError('Money cannot have both a sign and parentheses: -($123.45)'))
	);
});
