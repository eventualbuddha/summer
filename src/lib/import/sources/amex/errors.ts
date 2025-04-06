import {
	InconsistentValueError,
	InvalidDateError,
	MissingHeaderError,
	MissingValueError
} from '../../parse/errors';
import { ParseMoneyError } from '../../parse/money';
import type { PageText } from '../../statement/page';
import { InvalidMoneyAmountError } from '../schwab';

export type ParseActivityEntriesErrorCause =
	| InvalidDateError
	| InvalidMoneyAmountError
	| ParseMoneyError
	| MissingHeaderError
	| MissingValueError
	| InconsistentValueError<number>;

export interface ParseActivityEntriesErrorContext {
	pageNumber?: number;
	contentText?: PageText;
	searchFromText?: PageText;
	searchDirection?: 'left' | 'right' | 'up' | 'down';
}

export class ParseActivityEntriesError extends Error {
	readonly cause: ParseActivityEntriesErrorCause;
	readonly context?: ParseActivityEntriesErrorContext;

	constructor(cause: ParseActivityEntriesErrorCause, context?: ParseActivityEntriesErrorContext) {
		super(cause.message);
		this.cause = cause;
		this.context = context;
	}
}
