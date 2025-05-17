import { ParseStatementError } from '$lib/import/parse/errors';
import { MONEY_PATTERN, parseAmount } from '$lib/import/parse/money';
import type { Statement } from '$lib/import/statement/Statement';
import { StatementMetadata } from '$lib/import/StatementMetadata';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';

const MMM_DD_YYYY_PATTERN = /^\s*\w+ \d{1,2}, \d{4}\s*$/;
const MMM_DD_PATTERN = /^\s*\w+ \d{1,2}(, \d{4})?\s*$/;

export function parseStatementSummary(
	statement: Statement
): Result<StatementSummary, ParseStatementError> {
	const statementHeading = statement.navigator.find('Statement');

	if (!statementHeading) {
		return Result.err(ParseStatementError.MissingLabel('Missing statement heading'));
	}

	const closingDateValue = statementHeading.findDown(MMM_DD_YYYY_PATTERN, {
		maxGap: 50,
		alignment: 'right'
	});

	if (!closingDateValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing closing date value', {
				searchFromText: statementHeading.text,
				searchDirection: 'down'
			})
		);
	}

	const closingDate = DateTime.fromFormat(closingDateValue.text.str.trim(), 'MMM d, yyyy');

	const startDateValue = closingDateValue.findLeft(MMM_DD_PATTERN);

	if (!startDateValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing start date value', {
				searchFromText: closingDateValue.text,
				searchDirection: 'left'
			})
		);
	}

	let startDate = DateTime.fromFormat(startDateValue.text.str.trim(), 'MMM d');

	if (!startDate.isValid) {
		startDate = DateTime.fromFormat(startDateValue.text.str.trim(), 'MMM d, yyyy');
	} else {
		startDate = startDate.set({ year: closingDate.year });
	}

	const yourBalanceLabel = statement.navigator.find(/Your \w+ Balance/);

	if (!yourBalanceLabel) {
		return Result.err(ParseStatementError.MissingLabel('Missing balance label'));
	}

	const yourBalanceValue = yourBalanceLabel.findDown(MONEY_PATTERN, {
		maxGap: 50,
		alignment: 'left'
	});

	if (!yourBalanceValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing balance value', {
				searchFromText: yourBalanceLabel.text,
				searchDirection: 'down'
			})
		);
	}

	const yourBalance = parseAmount(yourBalanceValue.text.str);

	if (yourBalance.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid balance: ${yourBalance.error}`, {
				pageNumber: yourBalanceValue.pageNumber
			})
		);
	}

	const minimumPaymentDueValue = yourBalanceValue.findRight(MONEY_PATTERN);

	if (!minimumPaymentDueValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing minimum payment due value', {
				searchFromText: yourBalanceLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const paymentDueDateValue = minimumPaymentDueValue.findRight(MMM_DD_YYYY_PATTERN);

	if (!paymentDueDateValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing payment due date value', {
				searchFromText: minimumPaymentDueValue.text,
				searchDirection: 'right'
			})
		);
	}

	const paymentDueDate = DateTime.fromFormat(paymentDueDateValue.text.str.trim(), 'MMM d, yyyy');

	const previousBalanceLabel = paymentDueDateValue.findDown(/Previous Total Balance/, {
		alignment: 'left'
	});

	if (!previousBalanceLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing previous balance label', {
				searchFromText: paymentDueDateValue.text,
				searchDirection: 'down'
			})
		);
	}

	const previousBalanceValue = previousBalanceLabel.findRight(MONEY_PATTERN);

	if (!previousBalanceValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing previous balance value', {
				searchFromText: previousBalanceLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const previousBalance = parseAmount(previousBalanceValue.text.str);

	if (previousBalance.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid previous balance: ${previousBalance.error}`, {
				pageNumber: previousBalanceValue.pageNumber
			})
		);
	}

	const accountActivityLabel = statement.navigator.find(/Account Activity/);

	if (!accountActivityLabel) {
		return Result.err(ParseStatementError.MissingLabel('Missing "Account Activity" label'));
	}

	const totalPaymentsLabel = accountActivityLabel.findDown(/Total payments for this period/, {
		alignment: 'left'
	});

	if (!totalPaymentsLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total payments for this period" label', {
				pageNumber: accountActivityLabel.pageNumber
			})
		);
	}

	const totalPaymentsValue = totalPaymentsLabel.findRight(MONEY_PATTERN);

	if (!totalPaymentsValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing total payments value', {
				searchFromText: totalPaymentsLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalPayments = parseAmount(totalPaymentsValue.text.str);

	if (totalPayments.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid total payments: ${totalPayments.error}`, {
				pageNumber: totalPaymentsValue.pageNumber
			})
		);
	}

	const totalTransactionsLabel = totalPaymentsLabel.findDown(
		/Total charges, credits, and returns for this period/,
		{
			alignment: 'left'
		}
	);

	if (!totalTransactionsLabel) {
		return Result.err(
			ParseStatementError.MissingLabel(
				'Missing "Total charges, credits, and returns for this period" label',
				{
					pageNumber: totalPaymentsLabel.pageNumber
				}
			)
		);
	}

	const totalTransactionsValue = totalTransactionsLabel.findRight(MONEY_PATTERN);

	if (!totalTransactionsValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing total transactions value', {
				searchFromText: totalTransactionsLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalTransactions = parseAmount(totalTransactionsValue.text.str);

	if (totalTransactions.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid total transactions: ${totalTransactions.error}`, {
				pageNumber: totalTransactionsValue.pageNumber
			})
		);
	}

	const totalDailyCashLabel = totalTransactionsLabel.findDown(/Total Daily Cash to account/, {
		alignment: 'left'
	});

	if (!totalDailyCashLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total Daily Cash to account" label', {
				pageNumber: totalTransactionsLabel.pageNumber
			})
		);
	}

	const totalDailyCashValue = totalDailyCashLabel.findRight(MONEY_PATTERN);

	if (!totalDailyCashValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing total daily cash value', {
				searchFromText: totalDailyCashLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalDailyCash = parseAmount(totalDailyCashValue.text.str);

	const totalInterestChargedLabel = totalDailyCashLabel.findDown(/Total interest for this month/, {
		alignment: 'left'
	});

	if (!totalInterestChargedLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total interest for this month" label', {
				pageNumber: totalDailyCashLabel.pageNumber
			})
		);
	}

	const totalInterestChargedValue = totalInterestChargedLabel.findRight(MONEY_PATTERN);
	if (!totalInterestChargedValue) {
		return Result.err(
			ParseStatementError.MissingValue('Missing total interest charged value', {
				searchFromText: totalInterestChargedLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalInterestCharged = parseAmount(totalInterestChargedValue.text.str);

	if (totalInterestCharged.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Invalid total interest charged: ${totalInterestCharged.error}`,
				{
					pageNumber: totalInterestChargedValue.pageNumber
				}
			)
		);
	}

	if (totalDailyCash.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid total daily cash: ${totalDailyCash.error}`, {
				pageNumber: totalDailyCashValue.pageNumber
			})
		);
	}

	return Result.ok(
		new StatementSummary(
			startDate,
			closingDate,
			paymentDueDate,
			-previousBalance.value,
			-totalPayments.value,
			-totalTransactions.value,
			totalDailyCash.value,
			-totalInterestCharged.value,
			-yourBalance.value
		)
	);
}

export class StatementSummary extends StatementMetadata {
	startDate: DateTime;
	paymentDueDate: DateTime;
	previousBalance: number;
	totalPayments: number;
	totalTransactions: number;
	totalDailyCash: number;
	interestCharged: number;
	totalBalance: number;

	constructor(
		startDate: DateTime,
		closingDate: DateTime,
		paymentDueDate: DateTime,
		previousBalance: number,
		totalPayments: number,
		totalTransactions: number,
		totalDailyCash: number,
		interestCharged: number,
		totalBalance: number
	) {
		super(closingDate, 'credit', 'apple-card', 'Apple Card');
		this.startDate = startDate;
		this.closingDate = closingDate;
		this.paymentDueDate = paymentDueDate;
		this.previousBalance = previousBalance;
		this.totalPayments = totalPayments;
		this.totalTransactions = totalTransactions;
		this.totalDailyCash = totalDailyCash;
		this.interestCharged = interestCharged;
		this.totalBalance = totalBalance;
	}
}
