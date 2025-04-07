import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import { ParseStatementError } from '$lib/import/parse/errors';
import { parseAmount } from '$lib/import/parse/money';
import type { StatementTextLocation } from '$lib/import/statement/navigation';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';

export class Credit implements ImportedTransaction {
	#pageNumber: number;
	date: DateTime<true>;
	card: string;
	descriptionLines: string[];
	amount: number;

	constructor(
		pageNumber: number,
		date: DateTime<true>,
		card: string,
		descriptionLines: string[],
		amount: number
	) {
		this.#pageNumber = pageNumber;
		this.date = date;
		this.card = card;
		this.descriptionLines = descriptionLines;
		this.amount = amount;
	}

	get pageNumber(): number {
		return this.#pageNumber;
	}

	get statementDescription(): string {
		return this.descriptionLines.join(' ');
	}
}

function parseCreditFromDate(
	dateValue: StatementTextLocation,
	endOfSection: StatementTextLocation
): Result<Credit, ParseStatementError> {
	const date = DateTime.fromFormat(dateValue.text.str.replace(/\*$/, ''), 'MM/dd/yy');

	if (!date.isValid) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Invalid date "${dateValue.text.str}": ${date.invalidExplanation}`,
				{
					pageNumber: dateValue.pageNumber,
					contentText: dateValue.text
				}
			)
		);
	}

	const cardValue = dateValue.findRight(/\w+/);

	if (!cardValue || cardValue.isBelow(endOfSection)) {
		return Result.err(
			ParseStatementError.MissingValue('Missing "card" value', {
				pageNumber: (cardValue ?? dateValue).pageNumber,
				contentText: cardValue?.text,
				searchFromText: dateValue.text,
				searchDirection: 'right'
			})
		);
	}

	const descriptionStart = cardValue.findRight(/\w+/);

	if (!descriptionStart || descriptionStart.isBelow(endOfSection)) {
		return Result.err(
			ParseStatementError.MissingValue('Missing "description" value', {
				pageNumber: (descriptionStart ?? cardValue).pageNumber,
				contentText: descriptionStart?.text,
				searchFromText: cardValue.text,
				searchDirection: 'right'
			})
		);
	}

	const descriptionLines = [descriptionStart];
	let lastDescriptionLine = descriptionStart;
	while (lastDescriptionLine.isAbove(endOfSection)) {
		const nextDescriptionLine = lastDescriptionLine.findDown(/\w+/, {
			alignment: 'left',
			maxGap: 10
		});
		if (!nextDescriptionLine) break;
		lastDescriptionLine = nextDescriptionLine;
		descriptionLines.push(lastDescriptionLine);
	}

	const amountValue = descriptionStart.findRight(/\d+\.\d{2}/);

	if (!amountValue || amountValue.isBelow(endOfSection)) {
		return Result.err(
			ParseStatementError.MissingValue('Missing "amount" value', {
				pageNumber: (amountValue ?? descriptionStart).pageNumber,
				contentText: amountValue?.text,
				searchFromText: descriptionStart.text,
				searchDirection: 'right'
			})
		);
	}

	const amount = parseAmount(amountValue.text.str);

	if (amount.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid amount "${amountValue.text.str}"`, {
				cause: amount.error,
				pageNumber: (amountValue ?? descriptionStart).pageNumber,
				contentText: amountValue.text,
				searchFromText: descriptionStart.text,
				searchDirection: 'right'
			})
		);
	}

	return Result.ok(
		new Credit(
			dateValue.pageNumber,
			date,
			cardValue.text.str,
			descriptionLines.map((line) => line.text.str),
			amount.value
		)
	);
}

function parseCreditsFromDateAlignedHeader(
	dateAlignedHeader: StatementTextLocation,
	endOfSection: StatementTextLocation
): Result<Credit[], ParseStatementError> {
	let lastDateAlignedLocation = dateAlignedHeader;
	const credits: Credit[] = [];

	while (true) {
		const dateValue = lastDateAlignedLocation.findDown(/^\d\d\/\d\d\/\d\d/, {
			alignment: 'left'
		});

		if (!dateValue || dateValue.isBelow(endOfSection)) {
			break;
		}

		const result = parseCreditFromDate(dateValue, endOfSection);

		if (result.isErr) {
			return Result.err(result.error);
		}

		credits.push(result.value);
		lastDateAlignedLocation = dateValue;
	}

	return Result.ok(credits);
}

