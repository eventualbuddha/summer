<script lang="ts">
	import type { Transaction } from '$lib/db';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import CategoryPill from './CategoryPill.svelte';
	import TransactionDescription from './TransactionDescription.svelte';

	let { transaction }: { transaction: Transaction } = $props();
</script>

<div class="flex grow-0 flex-row items-center gap-2">
	<div class="text-xs text-gray-600">
		<div class="w-12 text-center">
			{transaction.date.toLocaleDateString(undefined, { month: 'short' })}
			{transaction.date.toLocaleDateString(undefined, { day: 'numeric' })}<br />
			{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
		</div>
	</div>
	<CategoryPill category={transaction.category} style="short" />
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		<TransactionDescription {transaction} />
	</div>
	<div>{formatTransactionAmount(transaction.amount)}</div>
</div>
