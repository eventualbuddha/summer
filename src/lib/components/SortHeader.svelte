<script lang="ts">
	import type { Sorting } from '$lib/state.svelte';
	import IconSortAlphabeticalAscending from '~icons/mdi/sort-alphabetical-ascending';
	import IconSortAlphabeticalDescending from '~icons/mdi/sort-alphabetical-descending';
	import IconSortNumericAscending from '~icons/mdi/sort-numeric-ascending';
	import IconSortNumericDescending from '~icons/mdi/sort-numeric-descending';

	let { sort }: { sort: Sorting } = $props();
	let dateSort = sort.fieldSort('date');
	let descriptionSort = sort.fieldSort('statementDescription');
	let amountSort = sort.fieldSort('amount');
</script>

<div class="flex w-full flex-row text-sm font-bold">
	<button
		class="text-align-left flex w-24 cursor-pointer items-center pl-1"
		onclick={() => sort.sortBy('date')}
	>
		Date
		{#if dateSort === 'asc'}
			<IconSortNumericAscending />
		{:else if dateSort === 'desc'}
			<IconSortNumericDescending />
		{/if}
	</button>
	<button
		class="text-align-left flex grow-1 cursor-pointer items-center"
		onclick={() => sort.sortBy('statementDescription')}
	>
		Description
		{#if descriptionSort === 'asc'}
			<IconSortAlphabeticalAscending />
		{:else if descriptionSort === 'desc'}
			<IconSortAlphabeticalDescending />
		{/if}
	</button>
	<button class="flex cursor-pointer items-center" onclick={() => sort.sortBy('amount')}>
		{#if amountSort === 'asc'}
			<IconSortNumericAscending />
		{:else if amountSort === 'desc'}
			<IconSortNumericDescending />
		{/if}
		Amount
	</button>
</div>
