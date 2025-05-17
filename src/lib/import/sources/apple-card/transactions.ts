import { ImportedTransaction, ImportedTransactionKind } from '$lib/import/ImportedTransaction';
import { ParseStatementError } from '$lib/import/parse/errors';
import { MONEY_PATTERN, parseAmount } from '$lib/import/parse/money';
import type { PageTextLocation } from '$lib/import/statement/navigation';
import type { Statement } from '$lib/import/statement/Statement';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';

const MM_DD_YYYY_PATTERN = /^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/;

export function* parseTransactions(
	statement: Statement
): Generator<Result<Transaction, ParseStatementError>> {
	const transactionSectionHeadings = statement.navigator.findAll(/Transactions by \w+/);

	for (const transactionsHeading of transactionSectionHeadings) {
		const dateTableHeaderLabel = transactionsHeading.findDown('Date', {
			alignment: 'left',
			maxAlignmentError: 2
		});

		if (!dateTableHeaderLabel) {
			yield Result.err(
				ParseStatementError.MissingLabel('Missing "Date" table header label', {
					searchFromText: transactionsHeading.text,
					searchDirection: 'down'
				})
			);
			return;
		}

		const firstDateValue = dateTableHeaderLabel.findDown(MM_DD_YYYY_PATTERN, {
			maxGap: 30,
			alignment: 'left',
			maxAlignmentError: 2
		});

		if (!firstDateValue) {
			yield Result.err(
				ParseStatementError.MissingValue('Missing first date value', {
					searchFromText: dateTableHeaderLabel.text,
					searchDirection: 'down'
				})
			);
			return;
		}

		let currentDateValue: PageTextLocation | undefined = firstDateValue.pageLocation;
		while (currentDateValue) {
			const transactionDate = DateTime.fromFormat(currentDateValue.text.str, 'MM/dd/yyyy');

			if (!transactionDate.isValid) {
				yield Result.err(
					ParseStatementError.InvalidValue('Invalid transaction date', {
						contentText: currentDateValue.text
					})
				);
				return;
			}

			const statementDescriptionValue = currentDateValue.findRight(/\w+/);

			if (!statementDescriptionValue) {
				yield Result.err(
					ParseStatementError.MissingValue('Missing transaction description', {
						searchFromText: currentDateValue.text,
						searchDirection: 'right'
					})
				);
				return;
			}

			const dailyCashAdjustmentLabel = statementDescriptionValue.findDown('Daily Cash Adjustment', {
				maxGap: 10,
				alignment: 'left'
			});

			if (dailyCashAdjustmentLabel) {
				const dailyCashPercentValue = dailyCashAdjustmentLabel.findRight(/\d+/);

				if (!dailyCashPercentValue) {
					yield Result.err(
						ParseStatementError.MissingValue('Missing daily cash percent value', {
							searchFromText: dailyCashAdjustmentLabel.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const dailyCashAmountValue = dailyCashPercentValue.findRight(MONEY_PATTERN);

				if (!dailyCashAmountValue) {
					yield Result.err(
						ParseStatementError.MissingValue('Missing daily cash amount value', {
							searchFromText: dailyCashPercentValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const parseDailyCashAmountResult = parseAmount(dailyCashAmountValue.text.str.trim());

				if (parseDailyCashAmountResult.isErr) {
					yield Result.err(
						ParseStatementError.InvalidValue('Invalid daily cash amount', {
							searchFromText: dailyCashAmountValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const dailyCashAmount = -parseDailyCashAmountResult.value;
				const amountValue = statementDescriptionValue.findRight(MONEY_PATTERN);

				if (!amountValue) {
					yield Result.err(
						ParseStatementError.MissingValue('Missing transaction amount value', {
							searchFromText: statementDescriptionValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const parseAmountResult = parseAmount(amountValue.text.str.trim());

				if (parseAmountResult.isErr) {
					yield Result.err(
						ParseStatementError.InvalidValue('Invalid transaction amount', {
							searchFromText: amountValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const amount = -parseAmountResult.value;

				const dailyCashPercent = parseFloat(dailyCashPercentValue.text.str.trim().replace('%', ''));
				const description = statementDescriptionValue.text.str.trim();
				const transaction = new Transaction(
					ImportedTransactionKind.Credit,
					transactionDate,
					amount,
					description,
					transactionsHeading.pageNumber,
					dailyCashPercent,
					dailyCashAmount
				);
				yield Result.ok(transaction);
			} else {
				const transactionTexts = currentDateValue.collectRight(/\w+/);

				if (transactionTexts.length !== 4) {
					yield Result.err(
						ParseStatementError.MissingValue('Unexpected transaction data', {
							searchFromText: currentDateValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const [descriptionValue, dailyCashPercentValue, dailyCashAmountValue, amountValue] =
					transactionTexts as [
						PageTextLocation,
						PageTextLocation,
						PageTextLocation,
						PageTextLocation
					];

				const parseDailyCashAmountResult = parseAmount(dailyCashAmountValue.text.str.trim());

				if (parseDailyCashAmountResult.isErr) {
					yield Result.err(
						ParseStatementError.InvalidValue('Invalid daily cash amount', {
							searchFromText: dailyCashAmountValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const dailyCashAmount = parseDailyCashAmountResult.value;
				const dailyCashPercent = parseFloat(dailyCashPercentValue.text.str.trim().replace('%', ''));
				const parseAmountResult = parseAmount(amountValue.text.str.trim());

				if (parseAmountResult.isErr) {
					yield Result.err(
						ParseStatementError.InvalidValue('Invalid transaction amount', {
							searchFromText: amountValue.text,
							searchDirection: 'right'
						})
					);
					return;
				}

				const amount = -parseAmountResult.value;
				const description = descriptionValue.text.str.trim();

				const transaction = new Transaction(
					ImportedTransactionKind.Charge,
					transactionDate,
					amount,
					description,
					transactionsHeading.pageNumber,
					dailyCashPercent,
					dailyCashAmount
				);

				yield Result.ok(transaction);
			}

			currentDateValue = currentDateValue.findDown(MM_DD_YYYY_PATTERN, {
				maxGap: 30,
				alignment: 'left'
			});
		}
	}
}

export class Transaction extends ImportedTransaction {
	readonly dailyCashPercent: number;
	readonly dailyCashAmount: number;

	constructor(
		kind: ImportedTransactionKind,
		date: DateTime,
		amount: number,
		description: string,
		pageNumber: number,
		dailyCashPercent: number,
		dailyCashAmount: number
	) {
		super(kind, date, amount, description, pageNumber);
		this.dailyCashPercent = dailyCashPercent;
		this.dailyCashAmount = dailyCashAmount;
	}
}
