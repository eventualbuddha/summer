import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { ImportedTransaction } from '../ImportedTransaction';
import { StatementMetadata } from '../StatementMetadata';
import { parseAmount, ParseMoneyError } from '../parse/money';
import type { Statement } from '../statement/Statement';
import type { PageTextLocation } from '../statement/navigation';
import type { Page } from '../statement/page';

export type ImportStatementError =
	| ParseActivityEntriesError
	| InvalidTransactionError
	| InvalidStatementIntervalError
	| InvalidStatementSummaryError
	| InconsistentStatementIntervalError
	| ParseStatementSummaryError;

function getStatementPeriod(page: Page): Interval {
	const statementPeriodLabelText = page.texts.find((text) => text.str === 'Statement Period');
	if (!statementPeriodLabelText) {
		return Interval.invalid('Statement period label not found');
	}

	const firstStatementPeriodLine = page.texts.find(
		(text) =>
			!text.isEmpty &&
			text.y < statementPeriodLabelText.y &&
			statementPeriodLabelText.isVerticallyAlignedWith(text, {
				alignment: 'left',
				maxGap: 5
			})
	);

	if (!firstStatementPeriodLine) {
		return Interval.invalid('First statement period line not found');
	}

	const secondStatementPeriodLine = page.texts.find(
		(text) =>
			!text.isEmpty &&
			text.y < firstStatementPeriodLine.y &&
			firstStatementPeriodLine.isVerticallyAlignedWith(text, {
				alignment: 'left',
				maxGap: 5
			})
	);

	if (secondStatementPeriodLine) {
		const startMatch = firstStatementPeriodLine.str.match(/^(\w+) (\d+), (\d+) to$/);

		if (!startMatch) {
			return Interval.invalid(
				`First statement period line does not match expected format: ${firstStatementPeriodLine.str}`
			);
		}

		const start = DateTime.fromFormat(
			`${startMatch[1]} ${startMatch[2]?.padStart(2, '0')}, ${startMatch[3]}`,
			'MMMM dd, yyyy'
		);

		const endMatch = secondStatementPeriodLine.str.match(/^(\w+) (\d+), (\d+)$/);

		if (!endMatch) {
			return Interval.invalid(
				`Second statement period line does not match expected format: ${secondStatementPeriodLine.str}`
			);
		}

		const end = DateTime.fromFormat(
			`${endMatch[1]} ${endMatch[2]?.padStart(2, '0')}, ${endMatch[3]}`,
			'MMMM dd, yyyy'
		);

		return Interval.fromDateTimes(start, end);
	} else {
		const match = firstStatementPeriodLine.str.match(/^(\w+) (\d+)-(\d+), (\d+)$/);

		if (!match) {
			return Interval.invalid(
				`First statement period line does not match expected format: ${firstStatementPeriodLine.str}`
			);
		}

		const start = DateTime.fromFormat(
			`${match[1]} ${match[2]?.padStart(2, '0')}, ${match[4]}`,
			'MMMM dd, yyyy'
		);
		const end = DateTime.fromFormat(
			`${match[1]} ${match[3]?.padStart(2, '0')}, ${match[4]}`,
			'MMMM dd, yyyy'
		);

		return Interval.fromDateTimes(start, end);
	}
}

export class StatementSummary {
	period: Interval;
	account: string;
	accountName: string;
	beginningBalance: number;
	depositsAndCredits: number;
	interestPaid: number;
	withdrawalsAndDebits: number;
	otherFees: number;
	endingBalance: number;

	constructor(
		period: Interval,
		account: string,
		accountName: string,
		beginningBalance: number,
		depositsAndCredits: number,
		interestPaid: number,
		withdrawalsAndDebits: number,
		otherFees: number,
		endingBalance: number
	) {
		this.period = period;
		this.account = account;
		this.accountName = accountName;
		this.beginningBalance = beginningBalance;
		this.depositsAndCredits = depositsAndCredits;
		this.interestPaid = interestPaid;
		this.withdrawalsAndDebits = withdrawalsAndDebits;
		this.otherFees = otherFees;
		this.endingBalance = endingBalance;
	}
}

export class ParseStatementSummaryError extends Error {
	readonly pageNumber: number;

	constructor(pageNumber: number, message: string) {
		super(`${message} on page ${pageNumber}`);
		this.pageNumber = pageNumber;
	}
}

