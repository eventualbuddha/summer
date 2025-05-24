import { AccountSchema, StatementSchema, type Account, type Statement } from '$lib/db';
import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import type { StatementMetadata } from '$lib/import/StatementMetadata';
import { Result } from '@badrap/result';
import { Surreal } from 'surrealdb';
import { z } from 'zod';

export async function importStatement(
	surreal: Surreal,
	filename: string,
	pdfData: Uint8Array,
	source: string,
	metadata: StatementMetadata,
	transactions: readonly ImportedTransaction[]
): Promise<Result<{ account: Account; statement: Statement }>> {
	const results = await surreal.queryRaw(
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
			accountNumber: metadata.account,
			accountName: metadata.accountName,
			accountType: metadata.accountType,
			filename,
			pdfData,
			statementDate: metadata.closingDate.toJSDate(),
			transactions: transactions.map((t) => ({
				date: t.date.toJSDate(),
				amount: t.amount,
				statementDescription: t.statementDescription,
				type: t.kind
			}))
		}
	);

	const errors = results.filter((r) => r.status === 'ERR');
	const errorMessage = errors
		.find(({ status, result }) => status === 'ERR' && !/failed transaction/.test(result))
		?.result?.replace(/^An error occurred:\s*/, '');

	if (errors.length > 0) {
		return Result.err(new Error(errorMessage));
	}

	const [, accountResult, , , , , statementResult] = z
		.tuple([
			// LET $account = …
			z.unknown(),
			// Account record.
			z.object({ status: z.union([z.literal('OK'), z.literal('ERR')]), result: AccountSchema }),
			// LET $file = …
			z.unknown(),
			// LET $existingStatement = …
			z.unknown(),
			// IF $existingStatement { … }
			z.unknown(),
			// LET $statement = …
			z.unknown(),
			// Statement record.
			z.object({ status: z.union([z.literal('OK'), z.literal('ERR')]), result: StatementSchema }),
			// LET $defaultCategory = …
			z.unknown(),
			// IF !$defaultCategory { … }
			z.unknown(),
			// FOR $t IN $transactions { … }
			z.unknown()
		])
		.parse(results);

	console.log('Account result:', accountResult);
	console.log('Statement result:', statementResult);
	if (accountResult.status !== 'OK' || statementResult.status !== 'OK') {
		throw new Error('Results should be OK');
	}

	return Result.ok({
		account: accountResult.result,
		statement: {
			...statementResult.result,
			account: accountResult.result
		}
	});
}
