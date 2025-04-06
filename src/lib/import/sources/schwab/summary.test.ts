import { expect, test } from 'vitest';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatementSummary } from './summary';

test('summary', async () => {
	const statementSummary = parseStatementSummary(
		fixtures.schwab.checking.statement.pages[2]!
	).unwrap();
	expect(statementSummary).toMatchSnapshot();
});