export function parseCredits(
	sectionHeader: StatementTextLocation,
	nextSectionHeader: StatementTextLocation
): Result<Credit[], ParseStatementError> {
	const credits: Credit[] = [];

	const totalHeader = sectionHeader.findAfter('Total');

	if (!totalHeader || totalHeader.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total" label', {
				pageNumber: sectionHeader.pageNumber,
				contentText: totalHeader?.text,
				searchFromText: sectionHeader.text
			})
		);
	}

	const paymentsLabel = totalHeader.findAfter('Payments');

	if (!paymentsLabel || paymentsLabel.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Payments" label', {
				pageNumber: (paymentsLabel ?? totalHeader).pageNumber,
				contentText: paymentsLabel?.text,
				searchFromText: totalHeader.text
			})
		);
	}

	const paymentsValue = totalHeader.findDown(/\d+/, {
		alignment: 'right',
		maxGap: 20
	});

	if (!paymentsValue || paymentsValue.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Payments" label', {
				pageNumber: (paymentsValue ?? totalHeader).pageNumber,
				contentText: paymentsValue?.text,
				searchFromText: totalHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const paymentsAmount = parseAmount(paymentsValue.text.str);

	if (paymentsAmount.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(`Invalid amount: "${paymentsValue.text.str}"`, {
				cause: paymentsAmount.error,
				pageNumber: paymentsValue.pageNumber,
				contentText: paymentsValue.text,
				searchFromText: totalHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const totalPaymentsAndCreditsLabel = paymentsLabel.findDown('Total Payments and Credits', {
		alignment: 'left'
	});

	if (!totalPaymentsAndCreditsLabel || totalPaymentsAndCreditsLabel.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total Payments and Credits" label', {
				pageNumber: (totalPaymentsAndCreditsLabel ?? paymentsLabel).pageNumber,
				contentText: totalPaymentsAndCreditsLabel?.text,
				searchFromText: paymentsLabel.text,
				searchDirection: 'down'
			})
		);
	}

	const totalPaymentsAndCreditsValue = totalHeader.findDown(
		(text) => text.isHorizontallyAlignedWith(totalPaymentsAndCreditsLabel.text),
		{ alignment: 'right' }
	);

	if (!totalPaymentsAndCreditsValue || totalPaymentsAndCreditsValue.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total Payments and Credits" label', {
				pageNumber: (totalPaymentsAndCreditsValue ?? totalHeader).pageNumber,
				contentText: totalPaymentsAndCreditsValue?.text,
				searchFromText: totalHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const totalPaymentsAndCreditsAmount = parseAmount(totalPaymentsAndCreditsValue.text.str);

	if (totalPaymentsAndCreditsAmount.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Invalid amount: "${totalPaymentsAndCreditsValue.text.str}"`,
				{
					cause: totalPaymentsAndCreditsAmount.error,
					pageNumber: totalPaymentsAndCreditsValue.pageNumber,
					contentText: totalPaymentsAndCreditsValue.text,
					searchFromText: totalPaymentsAndCreditsLabel.text,
					searchDirection: 'down'
				}
			)
		);
	}

	const creditsAmount = totalPaymentsAndCreditsAmount.value - paymentsAmount.value;

	if (paymentsAmount.value !== 0) {
		const paymentsHeader = totalPaymentsAndCreditsLabel.findDown('Payments', {
			alignment: 'left'
		});

		if (!paymentsHeader || paymentsHeader.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingLabel('Missing "Payments and Credits: Payments" label', {
					pageNumber: (paymentsHeader ?? totalPaymentsAndCreditsLabel).pageNumber,
					contentText: paymentsHeader?.text,
					searchFromText: totalPaymentsAndCreditsLabel.text,
					searchDirection: 'down'
				})
			);
		}

		const creditsHeader = paymentsHeader.findDown('Credits', {
			alignment: 'left'
		});

		const endOfPayments = creditsAmount === 0 ? nextSectionHeader : creditsHeader;

		if (!endOfPayments || endOfPayments.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingLabel('Missing "Payments and Credits: Credits" label', {
					pageNumber: (endOfPayments ?? paymentsHeader).pageNumber,
					contentText: endOfPayments?.text,
					searchFromText: paymentsHeader.text,
					searchDirection: 'down'
				})
			);
		}

		const parsePaymentsResult = parseCreditsFromDateAlignedHeader(paymentsHeader, endOfPayments);

		if (parsePaymentsResult.isErr) {
			return Result.err(parsePaymentsResult.error);
		}

		credits.push(...parsePaymentsResult.value);
	}

	if (creditsAmount !== 0) {
		const creditsHeader = totalPaymentsAndCreditsLabel.findDown('Credits', {
			alignment: 'left'
		});

		if (!creditsHeader || creditsHeader.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingLabel('Missing "Payments and Credits: Credits" label', {
					pageNumber: (creditsHeader ?? totalPaymentsAndCreditsLabel).pageNumber,
					contentText: creditsHeader?.text,
					searchFromText: totalPaymentsAndCreditsLabel.text,
					searchDirection: 'down'
				})
			);
		}

		const parsePaymentsResult = parseCreditsFromDateAlignedHeader(creditsHeader, nextSectionHeader);

		if (parsePaymentsResult.isErr) {
			return Result.err(parsePaymentsResult.error);
		}

		credits.push(...parsePaymentsResult.value);
	}

	return Result.ok(credits);
}
