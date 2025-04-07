import { Result } from '@badrap/result';
import { expect, test } from 'vitest';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatement } from './statement';
import { ParseStatementError } from '$lib/import/parse/errors';

test('transactions', async () => {
	const importedTransactions = parseStatement(fixtures.schwab.checking.statement)
		.filter((result) => result.isOk)
		.map((result) => result.value)
		.toArray();

	expect(importedTransactions).toMatchSnapshot();
});

test('summary mismatch', async () => {
	const statementSummaryErrors = parseStatement(fixtures.schwab.checking.statement)
		.filter((result) => result.isErr)
		.toArray();
	expect(statementSummaryErrors).toEqual([]);

	for (const page of fixtures.schwab.checking.statement.pages) {
		for (const text of page.texts) {
			if (text.str === '$1,594.08') {
				Object.defineProperty(text, 'str', { value: '$1,594.07', configurable: true });
			}
		}
	}

	const afterModificationErrors = parseStatement(fixtures.schwab.checking.statement)
		.filter((result) => result.isErr)
		.toArray();
	expect(afterModificationErrors).toEqual([
		Result.err(
			ParseStatementError.InvalidValue(
				'Ending balance does not match the computed value: 159407 ≠ 159408'
			)
		)
	]);
});
