import { Result } from '@badrap/result';
import { lazy } from '@nfnitloop/better-iterators';
import { expect, test } from 'vitest';
import * as fixtures from '../../../../tests/fixtures';
import { parseStatement, InvalidStatementSummaryError, parseStatementSummary } from './schwab';

test('checking account summary', async () => {
	expect(
		lazy(fixtures.schwab.checking.statement.pages)
			.map(parseStatementSummary)
			.filter((result) => result.isOk)
			.first().value
	).toMatchSnapshot();
});

test('checking account transactions', async () => {
	const importedTransactions = await lazy(parseStatement(fixtures.schwab.checking.statement))
		.filter((result) => result.isOk)
		.map((result) => result.value)
		.toArray();

	expect(importedTransactions).toMatchSnapshot();
});

test('checking account summary mismatch', async () => {
	const statementSummaryErrors = await lazy(parseStatement(fixtures.schwab.checking.statement))
		.filter((result) => result.isErr && result.error instanceof InvalidStatementSummaryError)
		.toArray();
	expect(statementSummaryErrors).toHaveLength(0);

	for (const page of fixtures.schwab.checking.statement.pages) {
		for (const text of page.texts) {
			if (text.str === '$1,594.08') {
				Object.defineProperty(text, 'str', { value: '$1,594.07', configurable: true });
			}
		}
	}

	const afterModificationErrors = await lazy(parseStatement(fixtures.schwab.checking.statement))
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
