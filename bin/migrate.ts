#!/usr/bin/env node

import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { Surreal } from 'surrealdb';
import { applyMigrations } from '../src/lib/server/migrations.ts';

export const OPTIONS = {
	help: {
		type: 'boolean',
		short: 'h',
		description: 'Display help information'
	},
	url: {
		type: 'string',
		short: 'u',
		description: 'SurrealDB URL',
		default: 'http://localhost:8001'
	},
	username: {
		type: 'string',
		short: 'U',
		description: 'SurrealDB Username'
	},
	namespace: {
		type: 'string',
		short: 'n',
		description: 'SurrealDB Namespace',
		default: 'summer'
	},
	database: {
		type: 'string',
		short: 'd',
		description: 'SurrealDB Database',
		default: 'summer'
	}
} as const;

function showHelp() {
	stdout.write('Usage: migrate [options]\n\n');
	stdout.write('Apply pending database migrations to SurrealDB.\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help      Display help information\n');
	stdout.write('  -u, --url       SurrealDB URL [http://localhost:8001]\n');
	stdout.write('  -U, --username  SurrealDB Username\n');
	stdout.write('  -n, --namespace SurrealDB Namespace [summer]\n');
	stdout.write('  -d, --database  SurrealDB Database [summer]\n\n');
	stdout.write('Examples:\n');
	stdout.write('  # Use defaults (localhost:8001, summer/summer)\n');
	stdout.write('  migrate\n\n');
	stdout.write('  # Use custom endpoint\n');
	stdout.write('  migrate -u http://localhost:8000 -n test -d test\n\n');
	stdout.write('  # With authentication\n');
	stdout.write('  migrate -u http://localhost:8000 -U root\n');
}

export async function migrate({
	url,
	namespace,
	database,
	username,
	password,
	progress
}: {
	url: string;
	namespace: string;
	database: string;
	username?: string;
	password?: string;
	progress?: (message: string) => void;
}): Promise<number> {
	const db = new Surreal();
	await db.connect(url);

	if (username && password) {
		await db.signin({ username, password });
	}

	await db.use({ namespace, database });

	progress?.('Ensuring migrations table exists...');
	progress?.('Checking for applied migrations...');

	try {
		await applyMigrations(db, undefined, progress);
		await db.close();
		return 0;
	} catch (error) {
		if (error instanceof Error) {
			stdout.write(`\nError: ${error.message}\n`);
		}
		await db.close();
		return 1;
	}
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

	const url = options.values.url ?? 'http://localhost:8001';
	const namespace = options.values.namespace ?? 'summer';
	const database = options.values.database ?? 'summer';
	const username = options.values.username;

	let password: string | undefined;
	if (username) {
		const readline = createInterface(stdin);
		password = await readline.question('Password: ');
	}

	stdout.write(`Connecting to ${url} (namespace: ${namespace}, database: ${database})\n`);

	const exitCode = await migrate({
		url,
		namespace,
		database,
		username,
		password,
		progress(message) {
			stdout.write(`${message}\n`);
		}
	});

	return exitCode;
}

if (import.meta.main) {
	const exitCode = await main(argv);
	exit(exitCode);
}
