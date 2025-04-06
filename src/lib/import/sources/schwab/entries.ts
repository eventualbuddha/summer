import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import { Result } from '@badrap/result';
import { DateTime, Interval } from 'luxon';
import { InvalidDateError, MissingHeaderError, MissingTableCellError } from '../../parse/errors';
import { parseAmount } from '../../parse/money';
import type { PageTextLocation } from '../../statement/navigation';
import type { Page } from '../../statement/page';
import { InvalidMoneyAmountError, type ParseActivityEntriesError } from './errors';

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
	if (!activitySectionLabel) return Result.err(new MissingHeaderError('Activity'));

	const dateHeaderLabel = activitySectionLabel.findDown(/^\s*Date\s*$/, {
		alignment: 'left'
	});
	if (!dateHeaderLabel) return Result.err(new MissingHeaderError('Date'));

	const postedHeaderLabel = dateHeaderLabel.findDown(/^\s*Posted\s*$/, {
		alignment: 'left'
	});
	if (!postedHeaderLabel) return Result.err(new MissingHeaderError('Posted'));

	const descriptionHeaderLabel = postedHeaderLabel.findRight(/^\s*Description\s*$/);
	if (!descriptionHeaderLabel) return Result.err(new MissingHeaderError('Description'));

	const debitsHeaderLabel = descriptionHeaderLabel.findRight(/^\s*Debits\s*$/);
	if (!debitsHeaderLabel) return Result.err(new MissingHeaderError('Debits'));

	const creditsHeaderLabel = debitsHeaderLabel.findRight(/^\s*Credits\s*$/);
	if (!creditsHeaderLabel) return Result.err(new MissingHeaderError('Credits'));

	const balanceHeaderLabel = creditsHeaderLabel.findRight(/^\s*Balance\s*$/);
	if (!balanceHeaderLabel) return Result.err(new MissingHeaderError('Balance'));

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

export class ActivityEntry implements ImportedTransaction {
	pageNumber: number;
	date: DateTime<true>;
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
		this.pageNumber = pageNumber;
		this.date = date;
		this.type = type;
		this.description = description;
		this.debit = debit;
		this.credit = credit;
		this.balance = balance;
	}

	get amount(): number {
		return this.debit ? -this.debit : (this.credit ?? Number.NaN);
	}

	get statementDescription(): string {
		return this.description ? `${this.type} ${this.description}` : this.type;
	}
}
