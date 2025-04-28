<script lang="ts">
	import type { Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import CategoryPill from './CategoryPill.svelte';
	import Select from './Select.svelte';
	import MultiSelector from './MultiSelector.svelte';

	let {
		selections = $bindable(),
		'aria-label': ariaLabel
	}: {
		selections: Selection<Category>[];
		'aria-label'?: string;
	} = $props();

	let label = $derived(
		(() => {
			const selected = selections.filter((s) => s.selected);

			switch (selected.length) {
				case selections.length:
					return 'All Categories';
				case 0:
					return 'No Categories';
				case 1:
					return selected[0]!.value.name;
				case 2:
					return `${selected[0]!.value.name} & ${selected[1]!.value.name}`;
				default: {
					return `${selected.length} Categories`;
				}
			}
		})()
	);
</script>

<Select aria-label={ariaLabel} {label}>
	<MultiSelector bind:selections allToggle>
		{#snippet item(selection: Selection<Category>)}
			<span class="text-sm">
				<CategoryPill category={selection.value} />
			</span>
		{/snippet}
	</MultiSelector>
	<div class="mt-4 text-xs text-gray-400">Tip: alt+click for just one</div>
</Select>
