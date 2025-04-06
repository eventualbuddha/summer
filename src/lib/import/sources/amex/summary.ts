import { parseAmount } from '$lib/import/parse/money';
import type { Page } from '$lib/import/statement/page';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';
import { ParseStatementSummaryError } from '../../parse/errors';
import { StatementSummary } from './statement';

export function parseStatementSummary(
	page: Page
): Result<StatementSummary, ParseStatementSummaryError> {
	const closingDateLabel = page.navigator.find('Closing Date');
	const closingDateValue = closingDateLabel?.findRight(/^\d+\/\d+\/\d+$/);

	if (!closingDateValue) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Missing closing date'));
	}

	const closingDate = DateTime.fromFormat(closingDateValue.text.str.trim(), 'MM/dd/yy');

	if (!closingDate.isValid) {
		return Result.err(
			new ParseStatementSummaryError(
				page.pageNumber,
				`Invalid closing date: ${closingDate.invalidExplanation}`
			)
		);
	}

	const accountHolderLabel = closingDateLabel?.findUp(/\w+/, { alignment: 'left', maxGap: 10 });

	if (!accountHolderLabel) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Missing account holder'));
	}

	const accountEndingLabel = closingDateLabel?.findDown(/Account Ending/, { alignment: 'left' });
	const accountEndingValue = accountEndingLabel?.findRight(/[-\d]+/);

	if (!accountEndingValue) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Missing account number'));
	}

	const previousBalanceLabel = page.navigator.find(/Previous Balance/);
	const entries = previousBalanceLabel?.findTable(
		[
			/Previous Balance/,
			/Payments\/Credits/,
			/New Charges/,
			/Fees/,
			/Interest Charged/,
			/New Balance/,
			/Minimum Payment Due/,
			/Credit Limit/,
			/Available Credit/,
			/Cash Advance Limit/,
			/Available Cash/
		],
		[/\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/, /\d+/],
		{ labelAlignment: 'left', valueAlignment: 'right' }
	);

	if (!entries) {
		return Result.err(new ParseStatementSummaryError(page.pageNumber, 'Missing summary info'));
	}

	const account = accountEndingValue.text.str.trim();
	const accountHolder = accountHolderLabel.text.str.trim();
	const previousBalance = parseAmount(entries[0][1].text.str);
	const paymentsAndCredits = parseAmount(entries[1][1].text.str);
	const newCharges = parseAmount(entries[2][1].text.str);
	const fees = parseAmount(entries[3][1].text.str);
	const interestCharged = parseAmount(entries[4][1].text.str);
	const newBalance = parseAmount(entries[5][1].text.str);
	const minimumPaymentDue = parseAmount(entries[6][1].text.str);
	const creditLimit = parseAmount(entries[7][1].text.str);
	const availableCredit = parseAmount(entries[8][1].text.str);
	const cashAdvanceLimit = parseAmount(entries[9][1].text.str);
	const availableCash = parseAmount(entries[10][1].text.str);

	const result = Result.all([
		previousBalance,
		paymentsAndCredits,
		newCharges,
		fees,
		interestCharged,
		newBalance,
		minimumPaymentDue,
		creditLimit,
		availableCredit,
		cashAdvanceLimit,
		availableCash
	]);

	if (result.isErr) {
		return Result.err(
			new ParseStatementSummaryError(page.pageNumber, 'Failed to parse summary info', result.error)
		);
	}

	return Result.ok(new StatementSummary(closingDate, account, accountHolder, ...result.value));
}
