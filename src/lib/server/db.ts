import Surreal from 'surrealdb';
import { applyMigrations } from './migrations';

const SURREALDB_URL = process.env.SURREALDB_URL || process.env.BACKEND_SURREALDB_HTTP_URL || '';
const SURREALDB_NAMESPACE =
	process.env.SURREALDB_NAMESPACE || process.env.DEFAULT_NAMESPACE || 'summer';
const SURREALDB_DATABASE =
	process.env.SURREALDB_DATABASE || process.env.DEFAULT_DATABASE || 'summer';

let db: Surreal | undefined;

export async function getDb(): Promise<Surreal> {
	if (db) return db;

	const instance = new Surreal();
	try {
		await instance.connect(SURREALDB_URL);
		await instance.use({ namespace: SURREALDB_NAMESPACE, database: SURREALDB_DATABASE });
		await applyMigrations(instance);

		db = instance;
		return db;
	} catch (err) {
		try {
			await instance.close();
		} catch {
			// ignore close errors
		}
		throw err;
	}
}
