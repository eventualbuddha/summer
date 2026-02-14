import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId, Table } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	id: z.string().optional(),
	name: z.string(),
	emoji: z.string(),
	color: z.string()
});

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [categories] = await db.query(
		'SELECT id.id() AS id, name, emoji, color, ordinal FROM category ORDER BY ordinal ASC'
	);
	return json(categories);
};

export const POST: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		throw error(400, `invalid request body: ${JSON.stringify(parsedBody.error)}`);
	}

	const body = parsedBody.data;
	const db = await getDb();
	const record = body.id
		? {
				id: new RecordId('category', body.id),
				name: body.name,
				emoji: body.emoji,
				color: body.color
			}
		: { name: body.name, emoji: body.emoji, color: body.color };
	await db.create(new Table('category'), record);
	// Re-fetch to get the ordinal and normalized id
	const [categories] = await db.query(
		'SELECT id.id() AS id, name, emoji, color, ordinal FROM category ORDER BY ordinal DESC LIMIT 1'
	);
	return json(categories, { status: 201 });
};
