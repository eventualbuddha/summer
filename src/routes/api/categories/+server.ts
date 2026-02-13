import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId, Table } from 'surrealdb';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [categories] = await db.query(
		'SELECT id.id() AS id, name, emoji, color, ordinal FROM category ORDER BY ordinal ASC'
	);
	return json(categories);
};

export const POST: RequestHandler = async ({ request }) => {
	const { id, name, emoji, color } = await request.json();
	const db = await getDb();
	const record = id
		? { id: new RecordId('category', id), name, emoji, color }
		: { name, emoji, color };
	await db.create(new Table('category'), record);
	// Re-fetch to get the ordinal and normalized id
	const [categories] = await db.query(
		'SELECT id.id() AS id, name, emoji, color, ordinal FROM category ORDER BY ordinal DESC LIMIT 1'
	);
	return json(categories, { status: 201 });
};
