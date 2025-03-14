export interface TransactionDescription {
	text: string;
	doordash?: boolean;
	github?: boolean;
	venmo?: boolean;
	cashApp?: boolean;
	amazon?: boolean;
}

/**
 * Cleans up a bank transaction description by removing unnecessary prefixes and
 * formatting. Recognizes common vendors and flags them, e.g. Amazon and
 * DoorDash.
 */
export function tidyBankDescription(originalDescription: string): TransactionDescription {
	const result: TransactionDescription = { text: originalDescription };

	for (;;) {
		const match = result.text.match(
			/^\s*(?:AplPay|SQ|DD|TST|EB|BLS|BLT|PAR|CNP|TOTEM|PROPAY|ACT|SP|PP|PAYPAL|IN|PB|BT|PAY|LGC|CKE|FH|\*)?(?:\b|\s)\s*([\s\S]*)$/i
		);
		if (!match || match[1] === result.text) {
			break;
		}
		result.text = match?.[1]?.trim() ?? result.text;
	}

	const doordashMatch = result.text.match(/^DOORDASH(?:\s*\*)?\s*([\s\S]*)$/);
	if (doordashMatch?.[1]) {
		result.doordash = true;
		result.text = doordashMatch[1];
	}

	const githubMatch = result.text.match(/^GITHUB\s*([\s\S]*)$/);
	if (githubMatch) {
		result.github = true;
	}

	const venmoMatch = result.text.match(/^VENMO\s*([\s\S]*)$/);
	if (venmoMatch) {
		result.venmo = true;
	}

	const cashAppMatch = result.text.match(/^(?:.+\n)?CASH\s*APP\s*(?:\*)?([\s\S]*)$/);
	if (cashAppMatch?.[1]) {
		result.cashApp = true;
		result.text = cashAppMatch[1];
	}

	const amazonMatch = result.text.match(
		/(?:amazon\.com|amzn\.com|zappos\.com|amazon prime|kindle svcs|prime video)\b/i
	);
	if (amazonMatch) {
		result.amazon = true;
	}

	return result;
}