export function parseStatementSummary(
	page: Page
): Result<StatementSummary, ParseStatementSummaryError> {
	const summary: Partial<StatementSummary> = {};
	const period = getStatementPeriod(page);

	if (!period.isValid) {
		return Result.err(
			new ParseStatementSummaryError(
				page.pageNumber,
				`Invalid statement period: ${period.invalidReason}`
			)
		);
	}

	summary.period = period;

	const accountNumberLabel = page.navigator.find(/^Account Number: (.+)$/);

	if (!accountNumberLabel) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Account number not found'));
	}

	summary.account = accountNumberLabel.text.str.replace('Account Number: ', '');

	const accountNameLabel = accountNumberLabel.findLeft(/\w{5,}/);

	if (!accountNameLabel) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Account name not found'));
	}

	summary.accountName = accountNameLabel.text.str;

	const summaryLabel = page.navigator.find('Summary');

	if (!summaryLabel) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, '"Summary" label not found'));
	}

	const amountLabel = summaryLabel.findRight('Amount');

	if (!amountLabel) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, '"Amount" label not found'));
	}

	const leftColumnLabelStrings = new Map([
		['beginningBalance', 'Beginning Balance'],
		['depositsAndCredits', 'Deposits and Credits'],
		['interestPaid', 'Interest Paid'],
		['withdrawalsAndDebits', 'Withdrawals and Other Debits'],
		['otherFees', 'Other Fees'],
		['endingBalance', 'Ending Balance']
	] as const);

	let previousLeft = summaryLabel;
	let previousRight = amountLabel;

	for (const [key, labelString] of leftColumnLabelStrings) {
		const label = previousLeft.findDown(labelString, {
			alignment: 'left',
			maxGap: 20
		});
		const value = previousRight.findDown(/.*/, {
			alignment: 'right',
			maxGap: 20
		});

		if (!label) {
			return Result.err(
				new ParseStatementSummaryError(page.pageNumber, `"${labelString}" label not found`)
			);
		}

		if (!value) {
			return Result.err(
				new ParseStatementSummaryError(page.pageNumber, `"${labelString}" value not found`)
			);
		}

		const parseAmountResult = parseAmount(value.text.str);

		if (parseAmountResult.isErr) {
			return Result.err(
				new ParseStatementSummaryError(
					page.pageNumber,
					`"${labelString}" value is invalid: ${parseAmountResult.error.message}`
				)
			);
		}

		summary[key] = parseAmountResult.value;
		previousLeft = label;
		previousRight = value;
	}

	if (!summary.period || !summary.period.isValid) {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, `"Period" not found or is invalid`)
		);
	}

	if (!summary.account) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, `"Account" not found`));
	}

	if (!summary.accountName) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, `"Account Name" not found`));
	}

	if (typeof summary.beginningBalance === 'undefined') {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, `"Beginning Balance" not found`)
		);
	}

	if (typeof summary.depositsAndCredits === 'undefined') {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, `"Deposits and Credits" not found`)
		);
	}

	if (typeof summary.interestPaid === 'undefined') {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, `"Interest Paid" not found`));
	}

	if (typeof summary.withdrawalsAndDebits === 'undefined') {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, `"Withdrawals and Debits" not found`)
		);
	}

	if (typeof summary.otherFees === 'undefined') {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, `"Other Fees" not found`));
	}

	if (typeof summary.endingBalance === 'undefined') {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, `"Ending Balance" not found`)
		);
	}

	return Result.ok(
		new StatementSummary(
			summary.period,
			summary.account,
			summary.accountName,
			summary.beginningBalance,
			summary.depositsAndCredits,
			summary.interestPaid,
			summary.withdrawalsAndDebits,
			summary.otherFees,
			summary.endingBalance
		)
	);
}

