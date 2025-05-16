import { DateTime } from 'luxon';

export type AccountType = 'credit' | 'banking';

/**
 * Metadata for a statement that may be useful in importing it.
 */
export class StatementMetadata {
	/** Statement closing date. */
	closingDate: DateTime;

	/** The type of account */
	accountType: AccountType;

	/** Account number or other unique identifier. */
	account: string;

	/** Account name. */
	accountName: string;

	constructor(
		closingDate: DateTime,
		accountType: AccountType,
		account: string,
		accountName: string
	) {
		this.closingDate = closingDate;
		this.accountType = accountType;
		this.account = account;
		this.accountName = accountName;
	}
}
