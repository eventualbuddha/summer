<script lang="ts">
	import type { Account, Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import AccountSelect from './AccountSelect.svelte';
	import CategorySelect from './CategorySelect.svelte';
	import MonthSelect from './MonthSelect.svelte';
	import YearSelect from './YearSelect.svelte';

	let {
		yearSelections,
		monthSelections,
		categorySelections,
		accountSelections,
		searchTerm,
		selectYears,
		selectMonths,
		selectCategories,
		selectAccounts,
		updateSearchTerm
	}: {
		yearSelections: Selection<number>[];
		monthSelections: Selection<number>[];
		categorySelections: Selection<Category>[];
		accountSelections: Selection<Account>[];
		searchTerm: string;
		selectYears: (keys: readonly string[]) => void;
		selectMonths: (keys: readonly string[]) => void;
		selectCategories: (keys: readonly string[]) => void;
		selectAccounts: (keys: readonly string[]) => void;
		updateSearchTerm: (searchTerm: string) => void;
	} = $props();

	let editableSearchTerm = $state(searchTerm);

	$effect(() => {
		let newSearchTerm = editableSearchTerm;
		let timeout = setTimeout(() => {
			updateSearchTerm(newSearchTerm);
		}, 300);
		return () => clearTimeout(timeout);
	});
</script>

<div class="flex flex-row items-center gap-1">
	<span class="font-bold">Filters:</span>
	<YearSelect aria-label="Year Filter" selections={yearSelections} selectItems={selectYears} />
	<MonthSelect aria-label="Month Filter" selections={monthSelections} selectItems={selectMonths} />
	<CategorySelect
		aria-label="Category Filter"
		selections={categorySelections}
		selectItems={selectCategories}
	/>
	<AccountSelect
		aria-label="Account Filter"
		selections={accountSelections}
		selectItems={selectAccounts}
	/>
	<input
		type="text"
		placeholder="Search"
		bind:value={editableSearchTerm}
		class="rounded-md border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-800"
	/>
</div>
