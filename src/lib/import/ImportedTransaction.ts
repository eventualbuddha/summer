import { DateTime } from 'luxon';

/**
 * A transaction to import from a statement.
 */
export class ImportedTransaction {
	/** Statement date for the transaction. */
	readonly date: DateTime;

	/** Amount of the transaction in cents. */
	readonly amount: number;

	/** Statement description for the transaction. */
	readonly statementDescription: string;

	/** Page number this transaction was found on. */
	readonly pageNumber: number;

	constructor(date: DateTime, amount: number, statementDescription: string, pageNumber: number) {
		this.date = date;
		this.amount = amount;
		this.statementDescription = statementDescription;
		this.pageNumber = pageNumber;
	}
}
