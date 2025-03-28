<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import CategoryPill from './CategoryPill.svelte';
	import Dropdown from './Dropdown.svelte';
	import TransactionDescription from './TransactionDescription.svelte';

	let {
		state: s,
		transaction,
		categories
	}: { state: State; transaction: Transaction; categories: Category[] } = $props();

	let isSelectingCategory = $state(false);

	async function setCategory(category: Category) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
	}
</script>

<div class="flex grow-0 flex-row items-center gap-2">
	<div class="text-xs text-gray-600">
		<div class="w-12 text-center">
			{transaction.date.toLocaleDateString(undefined, { month: 'short' })}
			{transaction.date.toLocaleDateString(undefined, { day: 'numeric' })}<br />
			{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
		</div>
	</div>
	<Dropdown bind:open={isSelectingCategory}>
		{#snippet root(contents)}
			<div class="relative">
				{@render contents()}
			</div>
		{/snippet}
		{#snippet trigger()}
			<CategoryPill category={transaction.category} style="short" />
		{/snippet}
		{#snippet portal()}
			<div
				class="absolute z-50 flex flex-col gap-0.5 rounded-md border border-gray-400 bg-gray-200 p-2 pr-1 pl-3 dark:border-gray-200 dark:bg-gray-800"
			>
				{#each categories as category, index (category.id)}
					<button
						tabindex={index}
						onclick={() => setCategory(category)}
						class="cursor-pointer rounded-md text-left hover:bg-gray-500 hover:text-gray-50"
					>
						<CategoryPill {category} style="full" />
					</button>
				{/each}
			</div>
		{/snippet}
	</Dropdown>
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		<TransactionDescription {transaction} />
	</div>
	<div>{formatTransactionAmount(transaction.amount)}</div>
</div>
