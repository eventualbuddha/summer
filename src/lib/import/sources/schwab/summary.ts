import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { StatementMetadata } from '../../StatementMetadata';
import { ParseStatementSummaryError } from '../../parse/errors';
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
		[/\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/],
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

export function parseStatementPeriod(firstLine: string, secondLine?: string): Interval {
	if (secondLine) {
		const startMatch = firstLine.match(/^(\w+) (\d+), (\d+) to$/);

		if (!startMatch) {
			return Interval.invalid(
				`First statement period line does not match expected format: ${firstLine}`
			);
		}

		const start = DateTime.fromFormat(
			`${startMatch[1]} ${startMatch[2]?.padStart(2, '0')}, ${startMatch[3]}`,
			'MMMM dd, yyyy'
		);

		const endMatch = secondLine.match(/^(\w+) (\d+), (\d+)$/);

		if (!endMatch) {
			return Interval.invalid(
				`Second statement period line does not match expected format: ${secondLine}`
			);
		}

		const end = DateTime.fromFormat(
			`${endMatch[1]} ${endMatch[2]?.padStart(2, '0')}, ${endMatch[3]}`,
			'MMMM dd, yyyy'
		);

		return Interval.fromDateTimes(start, end);
	} else {
		const match = firstLine.match(/^(\w+) (\d+)-(\d+), (\d+)$/);

		if (!match) {
			return Interval.invalid(
				`First statement period line does not match expected format: ${firstLine}`
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

	return parseStatementPeriod(firstStatementPeriodLine.str, secondStatementPeriodLine?.str);
}
