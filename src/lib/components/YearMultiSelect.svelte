<script lang="ts">
	import type { Selection } from '$lib/types';
	import { getSelectionRange } from '$lib/utils/getSelectionRange';
	import MultiSelector from './MultiSelector.svelte';
	import Select from './Select.svelte';

	let {
		selections = $bindable(),
		'aria-label': ariaLabel
	}: {
		selections: Selection<number>[];
		'aria-label'?: string;
	} = $props();

	let label = $derived(
		(() => {
			const selected = selections.filter((s) => s.selected);

			switch (selected.length) {
				case selections.length:
					return 'All Years';
				case 0:
					return 'No Years';
				case 1:
					return selected[0]!.value.toString();
				default: {
					const range = getSelectionRange(selections);
					if (range) {
						const [start, end] = range;
						return `${Math.min(start.value, end.value)}–${Math.max(start.value, end.value)}`;
					}
					return `${selected.length} Years`;
				}
			}
		})()
	);
</script>

{#snippet item({ value }: Selection<number>)}
	{value}
{/snippet}

<Select {label} aria-label={ariaLabel}>
	<MultiSelector bind:selections {item} allToggle />
	<div class="mt-4 text-xs text-gray-400">Tip: alt+click for just one</div>
</Select>
