import { expect, test } from 'bun:test';
import { apple } from '../../../../../tests/fixtures';
import { parseStatementSummary } from './summary';

test('parse summary', () => {
	expect(parseStatementSummary(apple.statement())).toMatchSnapshot();
});
