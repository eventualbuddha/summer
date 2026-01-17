<script lang="ts">
	import type { Sorting, SortingField, FieldSortInfo } from '$lib/state.svelte';
	import IconSortAlphabeticalAscending from '~icons/mdi/sort-alphabetical-ascending';
	import IconSortAlphabeticalDescending from '~icons/mdi/sort-alphabetical-descending';
	import IconSortNumericAscending from '~icons/mdi/sort-numeric-ascending';
	import IconSortNumericDescending from '~icons/mdi/sort-numeric-descending';

	let { sort }: { sort: Sorting } = $props();
	let dateSort = $derived(sort.fieldSort('date'));
	let descriptionSort = $derived(sort.fieldSort('statementDescription'));
	let amountSort = $derived(sort.fieldSort('amount'));

	function handleClick(field: SortingField, event: MouseEvent) {
		if (event.shiftKey) {
			sort.addOrToggle(field);
		} else {
			sort.sortBy(field);
		}
	}

	const fieldLabels: Record<SortingField, string> = {
		date: 'Date',
		statementDescription: 'Description',
		amount: 'Amount'
	};

	let sortTooltip = $derived.by(() => {
		const columns = sort.columns;
		if (columns.length === 0) return '';
		if (columns.length === 1) {
			const col = columns[0]!;
			return `Sorted by: ${fieldLabels[col.field]} ${col.direction === 'asc' ? '↑' : '↓'}`;
		}
		return (
			'Sorted by: ' +
			columns
				.map(
					(col, i) => `${i + 1}. ${fieldLabels[col.field]} ${col.direction === 'asc' ? '↑' : '↓'}`
				)
				.join(', ')
		);
	});

	function showPriority(info: FieldSortInfo | undefined): boolean {
		return info !== undefined && sort.columns.length > 1;
	}
</script>

<div class="flex w-full flex-row text-sm font-bold" title={sortTooltip}>
	<button
		class="text-align-left flex w-24 cursor-pointer items-center pl-1"
		onclick={(e) => handleClick('date', e)}
	>
		Date
		{#if dateSort}
			{#if showPriority(dateSort)}<span class="text-xs opacity-60">{dateSort.priority}</span>{/if}
			{#if dateSort.direction === 'asc'}
				<IconSortNumericAscending />
			{:else}
				<IconSortNumericDescending />
			{/if}
		{/if}
	</button>
	<button
		class="text-align-left flex grow-1 cursor-pointer items-center"
		onclick={(e) => handleClick('statementDescription', e)}
	>
		Description
		{#if descriptionSort}
			{#if showPriority(descriptionSort)}<span class="text-xs opacity-60"
					>{descriptionSort.priority}</span
				>{/if}
			{#if descriptionSort.direction === 'asc'}
				<IconSortAlphabeticalAscending />
			{:else}
				<IconSortAlphabeticalDescending />
			{/if}
		{/if}
	</button>
	<button class="flex cursor-pointer items-center" onclick={(e) => handleClick('amount', e)}>
		{#if amountSort}
			{#if showPriority(amountSort)}<span class="text-xs opacity-60">{amountSort.priority}</span
				>{/if}
			{#if amountSort.direction === 'asc'}
				<IconSortNumericAscending />
			{:else}
				<IconSortNumericDescending />
			{/if}
		{/if}
		Amount
	</button>
</div>
