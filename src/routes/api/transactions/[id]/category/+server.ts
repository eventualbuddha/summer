import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { categoryId } = await request.json();
	const db = await getDb();

	if (categoryId) {
		await db.query('UPDATE $transaction SET category = $category', {
			transaction: new RecordId('transaction', params.id!),
			category: new RecordId('category', categoryId)
		});
	} else {
		await db.query('UPDATE $transaction SET category = none', {
			transaction: new RecordId('transaction', params.id!)
		});
	}

	return json({ ok: true });
};
