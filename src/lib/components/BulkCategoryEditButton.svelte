<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';
	import BulkCategoryConfirmationModal from './BulkCategoryConfirmationModal.svelte';
	import Button from './Button.svelte';
	import CategorySelect from './CategorySelect.svelte';

	let s: State = getContext('state');

	let {
		transactions,
		categories
	}: {
		transactions: readonly Transaction[];
		categories: readonly Category[];
	} = $props();

	let showConfirmationModal = $state(false);
	let selectedCategory = $state<Category | undefined>();

	function onCategorySelected(category: Category | undefined) {
		selectedCategory = category;
		showConfirmationModal = true;
	}

	function onConfirmUpdate() {
		if (selectedCategory !== undefined) {
			s.setBulkCategory(transactions, selectedCategory);
		}
		showConfirmationModal = false;
		selectedCategory = undefined;
	}

	function onCancelUpdate() {
		showConfirmationModal = false;
		selectedCategory = undefined;
	}

	const transactionCount = $derived(transactions.length);
</script>

<CategorySelect
	isOpen={false}
	bind:value={() => undefined, (newCategory) => onCategorySelected(newCategory)}
	{categories}
>
	{#snippet trigger(isOpen, setIsOpen)}
		<Button
			disabled={transactionCount === 0}
			aria-label="Edit category for all filtered transactions"
			onclick={() => setIsOpen(!isOpen)}
		>
			Edit Category
		</Button>
	{/snippet}
</CategorySelect>

{#if showConfirmationModal}
	<BulkCategoryConfirmationModal
		{transactions}
		targetCategory={selectedCategory}
		{categories}
		onConfirm={onConfirmUpdate}
		onCancel={onCancelUpdate}
	/>
{/if}
