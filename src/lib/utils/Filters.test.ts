import { describe, expect, it } from 'vitest';
import { Filters } from './Filters.svelte';

describe('Filters sticky transaction IDs', () => {
	it('clearStickyTransactionIds clears backing sticky IDs', () => {
		const filters = new Filters({ enableStickyResetEffect: false });
		filters.addStickyTransactionId('tx-1');
		filters.addStickyTransactionId('tx-2');

		expect([...filters.stickyTransactionIds]).toEqual(['tx-1', 'tx-2']);

		filters.clearStickyTransactionIds();

		expect([...filters.stickyTransactionIds]).toEqual([]);
	});
});
