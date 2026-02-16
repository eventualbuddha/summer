import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	effectiveDate: z.string().nullable()
});

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
	const transactionId = new RecordId('transaction', params.id!);

	const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;

	if (effectiveDate) {
		await db.query('UPDATE $transaction SET effectiveDate = $effectiveDate', {
			transaction: transactionId,
			effectiveDate
		});
	} else {
		await db.query('UPDATE $transaction SET effectiveDate = NONE', {
			transaction: transactionId
		});
	}

	return json({ effectiveDate: body.effectiveDate });
};
