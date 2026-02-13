import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const db = await getDb();

	const sets: string[] = [];
	const bindings: Record<string, unknown> = { id: new RecordId('category', params.id!) };

	if ('name' in body) {
		sets.push('name = $name');
		bindings.name = body.name;
	}
	if ('emoji' in body) {
		sets.push('emoji = $emoji');
		bindings.emoji = body.emoji;
	}
	if ('color' in body) {
		sets.push('color = $color');
		bindings.color = body.color;
	}

	if (sets.length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const [updated] = await db.query(
		`UPDATE $id SET ${sets.join(', ')} RETURN id.id() AS id, name, emoji, color, ordinal`,
		bindings
	);
	return json(updated);
};
