<script lang="ts">
	import type { Account } from '$lib/db';
	import type { Selection } from '$lib/types';
	import Select from './Select.svelte';
	import MultiSelector from './MultiSelector.svelte';

	let {
		selections,
		selectItems,
		'aria-label': ariaLabel
	}: {
		selections: Selection<Account>[];
		selectItems: (keys: readonly string[]) => void;
		'aria-label'?: string;
	} = $props();

	let label = $derived(
		(() => {
			const selected = selections.filter((s) => s.selected);

			switch (selected.length) {
				case selections.length:
					return 'All Accounts';
				case 0:
					return 'No Accounts';
				case 1:
					return selected[0]!.value.name;
				case 2:
					return `${selected[0]!.value.name} & ${selected[1]!.value.name}`;
				default: {
					return `${selected.length} Accounts`;
				}
			}
		})()
	);
</script>

{#snippet item(selection: Selection<Account>)}
	{selection.value.name}
{/snippet}

<Select aria-label={ariaLabel} {label}>
	<MultiSelector {selections} {selectItems} {item} allToggle />
	<div class="mt-4 text-xs text-gray-400">Tip: alt+click for just one</div>
</Select>
