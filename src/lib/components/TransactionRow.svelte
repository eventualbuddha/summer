<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { tidyBankDescription } from '$lib/utils/tidyBankDescription';
	import { getContext } from 'svelte';
	import CategorySelect from './CategorySelect.svelte';
	import TransactionDescription from './TransactionDescription.svelte';
	import ErrorAlert from './ErrorAlert.svelte';

	let s: State = getContext('state');
	let { transaction, categories }: { transaction: Transaction; categories: Category[] } = $props();

	let isEditingDescription = $state(false);
	let descriptionInput = $state<HTMLInputElement>();
	let editableDescription = $derived.by(() =>
		`${transaction.description ?? ''} ${transaction.tagged
			.map((tagged) => (tagged.year ? `#${tagged.tag.name}-${tagged.year}` : `#${tagged.tag.name}`))
			.join(' ')}`.trim()
	);
	let hasDescriptionText = $state(false);

	$effect(() => {
		if (isEditingDescription) {
			descriptionInput?.focus();
			descriptionInput?.select();
			hasDescriptionText = editableDescription.length > 0;
		}
	});

	let isSelectingCategory = $state(false);

	async function setCategory(category: Category | undefined) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
	}

	let error = $state<string>();
</script>

<div data-transaction class="flex grow-0 flex-row items-center gap-2">
	<div class="text-xs text-gray-600">
		<div class="w-12 text-center">
			{transaction.date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}<br />
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
				class="w-full py-1 {hasDescriptionText ? '' : 'font-mono'} text-sm ring-0 focus:ring-0"
				value={editableDescription}
				placeholder={tidyBankDescription(transaction.statementDescription).text}
				onblur={async (e) => {
					if (isEditingDescription) {
						isEditingDescription = false;
						const result = await s.updateTransactionDescription(transaction, e.currentTarget.value);
						error = result.isErr ? result.error.message : undefined;
					}
				}}
				oninput={(e) => {
					hasDescriptionText = e.currentTarget.value.length > 0;
				}}
				onkeydown={async (e) => {
					switch (e.key) {
						case 'Enter': {
							isEditingDescription = false;
							const result = await s.updateTransactionDescription(
								transaction,
								e.currentTarget.value
							);
							error = result.isErr ? result.error.message : undefined;
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

{#if error}
	<ErrorAlert title="Update Error" body={error} />
{/if}
