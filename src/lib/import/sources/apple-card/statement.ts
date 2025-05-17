import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import type { ParseStatementError } from '$lib/import/parse/errors';
import type { Statement } from '$lib/import/statement/Statement';
import { Result } from '@badrap/result';
import { parseStatementSummary, type StatementSummary } from './summary';
import { parseTransactions } from './transactions';

/**
 * Parses a statement from text extracted from an Apple Card statement PDF.
 * Expects a fairly specific format, with transaction data in a table, usually
 * across multiple pages. Also expects a summary section that contains the total
 * debits and credits as well as the ending balance.
 */
export function* parseStatement(
	statement: Statement
): Generator<Result<ImportedTransaction | StatementSummary, ParseStatementError>> {
	yield parseStatementSummary(statement);
	yield* parseTransactions(statement);
}
