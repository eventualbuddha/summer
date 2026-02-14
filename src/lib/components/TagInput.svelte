<script lang="ts">
	import type { Tag, Tagged } from '$lib/db';

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
		const search = inputValue.replace(/^#/, '').toLowerCase();
		if (!search) return [];
		const currentTagNames = new Set(tags.map((t) => t.tag.name));
		return availableTags
			.filter((t) => t.name.toLowerCase().startsWith(search) && !currentTagNames.has(t.name))
			.slice(0, 8);
	});

	function parseTagText(text: string): { name: string; year?: number } {
		const cleaned = text.replace(/^#/, '').trim();
		const match = cleaned.match(/^(\S+?)(?:-(\d{4,}))?$/);
		if (!match?.[1]) return { name: cleaned };
		const name = match[1];
		const year = match[2] ? parseInt(match[2], 10) : undefined;
		return { name, year };
	}

	function addTag(name: string, year?: number) {
		if (tags.some((t) => t.tag.name === name && t.year === year)) return;
		const newTagged: Tagged = {
			id: `new-${Date.now()}`,
			tag: { id: `new-${Date.now()}`, name },
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
			<span
				class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200"
			>
				#{tagged.tag.name}{#if tagged.year}-{tagged.year}{/if}
				<button
					type="button"
					class="ml-0.5 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
					onclick={(e) => {
						e.stopPropagation();
						removeTag(index);
					}}
					aria-label="Remove tag {tagged.tag.name}"
				>
					&times;
				</button>
			</span>
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
					#{suggestion.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
