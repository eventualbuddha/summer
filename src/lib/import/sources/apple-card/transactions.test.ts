import { expect, test } from 'bun:test';
import { parseTransactions } from './transactions';
import { apple } from '../../../../../tests/fixtures';

test('parse transactions', () => {
	expect(
		parseTransactions(apple.statement())
			.toArray()
			.map((r) => r.unwrap())
	).toMatchSnapshot();
});
