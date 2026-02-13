import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [years, months, categories, accounts] = await db.query(`
		(SELECT date.year() as year FROM statement ORDER BY year DESC).year.distinct();
		(SELECT date.month() as month FROM statement ORDER BY month ASC).month.distinct();
		SELECT id.id(), name, emoji, color, ordinal FROM category ORDER BY ordinal ASC;
		SELECT id.id(), type, number, name FROM account ORDER BY type ASC, name ASC;
	`);
	return json({ years, months, categories, accounts });
};
