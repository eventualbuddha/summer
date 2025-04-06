import type { DateTime } from 'luxon';

export class ParseStatementSummaryError extends Error {
	readonly pageNumber: number;
	readonly cause?: Error;

	constructor(pageNumber: number, message: string, cause?: Error) {
		super(`${message} on page ${pageNumber}${cause ? `: ${cause.message}` : ''}`);
		this.pageNumber = pageNumber;
		this.cause = cause;
	}
}

export class MissingHeaderError extends Error {
	readonly header: string;

	constructor(header: string) {
		super(`Header '${header}' not found`);
		this.header = header;
	}
}

export class MissingValueError extends Error {
	readonly value: string;

	constructor(value: string) {
		super(`Value '${value}' not found`);
		this.value = value;
	}
}

export class MissingTableCellError extends Error {
	readonly page: number;
	readonly row: number;
	readonly column: string;

	constructor(page: number, row: number, column: string) {
		super(`Column '${column}' not found in row ${row} of page ${page}`);
		this.page = page;
		this.row = row;
		this.column = column;
	}
}

export class InvalidDateError extends Error {
	readonly date: string;
	readonly dateTime: DateTime<false>;

	constructor(date: string, dateTime: DateTime<false>) {
		super(`Invalid date '${date}'`);
		this.date = date;
		this.dateTime = dateTime;
	}
}

export class InconsistentValueError<T> extends Error {
	readonly label: string;
	readonly expectedValue: T;
	readonly actualValue: T;

	constructor(label: string, expectedValue: T, actualValue: T) {
		super(`Expected "${label}" to equal ${expectedValue} but got ${actualValue}`);
		this.label = label;
		this.expectedValue = expectedValue;
		this.actualValue = actualValue;
	}
}
