import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const description: string = body.description;
	const tagged: Array<{ name: string; year?: number }> = body.tagged;
	const originalTagged: Array<{ id: string; tag: { name: string }; year?: number }> =
		body.originalTagged;

	const taggedRecordsToCreate = tagged.filter(
		(t) => !originalTagged.some((oldTag) => oldTag.tag.name === t.name && oldTag.year === t.year)
	);
	const taggedRecordsToDelete = originalTagged.filter(
		(t) => !tagged.some((newTag) => newTag.name === t.tag.name && newTag.year === t.year)
	);

	const db = await getDb();
	const transactionId = new RecordId('transaction', params.id!);

	const results = await db.queryRaw(
		`
		BEGIN TRANSACTION;

		UPDATE transaction
		SET description = $description
		WHERE id = $transactionId;

		DELETE FROM tagged WHERE id IN $taggedRecordsToDelete;

		FOR $tagged IN $taggedRecordsToCreate {
			LET $tag = (
				SELECT * FROM ONLY tag WHERE name = $tagged.name LIMIT 1
			) ?? (
				CREATE ONLY tag SET name = $tagged.name
			);
			LET $existingTagged = count(
				SELECT * FROM tagged WHERE in.id = $transactionId AND out.id = $tag.id
			);
			IF $existingTagged > 0 {
				THROW 'Tag already exists for this transaction.';
			};
			LET $tagId = $tag.id;
			RELATE $transactionId->tagged->$tagId
			   SET year = $tagged.year;
		};

		SELECT
			id.id() as id,
			->(SELECT id.id() as id, name FROM tag LIMIT 1)[0] as tag,
			year
		FROM tagged
		WHERE in = $transactionId;

		COMMIT TRANSACTION;
		`,
		{
			description,
			transactionId,
			taggedRecordsToCreate,
			taggedRecordsToDelete: taggedRecordsToDelete.map((t) => new RecordId('tagged', t.id))
		}
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

	const taggedResult = z
		.object({
			status: z.union([z.literal('OK'), z.literal('ERR')]),
			result: z.array(
				z.object({
					id: z.string(),
					tag: z.object({ id: z.string(), name: z.string() }),
					year: z.number().optional()
				})
			)
		})
		.parse(results[3]);

	const sortedTagged = taggedResult.result.sort((a, b) => a.tag.name.localeCompare(b.tag.name));

	return json({ tagged: sortedTagged });
};
