import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	transactionIds: z.array(z.string()),
	categoryId: z.string().nullable()
});

export const PATCH: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		throw error(400, `invalid request body: ${JSON.stringify(parsedBody.error)}`);
	}

	const body = parsedBody.data;

	const db = await getDb();
	const transactionRecordIds = body.transactionIds.map((id) => new RecordId('transaction', id));

	if (body.categoryId) {
		await db.query('UPDATE $transactions SET category = $category', {
			transactions: transactionRecordIds,
			category: new RecordId('category', body.categoryId)
		});
	} else {
		await db.query('UPDATE $transactions SET category = none', {
			transactions: transactionRecordIds
		});
	}

	return json({ ok: true });
};
