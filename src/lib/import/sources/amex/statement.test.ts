import { expect, test } from 'vitest';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatement } from './statement';
import { parseStatementSummary } from './summary';

test('account summary', async () => {
	expect(parseStatementSummary(fixtures.amex.skymiles.statement.pages[0]!)).toMatchSnapshot();
});

test('transactions', async () => {
	expect(parseStatement(fixtures.amex.skymiles.statement).toArray()).toMatchSnapshot();
});
