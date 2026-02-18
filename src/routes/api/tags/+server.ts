import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [tags] = await db.query<[Array<{ id: string; name: string; transactionCount: number }>]>(
		'SELECT id.id() AS id, name, count(<-tagged) AS transactionCount FROM tag'
	);
	tags.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
	return json(tags);
};
