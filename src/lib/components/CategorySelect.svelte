<script lang="ts">
	import type { Category } from '$lib/db';
	import { createSingleSelection } from '$lib/utils/Selection.svelte';
	import CategoryPill from './CategoryPill.svelte';
	import Dropdown from './Dropdown.svelte';

	let {
		isOpen = $bindable(),
		value = $bindable(),
		categories
	}: {
		isOpen: boolean;
		value?: Category;
		categories: Category[];
	} = $props();

	const NONE_CATEGORY: Category = {
		id: 'none',
		name: 'None',
		ordinal: categories.length,
		color: 'gray-300',
		emoji: '🚫'
	};

	function setValue(newValue: Category | undefined) {
		value = newValue;
		isOpen = false;
	}

	const selection = $derived(
		isOpen
			? createSingleSelection({
					options: [...categories, NONE_CATEGORY],
					onchange: setValue,
					onclose: () => {
						isOpen = false;
					}
				})
			: undefined
	);
</script>

<Dropdown bind:open={isOpen}>
	{#snippet root(contents)}
		<div class="relative">
			{@render contents()}
		</div>
	{/snippet}
	{#snippet trigger()}
		<CategoryPill category={value ?? NONE_CATEGORY} style="short" />
	{/snippet}
	{#snippet portal()}
		<div
			class="absolute z-50 flex flex-col gap-0.5 rounded-md border border-gray-400 bg-gray-200 p-2 pr-1 pl-3 dark:border-gray-200 dark:bg-gray-800"
		>
			{#each categories as category, index (category.id)}
				<button
					tabindex={index}
					onclick={() => setValue(category)}
					onmouseenter={() => {
						if (selection) selection.hoverIndex = index;
					}}
					onmouseleave={() => {
						if (selection) selection.hoverIndex = -1;
					}}
					class="cursor-pointer rounded-md text-left {selection?.hoverIndex === index
						? 'bg-gray-500 text-gray-50'
						: ''}"
				>
					<CategoryPill {category} style="full" />
				</button>
			{/each}
			<button
				tabindex={categories.length}
				onclick={() => setValue(undefined)}
				onmouseenter={() => {
					if (selection) selection.hoverIndex = categories.length;
				}}
				onmouseleave={() => {
					if (selection) selection.hoverIndex = -1;
				}}
				class="cursor-pointer rounded-md text-left {selection?.hoverIndex === categories.length
					? 'bg-gray-500 text-gray-50'
					: ''}"
			>
				<CategoryPill category={NONE_CATEGORY} style="full" />
			</button>
		</div>
	{/snippet}
</Dropdown>
