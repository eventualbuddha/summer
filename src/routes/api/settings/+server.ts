import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [settings] = await db.query<[{ defaultCategoryId?: string }]>(
		'SELECT defaultCategory?.id() as defaultCategoryId FROM ONLY settings:global'
	);
	return json({ defaultCategoryId: settings?.defaultCategoryId ?? null });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const { defaultCategoryId } = await request.json();
	const db = await getDb();
	await db.query('UPSERT settings:global SET defaultCategory = $defaultCategory', {
		defaultCategory: defaultCategoryId ? new RecordId('category', defaultCategoryId) : null
	});
	return json({ defaultCategoryId: defaultCategoryId ?? null });
};
