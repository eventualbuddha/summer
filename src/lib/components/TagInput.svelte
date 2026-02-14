<script lang="ts">
	import type { Tag, Tagged } from '$lib/db';
	import TagChip from './TagChip.svelte';

	let {
		tags,
		availableTags,
		onchange
	}: {
		tags: Tagged[];
		availableTags: Tag[];
		onchange: (tagged: Tagged[]) => void;
	} = $props();

	let inputValue = $state('');
	let inputElement = $state<HTMLInputElement>();
	let showAutocomplete = $state(false);
	let hoverIndex = $state(-1);

	let filteredSuggestions = $derived.by(() => {
		if (!inputValue.trim()) return [];
		const search = inputValue.toLowerCase();
		if (!search) return [];
		const currentTagNames = new Set(tags.map((t) => t.tag.name));
		return availableTags
			.filter((t) => t.name.toLowerCase().startsWith(search) && !currentTagNames.has(t.name))
			.slice(0, 8);
	});

	function parseTagText(text: string): { name: string; year?: number } {
		const cleaned = text.trim();
		if (!cleaned) return { name: cleaned };
		const parts = cleaned.split(/\s+/);
		const lastPart = parts[parts.length - 1]!;
		const yearMatch = /^\d{4}$/.test(lastPart) ? parseInt(lastPart, 10) : NaN;
		const currentYear = new Date().getFullYear();
		const maxYear = currentYear + 10;
		if (!Number.isNaN(yearMatch) && yearMatch >= 1900 && yearMatch <= maxYear && parts.length > 1) {
			return { name: parts.slice(0, -1).join(' '), year: yearMatch };
		}
		return { name: cleaned };
	}

	function addTag(name: string, year?: number) {
		if (!name.trim()) return;
		if (tags.some((t) => t.tag.name === name && t.year === year)) return;
		const timestamp = Date.now();
		const id = `new-${timestamp}`;
		const newTagged: Tagged = {
			id,
			tag: { id, name },
			year
		};
		onchange([...tags, newTagged]);
		inputValue = '';
		showAutocomplete = false;
		hoverIndex = -1;
	}

	function removeTag(index: number) {
		const newTags = [...tags];
		newTags.splice(index, 1);
		onchange(newTags);
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'Enter': {
				e.preventDefault();
				if (hoverIndex >= 0 && hoverIndex < filteredSuggestions.length) {
					const suggestion = filteredSuggestions[hoverIndex]!;
					addTag(suggestion.name);
				} else if (inputValue.trim()) {
					const { name, year } = parseTagText(inputValue);
					if (name) addTag(name, year);
				}
				break;
			}
			case 'Backspace': {
				if (inputValue === '' && tags.length > 0) {
					removeTag(tags.length - 1);
				}
				break;
			}
			case 'Escape': {
				if (showAutocomplete) {
					e.stopPropagation();
					showAutocomplete = false;
					hoverIndex = -1;
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

	function handleInput(e: Event) {
		inputValue = (e.target as HTMLInputElement).value;
		showAutocomplete = filteredSuggestions.length > 0;
		hoverIndex = -1;
	}

	function handleFocus() {
		if (filteredSuggestions.length > 0) {
			showAutocomplete = true;
		}
	}

	function handleBlur() {
		// Delay to allow click on autocomplete options
		setTimeout(() => {
			showAutocomplete = false;
		}, 150);
	}

	export function focus() {
		inputElement?.focus();
	}
</script>

<div class="relative">
	<div
		class="flex min-h-[2.25rem] flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
		onclick={() => inputElement?.focus()}
		role="presentation"
	>
		{#each tags as tagged, index (tagged.id)}
			<TagChip name={tagged.tag.name} year={tagged.year} onremove={() => removeTag(index)} />
		{/each}
		<input
			bind:this={inputElement}
			type="text"
			class="min-w-[4rem] flex-1 border-none bg-transparent p-0 text-sm outline-none focus:ring-0"
			placeholder={tags.length === 0 ? 'Add tags...' : ''}
			value={inputValue}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			aria-label="Tag input"
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
