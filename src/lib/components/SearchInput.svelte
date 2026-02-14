<script lang="ts">
	import type { Tag } from '$lib/db';
	import type { NewTagged } from '$lib/db/updateTransactionDescription';

	let {
		searchText = $bindable(),
		searchTags = $bindable(),
		availableTags
	}: {
		searchText: string;
		searchTags: NewTagged[];
		availableTags: Tag[];
	} = $props();

	let inputElement = $state<HTMLInputElement>();
	let showAutocomplete = $state(false);
	let hoverIndex = $state(-1);

	let filteredSuggestions = $derived.by(() => {
		if (!searchText.trim()) return [];
		const search = searchText.toLowerCase();
		if (!search) return [];
		const currentTagNames = new Set(searchTags.map((t) => t.name));
		return availableTags
			.filter((t) => t.name.toLowerCase().includes(search) && !currentTagNames.has(t.name))
			.slice(0, 8);
	});

	function addTag(name: string, year?: number) {
		if (searchTags.some((t) => t.name === name && t.year === year)) return;
		searchTags = [...searchTags, { name, year }];
		searchText = '';
		if (inputElement) inputElement.value = '';
		showAutocomplete = false;
		hoverIndex = -1;
	}

	function removeTag(index: number) {
		searchTags = searchTags.filter((_, i) => i !== index);
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
				if (inputElement?.value === '' && searchTags.length > 0) {
					removeTag(searchTags.length - 1);
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
		{#each searchTags as tagged, index}
			<span
				class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200"
			>
				{tagged.name}
				{#if tagged.year}
					<span
						class="ml-1 rounded-full bg-blue-200 px-1.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-700 dark:text-blue-100"
					>
						{tagged.year}
					</span>
				{/if}
				<button
					type="button"
					class="ml-0.5 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
					onclick={(e) => {
						e.stopPropagation();
						removeTag(index);
					}}
					aria-label="Remove tag {tagged.name}"
				>
					&times;
				</button>
			</span>
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
