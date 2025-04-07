import type { PageText } from '../statement/page';

export type ParseStatementErrorKind = 'MissingLabel' | 'MissingValue' | 'InvalidValue';
export const ParseStatementErrorKind = {
	MissingLabel: 'MissingLabel',
	MissingValue: 'MissingValue',
	InvalidValue: 'InvalidValue'
} satisfies Record<ParseStatementErrorKind, ParseStatementErrorKind>;

export class ParseStatementError extends Error {
	readonly kind: ParseStatementErrorKind;
	readonly context?: ParseStatementErrorContext;

	constructor(
		kind: ParseStatementErrorKind,
		message: string,
		context?: ParseStatementErrorContext
	) {
		super(message);
		this.kind = kind;
		this.context = context;
	}

	static MissingLabel = (message: string, context?: ParseStatementErrorContext) =>
		new ParseStatementError(ParseStatementErrorKind.MissingLabel, message, context);
	static MissingValue = (message: string, context?: ParseStatementErrorContext) =>
		new ParseStatementError(ParseStatementErrorKind.MissingValue, message, context);
	static InvalidValue = (message: string, context?: ParseStatementErrorContext) =>
		new ParseStatementError(ParseStatementErrorKind.InvalidValue, message, context);
}

export interface ParseStatementErrorContext {
	cause?: Error;
	pageNumber?: number;
	contentText?: PageText;
	searchFromText?: PageText;
	searchDirection?: 'left' | 'right' | 'up' | 'down';
}
