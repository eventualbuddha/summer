import { Result } from '@badrap/result';

export class ParseMoneyError extends Error {}

/**
 * Parses a money string into a number. Assumes USD.
 *
 * @param str The currency string to parse.
 * @returns The number of cents in the amount.
 */
export function parseAmount(str: string): Result<number, ParseMoneyError> {
	const match = str.match(/^\s*([-+])?\s*(\(\s*)?\$?([\d,]+)(?:\.(\d{2}))?(\s*\))?\s*$/);
	if (!match) {
		return Result.err(new ParseMoneyError(`Money does not match expected format: ${str}`));
	}

	const [, sign, openParen, dollars, cents, closeParen] = match as [
		string,
		string,
		string,
		string,
		string,
		string
	];
	if (!!openParen !== !!closeParen) {
		return Result.err(new ParseMoneyError(`Money has mismatched parentheses: ${str}`));
	}

	if (sign && openParen) {
		return Result.err(new ParseMoneyError(`Money cannot have both a sign and parentheses: ${str}`));
	}

	const isNegative = !!openParen || sign === '-';
	const dollarsAsNumber = parseInt(dollars.replaceAll(',', ''), 10);
	const centsAsNumber = cents ? parseInt(cents, 10) : 0;
	const amount = dollarsAsNumber * 100 + centsAsNumber;
	return Result.ok((isNegative ? -1 : 1) * amount);
}
