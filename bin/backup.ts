#!/usr/bin/env bun

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { RecordId, Surreal } from 'surrealdb';
import { serializeRecord } from '../src/lib/serialization';

export const OPTIONS = {
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
} as const;

export async function backup({
	backupPath,
	url,
	namespace,
	database,
	username,
	password,
	progress
}: {
	backupPath: string;
	url: string;
	namespace: string;
	database: string;
	username?: string;
	password?: string;
	progress?: (table: string) => void;
}) {
	const db = new Surreal();
	await db.connect(url);

	if (username && password) {
		await db.signin({ username, password });
	}

	await db.use({ namespace, database });

	const [{ tables }] = await db.query<[{ tables: Record<string, string> }]>('INFO FOR DB;');

	await mkdir(backupPath, { recursive: true });

	for (const table of Object.keys(tables)) {
		const file = createWriteStream(join(backupPath, `${table}.jsonl`));

		for (const record of await db.select(table)) {
			if (record.in instanceof RecordId && record.out instanceof RecordId) {
				await new Promise((resolve) => file.write('RELATE: ', resolve));
			}

			await new Promise((resolve) => file.write(`${serializeRecord(record)}\n`, resolve));
			progress?.(table);
		}

		file.end();
	}

	await db.close();
}

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

export async function main(argv: readonly string[]): Promise<number> {
	const options = parseArgs({
		args: argv.slice(2),
		strict: true,
		options: OPTIONS
	});

	if (options.values.help) {
		showHelp();
		return 0;
	}

	if (!options.values.url) {
		stdout.write('Error: URL is required\n');
		showHelp();
		return 1;
	}

	if (!options.values.namespace) {
		stdout.write('Error: Namespace is required\n');
		showHelp();
		return 1;
	}

	if (!options.values.database) {
		stdout.write('Error: Database is required\n');
		showHelp();
		return 1;
	}

	const { url, username, namespace, database } = options.values;
	let password: string | undefined;

	if (username) {
		const readline = createInterface(stdin);
		// work around a bug in Bun where readline.question() doesn't print the prompt
		stdout.write('Password: ');
		password = await readline.question('');
	}

	const backupPath = options.values.outputPath ?? join('backups', new Date().toISOString());
	stdout.write(`Backing up to ${backupPath}\n`);

	let lastTable: string | undefined;
	await backup({
		backupPath,
		url,
		username,
		password,
		namespace,
		database,
		progress(table) {
			if (table !== lastTable) {
				if (lastTable) {
					stdout.write('\n');
				}
				stdout.write(`Backing up ${table}`);
			}
			stdout.write('.');
			lastTable = table;
		}
	});

	return 0;
}

if (import.meta.main) {
	const exitCode = await main(argv);
	exit(exitCode);
}
