<script lang="ts" generics="T">
	import type { Selection } from '../types';
	import type { Snippet } from 'svelte';

	let {
		title,
		selections,
		children
	}: { title: string; selections?: Selection<T>[]; children: Snippet } = $props();

	function setAllSelected(selected: boolean) {
		if (!selections) return;
		for (const selection of selections) {
			selection.selected = selected;
		}
	}

	function toggleSelections() {
		if (!selections) return;
		for (const selection of selections) {
			selection.selected = !selection.selected;
		}
	}
</script>

<div class="filter-section">
	<h4 class="font-bold">{title}</h4>
	{#if selections}
		<button
			class="cursor-pointer italic"
			onclick={(e) => {
				if (e.altKey) {
					toggleSelections();
				} else {
					setAllSelected(true);
				}
			}}
		>
			(all)</button
		>
		<button
			class="cursor-pointer italic"
			onclick={(e) => {
				if (e.altKey) {
					toggleSelections();
				} else {
					setAllSelected(false);
				}
			}}>(none)</button
		>
	{/if}

	{@render children()}
</div>
