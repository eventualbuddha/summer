import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Surreal } from 'surrealdb';

interface AppliedMigration {
	name: string;
	applied_at: Date;
}

/**
 * Apply all pending database migrations.
 *
 * @param db - Connected and authenticated Surreal instance with namespace/database selected
 * @param migrationsDir - Path to migrations directory (defaults to /migrations in project root)
 * @param progress - Optional callback for progress updates
 * @returns Number of migrations applied (0 if all up to date)
 */
export async function applyMigrations(
	db: Surreal,
	migrationsDir?: string,
	progress?: (message: string) => void
): Promise<number> {
	// Migrations directory is always at project root
	// If migrations dir starts with /, it's already absolute
	// Otherwise, resolve from process.cwd() (which is project root when running via node server.js or npm)
	const defaultDir =
		migrationsDir || (process.env.MIGRATIONS_DIR ?? join(process.cwd(), 'migrations'));
	const dir = isAbsolute(defaultDir) ? defaultDir : resolve(process.cwd(), defaultDir);

	// Ensure migrations table exists
	const migrationTableSql = await readFile(join(dir, '000_migrations_table.surql'), 'utf8');
	try {
		await db.query(migrationTableSql);
	} catch (err) {
		// Only ignore the specific "already exists" error; rethrow everything else
		if (!(err instanceof Error) || !/already exists/i.test(err.message)) {
			throw err;
		}
	}

	// Get list of applied migrations
	const [result] = await db.query<[AppliedMigration[]]>(
		'SELECT name, applied_at FROM migration ORDER BY applied_at ASC;'
	);
	const appliedMigrations = new Set(result.map((m) => m.name));

	// Get list of migration files
	const files = (await readdir(dir)).filter((f) => f.endsWith('.surql')).sort();

	let pendingCount = 0;

	for (const filename of files) {
		const migrationName = filename.replace('.surql', '');

		// Skip the migrations table setup itself
		if (migrationName === '000_migrations_table') {
			continue;
		}

		// Check if migration has already been applied
		if (appliedMigrations.has(migrationName)) {
			progress?.(`✓ ${migrationName} (already applied)`);
			continue;
		}

		// Apply the migration
		progress?.(`→ Applying ${migrationName}...`);
		const migrationSql = await readFile(join(dir, filename), 'utf8');

		// Run the migration and record it as applied atomically to avoid concurrent runners
		const transactionalSql = `
BEGIN TRANSACTION;

LET $claim = (CREATE ONLY migration:${migrationName} SET name = $name, applied_at = time::now());

IF $claim != NONE THEN {
${migrationSql}
	UPDATE $claim SET applied_at = time::now();
};

COMMIT TRANSACTION;
		`;

		await db.query(transactionalSql, { name: migrationName });
		progress?.(`✓ ${migrationName} (applied successfully)`);
		pendingCount++;
	}

	if (pendingCount === 0) {
		progress?.('All migrations are up to date!');
	} else {
		progress?.(`Applied ${pendingCount} migration(s) successfully!`);
	}

	return pendingCount;
}
