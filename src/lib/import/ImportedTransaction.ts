import { DateTime } from 'luxon';

export type ImportedTransactionKind =
	| 'Balance'
	| 'Charge'
	| 'Check'
	| 'Credit'
	| 'Deposit'
	| 'Interest'
	| 'Payment'
	| 'Transfer'
	| 'Unknown';
export const ImportedTransactionKind = {
	Balance: 'Balance',
	Charge: 'Charge',
	Credit: 'Credit',
	Check: 'Check',
	Deposit: 'Deposit',
	Interest: 'Interest',
	Transfer: 'Transfer',
	Payment: 'Payment',
	Unknown: 'Unknown'
} satisfies Record<ImportedTransactionKind, ImportedTransactionKind>;

/**
 * A transaction to import from a statement.
 */
export class ImportedTransaction {
	/** What kind of transaction is this? */
	readonly kind: ImportedTransactionKind;

	/** Statement date for the transaction. */
	readonly date: DateTime;

	/** Amount of the transaction in cents. */
	readonly amount: number;

	/** Statement description for the transaction. */
	readonly statementDescription: string;

	/** Page number this transaction was found on. */
	readonly pageNumber: number;

	constructor(
		kind: ImportedTransactionKind,
		date: DateTime,
		amount: number,
		statementDescription: string,
		pageNumber: number
	) {
		this.kind = kind;
		this.date = date;
		this.amount = amount;
		this.statementDescription = statementDescription;
		this.pageNumber = pageNumber;
	}
}
