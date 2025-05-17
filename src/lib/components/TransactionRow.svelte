<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import CategoryPill from './CategoryPill.svelte';
	import Dropdown from './Dropdown.svelte';
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

	const NONE_CATEGORY: Category = {
		id: 'none',
		name: 'None',
		ordinal: categories.length,
		color: 'gray-300',
		emoji: '🚫'
	};
</script>

<div data-transaction class="flex grow-0 flex-row items-center gap-2">
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
			<CategoryPill
				category={categories.find((c) => c.id === transaction.categoryId) ?? NONE_CATEGORY}
				style="short"
			/>
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
				<button
					tabindex={categories.length}
					onclick={() => setCategory(undefined)}
					class="cursor-pointer rounded-md text-left hover:bg-gray-500 hover:text-gray-50"
				>
					<CategoryPill category={NONE_CATEGORY} style="full" />
				</button>
			</div>
		{/snippet}
	</Dropdown>
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		{#if isEditingDescription}
			<input
				type="text"
				aria-label="Transaction description"
				bind:this={descriptionInput}
				class="w-full py-1 font-mono text-sm ring-0 focus:ring-0"
				value={transaction.description}
				placeholder={transaction.statementDescription}
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
