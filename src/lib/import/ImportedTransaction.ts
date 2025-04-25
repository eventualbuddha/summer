import { Point, Polygon } from '$lib/types';
import { DateTime } from 'luxon';
import type { PageText } from './statement/page';

export type ImportedTransactionKind =
	| 'Balance'
	| 'Charge'
	| 'Check'
	| 'Credit'
	| 'Deposit'
	| 'Interest'
	| 'Payment'
	| 'Transfer'
	| 'Unknown';
export const ImportedTransactionKind = {
	Balance: 'Balance',
	Charge: 'Charge',
	Credit: 'Credit',
	Check: 'Check',
	Deposit: 'Deposit',
	Interest: 'Interest',
	Transfer: 'Transfer',
	Payment: 'Payment',
	Unknown: 'Unknown'
} satisfies Record<ImportedTransactionKind, ImportedTransactionKind>;

/**
 * A transaction to import from a statement.
 */
export class ImportedTransaction {
	/** What kind of transaction is this? */
	readonly kind: ImportedTransactionKind;

	/** Statement date for the transaction. */
	readonly date: DateTime;

	/** Amount of the transaction in cents. */
	readonly amount: number;

	/** Statement description for the transaction. */
	readonly statementDescription: string;

	/** Bounding box where this transaction was found on the statement. */
	readonly bounds: Polygon;

	/** Page number this transaction was found on. */
	readonly pageNumber: number;

	constructor(
		kind: ImportedTransactionKind,
		date: DateTime,
		amount: number,
		statementDescription: string,
		pageNumber: number,
		bounds: Polygon
	) {
		this.kind = kind;
		this.date = date;
		this.amount = amount;
		this.statementDescription = statementDescription;
		this.pageNumber = pageNumber;
		this.bounds = bounds;
	}

	static boundsForTexts(...texts: [PageText, ...(PageText | undefined)[]]): Polygon {
		const [first, ...rest] = texts;
		let minX = first.left;
		let minY = first.bottom;
		let maxX = first.right;
		let maxY = first.top;

		for (const text of rest) {
			if (!text) continue;
			minX = Math.min(minX, text.left);
			minY = Math.min(minY, text.bottom);
			maxX = Math.max(maxX, text.right);
			maxY = Math.max(maxY, text.top);
		}

		const bottomLeft = new Point(minX, minY);
		const bottomRight = new Point(maxX, minY);
		const topRight = new Point(maxX, maxY);
		const topLeft = new Point(minX, maxY);
		return new Polygon([bottomLeft, bottomRight, topRight, topLeft, bottomLeft]);
	}
}
