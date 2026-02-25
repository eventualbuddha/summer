import { Surreal } from 'surrealdb';
import { applyMigrations } from './migrations';

const SURREALDB_URL = process.env.SURREALDB_URL || process.env.BACKEND_SURREALDB_HTTP_URL || '';
const SURREALDB_NAMESPACE =
	process.env.SURREALDB_NAMESPACE || process.env.DEFAULT_NAMESPACE || 'summer';
const SURREALDB_DATABASE =
	process.env.SURREALDB_DATABASE || process.env.DEFAULT_DATABASE || 'summer';

let db: Surreal | undefined;

async function connect(): Promise<Surreal> {
	const instance = new Surreal();
	try {
		await instance.connect(SURREALDB_URL);
		// Create namespace/database if they don't exist (handles fresh SurrealDB starts)
		await instance.query(`DEFINE NAMESPACE IF NOT EXISTS ${SURREALDB_NAMESPACE}`);
		await instance.use({ namespace: SURREALDB_NAMESPACE });
		await instance.query(`DEFINE DATABASE IF NOT EXISTS ${SURREALDB_DATABASE}`);
		await instance.use({ namespace: SURREALDB_NAMESPACE, database: SURREALDB_DATABASE });
		await applyMigrations(instance);
		return instance;
	} catch (err) {
		try {
			await instance.close();
		} catch {
			// ignore close errors
		}
		throw err;
	}
}

export async function getDb(): Promise<Surreal> {
	if (db) {
		// Verify connection is still valid
		try {
			await db.query('SELECT * FROM migration LIMIT 0');
			return db;
		} catch {
			db = undefined;
		}
	}

	db = await connect();
	return db;
}
