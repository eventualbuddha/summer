import { tidyBankDescription } from './tidyBankDescription';

/**
 * Normalizes a bank transaction description for category matching.
 * Strips payment processor prefixes via tidyBankDescription, then further removes
 * store numbers, asterisk reference codes, embedded dates, and trailing digit tokens.
 */
export function normalizeForMatching(statementDescription: string): string {
	let text = tidyBankDescription(statementDescription).text;

	// Strip store numbers: #1234
	text = text.replace(/#\d+/g, '');

	// Strip asterisk reference codes: *ABCD1234 (4+ uppercase alphanumeric after *)
	text = text.replace(/\*[A-Z0-9]{4,}/g, '');

	// Strip embedded dates: 12/31
	text = text.replace(/\d{2}\/\d{2}/g, '');

	// Strip trailing digit-only tokens
	text = text.replace(/\s+\d+$/g, '');

	return text.toLowerCase().trim().replace(/\s+/g, ' ');
}
