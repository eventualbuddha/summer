import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [years, months, categories, accounts] = await db.query(`
		array::sort::desc(array::union(
			(SELECT VALUE date.year() FROM statement),
			(SELECT VALUE effectiveDate.year() FROM transaction WHERE effectiveDate IS NOT NONE)
		));
		array::sort::asc(array::union(
			(SELECT VALUE date.month() FROM statement),
			(SELECT VALUE effectiveDate.month() FROM transaction WHERE effectiveDate IS NOT NONE)
		));
		SELECT id.id(), name, emoji, color, ordinal FROM category ORDER BY ordinal ASC;
		SELECT id.id(), type, number, name FROM account ORDER BY type ASC, name ASC;
	`);
	return json({ years, months, categories, accounts });
};
