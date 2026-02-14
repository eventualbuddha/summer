import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	description: z.string()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const db = await getDb();
	const transactionId = new RecordId('transaction', params.id!);

	await db.query(`UPDATE transaction SET description = $description WHERE id = $transactionId`, {
		description: parsedBody.data.description,
		transactionId
	});

	return json({ description: parsedBody.data.description });
};
