import { expect, test } from 'vitest';
import { apple } from '../../../../../tests/fixtures';
import { parseStatementSummary } from './summary';

test('parse summary', () => {
	expect(parseStatementSummary(apple.statement())).toMatchSnapshot();
});
