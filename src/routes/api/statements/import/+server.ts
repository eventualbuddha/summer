import { json, type RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { z } from 'zod';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		source,
		accountNumber,
		accountName,
		accountType,
		filename,
		pdfData,
		statementDate,
		transactions
	} = body as {
		source: string;
		accountNumber: string;
		accountName: string;
		accountType: string;
		filename: string;
		pdfData: string; // base64
		statementDate: string; // ISO date
		transactions: Array<{
			date: string;
			amount: number;
			statementDescription: string;
			type: string;
		}>;
	};

	const db = await getDb();

	// Decode base64 PDF data to Uint8Array
	const pdfBytes = Uint8Array.from(atob(pdfData), (c) => c.charCodeAt(0));

	const results = await db.queryRaw(
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
			source,
			accountNumber,
			accountName,
			accountType,
			filename,
			pdfData: pdfBytes,
			statementDate: new Date(statementDate),
			transactions: transactions.map((t) => ({
				...t,
				date: new Date(t.date)
			}))
		}
	);

	const errors = results.filter((r) => r.status === 'ERR');
	const errorMessage = errors.find(
		({ status, result }) => status === 'ERR' && !/failed transaction/.test(result as string)
	)?.result;

	if (errors.length > 0) {
		return json(
			{
				error:
					((errorMessage as string)?.replace(/^An error occurred:\s*/, '') as string) ??
					'Import failed'
			},
			{ status: 400 }
		);
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
		date: z.instanceof(Date),
		file: z.string().nonempty()
	});

	const [, accountResult, , , , , statementResult] = z
		.tuple([
			z.unknown(),
			z.object({
				status: z.union([z.literal('OK'), z.literal('ERR')]),
				result: AccountSchema
			}),
			z.unknown(),
			z.unknown(),
			z.unknown(),
			z.unknown(),
			z.object({
				status: z.union([z.literal('OK'), z.literal('ERR')]),
				result: StatementSchema
			}),
			z.unknown(),
			z.unknown(),
			z.unknown()
		])
		.parse(results);

	return json({
		account: accountResult.result,
		statement: {
			...statementResult.result,
			date: statementResult.result.date.toISOString()
		}
	});
};
