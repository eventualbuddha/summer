import { ImportedTransaction } from '$lib/import/ImportedTransaction';
import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { ParseStatementError } from '../../parse/errors';
import { parseAmount } from '../../parse/money';
import type { PageTextLocation } from '../../statement/navigation';
import type { Page } from '../../statement/page';

/**
 * Parses tabular activity entries from a Schwab statement PDF. These mostly
 * correspond to transactions that occurred during the statement interval,
 * though some may be informational entries such as account balances.
 */
export function parseActivityEntries(
	page: Page,
	statementInterval: Interval<true>
): Result<ActivityEntry[], ParseStatementError> {
	const activityEntries: ActivityEntry[] = [];

	const activitySectionLabel = page.navigator.find(/^\s*Activity\s*$/);
	if (!activitySectionLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Activity', { pageNumber: page.pageNumber })
		);

	const dateHeaderLabel = activitySectionLabel.findDown(/^\s*Date\s*$/, {
		alignment: 'left'
	});
	if (!dateHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Date', {
				pageNumber: page.pageNumber,
				searchFromText: activitySectionLabel.text,
				searchDirection: 'down'
			})
		);

	const postedHeaderLabel = dateHeaderLabel.findDown(/^\s*Posted\s*$/, {
		alignment: 'left'
	});
	if (!postedHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Posted', {
				pageNumber: page.pageNumber,
				searchFromText: dateHeaderLabel.text,
				searchDirection: 'down'
			})
		);

	const descriptionHeaderLabel = postedHeaderLabel.findRight(/^\s*Description\s*$/);
	if (!descriptionHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Description', {
				pageNumber: page.pageNumber,
				searchFromText: postedHeaderLabel.text,
				searchDirection: 'right'
			})
		);

	const debitsHeaderLabel = descriptionHeaderLabel.findRight(/^\s*Debits\s*$/);
	if (!debitsHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Debits', {
				pageNumber: page.pageNumber,
				searchFromText: descriptionHeaderLabel.text,
				searchDirection: 'right'
			})
		);

	const creditsHeaderLabel = debitsHeaderLabel.findRight(/^\s*Credits\s*$/);
	if (!creditsHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Credits', {
				pageNumber: page.pageNumber,
				searchFromText: debitsHeaderLabel.text,
				searchDirection: 'right'
			})
		);

	const balanceHeaderLabel = creditsHeaderLabel.findRight(/^\s*Balance\s*$/);
	if (!balanceHeaderLabel)
		return Result.err(
			ParseStatementError.MissingLabel('Balance', {
				pageNumber: page.pageNumber,
				searchFromText: creditsHeaderLabel.text,
				searchDirection: 'right'
			})
		);

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
			return Result.err(
				ParseStatementError.MissingValue('Missing type', { pageNumber: page.pageNumber })
			);
		}

		if (!balanceLabel) {
			return Result.err(
				ParseStatementError.MissingValue('Missing balance', { pageNumber: page.pageNumber })
			);
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
			return Result.err(
				ParseStatementError.InvalidValue(
					`Invalid date "${dateLabel.text.str}": ${date.invalidExplanation}`,
					{ pageNumber: page.pageNumber, contentText: dateLabel.text }
				)
			);
		}

		const parseDebitResult = debitLabel ? parseAmount(debitLabel.text.str) : undefined;

		if (debitLabel && parseDebitResult?.isErr) {
			return Result.err(
				ParseStatementError.InvalidValue('Invalid debit', {
					cause: parseDebitResult.error,
					pageNumber: debitLabel.pageNumber,
					contentText: debitLabel.text
				})
			);
		}

		const parseCreditResult = creditLabel ? parseAmount(creditLabel.text.str) : undefined;

		if (creditLabel && parseCreditResult?.isErr) {
			return Result.err(
				ParseStatementError.InvalidValue('Invalid credit', {
					cause: parseCreditResult.error,
					pageNumber: creditLabel.pageNumber,
					contentText: creditLabel.text
				})
			);
		}

		const parseBalanceResult = parseAmount(balanceLabel.text.str);

		if (balanceLabel && parseBalanceResult.isErr) {
			return Result.err(
				ParseStatementError.InvalidValue('Invalid balance', {
					cause: parseBalanceResult.error,
					pageNumber: balanceLabel.pageNumber,
					contentText: balanceLabel.text
				})
			);
		}

		const debit = parseDebitResult?.unwrap();
		const credit = parseCreditResult?.unwrap();
		const balance = parseBalanceResult.unwrap();
		const activityEntry = new ActivityEntry(
			page.pageNumber,
			date,
			typeLabel.text.str,
			descriptionLabel?.text.str,
			debit,
			credit,
			balance
		);

		activityEntries.push(activityEntry);
	}

	return Result.ok(activityEntries);
}

export class ActivityEntry extends ImportedTransaction {
	type: string;
	description?: string;
	debit?: number;
	credit?: number;
	balance: number;

	constructor(
		pageNumber: number,
		date: DateTime<true>,
		type: string,
		description: string | undefined,
		debit: number | undefined,
		credit: number | undefined,
		balance: number
	) {
		super(
			date,
			debit ? -debit : (credit ?? Number.NaN),
			description ? `${type} ${description}` : type,
			pageNumber
		);
		this.type = type;
		this.description = description;
		this.debit = debit;
		this.credit = credit;
		this.balance = balance;
	}
}