export interface ActivityEntry {
	date: DateTime<true>;
	type: string;
	description?: string;
	debit?: number;
	credit?: number;
	balance: number;
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

/**
 * Parses tabular activity entries from a Schwab statement PDF. These mostly
 * correspond to transactions that occurred during the statement interval,
 * though some may be informational entries such as account balances.
 */
export function parseActivityEntries(
	page: Page,
	statementInterval: Interval<true>
): Result<ActivityEntry[], ParseActivityEntriesError> {
	const activityEntries: ActivityEntry[] = [];

	const activitySectionLabel = page.navigator.find(/^\s*Activity\s*$/);
	if (!activitySectionLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Activity'));

	const dateHeaderLabel = activitySectionLabel.findDown(/^\s*Date\s*$/, {
		alignment: 'left'
	});
	if (!dateHeaderLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Date'));

	const postedHeaderLabel = dateHeaderLabel.findDown(/^\s*Posted\s*$/, {
		alignment: 'left'
	});
	if (!postedHeaderLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Posted'));

	const descriptionHeaderLabel = postedHeaderLabel.findRight(/^\s*Description\s*$/);
	if (!descriptionHeaderLabel)
		return Result.err(new MissingHeaderError(page.pageNumber, 'Description'));

	const debitsHeaderLabel = descriptionHeaderLabel.findRight(/^\s*Debits\s*$/);
	if (!debitsHeaderLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Debits'));

	const creditsHeaderLabel = debitsHeaderLabel.findRight(/^\s*Credits\s*$/);
	if (!creditsHeaderLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Credits'));

	const balanceHeaderLabel = creditsHeaderLabel.findRight(/^\s*Balance\s*$/);
	if (!balanceHeaderLabel) return Result.err(new MissingHeaderError(page.pageNumber, 'Balance'));

	let previousLeftValue = postedHeaderLabel;

	for (let row = 0; ; row += 1) {
		const dateLabel = previousLeftValue.findDown(/^\d+\/\d+$/, {
			alignment: 'left'
		});

		if (!dateLabel) {
			break;
		}
		previousLeftValue = dateLabel;

		let typeLabel: PageTextLocation | undefined;
		let debitLabel: PageTextLocation | undefined;
		let creditLabel: PageTextLocation | undefined;
		let balanceLabel: PageTextLocation | undefined;

		for (
			let label: PageTextLocation | undefined = dateLabel;
			label;
			label = label.findRight((t) => !t.isEmpty)
		) {
			if (label.text.isVerticallyAlignedWith(descriptionHeaderLabel.text, { alignment: 'left' })) {
				typeLabel = label;
			} else if (
				label.text.isVerticallyAlignedWith(debitsHeaderLabel.text, { alignment: 'right' })
			) {
				debitLabel = label;
			} else if (
				label.text.isVerticallyAlignedWith(creditsHeaderLabel.text, { alignment: 'right' })
			) {
				creditLabel = label;
			} else if (
				label.text.isVerticallyAlignedWith(balanceHeaderLabel.text, { alignment: 'right' })
			) {
				balanceLabel = label;
			}
		}

		if (!typeLabel) {
			return Result.err(new MissingTableCellError(page.pageNumber, row, 'Type'));
		}

		if (!balanceLabel) {
			return Result.err(new MissingTableCellError(page.pageNumber, row, 'Balance'));
		}

		const descriptionLabel = typeLabel.findDown((t) => !t.isEmpty, {
			alignment: 'left',
			maxGap: 5
		});

		const [, month, day] = dateLabel.text.str.match(/^(\d+)\/(\d+)$/) as [string, string, string];
		const date = DateTime.fromObject({
			day: parseInt(day),
			month: parseInt(month),
			year: statementInterval.end.year
		});

		if (!date.isValid) {
			return Result.err(new InvalidDateError(dateLabel.text.str, date));
		}

		const parseDebitResult = debitLabel ? parseAmount(debitLabel.text.str) : undefined;

		if (debitLabel && parseDebitResult?.isErr) {
			return Result.err(
				new InvalidMoneyAmountError('Debit', debitLabel.text.str, parseDebitResult.error)
			);
		}

		const parseCreditResult = creditLabel ? parseAmount(creditLabel.text.str) : undefined;

		if (creditLabel && parseCreditResult?.isErr) {
			return Result.err(
				new InvalidMoneyAmountError('Credit', creditLabel.text.str, parseCreditResult.error)
			);
		}

		const parseBalanceResult = parseAmount(balanceLabel.text.str);

		if (balanceLabel && parseBalanceResult.isErr) {
			return Result.err(
				new InvalidMoneyAmountError('Balance', balanceLabel.text.str, parseBalanceResult.error)
			);
		}

		const debit = parseDebitResult?.unwrap();
		const credit = parseCreditResult?.unwrap();
		const balance = parseBalanceResult.unwrap();
		const activityEntry: ActivityEntry = {
			date,
			type: typeLabel.text.str,
			description: descriptionLabel?.text.str,
			debit,
			credit,
			balance
		};

		activityEntries.push(activityEntry);
	}

	return Result.ok(activityEntries);
}

export class InvalidTransactionError extends Error {
	readonly activityEntry: ActivityEntry;

	constructor(message: string, activityEntry: ActivityEntry) {
		super(message);
		this.name = 'InvalidTransactionError';
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

class ParseStatementIntervalHandler {
	#statementInterval?: Interval<true>;

	*parsePage(page: Page): Generator<Result<never, ImportStatementError>> {
		const period = getStatementPeriod(page);
		if (!period.isValid) {
			yield Result.err(new InvalidStatementIntervalError(period));
		}

		this.#statementInterval ??= period;
		if (!this.#statementInterval.equals(period)) {
			yield Result.err(new InconsistentStatementIntervalError(this.#statementInterval, period));
		}
	}

	get statementInterval(): Interval<true> | undefined {
		return this.#statementInterval;
	}
}

/**
 * Parser for the statement summary containing the beginning balance,
 * credits and debits, and ending balance.
 */
class ParseStatementSummaryHandler {
	#summary?: StatementSummary;

	/**
	 * Parses the current page for the statement summary. If found, yields the
	 * `StatementMetadata` and updates the `summary` property to the more
	 * comprehensive summary. Yields errors if the statement summary unparsable.
	 */
	*parsePage(page: Page): Generator<Result<StatementMetadata, ParseStatementSummaryError>> {
		if (this.#summary) {
			return;
		}

		const parseSummaryResult = parseStatementSummary(page);
		if (parseSummaryResult.isErr) {
			yield Result.err(parseSummaryResult.error);
		} else {
			this.#summary = parseSummaryResult.value;
			yield Result.ok(
				new StatementMetadata(
					this.#summary.period,
					this.#summary.account,
					this.#summary.accountName
				)
			);
		}
	}

	/**
	 * Parsed statement summary, if found.
	 */
	get summary(): StatementSummary | undefined {
		return this.#summary;
	}
}

/**
 * Parser for transaction activity listed in the statement. Tracks the
 * sum of credits and debits as transactions are parsed for reconciliation
 * with the statement summary.
 */
class ParseActivityHandler {
	#computedCredits = 0;
	#computedDebits = 0;

	/**
	 * Parse the activity in the page, updating `computedCredits` and
	 * `computedDebits` as transactions are parsed.
	 */
	*parsePage(
		page: Page,
		statementInterval: Interval<true>
	): Generator<Result<ImportedTransaction, ImportStatementError>> {
		const parseActivityEntriesResult = parseActivityEntries(page, statementInterval);

		if (parseActivityEntriesResult.isErr) {
			yield Result.err(parseActivityEntriesResult.error);
			return;
		}

		for (const entry of parseActivityEntriesResult.value) {
			if (typeof entry.debit === 'undefined' && typeof entry.credit === 'undefined') {
				// skip entries that don't affect the balance, like "Initial Balance" entries
				continue;
			}

			if (typeof entry.debit === 'number' && typeof entry.credit === 'number') {
				yield Result.err(
					new InvalidTransactionError('Transaction cannot be both debit and credit', entry)
				);
			}

			yield Result.ok(
				new ImportedTransaction(
					entry.date,
					entry.debit ? -entry.debit : entry.credit!,
					entry.description ? `${entry.type} ${entry.description}` : entry.type
				)
			);

			if (entry.debit) {
				this.#computedDebits -= entry.debit;
			} else if (entry.credit) {
				this.#computedCredits += entry.credit;
			}
		}
	}

	/**
	 * The sum of the value of credits in the statement parsed so far.
	 * Non-negative.
	 */
	get computedCredits() {
		return this.#computedCredits;
	}

	/**
	 * The sum of the value of debits in the statement parsed so far.
	 * Non-positive.
	 */
	get computedDebits() {
		return this.#computedDebits;
	}
}

/**
 * Parses a statement from text extracted from a Schwab statement PDF. Expects a
 * fairly specific format, with transaction data in a table, usually across
 * multiple pages. Also expects a summary section that contains the total
 * debits and credits as well as the ending balance.
 */
export async function* parseStatement(
	statement: Statement
): AsyncGenerator<Result<ImportedTransaction | StatementMetadata, ImportStatementError>> {
	const periodHandler = new ParseStatementIntervalHandler();
	const summaryHandler = new ParseStatementSummaryHandler();
	const activityHandler = new ParseActivityHandler();

	for (const page of statement.pages) {
		// Parse the statement period.
		yield* periodHandler.parsePage(page);

		// Parse the summary section, if present, and pipe results to our caller.
		yield* summaryHandler.parsePage(page);

		// We can't parse statement activity if the period has not been parsed.
		// This is because the transaction dates omit the year.
		if (!periodHandler.statementInterval) {
			continue;
		}

		// Parse the statement activity on this page.
		yield* activityHandler.parsePage(page, periodHandler.statementInterval);
	}

	const summary = summaryHandler.summary;

	if (summary) {
		const { computedCredits, computedDebits } = activityHandler;
		const summaryCredits = summary.depositsAndCredits + summary.interestPaid;
		if (computedCredits !== summaryCredits) {
			yield Result.err(
				new InvalidStatementSummaryError(
					'Credits do not match computed value',
					summary,
					summaryCredits,
					computedCredits
				)
			);
		}

		const summaryDebits = summary.withdrawalsAndDebits + summary.otherFees;
		if (computedDebits !== summaryDebits) {
			yield Result.err(
				new InvalidStatementSummaryError(
					'Debits do not match computed value',
					summary,
					summaryDebits,
					computedDebits
				)
			);
		}

		const computedEndingBalance = summary.beginningBalance + summaryCredits + summaryDebits;
		if (computedEndingBalance !== summary.endingBalance) {
			yield Result.err(
				new InvalidStatementSummaryError(
					'Ending balance does not match the computed value',
					summary,
					summary.endingBalance,
					computedEndingBalance
				)
			);
		}
	}
}
