import type { ImportedTransaction } from '$lib/import/ImportedTransaction';
import {
	InconsistentValueError,
	MissingHeaderError,
	MissingValueError
} from '$lib/import/parse/errors';
import { parseAmount } from '$lib/import/parse/money';
import type { StatementTextLocation } from '$lib/import/statement/navigation';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';
import { ParseActivityEntriesError } from './errors';

export class Charge implements ImportedTransaction {
	pageNumber: number;
	date: DateTime<true>;
	descriptionLines: string[];
	location: string;
	state: string;
	amount: number;

	constructor(
		pageNumber: number,
		date: DateTime<true>,
		descriptionLines: string[],
		location: string,
		state: string,
		amount: number
	) {
		this.pageNumber = pageNumber;
		this.date = date;
		this.descriptionLines = descriptionLines;
		this.location = location;
		this.state = state;
		this.amount = amount;
	}

	get statementDescription(): string {
		return this.descriptionLines.join('\n');
	}
}

export function parseNewCharges(
	sectionHeader: StatementTextLocation,
	nextSectionHeader: StatementTextLocation
): Result<Charge[], ParseActivityEntriesError> {
	const charges: Charge[] = [];

	const totalNewChargesLabel = sectionHeader.findAfter(/Total\s+New\s+Charges/);

	if (!totalNewChargesLabel || totalNewChargesLabel.isBelow(nextSectionHeader)) {
		return Result.err(
			new ParseActivityEntriesError(new MissingHeaderError('Total New Charges'), {
				pageNumber: (totalNewChargesLabel ?? sectionHeader).pageNumber,
				contentText: totalNewChargesLabel?.text,
				searchFromText: sectionHeader.text
			})
		);
	}

	const totalNewChargesValue = totalNewChargesLabel.findRight(/\d+/);

	if (!totalNewChargesValue || totalNewChargesValue.isBelow(nextSectionHeader)) {
		return Result.err(
			new ParseActivityEntriesError(new MissingValueError('Total New Charges'), {
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
			new ParseActivityEntriesError(totalNewChargesAmount.error, {
				pageNumber: (totalNewChargesValue ?? totalNewChargesLabel).pageNumber,
				contentText: totalNewChargesValue?.text,
				searchFromText: totalNewChargesLabel.text,
				searchDirection: 'right'
			})
		);
	}

	const totalNewCharges = totalNewChargesAmount.value;

	let lastAmountHeader = totalNewChargesValue;
	while (lastAmountHeader.isAbove(nextSectionHeader)) {
		const nextAmountHeader = lastAmountHeader.findDown('Amount', {
			alignment: 'right'
		});

		if (!nextAmountHeader) {
			break;
		}

		lastAmountHeader = nextAmountHeader;

		let lastAmountValue = lastAmountHeader;
		while (lastAmountValue.isAbove(nextSectionHeader)) {
			const amountValue = lastAmountValue.findDown(/\d+/, { alignment: 'right' });

			if (amountValue?.isBelow(nextSectionHeader)) {
				lastAmountValue = amountValue;
				break;
			}

			if (!amountValue) {
				return Result.err(
					new ParseActivityEntriesError(new MissingValueError('Amount'), {
						pageNumber: (amountValue ?? lastAmountValue).pageNumber,
						searchFromText: lastAmountValue.text,
						searchDirection: 'down'
					})
				);
			}

			const parsedAmount = parseAmount(amountValue.text.str);

			if (parsedAmount.isErr) {
				return Result.err(
					new ParseActivityEntriesError(parsedAmount.error, {
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
					new ParseActivityEntriesError(new MissingValueError('State'), {
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
					new ParseActivityEntriesError(new MissingValueError('Location'), {
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
					new ParseActivityEntriesError(new MissingValueError('Description'), {
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
					new ParseActivityEntriesError(new MissingValueError('Date'), {
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
					new ParseActivityEntriesError(new MissingValueError('Date'), {
						pageNumber: (dateValue ?? descriptionValue).pageNumber,
						contentText: dateValue.text,
						searchFromText: descriptionValue.text,
						searchDirection: 'left'
					})
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

		lastAmountHeader = nextAmountHeader;
	}

	const computedTotalChargesAmount = charges.reduce((sum, { amount }) => sum + amount, 0);

	if (computedTotalChargesAmount !== totalNewCharges) {
		return Result.err(
			new ParseActivityEntriesError(
				new InconsistentValueError('Total New Charges', totalNewCharges, computedTotalChargesAmount)
			)
		);
	}

	return Result.ok(charges);
}
