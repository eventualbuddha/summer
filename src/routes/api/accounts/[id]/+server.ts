import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	name: z.string().optional(),
	number: z.string().optional(),
	type: z.string().optional()
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		throw error(400, `invalid request body: ${JSON.stringify(parsedBody.error)}`);
	}

	const body = parsedBody.data;
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
