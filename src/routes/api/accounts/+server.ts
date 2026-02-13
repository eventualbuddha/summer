import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [accounts] = await db.query(
		'SELECT id.id() AS id, type, number, name FROM account ORDER BY type ASC, name ASC'
	);
	return json(accounts);
};
