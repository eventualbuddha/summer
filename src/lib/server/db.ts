import Surreal from 'surrealdb';
import { readFileSync } from 'fs';
import { join } from 'path';

const SURREALDB_URL = process.env.SURREALDB_URL || process.env.BACKEND_SURREALDB_HTTP_URL || '';
const SURREALDB_NAMESPACE =
	process.env.SURREALDB_NAMESPACE || process.env.DEFAULT_NAMESPACE || 'summer';
const SURREALDB_DATABASE =
	process.env.SURREALDB_DATABASE || process.env.DEFAULT_DATABASE || 'summer';

let db: Surreal | undefined;
let initialized = false;

export async function getDb(): Promise<Surreal> {
	if (db && initialized) return db;

	const instance = new Surreal();
	try {
		await instance.connect(SURREALDB_URL);
		await instance.use({ namespace: SURREALDB_NAMESPACE, database: SURREALDB_DATABASE });

		// Check if database exists and has tables, init schema if needed
		const [info] = await instance.query<[{ tables: Record<string, string> }]>('INFO FOR DB;');
		const hasSchema = info && Object.keys(info.tables).length > 0;

		if (!hasSchema) {
			const schemaPath = join(process.cwd(), 'static', 'schema.surql');
			const schema = readFileSync(schemaPath, 'utf-8');
			await instance.query(schema);
		}

		db = instance;
		initialized = true;
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
