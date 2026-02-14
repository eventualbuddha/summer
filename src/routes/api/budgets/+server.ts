import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	name: z.string(),
	year: z.number(),
	amount: z.number(),
	categories: z.array(z.object({ id: z.string() }))
});

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [budgets] = await db.query(
		'SELECT id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal} FROM budget ORDER BY year DESC'
	);
	return json(budgets);
};

export const POST: RequestHandler = async ({ request }) => {
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
	const [created] = await db.query(
		`CREATE budget SET name = $name, year = $year, amount = $amount, categories = $categories
		 RETURN id.id() AS id, name, year, amount, categories[*].{id: id.id(), name, emoji, color, ordinal}`,
		{ name: body.name, year: body.year, amount: body.amount, categories: categoryRecords }
	);
	return json(created, { status: 201 });
};
