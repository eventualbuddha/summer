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
	const results: QueryResponse[] = await db
		.query(
			`
      BEGIN TRANSACTION;

      IF $updateDescription {
        UPDATE $transactions SET description = $description;
      };

      IF $updateCategory {
        IF $setCategoryValue {
          UPDATE $transactions SET category = $category;
        } ELSE {
          UPDATE $transactions SET category = NONE;
        };
      };

      IF $updateEffectiveDate {
        IF $setEffectiveDateValue {
          UPDATE $transactions SET effectiveDate = <datetime>$effectiveDate;
        } ELSE {
          UPDATE $transactions SET effectiveDate = NONE;
        };
      };

      IF $updateTags {
        DELETE tagged WHERE in IN $transactions;

        FOR $transaction IN $transactions {
          FOR $name IN $tags {
            LET $existing = (SELECT * FROM tag WHERE name = $name LIMIT 1)[0];
            LET $tag = IF $existing { $existing } ELSE { (CREATE ONLY tag SET name = $name) };
            RELATE $transaction->tagged->$tag.id;
          };
        };
      };

      COMMIT TRANSACTION;
    `,
			{
				transactions: transactionRecordIds,
				updateDescription: 'description' in body,
				description: body.description ?? '',
				updateCategory: 'categoryId' in body,
				setCategoryValue: Boolean(body.categoryId),
				category: body.categoryId ? new RecordId('category', body.categoryId) : null,
				updateEffectiveDate: 'effectiveDate' in body,
				setEffectiveDateValue: Boolean(body.effectiveDate),
				effectiveDate: body.effectiveDate ?? null,
				updateTags: 'tags' in body && body.tags !== undefined,
				tags: body.tags ?? []
			}
		)
		.responses();

	const hasErrors = results
		.filter((r): r is QueryResponseFailure => !r.success)
		.some((r) => !(r.error instanceof QueryError && r.error.isNotExecuted));
	if (hasErrors) {
		return json({ error: 'Failed to update transactions' }, { status: 500 });
	}

	return json({ ok: true });
};
