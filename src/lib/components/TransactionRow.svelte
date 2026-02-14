<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import CategorySelect from './CategorySelect.svelte';
	import TransactionDescription from './TransactionDescription.svelte';
	import TransactionDetailModal from './TransactionDetailModal.svelte';

	let s: State = getContext('state');
	let { transaction, categories }: { transaction: Transaction; categories: Category[] } = $props();

	let isModalOpen = $state(false);
	let isSelectingCategory = $state(false);
	let rowElement = $state<HTMLDivElement>();

	async function setCategory(category: Category | undefined) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
	}

	function handleRowClick() {
		if (!isSelectingCategory) {
			isModalOpen = true;
		}
	}

	function handleModalClose() {
		isModalOpen = false;
		rowElement?.focus();
	}
</script>

<div
	bind:this={rowElement}
	data-transaction
	class="-mx-1 flex grow-0 cursor-pointer flex-row items-center gap-2 rounded-md px-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
	onclick={handleRowClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleRowClick();
		}
	}}
	role="button"
	tabindex="0"
>
	<div class="text-xs text-gray-600">
		<div class="w-12 text-center">
			{transaction.date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}<br />
			{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
		</div>
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div onclick={(e) => e.stopPropagation()}>
		<CategorySelect
			bind:isOpen={isSelectingCategory}
			bind:value={
				() => categories.find((c) => c.id === transaction.categoryId),
				(newCategory) => setCategory(newCategory)
			}
			{categories}
		/>
	</div>
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		<TransactionDescription {transaction} />
	</div>
	<div>{formatTransactionAmount(transaction.amount)}</div>
</div>

{#if isModalOpen}
	<TransactionDetailModal {transaction} {categories} onclose={handleModalClose} />
{/if}
