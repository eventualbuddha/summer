<script lang="ts">
	import type { Account, Category, Tag } from '$lib/db';
	import type { Selection } from '$lib/types';
	import AccountMultiSelect from './AccountMultiSelect.svelte';
	import CategoryMultiSelect from './CategoryMultiSelect.svelte';
	import MonthMultiSelect from './MonthMultiSelect.svelte';
	import SearchInput from './SearchInput.svelte';
	import YearMultiSelect from './YearMultiSelect.svelte';
	import { onMount } from 'svelte';

	let {
		yearSelections = $bindable(),
		monthSelections = $bindable(),
		categorySelections = $bindable(),
		accountSelections = $bindable(),
		searchText = $bindable(),
		searchTags = $bindable(),
		availableTags,
		onclear,
		onbulkedit,
		bulkEditDisabled = false
	}: {
		yearSelections: Selection<number>[];
		monthSelections: Selection<number>[];
		categorySelections: Selection<Category>[];
		accountSelections: Selection<Account>[];
		searchText: string;
		searchTags: string[];
		availableTags: Tag[];
		onclear?: () => void;
		onbulkedit?: () => void;
		bulkEditDisabled?: boolean;
	} = $props();

	let searchInput: SearchInput;

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.key === '/' &&
			!(event.target instanceof HTMLInputElement) &&
			!(event.target instanceof HTMLTextAreaElement)
		) {
			event.preventDefault();
			searchInput?.focus();
			searchInput?.select();
		}
	}

	function handleClear() {
		onclear?.();
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-row items-center gap-1">
		<YearMultiSelect aria-label="Year Filter" bind:selections={yearSelections} />
		<MonthMultiSelect aria-label="Month Filter" bind:selections={monthSelections} />
		<CategoryMultiSelect aria-label="Category Filter" bind:selections={categorySelections} />
		<AccountMultiSelect aria-label="Account Filter" bind:selections={accountSelections} />
		<SearchInput bind:this={searchInput} bind:searchText bind:searchTags {availableTags} />
		{#if onclear}
			<button
				type="button"
				onclick={handleClear}
				class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
				aria-label="Clear all filters"
			>
				Clear
			</button>
		{/if}
		{#if onbulkedit}
			<span class="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></span>
			<button
				type="button"
				onclick={onbulkedit}
				disabled={bulkEditDisabled}
				class="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
				aria-label="Bulk edit filtered transactions"
			>
				Bulk Edit
			</button>
		{/if}
	</div>
</div>
