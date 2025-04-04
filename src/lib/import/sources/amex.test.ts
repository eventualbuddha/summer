import { lazy } from '@nfnitloop/better-iterators';
import { expect, test } from 'vitest';
import * as fixtures from '../../../../tests/fixtures';
import { parseStatement, parseStatementSummary } from './amex';

test('account summary', async () => {
	expect(parseStatementSummary(fixtures.amex.skymiles.statement.pages[0]!)).toMatchSnapshot();
});

test('transactions', async () => {
	expect(await lazy(parseStatement(fixtures.amex.skymiles.statement)).toArray()).toMatchSnapshot();
});
