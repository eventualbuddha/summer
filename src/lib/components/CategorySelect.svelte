<script lang="ts">
	import type { Category } from '$lib/db';
	import { createSingleSelection } from '$lib/utils/Selection.svelte';
	import type { Snippet } from 'svelte';
	import CategoryPill from './CategoryPill.svelte';
	import Dropdown from './Dropdown.svelte';
	import { NONE_CATEGORY } from '$lib/utils/categories';

	let {
		isOpen = $bindable(),
		value = $bindable(),
		categories,
		trigger
	}: {
		isOpen: boolean;
		value?: Category;
		categories: readonly Category[];
		trigger?: Snippet<[boolean, (isOpen: boolean) => void]>;
	} = $props();

	function setValue(newValue: Category | undefined) {
		value = newValue;
		isOpen = false;
	}

	const selection = $derived(
		isOpen
			? createSingleSelection({
					options: [...categories, NONE_CATEGORY],
					search: (category) => category.name,
					onchange: setValue,
					onclose: () => {
						isOpen = false;
					}
				})
			: undefined
	);

	let optionsContainer: HTMLDivElement | undefined;

	$effect(() => {
		if (typeof selection?.hoverIndex === 'number') {
			const option = optionsContainer?.children[selection.hoverIndex];
			if (option) {
				option.scrollIntoView({
					block: 'nearest',
					inline: 'nearest'
				});
			}
		}
	});
</script>

{#snippet defaultTrigger(isOpen: boolean, setIsOpen: (isOpen: boolean) => void)}
	<button onclick={() => setIsOpen(!isOpen)}>
		<CategoryPill category={value ?? NONE_CATEGORY} style="short" />
	</button>
{/snippet}

<Dropdown bind:open={isOpen} trigger={trigger ?? defaultTrigger}>
	{#snippet root(contents)}
		<div class="relative">
			{@render contents()}
		</div>
	{/snippet}
	{#snippet portal()}
		<div
			role="listbox"
			bind:this={optionsContainer}
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
						: 'text-gray-900 dark:text-gray-200'}"
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
					: 'text-gray-900 dark:text-gray-200'}"
			>
				<CategoryPill category={NONE_CATEGORY} style="full" />
			</button>
		</div>
	{/snippet}
</Dropdown>
