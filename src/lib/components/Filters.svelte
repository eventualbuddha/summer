<script>
	import AccountDropdown from './AccountDropdown.svelte';
	import CategoryDropdown from './CategoryDropdown.svelte';
	import MonthDropdown from './MonthDropdown.svelte';
	import YearDropdown from './YearDropdown.svelte';

	let {
		yearSelections = $bindable(),
		monthSelections = $bindable(),
		categorySelections = $bindable(),
		accountSelections = $bindable()
	} = $props();
</script>

<div class="flex flex-row items-center gap-1">
	<span class="font-bold">Filters:</span>
	<YearDropdown aria-label="Year Filter" bind:selections={yearSelections} />
	<MonthDropdown aria-label="Month Filter" bind:selections={monthSelections} />
	<CategoryDropdown aria-label="Category Filter" bind:selections={categorySelections} />
	<AccountDropdown aria-label="Account Filter" bind:selections={accountSelections} />
</div>
