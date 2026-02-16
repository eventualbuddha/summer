import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
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

	const results = await db.queryRaw(
		`
      BEGIN TRANSACTION;

      DELETE $transaction->tagged;

      FOR $name IN $tags {
          LET $tag = (UPSERT tag SET name = $name WHERE name = $name RETURN VALUE id)[0];
          RELATE $transaction->tagged->$tag;
      };

      SELECT ->tagged->tag.name AS tags FROM ONLY $transaction;

      COMMIT TRANSACTION;
    `,
		{ transaction, tags }
	);

	const errors = results.filter((r) => r.status === 'ERR');
	const errorMessage = errors.find(
		({ status, result }) => status === 'ERR' && !/failed transaction/.test(result as string)
	)?.result;

	if (errors.length > 0) {
		return json(
			{ error: (errorMessage as string)?.replace(/^An error occurred:\s*/, '') ?? 'Unknown error' },
			{ status: 400 }
		);
	}

	const resultSchema = z.object({
		status: z.literal('OK'),
		result: z.object({ tags: z.array(z.string()) })
	});

	for (const result of results) {
		const parsed = resultSchema.safeParse(result);

		if (parsed.success) {
			return json({ tags: parsed.data.result.tags.sort((a, b) => a.localeCompare(b)) });
		}
	}

	const errorResult = results.find((result) => result.status === 'ERR');
	return json({ error: errorResult }, { status: 500 });
};
