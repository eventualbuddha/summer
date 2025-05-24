import { RecordId, StringRecordId } from 'surrealdb';

export function parseRecord(raw: string): {
	type: 'record' | 'relation';
	value: Record<string, unknown>;
} {
	const match = raw.match(/^RELATE: (.+)$/);
	let type: 'record' | 'relation' = 'record';
	let json = raw;

	if (match) {
		json = match[1] as string;
		type = 'relation';
	}

	const value = JSON.parse(json, (key, value) => {
		if (
			typeof value !== 'object' ||
			value === null ||
			!('type' in value) ||
			!('encoding' in value) ||
			!('value' in value)
		) {
			return value;
		}

		if (value.type === 'Buffer' && value.encoding === 'base64') {
			return Buffer.from(value.value, 'base64');
		}

		if (value.type === 'ArrayBuffer' && value.encoding === 'base64') {
			return Buffer.from(value.value, 'base64').buffer;
		}

		if (value.type === 'Date' && value.encoding === 'ISO') {
			return new Date(value.value);
		}

		if (value.type === 'RecordId' && value.encoding === 'string') {
			return new StringRecordId(value.value);
		}

		throw new Error(`Unsupported type: ${value.type}`);
	});

	return { type, value };
}

export function serializeRecord(record: Record<string, unknown>): string {
	return JSON.stringify(toJSON(record));
}

export function toJSON(value: unknown): unknown {
	if (typeof value !== 'object' || value === null) {
		return value;
	}

	if (Buffer.isBuffer(value)) {
		return {
			type: 'Buffer',
			encoding: 'base64',
			value: value.toString('base64')
		};
	}

	if (value instanceof ArrayBuffer) {
		return {
			type: 'ArrayBuffer',
			encoding: 'base64',
			value: Buffer.from(value).toString('base64')
		};
	}

	if (value instanceof Date) {
		return {
			type: 'Date',
			encoding: 'ISO',
			value: value.toISOString()
		};
	}

	if (value instanceof RecordId) {
		return {
			type: 'RecordId',
			encoding: 'string',
			value: value.toString()
		};
	}

	if (Array.isArray(value)) {
		return value.map(toJSON);
	}

	return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, toJSON(val)]));
}
