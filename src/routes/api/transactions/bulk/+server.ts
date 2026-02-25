import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { QueryError, RecordId, type QueryResponse, type QueryResponseFailure } from 'surrealdb';
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
		const results: QueryResponse[] = await db
			.query(
				`
      BEGIN TRANSACTION;

      DELETE tagged WHERE in IN $transactions;

      FOR $transaction IN $transactions {
        FOR $name IN $tags {
          LET $existing = (SELECT * FROM tag WHERE name = $name LIMIT 1)[0];
          LET $tag = IF $existing { $existing } ELSE { (CREATE ONLY tag SET name = $name) };
          RELATE $transaction->tagged->$tag.id;
        };
      };

      COMMIT TRANSACTION;
    `,
				{ transactions: transactionRecordIds, tags: body.tags }
			)
			.responses();

		const hasErrors = results
			.filter((r): r is QueryResponseFailure => !r.success)
			.some((r) => !(r.error instanceof QueryError && r.error.isNotExecuted));
		if (hasErrors) {
			return json({ error: 'Failed to update tags' }, { status: 500 });
		}
	}

	return json({ ok: true });
};
