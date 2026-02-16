import { expect, test } from 'vitest';
import { StringRecordId } from 'surrealdb';
import { parseRecord, serializeRecord } from './serialization';
import assert from 'node:assert';

test.each([
	null,
	0,
	1,
	1.1,
	'test',
	Buffer.of(1, 2, 3),
	new StringRecordId('test:1'),
	[1, 2, 3],
	{ a: 8 },
	{
		a: [{ b: 1, c: [0] }, -12345],
		id: new StringRecordId('table:bob'),
		p: { buf: Buffer.of(1, 2, 3, 4, 5) }
	}
])('%o', (value) => {
	expect(parseRecord(serializeRecord({ a: value }))).toEqual({
		type: 'record',
		value: { a: value }
	});
});

test('date', () => {
	const date = new Date();
	const roundTripped = parseRecord(serializeRecord({ date }));
	assert(roundTripped.type === 'record');
	const roundTrippedDate = roundTripped.value.date as Date;
	expect(roundTrippedDate.toDateString()).toEqual(date.toDateString());
});
