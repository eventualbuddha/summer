import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { StatementMetadata, type AccountType } from '../../StatementMetadata';
import { ParseStatementError } from '../../parse/errors';
import { parseAmount } from '../../parse/money';
import type { Page } from '../../statement/page';

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
		accountType: AccountType,
		account: string,
		accountName: string,
		beginningBalance: number,
		depositsAndCredits: number,
		interestPaid: number,
		withdrawalsAndDebits: number,
		otherFees: number,
		endingBalance: number
	) {
		super(period.end, accountType, account, accountName);
		this.period = period;
		this.beginningBalance = beginningBalance;
		this.depositsAndCredits = depositsAndCredits;
		this.interestPaid = interestPaid;
		this.withdrawalsAndDebits = withdrawalsAndDebits;
		this.otherFees = otherFees;
		this.endingBalance = endingBalance;
	}
}

export function parseStatementSummary(page: Page): Result<StatementSummary, ParseStatementError> {
	const summary: Partial<StatementSummary> = {};
	const parsePeriodResult = parseStatementPeriod(page);

	if (parsePeriodResult.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Invalid statement period: ${parsePeriodResult.error.message}`,
				{ pageNumber: page.pageNumber, cause: parsePeriodResult.error }
			)
		);
	}

	summary.period = parsePeriodResult.value;

	const accountNumberLabel = page.navigator.find(/^Account Number: (.+)$/);

	if (!accountNumberLabel) {
		return Result.err(
			ParseStatementError.MissingValue('Account number not found', { pageNumber: page.pageNumber })
		);
	}

	summary.account = accountNumberLabel.text.str.replace('Account Number: ', '');

	const accountNameLabel = accountNumberLabel.findLeft(/\w{5,}/);

	if (!accountNameLabel) {
		return Result.err(
			ParseStatementError.MissingValue('Account name not found', {
				pageNumber: page.pageNumber,
				searchFromText: accountNumberLabel.text,
				searchDirection: 'left'
			})
		);
	}

	summary.accountName = accountNameLabel.text.str;

	const summaryLabel = page.navigator.find('Summary');

	if (!summaryLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('"Summary" label not found', { pageNumber: page.pageNumber })
		);
	}

	const amountLabel = summaryLabel.findRight('Amount');

	if (!amountLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('"Amount" label not found', { pageNumber: page.pageNumber })
		);
	}

	const beginningBalanceLabel = summaryLabel.findDown('Beginning Balance', {
		alignment: 'left',
		maxGap: 20
	});

	if (!beginningBalanceLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('"Beginning Balance" label not found', {
				pageNumber: page.pageNumber,
				searchFromText: summaryLabel.text,
				searchDirection: 'down'
			})
		);
	}

	const entries = beginningBalanceLabel?.findTable(
		[
			'Beginning Balance',
			'Deposits and Credits',
			'Interest Paid',
			'Withdrawals and Other Debits',
			'Other Fees',
			'Ending Balance'
		],
		[/\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/],
		{ labelAlignment: 'left', valueAlignment: 'right', maxGap: 20 }
	);

	if (!entries) {
		return Result.err(
			ParseStatementError.MissingLabel('Summary table not found', { pageNumber: page.pageNumber })
		);
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
				ParseStatementError.InvalidValue(`Failed to parse ${key}: ${parseResult.error.message}`, {
					pageNumber: page.pageNumber,
					cause: parseResult.error
				})
			);
		}

		summary[key] = parseResult.value;
	}

	if (!summary.period || !summary.period.isValid) {
		return Result.err(
			ParseStatementError.InvalidValue(`"Period" not found or is invalid`, {
				pageNumber: page.pageNumber
			})
		);
	}

	if (!summary.account) {
		return Result.err(
			ParseStatementError.MissingLabel(`"Account" not found`, {
				pageNumber: page.pageNumber
			})
		);
	}

	if (!summary.accountName) {
		return Result.err(
			ParseStatementError.MissingLabel(`"Account Name" not found`, { pageNumber: page.pageNumber })
		);
	}

	if (typeof summary.beginningBalance === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Beginning Balance" not found`, {
				pageNumber: page.pageNumber
			})
		);
	}

	if (typeof summary.depositsAndCredits === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Deposits and Credits" not found`, {
				pageNumber: page.pageNumber
			})
		);
	}

	if (typeof summary.interestPaid === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Interest Paid" not found`, { pageNumber: page.pageNumber })
		);
	}

	if (typeof summary.withdrawalsAndDebits === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Withdrawals and Debits" not found`, {
				pageNumber: page.pageNumber
			})
		);
	}

	if (typeof summary.otherFees === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Other Fees" not found`, { pageNumber: page.pageNumber })
		);
	}

	if (typeof summary.endingBalance === 'undefined') {
		return Result.err(
			ParseStatementError.MissingLabel(`"Ending Balance" not found`, {
				pageNumber: page.pageNumber
			})
		);
	}

	return Result.ok(
		new StatementSummary(
			summary.period,
			'banking',
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

export function parseStatementPeriodLines(
	firstLine: string,
	secondLine?: string
): Result<Interval, ParseStatementError> {
	if (secondLine) {
		const startMatch = firstLine.match(/^(\w+) (\d+), (\d+) to$/);

		if (!startMatch) {
			return Result.err(
				ParseStatementError.InvalidValue(
					`First statement period line does not match expected format: ${firstLine}`
				)
			);
		}

		const start = DateTime.fromFormat(
			`${startMatch[1]} ${startMatch[2]?.padStart(2, '0')}, ${startMatch[3]}`,
			'MMMM dd, yyyy'
		);

		const endMatch = secondLine.match(/^(\w+) (\d+), (\d+)$/);

		if (!endMatch) {
			return Result.err(
				ParseStatementError.InvalidValue(
					`Second statement period line does not match expected format: ${secondLine}`
				)
			);
		}

		const end = DateTime.fromFormat(
			`${endMatch[1]} ${endMatch[2]?.padStart(2, '0')}, ${endMatch[3]}`,
			'MMMM dd, yyyy'
		);

		return Result.ok(Interval.fromDateTimes(start, end));
	} else {
		const match = firstLine.match(/^(\w+) (\d+)-(\d+), (\d+)$/);

		if (!match) {
			return Result.err(
				ParseStatementError.InvalidValue(
					`First statement period line does not match expected format: ${firstLine}`
				)
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

		return Result.ok(Interval.fromDateTimes(start, end));
	}
}

function parseStatementPeriod(page: Page): Result<Interval<true>, ParseStatementError> {
	const statementPeriodLabel = page.navigator.find('Statement Period');

	if (!statementPeriodLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Statement period label not found', {
				pageNumber: page.pageNumber
			})
		);
	}

	const firstStatementPeriodLine = statementPeriodLabel.findDown(/.+/, {
		alignment: 'left',
		maxGap: 5
	});

	if (!firstStatementPeriodLine) {
		return Result.err(
			ParseStatementError.MissingValue('First statement period line not found', {
				pageNumber: page.pageNumber,
				searchFromText: statementPeriodLabel.text,
				searchDirection: 'down'
			})
		);
	}

	const secondStatementPeriodLine = firstStatementPeriodLine.findDown(/.+/, {
		alignment: 'left',
		maxGap: 5
	});

	return parseStatementPeriodLines(
		firstStatementPeriodLine.text.str,
		secondStatementPeriodLine?.text.str
	);
}
