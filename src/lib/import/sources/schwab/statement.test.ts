import { expect, test } from 'vitest';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatement } from './statement';
import { ParseStatementError } from '$lib/import/parse/errors';

test('transactions', () => {
	const importedTransactions = parseStatement(fixtures.schwab.checking.statement())
		.filter((result) => result.isOk)
		.map((result) => result.value)
		.toArray();

	expect(importedTransactions).toMatchSnapshot();
});

test('summary mismatch', () => {
	const statementSummaryErrors = parseStatement(fixtures.schwab.checking.statement())
		.filter((result) => result.isErr)
		.toArray();
	expect(statementSummaryErrors).toEqual([]);

	const statement = fixtures.schwab.checking.statement();
	for (const page of statement.pages) {
		for (const text of page.texts) {
			if (text.str === '$1,594.08') {
				Object.defineProperty(text, 'str', { value: '$1,594.07', configurable: true });
			}
		}
	}

	const afterModificationErrors = parseStatement(statement)
		.filter((result) => result.isErr)
		.map(({ error }) => error)
		.toArray();
	expect(afterModificationErrors).toEqual([
		ParseStatementError.InvalidValue(
			'Ending balance does not match the computed value: 159407 ≠ 159408'
		)
	]);
});
