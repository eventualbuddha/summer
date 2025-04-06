import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import type { Statement } from '$lib/import/statement/Statement';
import { Result } from '@badrap/result';
import { MissingHeaderError } from '../../parse/errors';
import { parseAmount } from '../../parse/money';
import { parseActivityEntries, type ActivityEntry } from './entries';
import {
	InvalidStatementIntervalError,
	InvalidStatementSummaryError,
	type ImportStatementError
} from './errors';
import { parseStatementPeriod, StatementSummary } from './summary';

/**
 * Parses a statement from text extracted from a Schwab statement PDF. Expects a
 * fairly specific format, with transaction data in a table, usually across
 * multiple pages. Also expects a summary section that contains the total
 * debits and credits as well as the ending balance.
 */
export function* parseStatement(
	statement: Statement
): Generator<Result<ImportedTransaction | StatementSummary, ImportStatementError>> {
	// Find the start of the statement summary by looking for "Account Number: XXXX".
	const accountNumberLabel = statement.navigator.find(/Account Number: (.+)/);
	if (!accountNumberLabel) {
		yield Result.err(new MissingHeaderError('Account Number'));
		return;
	}

	const accountNumber = accountNumberLabel.text.str.trim().replace(/Account Number: (.+)/, '$1');

	const statementPeriodLabel = accountNumberLabel.pageLocation.findBefore('Statement Period');

	if (!statementPeriodLabel) {
		yield Result.err(new MissingHeaderError('Statement Period'));
		return;
	}

	const firstStatementPeriodLine = statementPeriodLabel.findDown(/\d+/, {
		alignment: 'left',
		maxGap: 10
	});

	if (!firstStatementPeriodLine) {
		yield Result.err(new MissingHeaderError('Statement Period'));
		return;
	}

	const secondStatementPeriodLine = firstStatementPeriodLine.findDown(/\d+/, {
		alignment: 'left',
		maxGap: 10
	});

	const statementPeriod = parseStatementPeriod(
		firstStatementPeriodLine.text.str,
		secondStatementPeriodLine?.text.str
	);

	if (!statementPeriod.isValid) {
		yield Result.err(new InvalidStatementIntervalError(statementPeriod));
		return;
	}

	const accountName = accountNumberLabel.findLeft(/\w{5,}/);

	if (!accountName) {
		yield Result.err(new MissingHeaderError('Account Name'));
		return;
	}

	const beginningBalance = accountName.findDown('Beginning Balance', { alignment: 'left' });

	if (!beginningBalance) {
		yield Result.err(new MissingHeaderError('Beginning Balance'));
		return;
	}

	const summaryTable = beginningBalance.pageLocation.findTable(
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

	if (!summaryTable) {
		yield Result.err(new MissingHeaderError('Summary'));
		return;
	}

	const amounts = Result.all([
		parseAmount(summaryTable[0][1].text.str),
		parseAmount(summaryTable[1][1].text.str),
		parseAmount(summaryTable[2][1].text.str),
		parseAmount(summaryTable[3][1].text.str),
		parseAmount(summaryTable[4][1].text.str),
		parseAmount(summaryTable[5][1].text.str)
	]);

	if (amounts.isErr) {
		yield Result.err(amounts.error);
		return;
	}

	const summary = new StatementSummary(
		statementPeriod,
		accountNumber,
		accountName.text.str.trim(),
		amounts.value[0],
		amounts.value[1],
		amounts.value[2],
		amounts.value[3],
		amounts.value[4],
		amounts.value[5]
	);
	yield Result.ok(summary);

	const parseResults = statement.pages.map((page) => parseActivityEntries(page, statementPeriod));
	const entries: ActivityEntry[] = [];

	for (const [index, parseResult] of parseResults.entries()) {
		if (parseResult.isErr) {
			if (entries.length > 0) {
				const allRemainingResultsAreErrors = parseResults
					.slice(index + 1)
					.every(({ isErr }) => isErr);

				if (!allRemainingResultsAreErrors) {
					const error = new Error(
						`Expected activity entries to appear on consecutive pages, got entries on pages ${parseResults
							.entries()
							.filter(([, { isOk }]) => isOk)
							.map(([index]) => statement.pages[index]?.pageNumber)
							.toArray()
							.join(', ')}`
					);

					yield Result.err(error);
					return;
				}
			}
		} else {
			// Include any entries that affect the account balance,
			// i.e. not "Beginning Balance" or "Ending Balance".
			entries.push(...parseResult.value.filter(({ amount }) => !Number.isNaN(amount)));
		}
	}

	const { credits, debits } = entries.reduce(
		(acc, entry) => ({
			credits: acc.credits + (entry.credit ?? 0),
			debits: acc.debits - (entry.debit ?? 0)
		}),
		{ credits: 0, debits: 0 }
	);

	const computedCredits = summary.depositsAndCredits + summary.interestPaid;
	const computedDebits = summary.withdrawalsAndDebits + summary.otherFees;

	if (credits !== computedCredits) {
		const error = new InvalidStatementSummaryError(
			'Credits do not match the computed value',
			summary,
			computedCredits,
			credits
		);

		yield Result.err(error);
		return;
	}

	if (debits !== computedDebits) {
		const error = new InvalidStatementSummaryError(
			'Debits do not match the computed value',
			summary,
			computedDebits,
			debits
		);

		yield Result.err(error);
		return;
	}

	const computedEndingBalance = summary.beginningBalance + credits + debits;

	if (summary.endingBalance !== computedEndingBalance) {
		const error = new InvalidStatementSummaryError(
			'Ending balance does not match the computed value',
			summary,
			summary.endingBalance,
			computedEndingBalance
		);

		yield Result.err(error);
		return;
	}

	yield* entries.map(Result.ok);
}
