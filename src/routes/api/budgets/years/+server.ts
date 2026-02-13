import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [budgets] = await db.query('SELECT year FROM budget');
	const parsed = budgets as Array<{ year: number }>;
	const years = Array.from(new Set(parsed.map((b) => b.year))).sort((a, b) => b - a);
	return json(years);
};
