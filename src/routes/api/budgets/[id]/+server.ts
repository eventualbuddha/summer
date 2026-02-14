import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	name: z.string(),
	year: z.number(),
	amount: z.number(),
	categories: z.array(z.object({ id: z.string() }))
});

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
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const body = parsedBody.data;
	const db = await getDb();
	const categoryRecords = body.categories.map((cat) => new RecordId('category', cat.id));
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
