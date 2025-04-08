import { expect, test } from 'bun:test';
import { tidyBankDescription } from './tidyBankDescription';

test('tidyBankDescription', () => {
	expect(tidyBankDescription('')).toEqual({ text: '' });
	expect(tidyBankDescription('DOORDASH LITTLE STAR')).toEqual({
		text: 'LITTLE STAR',
		doordash: true
	});
	expect(tidyBankDescription('GITHUB SINDRESORHUS')).toEqual({
		text: 'GITHUB SINDRESORHUS',
		github: true
	});
	expect(tidyBankDescription('VENMO CORALINE JONES')).toEqual({
		text: 'VENMO CORALINE JONES',
		venmo: true
	});
	expect(tidyBankDescription('CASH APP CORALINE JONES')).toEqual({
		text: 'CORALINE JONES',
		cashApp: true
	});
	expect(tidyBankDescription('AMZN.COM DELIVERY')).toEqual({
		text: 'AMZN.COM DELIVERY',
		amazon: true
	});
});
