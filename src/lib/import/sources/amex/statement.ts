import { Result } from '@badrap/result';
import type { ImportedTransaction } from '../../ImportedTransaction';
import { ParseStatementError } from '../../parse/errors';
import type { Statement } from '../../statement/Statement';
import { parseNewCharges } from './charges';
import { parseCredits } from './credits';
import type { StatementSummary } from './summary';

export function* parseStatement(
	statement: Statement
): Generator<Result<ImportedTransaction | StatementSummary, ParseStatementError>> {
	const paymentsAndCreditsSectionHeader = statement.navigator.find('Payments and Credits');

	if (!paymentsAndCreditsSectionHeader) {
		yield Result.err(ParseStatementError.MissingLabel('Payments and Credits'));
		return;
	}

	const paymentsAndCreditsSectionSummaryLabel = paymentsAndCreditsSectionHeader.findDown(
		'Summary',
		{
			alignment: 'left',
			maxGap: 30
		}
	);

	if (!paymentsAndCreditsSectionSummaryLabel) {
		yield Result.err(
			ParseStatementError.MissingLabel('Payments and Credits: Summary', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const paymentsAndCreditsDetailHeader = paymentsAndCreditsSectionSummaryLabel.findDown('Detail', {
		alignment: 'left'
	});

	if (!paymentsAndCreditsDetailHeader) {
		yield Result.err(
			ParseStatementError.MissingLabel('Payments and Credits: Detail', {
				pageNumber: paymentsAndCreditsSectionSummaryLabel.pageNumber,
				searchFromText: paymentsAndCreditsSectionSummaryLabel.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const newChargesSectionHeader = paymentsAndCreditsSectionHeader.findDown('New Charges', {
		alignment: 'left'
	});
	const newChargesSectionSummaryHeader = newChargesSectionHeader?.findDown('Summary', {
		alignment: 'left',
		maxGap: 30
	});

	if (!newChargesSectionHeader) {
		yield Result.err(
			ParseStatementError.MissingLabel('New Charges', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
		return;
	}
	if (!newChargesSectionSummaryHeader) {
		yield Result.err(
			ParseStatementError.MissingLabel('New Charges: Summary', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const feesSectionHeader = newChargesSectionHeader.findDown('Fees', {
		alignment: 'left'
	});

	if (!feesSectionHeader) {
		yield Result.err(
			ParseStatementError.MissingLabel('New Charges: Fees', {
				pageNumber: newChargesSectionHeader.pageNumber,
				searchFromText: newChargesSectionHeader.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const interestChargedSectionHeader = feesSectionHeader.findDown('Interest Charged', {
		alignment: 'left'
	});

	if (!interestChargedSectionHeader) {
		yield Result.err(
			ParseStatementError.MissingLabel('New Charges: Interest Charged', {
				pageNumber: feesSectionHeader.pageNumber,
				searchFromText: feesSectionHeader.text,
				searchDirection: 'down'
			})
		);
		return;
	}

	const parseCreditsResult = parseCredits(paymentsAndCreditsSectionHeader, newChargesSectionHeader);

	if (parseCreditsResult.isErr) {
		yield Result.err(parseCreditsResult.error);
		return;
	}

	for (const credit of parseCreditsResult.value) {
		yield Result.ok(credit);
	}

	const parseChargesResult = parseNewCharges(newChargesSectionHeader, feesSectionHeader);

	if (parseChargesResult.isErr) {
		yield Result.err(parseChargesResult.error);
		return;
	}

	for (const charge of parseChargesResult.value) {
		yield Result.ok(charge);
	}
}
