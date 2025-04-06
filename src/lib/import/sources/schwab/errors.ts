import type { ParseMoneyError } from '$lib/import/parse/money';
import type { Interval } from 'luxon';
import {
	InvalidDateError,
	MissingHeaderError,
	MissingTableCellError,
	ParseStatementSummaryError
} from '../../parse/errors';
import type { StatementSummary } from './summary';
import type { ActivityEntry } from './entries';

export type ImportStatementError =
	| ParseMoneyError
	| ParseActivityEntriesError
	| InvalidTransactionError
	| InvalidStatementIntervalError
	| InvalidStatementSummaryError
	| InconsistentStatementIntervalError
	| ParseStatementSummaryError;

export class InvalidTransactionError extends Error {
	readonly activityEntry: ActivityEntry;

	constructor(message: string, activityEntry: ActivityEntry) {
		super(message);
		this.activityEntry = activityEntry;
	}
}

export class InvalidStatementIntervalError extends Error {
	readonly interval: Interval;

	constructor(interval: Interval) {
		super(`Invalid statement interval: ${interval.invalidExplanation}`);
		this.interval = interval;
	}
}

export class InconsistentStatementIntervalError extends Error {
	readonly firstInterval: Interval;
	readonly secondInterval: Interval;

	constructor(firstInterval: Interval, secondInterval: Interval) {
		super(`Inconsistent statement intervals: ${firstInterval} and ${secondInterval}`);
		this.firstInterval = firstInterval;
		this.secondInterval = secondInterval;
	}
}

export class InvalidStatementSummaryError extends Error {
	readonly summary: StatementSummary;

	readonly summaryValue: number;
	readonly computedValue: number;

	constructor(
		message: string,
		summary: StatementSummary,
		summaryValue: number,
		computedValue: number
	) {
		super(message);
		this.summary = summary;
		this.summaryValue = summaryValue;
		this.computedValue = computedValue;
	}
}

export class InvalidMoneyAmountError extends Error {
	readonly column: string;
	readonly amount: string;
	readonly parseError: ParseMoneyError;

	constructor(column: string, amount: string, parseError: ParseMoneyError) {
		super(`Invalid money amount in column '${column}': ${amount} (${parseError.message})`);
		this.column = column;
		this.amount = amount;
		this.parseError = parseError;
	}
}

export type ParseActivityEntriesError =
	| MissingHeaderError
	| MissingTableCellError
	| InvalidDateError
	| InvalidMoneyAmountError;
