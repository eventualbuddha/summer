import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [budgets] = await db.query(
		'SELECT id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal} FROM budget ORDER BY year DESC'
	);
	return json(budgets);
};

export const POST: RequestHandler = async ({ request }) => {
	const { name, year, amount, categories } = await request.json();
	const db = await getDb();
	const categoryRecords = categories.map((cat: { id: string }) => new RecordId('category', cat.id));
	const [created] = await db.query(
		`CREATE budget SET name = $name, year = $year, amount = $amount, categories = $categories
		 RETURN id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal}`,
		{ name, year, amount, categories: categoryRecords }
	);
	return json(created, { status: 201 });
};
