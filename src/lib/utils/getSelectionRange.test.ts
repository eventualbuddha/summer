import { expect, test } from 'bun:test';
import { getSelectionRange } from './getSelectionRange';
import type { Selection } from '$lib/types';

test('empty selection', () => {
	expect(getSelectionRange([])).toBeUndefined();
});

test('single selection', () => {
	const selections: Selection<number>[] = [{ selected: true, value: 1, key: '1' }];
	expect(getSelectionRange(selections)).toEqual([selections[0]!, selections[0]!]);
});

test.each([
	[[false, false, false], undefined],
	[
		[true, false, false],
		[0, 0]
	],
	[
		[false, true, false],
		[1, 1]
	],
	[
		[false, false, true],
		[2, 2]
	],
	[
		[true, true, false],
		[0, 1]
	],
	[[true, false, true], undefined],
	[
		[false, true, true],
		[1, 2]
	]
] as const)('multiple selections: %o', (selecteds, range) => {
	const selections: Selection<number>[] = [
		{ selected: selecteds[0], value: 0, key: '0' },
		{ selected: selecteds[1], value: 1, key: '1' },
		{ selected: selecteds[2], value: 2, key: '2' }
	];
	expect<unknown>(getSelectionRange(selections)?.map((s) => s.value)).toEqual(range);
});
