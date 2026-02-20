<script lang="ts">
	import type { Tag } from '$lib/db';
	import type { AmountFilter, SearchFilter } from '$lib/types';
	import { searchFilterLabel } from '$lib/types';
	import { parseAmountInput } from '$lib/utils/searchFilters';
	import TagChip from './TagChip.svelte';

	type Suggestion =
		| { kind: 'tag'; tag: Tag }
		| { kind: 'amount'; filter: AmountFilter; label: string }
		| { kind: 'desc'; value: string }
		| { kind: 'bank'; value: string };

	let {
		searchText = $bindable(),
		searchFilters = $bindable(),
		availableTags
	}: {
		searchText: string;
		searchFilters: SearchFilter[];
		availableTags: Tag[];
	} = $props();

	let inputElement = $state<HTMLInputElement>();
	let showAutocomplete = $state(false);
	let hoverIndex = $state(-1);
	let focusedChipIndex = $state(-1);

	const hasDescChip = $derived(searchFilters.some((f) => f.type === 'desc'));
	const hasBankChip = $derived(searchFilters.some((f) => f.type === 'bank'));
	const currentTagNames = $derived(
		new Set(
			searchFilters
				.filter((f): f is { type: 'tag'; value: string } => f.type === 'tag')
				.map((f) => f.value)
		)
	);

	const suggestions = $derived.by((): Suggestion[] => {
		if (!searchText.trim()) return [];
		const search = searchText.toLowerCase();
		const result: Suggestion[] = [];

		// Tag suggestions (up to 6)
		const tagMatches = availableTags
			.filter((t) => t.name.toLowerCase().includes(search) && !currentTagNames.has(t.name))
			.slice(0, 6);
		for (const tag of tagMatches) {
			result.push({ kind: 'tag', tag });
		}

		// Amount suggestion
		const amountFilter = parseAmountInput(searchText);
		if (amountFilter) {
			const label = searchFilterLabel({ type: 'amount', filter: amountFilter });
			result.push({ kind: 'amount', filter: amountFilter, label });
		}

		// Desc suggestion (at most 1)
		if (!hasDescChip) {
			result.push({ kind: 'desc', value: searchText });
		}

		// Bank suggestion (at most 1)
		if (!hasBankChip) {
			result.push({ kind: 'bank', value: searchText });
		}

		return result;
	});

	function addFilter(filter: SearchFilter) {
		searchFilters = [...searchFilters, filter];
		searchText = '';
		if (inputElement) inputElement.value = '';
		showAutocomplete = false;
		hoverIndex = -1;
		focusedChipIndex = -1;
	}

	function removeFilter(index: number) {
		searchFilters = searchFilters.filter((_, i) => i !== index);
	}

	function selectSuggestion(s: Suggestion) {
		switch (s.kind) {
			case 'tag':
				addFilter({ type: 'tag', value: s.tag.name });
				break;
			case 'amount':
				addFilter({ type: 'amount', filter: s.filter });
				break;
			case 'desc':
				addFilter({ type: 'desc', value: s.value });
				break;
			case 'bank':
				addFilter({ type: 'bank', value: s.value });
				break;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		// Chip-nav mode
		if (focusedChipIndex >= 0) {
			switch (e.key) {
				case 'ArrowLeft': {
					e.preventDefault();
					focusedChipIndex = Math.max(0, focusedChipIndex - 1);
					return;
				}
				case 'ArrowRight': {
					e.preventDefault();
					focusedChipIndex = focusedChipIndex + 1;
					if (focusedChipIndex >= searchFilters.length) {
						focusedChipIndex = -1;
					}
					return;
				}
				case 'Backspace': {
					e.preventDefault();
					const idx = focusedChipIndex;
					removeFilter(idx);
					if (searchFilters.length <= 1) {
						focusedChipIndex = -1;
					} else {
						focusedChipIndex = Math.max(0, idx - 1);
					}
					return;
				}
				case 'Escape': {
					focusedChipIndex = -1;
					return;
				}
				default: {
					// Printable key: exit chip-nav, let it type normally into input
					if (e.key.length === 1) {
						focusedChipIndex = -1;
					}
					return;
				}
			}
		}

		// Text mode
		switch (e.key) {
			case 'Enter': {
				e.preventDefault();
				if (hoverIndex >= 0 && hoverIndex < suggestions.length) {
					selectSuggestion(suggestions[hoverIndex]!);
				}
				break;
			}
			case 'Backspace': {
				if (inputElement?.value === '' && searchFilters.length > 0) {
					focusedChipIndex = searchFilters.length - 1;
				}
				break;
			}
			case 'ArrowLeft': {
				if (
					inputElement?.selectionStart === 0 &&
					inputElement?.selectionEnd === 0 &&
					searchFilters.length > 0
				) {
					e.preventDefault();
					focusedChipIndex = searchFilters.length - 1;
				}
				break;
			}
			case 'Escape': {
				showAutocomplete = false;
				hoverIndex = -1;
				inputElement?.blur();
				break;
			}
			case 'ArrowDown': {
				e.preventDefault();
				if (suggestions.length > 0) {
					showAutocomplete = true;
					hoverIndex = Math.min(hoverIndex + 1, suggestions.length - 1);
				}
				break;
			}
			case 'ArrowUp': {
				e.preventDefault();
				if (suggestions.length > 0) {
					hoverIndex = Math.max(hoverIndex - 1, 0);
				}
				break;
			}
		}
	}

	function handleInput() {
		searchText = inputElement?.value ?? '';
		showAutocomplete = suggestions.length > 0;
		hoverIndex = -1;
		focusedChipIndex = -1;
	}

	function handleFocus() {
		if (suggestions.length > 0) {
			showAutocomplete = true;
		}
	}

	function handleBlur() {
		setTimeout(() => {
			showAutocomplete = false;
			focusedChipIndex = -1;
		}, 150);
	}

	function getSuggestionVariant(s: Suggestion): 'tag' | 'amount' | 'desc' | 'bank' {
		if (s.kind === 'tag') return 'tag';
		if (s.kind === 'amount') return 'amount';
		if (s.kind === 'desc') return 'desc';
		return 'bank';
	}

	function getSuggestionLabel(s: Suggestion): string {
		switch (s.kind) {
			case 'tag':
				return s.tag.name;
			case 'amount':
				return s.label;
			case 'desc':
				return `desc:${s.value}`;
			case 'bank':
				return `bank:${s.value}`;
		}
	}

	function getSuggestionSecondaryLabel(s: Suggestion): string {
		switch (s.kind) {
			case 'tag':
				return 'tag';
			case 'amount':
				return 'amount';
			case 'desc':
				return 'description';
			case 'bank':
				return 'bank description';
		}
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
		{#each searchFilters as filter, i (i)}
			<TagChip
				name={searchFilterLabel(filter)}
				variant={filter.type}
				focused={focusedChipIndex === i}
				onremove={() => removeFilter(i)}
				onclick={() => {
					focusedChipIndex = i;
				}}
			/>
		{/each}
		<input
			bind:this={inputElement}
			type="text"
			value={searchText}
			class="min-w-[4rem] flex-1 border-none bg-transparent p-0 text-sm outline-none focus:ring-0"
			placeholder={searchFilters.length === 0 ? 'Search (/)' : ''}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			aria-label="Search input"
		/>
	</div>

	{#if showAutocomplete && suggestions.length > 0}
		<div
			class="absolute z-50 mt-1 w-max min-w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
			role="listbox"
		>
			{#each suggestions as suggestion, index (index)}
				<button
					type="button"
					class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm {hoverIndex ===
					index
						? 'bg-blue-100 dark:bg-blue-800'
						: 'hover:bg-gray-100 dark:hover:bg-gray-600'}"
					onmousedown={(e) => {
						e.preventDefault();
						selectSuggestion(suggestion);
					}}
					onmouseenter={() => {
						hoverIndex = index;
					}}
					role="option"
					aria-selected={hoverIndex === index}
					aria-label={getSuggestionLabel(suggestion)}
				>
					<TagChip
						name={getSuggestionLabel(suggestion)}
						variant={getSuggestionVariant(suggestion)}
					/>
					<span class="text-xs text-gray-400">{getSuggestionSecondaryLabel(suggestion)}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
