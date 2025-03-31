import { expect, test } from 'vitest';
import { tidyBankDescription, type TransactionDescription } from './tidyBankDescription';

test('tidyBankDescription', () => {
	expect(tidyBankDescription('')).toEqual<TransactionDescription>({ text: '' });
	expect(tidyBankDescription('DOORDASH LITTLE STAR')).toEqual<TransactionDescription>({
		text: 'LITTLE STAR',
		doordash: true
	});
	expect(tidyBankDescription('GITHUB SINDRESORHUS')).toEqual<TransactionDescription>({
		text: 'GITHUB SINDRESORHUS',
		github: true
	});
	expect(tidyBankDescription('VENMO CORALINE JONES')).toEqual<TransactionDescription>({
		text: 'VENMO CORALINE JONES',
		venmo: true
	});
	expect(tidyBankDescription('CASH APP CORALINE JONES')).toEqual<TransactionDescription>({
		text: 'CORALINE JONES',
		cashApp: true
	});
	expect(tidyBankDescription('AMZN.COM DELIVERY')).toEqual<TransactionDescription>({
		text: 'AMZN.COM DELIVERY',
		amazon: true
	});
});
