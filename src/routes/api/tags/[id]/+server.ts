import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const PATCH_BODY = z.object({
	name: z.string().min(1)
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsedBody = PATCH_BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const { name } = parsedBody.data;
	const db = await getDb();
	const id = new RecordId('tag', params.id!);
	await db.query('UPDATE $id SET name = $name', { id, name });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const db = await getDb();
	const id = new RecordId('tag', params.id!);
	await db.query(
		`BEGIN TRANSACTION;
		DELETE tagged WHERE out = $id;
		DELETE $id;
		COMMIT TRANSACTION;`,
		{ id }
	);
	return new Response(null, { status: 204 });
};
