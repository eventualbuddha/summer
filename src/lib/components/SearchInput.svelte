<script lang="ts">
	import type { Tag } from '$lib/db';
	import TagChip from './TagChip.svelte';

	let {
		searchText = $bindable(),
		searchTags = $bindable(),
		availableTags
	}: {
		searchText: string;
		searchTags: string[];
		availableTags: Tag[];
	} = $props();

	let inputElement = $state<HTMLInputElement>();
	let showAutocomplete = $state(false);
	let hoverIndex = $state(-1);

	let filteredSuggestions = $derived.by(() => {
		if (!searchText.trim()) return [];
		const search = searchText.toLowerCase();
		if (!search) return [];
		const currentTagNames = new Set(searchTags);
		return availableTags
			.filter((t) => t.name.toLowerCase().includes(search) && !currentTagNames.has(t.name))
			.slice(0, 8);
	});

	function addTag(name: string) {
		if (searchTags.includes(name)) return;
		searchTags = [...searchTags, name];
		searchText = '';
		if (inputElement) inputElement.value = '';
		showAutocomplete = false;
		hoverIndex = -1;
	}

	function removeTag(name: string) {
		searchTags = searchTags.filter((t) => t !== name);
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'Enter': {
				e.preventDefault();
				if (hoverIndex >= 0 && hoverIndex < filteredSuggestions.length) {
					const suggestion = filteredSuggestions[hoverIndex]!;
					addTag(suggestion.name);
				}
				break;
			}
			case 'Backspace': {
				const lastTag = searchTags[searchTags.length - 1];
				if (inputElement?.value === '' && lastTag) {
					removeTag(lastTag);
				}
				break;
			}
			case 'Escape': {
				if (showAutocomplete) {
					e.stopPropagation();
					showAutocomplete = false;
					hoverIndex = -1;
				} else {
					inputElement?.blur();
				}
				break;
			}
			case 'ArrowDown': {
				e.preventDefault();
				if (filteredSuggestions.length > 0) {
					showAutocomplete = true;
					hoverIndex = Math.min(hoverIndex + 1, filteredSuggestions.length - 1);
				}
				break;
			}
			case 'ArrowUp': {
				e.preventDefault();
				if (filteredSuggestions.length > 0) {
					hoverIndex = Math.max(hoverIndex - 1, 0);
				}
				break;
			}
		}
	}

	function handleInput() {
		searchText = inputElement?.value ?? '';
		showAutocomplete = filteredSuggestions.length > 0;
		hoverIndex = -1;
	}

	function handleFocus() {
		if (filteredSuggestions.length > 0) {
			showAutocomplete = true;
		}
	}

	function handleBlur() {
		setTimeout(() => {
			showAutocomplete = false;
		}, 150);
	}

	export function focus() {
		inputElement?.focus();
	}

	export function select() {
		inputElement?.select();
	}
</script>

<div class="relative">
	<div
		class="flex min-h-[1.75rem] flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
		onclick={() => inputElement?.focus()}
		role="presentation"
	>
		{#each searchTags as tag (tag)}
			<TagChip name={tag} onremove={() => removeTag(tag)} />
		{/each}
		<input
			bind:this={inputElement}
			type="text"
			value={searchText}
			class="min-w-[4rem] flex-1 border-none bg-transparent p-0 text-sm outline-none focus:ring-0"
			placeholder={searchTags.length === 0 ? 'Search (/)' : ''}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			aria-label="Search input"
		/>
	</div>

	{#if showAutocomplete && filteredSuggestions.length > 0}
		<div
			class="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
			role="listbox"
		>
			{#each filteredSuggestions as suggestion, index (suggestion.id)}
				<button
					type="button"
					class="w-full cursor-pointer px-3 py-1.5 text-left text-sm {hoverIndex === index
						? 'bg-blue-100 dark:bg-blue-800'
						: 'hover:bg-gray-100 dark:hover:bg-gray-600'}"
					onmousedown={(e) => {
						e.preventDefault();
						addTag(suggestion.name);
					}}
					onmouseenter={() => {
						hoverIndex = index;
					}}
					role="option"
					aria-selected={hoverIndex === index}
				>
					{suggestion.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
