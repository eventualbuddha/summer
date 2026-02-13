import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const GET: RequestHandler = async ({ params }) => {
	const db = await getDb();
	const [budget] = await db.query(
		'SELECT id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal} FROM ONLY budget:$id',
		{ id: params.id! }
	);
	if (!budget) throw error(404, 'Budget not found');
	return json(budget);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const db = await getDb();
	const categoryRecords = body.categories.map(
		(cat: { id: string }) => new RecordId('category', cat.id)
	);
	const [updated] = await db.query(
		`UPDATE $id SET name = $name, year = $year, amount = $amount, categories = $categories
		 RETURN id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal}`,
		{
			id: new RecordId('budget', params.id!),
			name: body.name,
			year: body.year,
			amount: body.amount,
			categories: categoryRecords
		}
	);
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = await getDb();
	await db.query('DELETE $id', { id: new RecordId('budget', params.id!) });
	return new Response(null, { status: 204 });
};
