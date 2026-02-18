import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	sourceIds: z.array(z.string().min(1)).min(1),
	targetId: z.string().min(1)
});

export const POST: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const { sourceIds, targetId } = parsedBody.data;
	const db = await getDb();

	const sources = sourceIds.map((id) => new RecordId('tag', id));
	const targetTag = new RecordId('tag', targetId);

	await db.query(
		`BEGIN TRANSACTION;
		FOR $source IN $sources {
			FOR $rel IN (SELECT * FROM tagged WHERE out = $source) {
				LET $txn = $rel.in;
				LET $yr = $rel.year;
				LET $alreadyTagged = (SELECT count() FROM tagged WHERE in = $txn AND out = $targetTag GROUP ALL)[0].count ?? 0;
				IF $alreadyTagged = 0 {
					RELATE $txn->tagged->$targetTag SET year = $yr;
				};
			};
			DELETE tagged WHERE out = $source;
			DELETE $source;
		};
		COMMIT TRANSACTION;`,
		{ sources, targetTag }
	);

	return json({ ok: true });
};
