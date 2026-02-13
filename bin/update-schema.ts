#!/usr/bin/env node

import { join } from 'node:path';
import { argv, exit, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { backup, OPTIONS } from './backup.ts';
import { restore } from './restore.ts';

function showHelp() {
	stdout.write('Usage: update-schema [options]\n\n');
	stdout.write('Options:\n');
	stdout.write('  -h, --help      Display help information\n');
	stdout.write('  -o, --output    Output path for backup directory\n');
	stdout.write('  -u, --url       SurrealDB URL [http://localhost:8000]\n');
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
		password = await readline.question('Password: ');
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
	stdout.write('\n');

	lastTable = undefined;
	await restore({
		backupPath,
		url,
		username,
		password,
		namespace,
		database,
		overwriteDatabase: true,
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

if (import.meta.main) {
	const exitCode = await main(argv);
	exit(exitCode);
}
