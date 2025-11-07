<script lang="ts">
	import { SvelteDate as Date } from 'svelte/reactivity';
	import type { Selection } from '$lib/types';
	import { getSelectionRange } from '$lib/utils/getSelectionRange';
	import Select from './Select.svelte';
	import MultiSelector from './MultiSelector.svelte';

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
					return 'All Months';
				case 0:
					return 'No Months';
				case 1:
					return formatMonth(selected[0]!.value);
				default: {
					const range = getSelectionRange(selections);
					if (range) {
						const [start, end] = range;
						return `${formatMonth(Math.min(start.value, end.value))}–${formatMonth(Math.max(start.value, end.value))}`;
					}
					return `${selected.length} Months`;
				}
			}
		})()
	);

	function formatMonth(month: number): string {
		const formatter = new Intl.DateTimeFormat(undefined, {
			month: 'long'
		});
		const date = new Date();
		date.setMonth(month - 1);
		return formatter.format(date);
	}
</script>

{#snippet item({ value }: Selection<number>)}
	{formatMonth(value)}
{/snippet}

<Select aria-label={ariaLabel} {label}>
	<MultiSelector bind:selections {item} allToggle />
	<div class="mt-4 text-xs text-gray-400">Tip: alt+click for just one</div>
</Select>
