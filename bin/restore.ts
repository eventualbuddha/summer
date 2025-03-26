#!/usr/bin/env bun

import { createReadStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path, { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { StringRecordId, Surreal } from 'surrealdb';

const options = parseArgs({
	args: argv.slice(2),
	strict: true,
	options: {
		help: {
			type: 'boolean',
			short: 'h',
			description: 'Display help information'
		},
		inputPath: {
			type: 'string',
			short: 'i',
			description: 'Input path for backup directory'
		},
		url: {
			type: 'string',
			short: 'u',
			description: 'SurrealDB URL',
			default: 'ws://localhost:8000/'
		},
		username: {
			type: 'string',
			short: 'U',
			description: 'SurrealDB Username'
		},
		password: {
			type: 'string',
			short: 'p',
			description: 'SurrealDB Password'
		},
		namespace: {
			type: 'string',
			short: 'n',
			description: 'SurrealDB Namespace'
		},
		database: {
			type: 'string',
			short: 'd',
			description: 'SurrealDB Database'
		}
	}
});

function showHelp() {
	stdout.write('Usage: restore [options]\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help      Display help information\n');
	stdout.write('  -i, --input     Input path for backup directory (required)\n');
	stdout.write('  -u, --url       SurrealDB URL [ws://localhost:8000/]\n');
	stdout.write('  -U, --username  SurrealDB Username\n');
	stdout.write('  -p, --password  SurrealDB Password\n');
	stdout.write('  -n, --namespace SurrealDB Namespace (required)\n');
	stdout.write('  -d, --database  SurrealDB Database (required)\n');
}

if (options.values.help) {
	showHelp();
	exit(0);
}

if (!options.values.inputPath) {
	stdout.write('Error: Input path is required\n');
	showHelp();
	exit(1);
}

if (!options.values.url) {
	stdout.write('Error: URL is required\n');
	showHelp();
	exit(1);
}

if (!options.values.namespace) {
	stdout.write('Error: Namespace is required\n');
	showHelp();
	exit(1);
}

if (!options.values.database) {
	stdout.write('Error: Database is required\n');
	showHelp();
	exit(1);
}

const db = new Surreal();
await db.connect(options.values.url);

if (options.values.username) {
	const readline = createInterface(stdin);
	// work around a bug in Bun where readline.question() doesn't print the prompt
	stdout.write('Password: ');
	const password = await readline.question('');
	await db.signin({
		username: options.values.username,
		password: password
	});
}

await db.use({ namespace: options.values.namespace, database: options.values.database });

const schema = await readFile(join(import.meta.dirname, '../static/schema.surql'), 'utf8');

stdout.write('Restoring schema…');
await db.query(schema);
stdout.write('\n');

const files = await readdir(options.values.inputPath);

for (const filename of files) {
	const parts = path.parse(filename);

	if (parts.ext !== '.jsonl') {
		continue;
	}

	const table = parts.name;

	stdout.write(`Restoring ${table}`);
	const file = createReadStream(join(options.values.inputPath, filename));
	const lines = createInterface(file);

	for await (const line of lines) {
		const record = parseRecord(line);

		if ('id' in record && typeof record.id === 'string') {
			record.id = new StringRecordId(record.id);
		}

		await db.create(table, record);
		stdout.write('.');
	}

	stdout.write('\n');
}

await db.close();

function parseRecord(json: string): Record<string, unknown> {
	return JSON.parse(json, (key, value) => {
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
}
