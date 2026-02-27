import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

function isValidDateTimeString(value: string): boolean {
	return !Number.isNaN(new Date(value).getTime());
}

const BODY = z.object({
	effectiveDate: z
		.string()
		.refine(isValidDateTimeString, { message: 'effectiveDate must be a valid datetime string' })
		.nullable()
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

	if (body.effectiveDate) {
		await db.query('UPDATE $transaction SET effectiveDate = <datetime>$effectiveDate', {
			transaction: transactionId,
			effectiveDate: body.effectiveDate
		});
	} else {
		await db.query('UPDATE $transaction SET effectiveDate = NONE', {
			transaction: transactionId
		});
	}

	return json({ effectiveDate: body.effectiveDate });
};
