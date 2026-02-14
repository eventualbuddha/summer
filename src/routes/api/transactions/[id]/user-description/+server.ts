import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { description } = await request.json();
	const db = await getDb();
	const transactionId = new RecordId('transaction', params.id!);

	await db.query('UPDATE $transaction SET description = $description', {
		transaction: transactionId,
		description
	});

	return json({ description });
};
