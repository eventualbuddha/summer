import { StatementMetadata } from '$lib/import/StatementMetadata';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';
import type { ImportedTransaction } from '../../ImportedTransaction';
import { ParseStatementError } from '../../parse/errors';
import type { Statement } from '../../statement/Statement';
import { parseNewCharges } from './charges';
import { parseCredits } from './credits';

export class StatementSummary extends StatementMetadata {
	accountHolder: string;
	previousBalance: number;
	paymentsAndCredits: number;
	newCharges: number;
	fees: number;
	interestCharged: number;
	newBalance: number;
	minimumPaymentDue: number;
	creditLimit: number;
	availableCredit: number;
	cashAdvanceLimit: number;
	availableCash: number;

	constructor(
		closingDate: DateTime,
		account: string,
		accountHolder: string,
		previousBalance: number,
		paymentsAndCredits: number,
		newCharges: number,
		fees: number,
		interestCharged: number,
		newBalance: number,
		minimumPaymentDue: number,
		creditLimit: number,
		availableCredit: number,
		cashAdvanceLimit: number,
		availableCash: number
	) {
		super(closingDate, account);
		this.accountHolder = accountHolder;
		this.previousBalance = previousBalance;
		this.paymentsAndCredits = paymentsAndCredits;
		this.newCharges = newCharges;
		this.fees = fees;
		this.interestCharged = interestCharged;
		this.newBalance = newBalance;
		this.minimumPaymentDue = minimumPaymentDue;
		this.creditLimit = creditLimit;
		this.availableCredit = availableCredit;
		this.cashAdvanceLimit = cashAdvanceLimit;
		this.availableCash = availableCash;
	}
}

export function* parseStatement(
	statement: Statement
): Generator<Result<ImportedTransaction | StatementSummary, ParseStatementError>> {
	const paymentsAndCreditsSectionHeader = statement.navigator.find('Payments and Credits');

	if (!paymentsAndCreditsSectionHeader) {
		return Result.err(ParseStatementError.MissingLabel('Payments and Credits'));
	}

	const paymentsAndCreditsSectionSummaryLabel = paymentsAndCreditsSectionHeader.findDown(
		'Summary',
		{
			alignment: 'left',
			maxGap: 30
		}
	);

	if (!paymentsAndCreditsSectionSummaryLabel) {
		return Result.err(
			ParseStatementError.MissingLabel('Payments and Credits: Summary', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const paymentsAndCreditsDetailHeader = paymentsAndCreditsSectionSummaryLabel.findDown('Detail', {
		alignment: 'left'
	});

	if (!paymentsAndCreditsDetailHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('Payments and Credits: Detail', {
				pageNumber: paymentsAndCreditsSectionSummaryLabel.pageNumber,
				searchFromText: paymentsAndCreditsSectionSummaryLabel.text,
				searchDirection: 'down'
			})
		);
	}

	const newChargesSectionHeader = paymentsAndCreditsSectionHeader.findDown('New Charges', {
		alignment: 'left'
	});
	const newChargesSectionSummaryHeader = newChargesSectionHeader?.findDown('Summary', {
		alignment: 'left',
		maxGap: 30
	});

	if (!newChargesSectionHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('New Charges', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
	}
	if (!newChargesSectionSummaryHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('New Charges: Summary', {
				pageNumber: paymentsAndCreditsSectionHeader.pageNumber,
				searchFromText: paymentsAndCreditsSectionHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const feesSectionHeader = newChargesSectionHeader.findDown('Fees', {
		alignment: 'left'
	});

	if (!feesSectionHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('New Charges: Fees', {
				pageNumber: newChargesSectionHeader.pageNumber,
				searchFromText: newChargesSectionHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const interestChargedSectionHeader = feesSectionHeader.findDown('Interest Charged', {
		alignment: 'left'
	});

	if (!interestChargedSectionHeader) {
		return Result.err(
			ParseStatementError.MissingLabel('New Charges: Interest Charged', {
				pageNumber: feesSectionHeader.pageNumber,
				searchFromText: feesSectionHeader.text,
				searchDirection: 'down'
			})
		);
	}

	const parseCreditsResult = parseCredits(paymentsAndCreditsSectionHeader, newChargesSectionHeader);

	if (parseCreditsResult.isErr) {
		return Result.err(parseCreditsResult.error);
	}

	for (const credit of parseCreditsResult.value) {
		yield Result.ok(credit);
	}

	const parseChargesResult = parseNewCharges(newChargesSectionHeader, feesSectionHeader);

	if (parseChargesResult.isErr) {
		return Result.err(parseChargesResult.error);
	}

	for (const charge of parseChargesResult.value) {
		yield Result.ok(charge);
	}
}
