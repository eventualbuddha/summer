import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	transactionIds: z.array(z.string()),
	description: z.string().optional(),
	categoryId: z.string().nullable().optional(),
	effectiveDate: z.string().nullable().optional(),
	tags: z.array(z.string()).optional()
});

export const PATCH: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const body = parsedBody.data;
	const db = await getDb();
	const transactionRecordIds = body.transactionIds.map((id) => new RecordId('transaction', id));

	if ('description' in body) {
		await db.query('UPDATE $transactions SET description = $description', {
			transactions: transactionRecordIds,
			description: body.description ?? ''
		});
	}

	if ('categoryId' in body) {
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
	}

	if ('effectiveDate' in body) {
		if (body.effectiveDate) {
			await db.query('UPDATE $transactions SET effectiveDate = <datetime>$effectiveDate', {
				transactions: transactionRecordIds,
				effectiveDate: body.effectiveDate
			});
		} else {
			await db.query('UPDATE $transactions SET effectiveDate = none', {
				transactions: transactionRecordIds
			});
		}
	}

	if ('tags' in body && body.tags !== undefined) {
		const results = await db.queryRaw(
			`
      BEGIN TRANSACTION;

      DELETE tagged WHERE in IN $transactions;

      FOR $transaction IN $transactions {
        FOR $name IN $tags {
          LET $tag = (UPSERT tag SET name = $name WHERE name = $name RETURN VALUE id)[0];
          RELATE $transaction->tagged->$tag;
        };
      };

      COMMIT TRANSACTION;
    `,
			{ transactions: transactionRecordIds, tags: body.tags }
		);

		const errors = results.filter(
			(r) => r.status === 'ERR' && !/failed transaction/.test(r.result as string)
		);
		if (errors.length > 0) {
			return json({ error: 'Failed to update tags' }, { status: 500 });
		}
	}

	return json({ ok: true });
};
