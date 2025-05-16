import { expect, test } from 'bun:test';
import * as fixtures from '../../../../../tests/fixtures';
import { parseStatementSummary } from './summary';

test('summary', () => {
	const statementSummary = parseStatementSummary(
		fixtures.schwab.checking.statement().pages[2]!
	).unwrap();
	expect(statementSummary).toMatchSnapshot();
});
