import { ImportedTransaction, ImportedTransactionKind } from '$lib/import/ImportedTransaction';
import { ParseStatementError } from '$lib/import/parse/errors';
import { parseAmount } from '$lib/import/parse/money';
import type { StatementTextLocation } from '$lib/import/statement/navigation';
import { formatTransactionAmount } from '$lib/utils/formatting';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';

export class Charge extends ImportedTransaction {
	/** Absolute value of the charged amount. */
	readonly chargeAmount: number;

	/** Lines of text describing the credit in the statement. */
	readonly descriptionLines: string[];

	/** The location associated with the charge, typically a city/website/phone number. */
	readonly location: string;

	/** The state where the merchant of record is registered. */
	readonly state: string;

	constructor(
		pageNumber: number,
		date: DateTime<true>,
		descriptionLines: string[],
		location: string,
		state: string,
		chargeAmount: number
	) {
		if (chargeAmount < 0) {
			throw new Error(
				'Charge amounts must be represented as a positive value. Maybe you want `Credit`?'
			);
		}

		super(
			ImportedTransactionKind.Charge,
			date,
			-chargeAmount,
			descriptionLines.join('\n'),
			pageNumber
		);
		this.chargeAmount = chargeAmount;
		this.descriptionLines = descriptionLines;
		this.location = location;
		this.state = state;
	}
}

export function parseNewCharges(
	sectionHeader: StatementTextLocation,
	nextSectionHeader: StatementTextLocation
): Result<Charge[], ParseStatementError> {
	const charges: Charge[] = [];

	const totalNewChargesLabel = sectionHeader.findAfter(/Total\s+New\s+Charges/);

	if (!totalNewChargesLabel || totalNewChargesLabel.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Total New Charges" label', {
				pageNumber: (totalNewChargesLabel ?? sectionHeader).pageNumber,
				contentText: totalNewChargesLabel?.text,
				searchFromText: sectionHeader.text
			})
		);
	}

	const totalNewChargesValue = totalNewChargesLabel.findRight(/\d+/);

	if (!totalNewChargesValue || totalNewChargesValue.isBelow(nextSectionHeader)) {
		return Result.err(
			ParseStatementError.MissingValue('Missing "Total New Charges" value', {
				pageNumber: (totalNewChargesValue ?? totalNewChargesLabel).pageNumber,
				contentText: totalNewChargesValue?.text,
				searchFromText: totalNewChargesLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalNewChargesAmount = parseAmount(totalNewChargesValue.text.str);

	if (totalNewChargesAmount.isErr) {
		return Result.err(
			ParseStatementError.InvalidValue('Invalid "Total New Charges" amount', {
				cause: totalNewChargesAmount.error,
				pageNumber: (totalNewChargesValue ?? totalNewChargesLabel).pageNumber,
				contentText: totalNewChargesValue?.text,
				searchFromText: totalNewChargesLabel.text,
				searchDirection: 'right'
			})
		);
	}

	if (totalNewChargesAmount.value < 0) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Expected "Total New Charges" to be positive, but got ${formatTransactionAmount(totalNewChargesAmount.value)}`,
				{
					pageNumber: totalNewChargesValue.pageNumber,
					contentText: totalNewChargesValue.text,
					searchFromText: totalNewChargesLabel.text,
					searchDirection: 'right'
				}
			)
		);
	}

	const totalNewCharges = -totalNewChargesAmount.value;

	const firstAmountHeader = totalNewChargesValue.findDown('Amount', {
		alignment: 'right'
	});

	if (!firstAmountHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('Missing "Amount" header', {
				pageNumber: totalNewChargesValue.pageNumber,
				searchFromText: totalNewChargesValue.text,
				searchDirection: 'down'
			})
		);
	}

	let lastAmountValue = firstAmountHeader;
	while (lastAmountValue.isAbove(nextSectionHeader)) {
		const amountValue = lastAmountValue.findDown(/\d+/, { alignment: 'right' });

		if (!amountValue || amountValue.isBelow(nextSectionHeader)) {
			break;
		}

		if (!amountValue) {
			return Result.err(
				ParseStatementError.MissingValue('Missing "Amount" value', {
					searchFromText: lastAmountValue.text,
					searchDirection: 'down'
				})
			);
		}

		const parsedAmount = parseAmount(amountValue.text.str);

		if (parsedAmount.isErr) {
			return Result.err(
				ParseStatementError.InvalidValue('Invalid charge amount', {
					cause: parsedAmount.error,
					pageNumber: (amountValue ?? lastAmountValue).pageNumber,
					contentText: amountValue.text,
					searchFromText: lastAmountValue.text,
					searchDirection: 'down'
				})
			);
		}

		const stateValue = amountValue.findLeft(/\w+/);

		if (!stateValue || stateValue.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingValue('Missing "State" value', {
					pageNumber: (stateValue ?? amountValue).pageNumber,
					contentText: stateValue?.text,
					searchFromText: amountValue.text,
					searchDirection: 'left'
				})
			);
		}

		const locationValue = stateValue.findLeft(/.{4,}/);

		if (!locationValue || locationValue.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingValue('Missing "Location" value', {
					pageNumber: (locationValue ?? stateValue).pageNumber,
					contentText: locationValue?.text,
					searchFromText: stateValue.text,
					searchDirection: 'left'
				})
			);
		}

		const descriptionValue = locationValue.findLeft(/.{4,}/);

		if (!descriptionValue || descriptionValue.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingValue('Missing "Description" value', {
					pageNumber: (descriptionValue ?? locationValue).pageNumber,
					contentText: descriptionValue?.text,
					searchFromText: locationValue.text,
					searchDirection: 'left'
				})
			);
		}

		const dateValue = descriptionValue.findLeft(/^\d\d\/\d\d\/\d\d/);

		if (!dateValue || dateValue.isBelow(nextSectionHeader)) {
			return Result.err(
				ParseStatementError.MissingValue('Missing "Date" value', {
					pageNumber: (dateValue ?? descriptionValue).pageNumber,
					contentText: dateValue?.text,
					searchFromText: descriptionValue.text,
					searchDirection: 'left'
				})
			);
		}

		const date = DateTime.fromFormat(dateValue.text.str, 'MM/dd/yy');

		if (!date.isValid) {
			return Result.err(
				ParseStatementError.InvalidValue(
					`Invalid date "${dateValue.text.str}": ${date.invalidExplanation}`,
					{
						pageNumber: (dateValue ?? descriptionValue).pageNumber,
						contentText: dateValue.text,
						searchFromText: descriptionValue.text,
						searchDirection: 'left'
					}
				)
			);
		}

		charges.push(
			new Charge(
				dateValue.pageNumber,
				date,
				[descriptionValue.text.str],
				locationValue.text.str,
				stateValue.text.str,
				parsedAmount.value
			)
		);

		lastAmountValue = amountValue;
	}

	const computedTotalChargesAmount = charges.reduce((sum, { amount }) => sum + amount, 0);

	if (computedTotalChargesAmount !== totalNewCharges) {
		return Result.err(
			ParseStatementError.InvalidValue(
				`Computed "Total New Charges" does not match statement summary (expected ${formatTransactionAmount(totalNewCharges)} but got ${formatTransactionAmount(computedTotalChargesAmount)})`,
				{
					pageNumber: totalNewChargesValue.pageNumber,
					contentText: totalNewChargesValue.text
				}
			)
		);
	}

	return Result.ok(charges);
}
