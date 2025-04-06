import { Result } from '@badrap/result';
import { expect, test } from 'vitest';
import * as fixtures from '../../../../../tests/fixtures';
import { InvalidStatementSummaryError } from './errors';
import { parseStatement } from './statement';

test('transactions', async () => {
	const importedTransactions = parseStatement(fixtures.schwab.checking.statement)
		.filter((result) => result.isOk)
		.map((result) => result.value)
		.toArray();

	expect(importedTransactions).toMatchSnapshot();
});

test('summary mismatch', async () => {
	const statementSummaryErrors = parseStatement(fixtures.schwab.checking.statement)
		.filter((result) => result.isErr && result.error instanceof InvalidStatementSummaryError)
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
		.filter((result) => result.isErr && result.error instanceof InvalidStatementSummaryError)
		.toArray();
	expect(afterModificationErrors).toEqual([
		Result.err(
			new InvalidStatementSummaryError(
				'Ending balance does not match the computed value',
				expect.any(Object),
				159407,
				159408
			)
		)
	]);
});
