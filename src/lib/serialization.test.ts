import { StringRecordId } from 'surrealdb';
import { expect, test } from 'vitest';
import { parseRecord, serializeRecord } from './serialization';

test.each([
	null,
	0,
	1,
	1.1,
	'test',
	Buffer.of(1, 2, 3),
	new Date(),
	new StringRecordId('test:1'),
	[1, 2, 3],
	{ a: 8, b: new Date() },
	{
		a: [{ b: 1, c: [0] }, -12345],
		id: new StringRecordId('table:bob'),
		p: { date: new Date(), buf: Buffer.of(1, 2, 3, 4, 5) }
	}
])('%o', (value) => {
	expect(parseRecord(serializeRecord({ a: value }))).toEqual({ a: value });
});
