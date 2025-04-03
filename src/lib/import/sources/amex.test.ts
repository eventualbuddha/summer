import { expect, test } from 'vitest';
import * as fixtures from '../../../../tests/fixtures';
import { parseStatementSummary } from './amex';

test('checking account summary', async () => {
	expect(parseStatementSummary(fixtures.amex.skymiles.statement.pages[0]!)).toMatchSnapshot();
});
