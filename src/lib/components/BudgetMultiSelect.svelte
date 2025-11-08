<script lang="ts">
	import type { Selection } from '$lib/types';
	import Select from './Select.svelte';
	import MultiSelector from './MultiSelector.svelte';

	let {
		selections = $bindable(),
		'aria-label': ariaLabel
	}: {
		selections: Selection<string>[];
		'aria-label'?: string;
	} = $props();

	let label = $derived(
		(() => {
			const selected = selections.filter((s) => s.selected);

			switch (selected.length) {
				case selections.length:
					return 'All Budgets';
				case 0:
					return 'No Budgets';
				case 1:
					return selected[0]!.value;
				case 2:
					return `${selected[0]!.value} & ${selected[1]!.value}`;
				default: {
					return `${selected.length} Budgets`;
				}
			}
		})()
	);
</script>

<Select aria-label={ariaLabel} {label}>
	<MultiSelector bind:selections allToggle>
		{#snippet item(selection: Selection<string>)}
			<span class="text-sm">
				{selection.value}
			</span>
		{/snippet}
	</MultiSelector>
	<div class="mt-4 text-xs text-gray-400">Tip: alt+click for just one</div>
</Select>
