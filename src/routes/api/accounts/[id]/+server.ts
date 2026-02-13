import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const db = await getDb();

	const sets: string[] = [];
	const bindings: Record<string, unknown> = { id: new RecordId('account', params.id!) };

	if ('name' in body) {
		sets.push('name = $name');
		bindings.name = body.name;
	}
	if ('number' in body) {
		sets.push('number = $number');
		bindings.number = body.number;
	}
	if ('type' in body) {
		sets.push('type = $type');
		bindings.type = body.type;
	}

	if (sets.length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const [updated] = await db.query(
		`UPDATE $id SET ${sets.join(', ')} RETURN id.id() AS id, type, number, name`,
		bindings
	);
	return json(updated);
};
