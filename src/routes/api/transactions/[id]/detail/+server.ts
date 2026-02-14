import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { RecordId } from 'surrealdb';

export const GET: RequestHandler = async ({ params }) => {
	const db = await getDb();
	const transactionId = new RecordId('transaction', params.id!);

	const [result] = await db.query<
		[{ accountName: string; statementDate: string; fileId: string } | null]
	>(
		`SELECT
			statement.account.name as accountName,
			statement.date as statementDate,
			statement.file.id() as fileId
		FROM ONLY type::thing('transaction', $id)`,
		{ id: transactionId.id }
	);

	if (!result) {
		throw error(404, 'transaction not found');
	}

	return json(result);
};
