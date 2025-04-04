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
	readonly pageNumber: number;
	readonly header: string;

	constructor(pageNumber: number, header: string) {
		super(`Header '${header}' not found on page ${pageNumber}`);
		this.pageNumber = pageNumber;
		this.header = header;
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
