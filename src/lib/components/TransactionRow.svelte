<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { tidyBankDescription } from '$lib/utils/tidyBankDescription';
	import { getContext } from 'svelte';
	import CategorySelect from './CategorySelect.svelte';
	import TransactionDescription from './TransactionDescription.svelte';

	let s: State = getContext('state');
	let { transaction, categories }: { transaction: Transaction; categories: Category[] } = $props();

	let isEditingDescription = $state(false);
	let descriptionInput = $state<HTMLInputElement>();

	async function updateDescription(newDescription: string) {
		transaction.description = newDescription;
		await s.updateTransactionDescription(transaction.id, transaction.description);
	}

	$effect(() => {
		if (isEditingDescription) {
			descriptionInput?.focus();
			descriptionInput?.select();
		}
	});

	let isSelectingCategory = $state(false);

	async function setCategory(category: Category | undefined) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
	}
</script>

<div data-transaction class="flex grow-0 flex-row items-center gap-2">
	<div class="text-xs text-gray-600">
		<div class="w-12 text-center">
			{transaction.date.toLocaleDateString(undefined, { month: 'short' })}
			{transaction.date.toLocaleDateString(undefined, { day: 'numeric' })}<br />
			{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
		</div>
	</div>
	<CategorySelect
		bind:isOpen={isSelectingCategory}
		bind:value={
			() => categories.find((c) => c.id === transaction.categoryId),
			(newCategory) => setCategory(newCategory)
		}
		{categories}
	/>
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		{#if isEditingDescription}
			<input
				type="text"
				aria-label="Transaction description"
				bind:this={descriptionInput}
				class="w-full py-1 font-mono text-sm ring-0 focus:ring-0"
				value={transaction.description}
				placeholder={tidyBankDescription(transaction.statementDescription).text}
				onblur={async (e) => {
					await updateDescription(e.currentTarget.value);
					isEditingDescription = false;
				}}
				onkeydown={async (e) => {
					switch (e.key) {
						case 'Enter': {
							await updateDescription(e.currentTarget.value);
							isEditingDescription = false;
							break;
						}
						case 'Escape': {
							isEditingDescription = false;
							break;
						}
					}
				}}
			/>
		{:else}
			<TransactionDescription {transaction} onclick={() => (isEditingDescription = true)} />
		{/if}
	</div>
	<div>{formatTransactionAmount(transaction.amount)}</div>
</div>
