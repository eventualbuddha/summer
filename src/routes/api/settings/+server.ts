import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	defaultCategoryId: z.string().nullable()
});

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [settings] = await db.query<[{ defaultCategoryId?: string }]>(
		'SELECT defaultCategory?.id() as defaultCategoryId FROM ONLY settings:global'
	);
	return json({ defaultCategoryId: settings?.defaultCategoryId ?? null });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		throw error(400, `invalid request body: ${JSON.stringify(parsedBody.error)}`);
	}

	const body = parsedBody.data;
	const db = await getDb();
	await db.query('UPSERT settings:global SET defaultCategory = $defaultCategory', {
		defaultCategory: body.defaultCategoryId
			? new RecordId('category', body.defaultCategoryId)
			: null
	});
	return json({ defaultCategoryId: body.defaultCategoryId ?? null });
};
