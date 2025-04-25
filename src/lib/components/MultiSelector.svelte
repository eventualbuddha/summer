<script lang="ts" generics="Item extends { key: string; selected: boolean }">
	import type { Snippet } from 'svelte';

	let {
		selections,
		item,
		allToggle,
		selectItems
	}: {
		selections: Item[];
		item: Snippet<[Item]>;
		allToggle?: boolean;
		selectItems: (keys: readonly string[]) => void;
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
						const checked = e.currentTarget.checked;
						selectItems(checked ? selections.map(({ key }) => key) : []);
					}}
				/>
				All
			</label>
		{/if}

		{#each selections as selection (selection.key)}
			<label class="cursor-pointer">
				<input
					type="checkbox"
					bind:checked={
						() => selection.selected,
						(checked) =>
							selectItems(
								selections
									.filter((s) => (s.key === selection.key ? checked : s.selected))
									.map(({ key }) => key)
							)
					}
					onclick={(e) => {
						if (e.altKey) {
							const selected = selections.filter((s) => s.selected);
							const thisSelected = selected.length !== 1 || selected[0] !== selection;

							selectItems(
								thisSelected
									? [selection.key]
									: selections.filter((s) => s !== selection).map(({ key }) => key)
							);
						}
					}}
				/>
				{@render item(selection)}
			</label>
		{/each}
	</div>
</div>
