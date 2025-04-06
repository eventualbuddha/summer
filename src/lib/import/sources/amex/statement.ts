import { ParseMoneyError } from '$lib/import/parse/money';
import { StatementMetadata } from '$lib/import/StatementMetadata';
import { Result } from '@badrap/result';
import { DateTime } from 'luxon';
import type { ImportedTransaction } from '../../ImportedTransaction';
import { MissingHeaderError, ParseStatementSummaryError } from '../../parse/errors';
import type { Statement } from '../../statement/Statement';
import { Charge, parseNewCharges } from './charges';
import { Credit, parseCredits } from './credits';

export type ImportStatementError = ParseMoneyError | ParseStatementSummaryError;
export type ActivityEntry = Credit | Charge;

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
): Generator<Result<ImportedTransaction | StatementSummary, ImportStatementError>> {
	const paymentsAndCreditsSectionHeader = statement.navigator.find('Payments and Credits');
	const paymentsAndCreditsSectionSummaryLabel = paymentsAndCreditsSectionHeader?.findDown(
		'Summary',
		{
			alignment: 'left',
			maxGap: 30
		}
	);

	if (!paymentsAndCreditsSectionHeader) {
		return Result.err(new MissingHeaderError('Payments and Credits'));
	}
	if (!paymentsAndCreditsSectionSummaryLabel) {
		return Result.err(new MissingHeaderError('Payments and Credits: Summary'));
	}

	const paymentsAndCreditsDetailHeader = paymentsAndCreditsSectionSummaryLabel.findDown('Detail', {
		alignment: 'left'
	});

	if (!paymentsAndCreditsDetailHeader) {
		return Result.err(new MissingHeaderError('Payments and Credits: Detail'));
	}

	const newChargesSectionHeader = paymentsAndCreditsSectionHeader.findDown('New Charges', {
		alignment: 'left'
	});
	const newChargesSectionSummaryHeader = newChargesSectionHeader?.findDown('Summary', {
		alignment: 'left',
		maxGap: 30
	});

	if (!newChargesSectionHeader) {
		return Result.err(new MissingHeaderError('New Charges'));
	}
	if (!newChargesSectionSummaryHeader) {
		return Result.err(new MissingHeaderError('New Charges: Summary'));
	}

	const feesSectionHeader = newChargesSectionHeader.findDown('Fees', {
		alignment: 'left'
	});

	if (!feesSectionHeader) {
		return Result.err(new MissingHeaderError('New Charges: Fees'));
	}

	const interestChargedSectionHeader = feesSectionHeader.findDown('Interest Charged', {
		alignment: 'left'
	});

	if (!interestChargedSectionHeader) {
		return Result.err(new MissingHeaderError('New Charges: Interest Charged'));
	}

	const parseCreditsResult = parseCredits(paymentsAndCreditsSectionHeader, newChargesSectionHeader);

	if (parseCreditsResult.isErr) {
		return Result.err(parseCreditsResult.error);
	}

	yield* parseCreditsResult.value.map(Result.ok);

	const parseChargesResult = parseNewCharges(newChargesSectionHeader, feesSectionHeader);

	if (parseChargesResult.isErr) {
		return Result.err(parseChargesResult.error);
	}

	yield* parseChargesResult.value.map(Result.ok);
}
