import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import type { Statement } from '$lib/import/statement/Statement';
import { Result } from '@badrap/result';
import { ParseStatementError } from '../../parse/errors';
import { parseAmount } from '../../parse/money';
import { parseActivityEntries, type ActivityEntry } from './entries';
import { parseStatementPeriodLines, StatementSummary } from './summary';

/**
 * Parses a statement from text extracted from a Schwab statement PDF. Expects a
 * fairly specific format, with transaction data in a table, usually across
 * multiple pages. Also expects a summary section that contains the total
 * debits and credits as well as the ending balance.
 */
export function* parseStatement(
	statement: Statement
): Generator<Result<ImportedTransaction | StatementSummary, ParseStatementError>> {
	// Find the start of the statement summary by looking for "Account Number: XXXX".
	const accountNumberLabel = statement.navigator.find(/Account Number: (.+)/);
	if (!accountNumberLabel) {
		yield Result.err(ParseStatementError.MissingLabel('Account Number'));
		return;
	}

	const accountNumber = accountNumberLabel.text.str.trim().replace(/Account Number: (.+)/, '$1');

	const statementPeriodLabel = accountNumberLabel.pageLocation.findBefore('Statement Period');

	if (!statementPeriodLabel) {
		yield Result.err(
			ParseStatementError.MissingLabel('Statement Period', {
				pageNumber: accountNumberLabel.pageNumber,
				searchFromText: accountNumberLabel.text
			})
		);
		return;
	}

	const firstStatementPeriodLine = statementPeriodLabel.findDown(/\d+/, {
		alignment: 'left',
		maxGap: 10
	});

	if (!firstStatementPeriodLine) {
		yield Result.err(
			ParseStatementError.MissingLabel('Statement Period', {
				pageNumber: statementPeriodLabel.pageNumber,
				searchFromText: statementPeriodLabel.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const secondStatementPeriodLine = firstStatementPeriodLine.findDown(/\d+/, {
		alignment: 'left',
		maxGap: 10
	});

	const statementPeriod = parseStatementPeriodLines(
		firstStatementPeriodLine.text.str,
		secondStatementPeriodLine?.text.str
	);

	if (statementPeriod.isErr) {
		yield Result.err(statementPeriod.error);
		return;
	}

	const accountName = accountNumberLabel.findLeft(/\w{5,}/);

	if (!accountName) {
		yield Result.err(
			ParseStatementError.MissingValue('Account Name', {
				pageNumber: accountNumberLabel.pageNumber,
				searchFromText: accountNumberLabel.text,
				searchDirection: 'left'
			})
		);
		return;
	}

	const beginningBalance = accountName.findDown('Beginning Balance', { alignment: 'left' });

	if (!beginningBalance) {
		yield Result.err(
			ParseStatementError.MissingLabel('Beginning Balance', {
				pageNumber: accountName.pageNumber,
				searchFromText: accountName.text,
				searchDirection: 'down'
			})
		);
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
		yield Result.err(
			ParseStatementError.MissingLabel('Summary', {
				pageNumber: beginningBalance.pageNumber,
				searchFromText: beginningBalance.text
			})
		);
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
		yield Result.err(
			ParseStatementError.InvalidValue('Invalid summary money amount', {
				pageNumber: beginningBalance.pageNumber,
				cause: amounts.error
			})
		);
		return;
	}

	const summary = new StatementSummary(
		statementPeriod.value,
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

	const parseResults = statement.pages.map((page) =>
		parseActivityEntries(page, statementPeriod.value)
	);
	const entries: ActivityEntry[] = [];

	for (const [index, parseResult] of parseResults.entries()) {
		if (parseResult.isErr) {
			if (entries.length > 0) {
				const allRemainingResultsAreErrors = parseResults
					.slice(index + 1)
					.every(({ isErr }) => isErr);

				if (!allRemainingResultsAreErrors) {
					yield Result.err(
						ParseStatementError.InvalidValue(
							`Expected activity entries to appear on consecutive pages, got entries on pages ${parseResults
								.entries()
								.filter(([, { isOk }]) => isOk)
								.map(([index]) => statement.pages[index]?.pageNumber)
								.toArray()
								.join(', ')}`
						)
					);

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
		yield Result.err(
			ParseStatementError.InvalidValue(
				`Credits do not match the computed value: ${computedCredits} ≠ ${credits}`
			)
		);
		return;
	}

	if (debits !== computedDebits) {
		yield Result.err(
			ParseStatementError.InvalidValue(
				`Debits do not match the computed value: ${computedDebits} ≠ ${debits}`
			)
		);
		return;
	}

	const computedEndingBalance = summary.beginningBalance + credits + debits;

	if (summary.endingBalance !== computedEndingBalance) {
		yield Result.err(
			ParseStatementError.InvalidValue(
				`Ending balance does not match the computed value: ${summary.endingBalance} ≠ ${computedEndingBalance}`
			)
		);
		return;
	}

	for (const entry of entries) {
		yield Result.ok(entry);
	}
}
