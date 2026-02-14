import { error, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const GET: RequestHandler = async ({ params }) => {
	const db = await getDb();
	const fileId = new RecordId('file', params.id!);

	const [file] = await db.query<[{ name: string; data: ArrayBuffer }[]]>(
		'SELECT name, data FROM file WHERE id = $id',
		{ id: fileId }
	);

	if (!file?.[0]) {
		throw error(404, 'File not found');
	}

	const { data } = file[0];

	return new Response(data, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'inline'
		}
	});
};
