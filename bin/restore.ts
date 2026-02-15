#!/usr/bin/env node

import assert from 'node:assert';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path, { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { StringRecordId, Surreal } from 'surrealdb';
import { parseRecord } from '../src/lib/serialization.ts';
import { applyMigrations } from '../src/lib/server/migrations.ts';

export const OPTIONS = {
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
		default: 'http://localhost:8000'
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
	},
	force: {
		type: 'boolean',
		short: 'f',
		description: 'Force overwrite an existing database'
	}
} as const;

export async function restore({
	backupPath,
	url,
	namespace,
	database,
	overwriteDatabase,
	username,
	password,
	progress
}: {
	backupPath: string;
	url: string;
	namespace: string;
	database: string;
	overwriteDatabase?: boolean;
	username?: string;
	password?: string;
	progress?: (table: string) => void;
}) {
	const db = new Surreal();
	await db.connect(url);

	if (username && password) {
		await db.signin({
			username,
			password
		});
	}

	await db.use({ namespace });

	if (database.includes('`')) {
		throw new Error('Database name must not include backticks');
	}

	if (overwriteDatabase) {
		await db.query(`DEFINE DATABASE OVERWRITE \`${database}\`;`);
	} else {
		await db.query(`DEFINE DATABASE \`${database}\`;`);
	}

	await db.use({ namespace, database });

	// Apply migrations to set up schema
	await applyMigrations(db);

	const files = await readdir(backupPath);

	for (const filename of files) {
		const parts = path.parse(filename);

		if (parts.ext !== '.jsonl') {
			continue;
		}

		const table = parts.name;
		const file = createReadStream(join(backupPath, filename));
		const lines = createInterface(file);

		for await (const line of lines) {
			const parsed = parseRecord(line);

			switch (parsed.type) {
				case 'record': {
					const record = parsed.value;
					if ('id' in record && typeof record.id === 'string') {
						record.id = new StringRecordId(record.id);
					}

					await db.create(table, record);
					break;
				}

				case 'relation': {
					const { in: inId, out: outId, ...data } = parsed.value;
					assert(inId instanceof StringRecordId);
					assert(outId instanceof StringRecordId);
					await db.relate(inId, table, outId, data);
					break;
				}

				default: {
					throw new Error(`Unknown type: ${parsed.type}`);
				}
			}

			progress?.(table);
		}
	}

	await db.close();
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

	if (!options.values.inputPath) {
		stdout.write('Error: Input path is required\n');
		showHelp();
		return 1;
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

	const username = options.values.username;
	let password: string | undefined;
	if (username) {
		const readline = createInterface(stdin);
		password = await readline.question('Password: ');
	}

	let lastTable: string | undefined;
	await restore({
		backupPath: options.values.inputPath,
		url: options.values.url,
		namespace: options.values.namespace,
		database: options.values.database,
		overwriteDatabase: options.values.force,
		username,
		password,
		progress(table) {
			if (table !== lastTable) {
				if (lastTable) {
					stdout.write('\n');
				}
				stdout.write(`Restoring ${table}`);
			}
			stdout.write('.');
			lastTable = table;
		}
	});

	return 0;
}

function showHelp() {
	stdout.write('Usage: restore [options]\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help      Display help information\n');
	stdout.write('  -i, --input     Input path for backup directory (required)\n');
	stdout.write('  -u, --url       SurrealDB URL [http://localhost:8000]\n');
	stdout.write('  -U, --username  SurrealDB Username\n');
	stdout.write('  -p, --password  SurrealDB Password\n');
	stdout.write('  -n, --namespace SurrealDB Namespace (required)\n');
	stdout.write('  -d, --database  SurrealDB Database (required)\n');
}

if (import.meta.main) {
	const exitCode = await main(argv);
	exit(exitCode);
}
