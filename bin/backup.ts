#!/usr/bin/env bun

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { RecordId, Surreal } from 'surrealdb';

const options = parseArgs({
	args: argv.slice(2),
	strict: true,
	options: {
		help: {
			type: 'boolean',
			short: 'h',
			description: 'Display help information'
		},
		outputPath: {
			type: 'string',
			short: 'o',
			description: 'Output path for backup directory'
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
	stdout.write('Usage: backup [options]\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help      Display help information\n');
	stdout.write('  -o, --output    Output path for backup directory\n');
	stdout.write('  -u, --url       SurrealDB URL [ws://localhost:8000/]\n');
	stdout.write('  -U, --username  SurrealDB Username\n');
	stdout.write('  -n, --namespace SurrealDB Namespace\n');
	stdout.write('  -d, --database  SurrealDB Database\n');
}

if (options.values.help) {
	showHelp();
	exit(0);
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

const outputPath = options.values.outputPath ?? join('backups', new Date().toISOString());
await mkdir(outputPath, { recursive: true });

const [{ tables }] = await db.query<[{ tables: Record<string, string> }]>('INFO FOR DB;');

for (const table of Object.keys(tables)) {
	stdout.write(`Backing up ${table}`);
	const file = createWriteStream(join(outputPath, `${table}.jsonl`));

	for (const record of await db.select(table)) {
		await new Promise((resolve) => file.write(`${serializeRecord(record)}\n`, resolve));
		stdout.write('.');
	}

	file.end();
	stdout.write('\n');
}

await db.close();

function serializeRecord(record: Record<string, unknown>): string {
	return JSON.stringify(toJSON(record));
}

function toJSON(value: unknown): unknown {
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
