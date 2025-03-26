<script lang="ts">
	import AccountDropdown from './AccountDropdown.svelte';
	import CategoryDropdown from './CategoryDropdown.svelte';
	import MonthDropdown from './MonthDropdown.svelte';
	import YearDropdown from './YearDropdown.svelte';

	let {
		yearSelections = $bindable(),
		monthSelections = $bindable(),
		categorySelections = $bindable(),
		accountSelections = $bindable(),
		searchTerm = $bindable()
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
	<YearDropdown aria-label="Year Filter" bind:selections={yearSelections} />
	<MonthDropdown aria-label="Month Filter" bind:selections={monthSelections} />
	<CategoryDropdown aria-label="Category Filter" bind:selections={categorySelections} />
	<AccountDropdown aria-label="Account Filter" bind:selections={accountSelections} />
	<input
		type="text"
		placeholder="Search"
		bind:value={editableSearchTerm}
		class="rounded-md border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-800"
	/>
</div>
