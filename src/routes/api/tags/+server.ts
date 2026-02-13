import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [tags] = await db.query('SELECT id.id() AS id, name FROM tag ORDER BY name ASC');
	return json(tags);
};
