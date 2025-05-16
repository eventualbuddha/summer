import type { Result } from '@badrap/result';
import type { Statement } from './statement/Statement';
import type { ImportedTransaction } from './ImportedTransaction';
import type { StatementMetadata } from './StatementMetadata';
import type { ParseStatementError } from './parse/errors';
import * as amex from './sources/amex';
import * as schwab from './sources/schwab';

export type ParseStatementResults = Array<{
	source: string;
	results: Array<Result<ImportedTransaction | StatementMetadata, ParseStatementError>>;
}>;

export function parseStatement(statement: Statement): ParseStatementResults {
	return [schwab, amex].map((source) => ({
		source: source.id,
		results: source.parseStatement(statement).toArray()
	}));
}
