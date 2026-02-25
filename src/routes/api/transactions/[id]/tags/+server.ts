import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { QueryError, RecordId, type QueryResponse, type QueryResponseFailure } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	tags: z.array(z.string())
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const { tags } = parsedBody.data;
	const db = await getDb();
	const transaction = new RecordId('transaction', params.id!);

	const results: QueryResponse[] = await db
		.query(
			`
      BEGIN TRANSACTION;

      DELETE $transaction->tagged;

      FOR $name IN $tags {
          LET $existing = (SELECT * FROM tag WHERE name = $name LIMIT 1)[0];
          LET $tag = IF $existing { $existing } ELSE { (CREATE ONLY tag SET name = $name) };
          RELATE $transaction->tagged->$tag.id;
      };

      SELECT ->tagged->tag.name AS tags FROM ONLY $transaction;

      COMMIT TRANSACTION;
    `,
			{ transaction, tags }
		)
		.responses();

	const errors = results.filter((r): r is QueryResponseFailure => !r.success);
	const primaryError = errors.find(
		(r) => !(r.error instanceof QueryError && r.error.isNotExecuted)
	);

	if (errors.length > 0) {
		return json({ error: primaryError?.error.message ?? 'Unknown error' }, { status: 400 });
	}

	const resultSchema = z.object({
		success: z.literal(true),
		result: z.object({ tags: z.array(z.string()) })
	});

	for (const result of results) {
		const parsed = resultSchema.safeParse(result);

		if (parsed.success) {
			return json({ tags: parsed.data.result.tags.sort((a, b) => a.localeCompare(b)) });
		}
	}

	const errorResult = results.find((result) => !result.success);
	return json({ error: errorResult }, { status: 500 });
};
