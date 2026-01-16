<script lang="ts">
	import type { Account, Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import AccountMultiSelect from './AccountMultiSelect.svelte';
	import CategoryMultiSelect from './CategoryMultiSelect.svelte';
	import MonthMultiSelect from './MonthMultiSelect.svelte';
	import YearMultiSelect from './YearMultiSelect.svelte';
	import { onMount, untrack } from 'svelte';

	let {
		yearSelections = $bindable(),
		monthSelections = $bindable(),
		categorySelections = $bindable(),
		accountSelections = $bindable(),
		searchTerm = $bindable(),
		onclear
	}: {
		yearSelections: Selection<number>[];
		monthSelections: Selection<number>[];
		categorySelections: Selection<Category>[];
		accountSelections: Selection<Account>[];
		searchTerm: string;
		onclear?: () => void;
	} = $props();

	let editableSearchTerm = $state(searchTerm);
	let searchInput: HTMLInputElement;

	// Sync editableSearchTerm → searchTerm (with debounce)
	$effect(() => {
		let newSearchTerm = editableSearchTerm;
		let timeout = setTimeout(() => {
			searchTerm = newSearchTerm;
		}, 300);
		return () => clearTimeout(timeout);
	});

	// Sync searchTerm → editableSearchTerm (when changed externally, e.g., by clearFilters)
	$effect(() => {
		const current = searchTerm;
		untrack(() => {
			// Only update if they're different to avoid infinite loops
			if (current !== editableSearchTerm) {
				editableSearchTerm = current;
			}
		});
	});

	function handleKeydown(event: KeyboardEvent) {
		// Focus search input when "/" is pressed (unless already in an input/textarea)
		if (
			event.key === '/' &&
			event.target !== searchInput &&
			!(event.target instanceof HTMLInputElement) &&
			!(event.target instanceof HTMLTextAreaElement)
		) {
			event.preventDefault();
			searchInput?.focus();
			searchInput?.select();
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		// Blur search input when Escape is pressed
		if (event.key === 'Escape') {
			searchInput?.blur();
		}
	}

	function handleClear() {
		// Clear local state immediately to cancel any pending debounced updates
		editableSearchTerm = '';
		// Then call the parent's clear handler
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
		<span class="font-bold">Filters:</span>
		<YearMultiSelect aria-label="Year Filter" bind:selections={yearSelections} />
		<MonthMultiSelect aria-label="Month Filter" bind:selections={monthSelections} />
		<CategoryMultiSelect aria-label="Category Filter" bind:selections={categorySelections} />
		<AccountMultiSelect aria-label="Account Filter" bind:selections={accountSelections} />
		<input
			bind:this={searchInput}
			type="text"
			placeholder="Search (/)"
			bind:value={editableSearchTerm}
			onkeydown={handleSearchKeydown}
			class="rounded-md border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-800"
		/>
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
	</div>
</div>
