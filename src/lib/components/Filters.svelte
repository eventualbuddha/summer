<script lang="ts">
	import type { Account, Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import AccountSelect from './AccountSelect.svelte';
	import CategorySelect from './CategorySelect.svelte';
	import MonthSelect from './MonthSelect.svelte';
	import YearSelect from './YearSelect.svelte';

	let {
		yearSelections = $bindable(),
		monthSelections = $bindable(),
		categorySelections = $bindable(),
		accountSelections = $bindable(),
		searchTerm = $bindable()
	}: {
		yearSelections: Selection<number>[];
		monthSelections: Selection<number>[];
		categorySelections: Selection<Category>[];
		accountSelections: Selection<Account>[];
		searchTerm: string;
	} = $props();

	let editableSearchTerm = $state(searchTerm);

	$effect(() => {
		let newSearchTerm = editableSearchTerm;
		let timeout = setTimeout(() => {
			searchTerm = newSearchTerm;
		}, 300);
		return () => clearTimeout(timeout);
	});
</script>

<div class="flex flex-row items-center gap-1">
	<span class="font-bold">Filters:</span>
	<YearSelect aria-label="Year Filter" bind:selections={yearSelections} />
	<MonthSelect aria-label="Month Filter" bind:selections={monthSelections} />
	<CategorySelect aria-label="Category Filter" bind:selections={categorySelections} />
	<AccountSelect aria-label="Account Filter" bind:selections={accountSelections} />
	<input
		type="text"
		placeholder="Search"
		bind:value={editableSearchTerm}
		class="rounded-md border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-800"
	/>
</div>
