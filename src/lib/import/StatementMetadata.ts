import { DateTime } from 'luxon';

/**
 * Metadata for a statement that may be useful in importing it.
 */
export class StatementMetadata {
	/** Statement closing date. */
	closingDate: DateTime;

	/** Account number or other unique identifier. */
	account?: string;

	/** Account name. */
	accountName?: string;

	constructor(closingDate: DateTime, account?: string, accountName?: string) {
		this.closingDate = closingDate;
		this.account = account;
		this.accountName = accountName;
	}
}
