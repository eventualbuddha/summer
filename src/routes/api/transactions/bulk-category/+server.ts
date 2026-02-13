import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const PATCH: RequestHandler = async ({ request }) => {
	const { transactionIds, categoryId } = (await request.json()) as {
		transactionIds: string[];
		categoryId: string | null;
	};

	const db = await getDb();
	const transactionRecordIds = transactionIds.map((id) => new RecordId('transaction', id));

	if (categoryId) {
		await db.query('UPDATE $transactions SET category = $category', {
			transactions: transactionRecordIds,
			category: new RecordId('category', categoryId)
		});
	} else {
		await db.query('UPDATE $transactions SET category = none', {
			transactions: transactionRecordIds
		});
	}

	return json({ ok: true });
};
