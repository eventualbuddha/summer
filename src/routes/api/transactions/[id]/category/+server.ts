import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	categoryId: z.string().nullable()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		throw error(400, `invalid request body: ${JSON.stringify(parsedBody.error)}`);
	}

	const body = parsedBody.data;
	const db = await getDb();

	if (body.categoryId) {
		await db.query('UPDATE $transaction SET category = $category', {
			transaction: new RecordId('transaction', params.id!),
			category: new RecordId('category', body.categoryId)
		});
	} else {
		await db.query('UPDATE $transaction SET category = none', {
			transaction: new RecordId('transaction', params.id!)
		});
	}

	return json({ ok: true });
};
