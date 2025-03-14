<script lang="ts" generics="Item extends { key: string; selected: boolean }">
	import type { Snippet } from 'svelte';

	let {
		selections = $bindable(),
		item,
		allToggle
	}: {
		selections: Item[];
		item: Snippet<[Item]>;
		allToggle?: boolean;
	} = $props();
</script>

<div class="multi-selector">
	<div class="mt-2 flex flex-col gap-1">
		{#if allToggle}
			<label class="mb-2 cursor-pointer font-bold">
				<input
					type="checkbox"
					checked={selections.every((selection) => selection.selected)}
					onclick={(e) => {
						for (const selection of selections) {
							selection.selected = e.currentTarget.checked;
						}
					}}
				/>
				All
			</label>
		{/if}

		{#each selections as selection (selection.key)}
			<label class="cursor-pointer">
				<input
					type="checkbox"
					bind:checked={selection.selected}
					onclick={(e) => {
						if (e.altKey) {
							const selected = selections.filter((s) => s.selected);
							const thisSelected = selected.length !== 1 || selected[0] !== selection;

							for (const selection of selections) {
								selection.selected = !thisSelected;
							}
							selection.selected = thisSelected;
						}
					}}
				/>
				{@render item(selection)}
			</label>
		{/each}
	</div>
</div>
