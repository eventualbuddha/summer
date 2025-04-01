import { Interval } from 'luxon';

/**
 * Metadata for a statement that may be useful in importing it.
 */
export class StatementMetadata {
	/** Statement period. */
	period: Interval;

	/** Account number or other unique identifier. */
	account?: string;

	/** Account name. */
	accountName?: string;

	constructor(period: Interval, account?: string, accountName?: string) {
		this.period = period;
		this.account = account;
		this.accountName = accountName;
	}
}
