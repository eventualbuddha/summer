import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { QueryError, type QueryResponse, type QueryResponseFailure } from 'surrealdb';
import { z } from 'zod';

const BODY = z.object({
	source: z.string(),
	accountNumber: z.string(),
	accountName: z.string(),
	accountType: z.string(),
	filename: z.string(),
	pdfData: z.string(),
	statementDate: z.string(),
	transactions: z.array(
		z.object({
			date: z.string(),
			amount: z.number(),
			statementDescription: z.string(),
			type: z.string()
		})
	)
});

export const POST: RequestHandler = async ({ request }) => {
	const parsedBody = BODY.safeParse(await request.json());

	if (!parsedBody.success) {
		return json(
			{ error: `invalid request body: ${JSON.stringify(parsedBody.error)}` },
			{ status: 400 }
		);
	}

	const body = parsedBody.data;

	const db = await getDb();

	let pdfBytes: Uint8Array;
	try {
		// Decode base64 PDF data to Uint8Array.
		pdfBytes = Uint8Array.from(atob(body.pdfData), (c) => c.charCodeAt(0));
	} catch {
		return json({ error: 'Invalid PDF data payload' }, { status: 400 });
	}

	let results: QueryResponse[];
	try {
		results = await db
			.query(
				`
BEGIN TRANSACTION;

LET $account = (
    SELECT * FROM ONLY account
     WHERE source = $source
       AND number = $accountNumber
       AND type = $accountType
     LIMIT 1
) ?? (
    CREATE ONLY account SET
        source = $source,
        number = $accountNumber,
        name = $accountName,
        type = $accountType
);

{
  id: $account.id.id(),
  name: $account.name,
  source: $account.source,
  number: $account.number,
  type: $account.type,
};

LET $file = CREATE ONLY file SET
    name = $filename,
    data = $pdfData;

LET $existingStatements = (
		SELECT id FROM statement
		WHERE account = $account.id
			AND date = $statementDate
).len();

IF $existingStatements == 1 {
		THROW 'Statement already exists for this account and date.';
};

LET $statement = CREATE ONLY statement SET
    account = $account.id,
    date = $statementDate,
    file = $file.id;

{
  id: $statement.id.id(),
  account: $statement.account.id(),
  date: $statement.date,
  file: $statement.file.id(),
};

LET $defaultCategory = (SELECT defaultCategory FROM ONLY settings:global).defaultCategory;

IF !$defaultCategory {
    THROW 'No default category set.';
};

FOR $t IN $transactions {
    CREATE ONLY transaction SET
        statement = $statement.id,
        date = $t.date,
        amount = $t.amount,
        statementDescription = $t.statementDescription,
        category = $defaultCategory,
        type = $t.type;
};

COMMIT TRANSACTION;
		`,
				{
					source: body.source,
					accountNumber: body.accountNumber,
					accountName: body.accountName,
					accountType: body.accountType,
					filename: body.filename,
					pdfData: pdfBytes,
					statementDate: new Date(body.statementDate),
					transactions: body.transactions.map((t) => ({
						...t,
						date: new Date(t.date)
					}))
				}
			)
			.responses();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json({ error: `Import failed: ${message}` }, { status: 500 });
	}

	const errors = results.filter((r): r is QueryResponseFailure => !r.success);
	const primaryError = errors.find(
		(r) => !(r.error instanceof QueryError && r.error.isNotExecuted)
	);

	if (errors.length > 0) {
		return json({ error: primaryError?.error.message ?? 'Import failed' }, { status: 400 });
	}

	const AccountSchema = z.object({
		id: z.string().nonempty(),
		type: z.string().nonempty(),
		number: z.string().nonempty().optional(),
		name: z.string().nonempty()
	});

	const StatementSchema = z.object({
		id: z.string().nonempty(),
		account: z.string().nonempty(),
		date: z.coerce.date(),
		file: z.string().nonempty()
	});

	const successfulResults = results
		.filter((r): r is QueryResponse & { success: true } => r.success)
		.map((r) => r.result);

	const account = successfulResults
		.map((result) => AccountSchema.safeParse(result))
		.find((parsed) => parsed.success)?.data;
	const statement = successfulResults
		.map((result) => StatementSchema.safeParse(result))
		.find((parsed) => parsed.success)?.data;

	if (!account || !statement) {
		return json({ error: 'Import completed, but response parsing failed' }, { status: 500 });
	}

	return json({
		account,
		statement: {
			...statement,
			date: statement.date.toISOString()
		}
	});
};
