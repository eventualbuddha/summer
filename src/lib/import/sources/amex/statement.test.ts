import { expect, test } from 'bun:test';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatement } from './statement';
import { parseStatementSummary } from './summary';

test('account summary', () => {
	expect(parseStatementSummary(fixtures.amex.skymiles.statement.pages[0]!)).toMatchSnapshot();
});

test('transactions', async () => {
	expect(parseStatement(fixtures.amex.skymiles.statement).toArray()).toMatchSnapshot();
});
