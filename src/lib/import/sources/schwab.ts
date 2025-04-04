import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { ImportedTransaction } from '../ImportedTransaction';
import { StatementMetadata } from '../StatementMetadata';
import { AccumulationParser } from '../parse/AccumulationParser';
import { OnceParser } from '../parse/OnceParser';
import {
	InvalidDateError,
	MissingHeaderError,
	MissingTableCellError,
	ParseStatementSummaryError
} from '../parse/errors';
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

export class StatementSummary extends StatementMetadata {
	period: Interval;
	beginningBalance: number;
	depositsAndCredits: number;
	interestPaid: number;
	withdrawalsAndDebits: number;
	otherFees: number;
	endingBalance: number;

	constructor(
		period: Interval<true>,
		account: string,
		accountName: string,
		beginningBalance: number,
		depositsAndCredits: number,
		interestPaid: number,
		withdrawalsAndDebits: number,
		otherFees: number,
		endingBalance: number
	) {
		super(period.end, account, accountName);
		this.period = period;
		this.beginningBalance = beginningBalance;
		this.depositsAndCredits = depositsAndCredits;
		this.interestPaid = interestPaid;
		this.withdrawalsAndDebits = withdrawalsAndDebits;
		this.otherFees = otherFees;
		this.endingBalance = endingBalance;
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

	const beginningBalanceLabel = summaryLabel.findDown('Beginning Balance', {
		alignment: 'left',
		maxGap: 20
	});
	const entries = beginningBalanceLabel?.findTable(
		[
			'Beginning Balance',
			'Deposits and Credits',
			'Interest Paid',
			'Withdrawals and Other Debits',
			'Other Fees',
			'Ending Balance'
		],
		[/.+/, /.+/, /.+/, /.+/, /.+/, /.+/],
		{ labelAlignment: 'left', valueAlignment: 'right', maxGap: 20 }
	);

	if (!entries) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Summary table not found'));
	}

	for (const [key, [, valueText]] of [
		['beginningBalance', entries[0]],
		['depositsAndCredits', entries[1]],
		['interestPaid', entries[2]],
		['withdrawalsAndDebits', entries[3]],
		['otherFees', entries[4]],
		['endingBalance', entries[5]]
	] as const) {
		const parseResult = parseAmount(valueText.text.str);

		if (parseResult.isErr) {
			return Result.err(
				new ParseStatementSummaryError(
					page.pageNumber,
					`Failed to parse ${key}: ${parseResult.error.message}`
				)
			);
		}

		summary[key] = parseResult.value;
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

/**
 * Parser for transaction activity listed in the statement. Tracks the
 * sum of credits and debits as transactions are parsed for reconciliation
 * with the statement summary.
 */
function makeActivityParser() {
	return new AccumulationParser<
		{ credits: number; debits: number },
		ImportStatementError,
		ImportedTransaction,
		Interval<true>
	>(
		function* (page, acc, statementInterval) {
			if (!acc) {
				throw new Error('Accumulator is missing');
			}
			if (!statementInterval) {
				throw new Error('Statement summary is missing');
			}
			const parseActivityEntriesResult = parseActivityEntries(page, statementInterval);

			if (parseActivityEntriesResult.isErr) {
				yield Result.err(parseActivityEntriesResult.error);
				return acc;
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
						entry.description ? `${entry.type} ${entry.description}` : entry.type,
						page.pageNumber
					)
				);

				if (entry.debit) {
					acc.debits -= entry.debit;
				} else if (entry.credit) {
					acc.credits += entry.credit;
				}
			}

			return acc;
		},
		{ credits: 0, debits: 0 }
	);
}

function makePeriodParser() {
	return new AccumulationParser<Interval<true>, ImportStatementError>(function* (
		page,
		previousPeriod
	) {
		const thisPeriod = getStatementPeriod(page);
		if (!thisPeriod.isValid) {
			yield Result.err(new InvalidStatementIntervalError(thisPeriod));
		}

		if (previousPeriod && !previousPeriod.equals(thisPeriod)) {
			yield Result.err(new InconsistentStatementIntervalError(previousPeriod, thisPeriod));
		}

		return thisPeriod;
	});
}

/**
 * Parses a statement from text extracted from a Schwab statement PDF. Expects a
 * fairly specific format, with transaction data in a table, usually across
 * multiple pages. Also expects a summary section that contains the total
 * debits and credits as well as the ending balance.
 */
export async function* parseStatement(
	statement: Statement
): AsyncGenerator<Result<ImportedTransaction | StatementSummary, ImportStatementError>> {
	const periodParser = makePeriodParser();
	const summaryParser = new OnceParser(parseStatementSummary);
	const activityHandler = makeActivityParser();

	for (const page of statement.pages) {
		// Parse the statement period.
		yield* periodParser.parsePage(page);

		// Parse the summary section, if present, and pipe results to our caller.
		yield* summaryParser.parsePage(page);

		// We can't parse statement activity if the period has not been parsed.
		// This is because the transaction dates omit the year.
		if (!periodParser.parsed) {
			continue;
		}

		// Parse the statement activity on this page.
		yield* activityHandler.parsePage(page, periodParser.parsed);
	}

	const summary = summaryParser.parsed;

	if (summary) {
		const { credits, debits } = activityHandler.parsed!;
		const summaryCredits = summary.depositsAndCredits + summary.interestPaid;
		if (credits !== summaryCredits) {
			yield Result.err(
				new InvalidStatementSummaryError(
					'Credits do not match computed value',
					summary,
					summaryCredits,
					credits
				)
			);
		}

		const summaryDebits = summary.withdrawalsAndDebits + summary.otherFees;
		if (debits !== summaryDebits) {
			yield Result.err(
				new InvalidStatementSummaryError(
					'Debits do not match computed value',
					summary,
					summaryDebits,
					debits
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
