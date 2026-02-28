<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	let {
		value,
		onchange,
		onclose,
		initialFocus
	}: {
		value: { month: number; year: number } | null;
		onchange: (value: { month: number; year: number } | null) => void;
		onclose: () => void;
		initialFocus?: { month: number; year: number };
	} = $props();

	let displayYear = $state(value?.year ?? initialFocus?.year ?? new Date().getFullYear());

	// Capture the value when picker opened, for the "old value" ring indicator
	const initialValue = value;

	// Keyboard cursor position (0–11 = Jan–Dec)
	let focusedIndex = $state(
		value !== null && value.year === displayYear
			? value.month - 1
			: initialFocus?.year === displayYear
				? initialFocus.month - 1
				: 0
	);

	// +1 = animating forward (next year), -1 = backward (prev year), 0 = initial
	let direction = $state(0);

	let pickerEl = $state<HTMLElement>();

	onMount(() => {
		pickerEl?.focus();
	});

	function prevYear() {
		direction = -1;
		displayYear--;
	}

	function nextYear() {
		direction = 1;
		displayYear++;
	}

	function handleMonthClick(monthIndex: number) {
		onchange({ month: monthIndex + 1, year: displayYear });
	}

	function handleClear() {
		onchange(null);
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowLeft':
			case 'h': {
				e.preventDefault();
				e.stopPropagation();
				// Row-based wrap: left edge → same row right edge of previous year
				if (focusedIndex % 4 === 0) {
					prevYear();
					focusedIndex += 3;
				} else {
					focusedIndex--;
				}
				break;
			}
			case 'ArrowRight':
			case 'l': {
				e.preventDefault();
				e.stopPropagation();
				// Row-based wrap: right edge → same row left edge of next year
				if (focusedIndex % 4 === 3) {
					nextYear();
					focusedIndex -= 3;
				} else {
					focusedIndex++;
				}
				break;
			}
			case 'ArrowUp':
			case 'k':
				e.preventDefault();
				e.stopPropagation();
				focusedIndex = Math.max(0, focusedIndex - 4);
				break;
			case 'ArrowDown':
			case 'j':
				e.preventDefault();
				e.stopPropagation();
				focusedIndex = Math.min(11, focusedIndex + 4);
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				e.stopPropagation();
				handleMonthClick(focusedIndex);
				break;
			case 'q':
			case 'Escape':
				e.preventDefault();
				e.stopPropagation();
				onclose();
				break;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[60]" onclick={handleBackdropClick} onkeydown={handleKeydown}>
	<div
		bind:this={pickerEl}
		class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl outline-none dark:border-gray-600 dark:bg-gray-800"
		data-testid="month-year-picker"
		tabindex="-1"
	>
		<div class="mb-3 flex items-center justify-between">
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={prevYear}
				aria-label="Previous year"
			>
				&larr;
			</button>
			<!-- Year label animates on change -->
			<div style="display:grid; overflow:hidden; min-width:3.5rem; text-align:center">
				{#key displayYear}
					<span
						style="grid-area:1/1"
						class="text-sm font-semibold"
						in:fly={{ x: direction * 24, duration: 200, easing: cubicOut }}
						out:fly={{ x: -direction * 24, duration: 200, easing: cubicOut }}
					>
						{displayYear}
					</span>
				{/key}
			</div>
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={nextYear}
				aria-label="Next year"
			>
				&rarr;
			</button>
		</div>
		<!-- Month grid animates on year change. p-1 gives edge rings room to render. -->
		<div style="display:grid; overflow:hidden;">
			{#key displayYear}
				<div
					style="grid-area:1/1"
					class="grid grid-cols-4 gap-1 p-1"
					in:fly={{ x: direction * 200, duration: 200, easing: cubicOut }}
					out:fly={{ x: -direction * 200, duration: 200, easing: cubicOut }}
				>
					{#each MONTHS as monthName, i (monthName)}
						{@const isSelected =
							value !== null && value.month === i + 1 && value.year === displayYear}
						{@const isFocused = focusedIndex === i}
						{@const isInitial =
							initialValue !== null &&
							initialValue.month === i + 1 &&
							initialValue.year === displayYear &&
							!isSelected &&
							!isFocused}
						<button
							type="button"
							class="cursor-pointer rounded px-3 py-1.5 text-sm transition-colors
								{isSelected
								? 'bg-blue-600 text-white'
								: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}
								{isFocused ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
								{isInitial ? 'ring-1 ring-gray-300 dark:ring-gray-500' : ''}"
							onclick={() => handleMonthClick(i)}
							data-testid="month-option-{i + 1}"
						>
							{monthName}
						</button>
					{/each}
				</div>
			{/key}
		</div>
		{#if value !== null}
			<div class="mt-3 flex justify-center">
				<button
					type="button"
					class="cursor-pointer rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
					onclick={handleClear}
					data-testid="clear-effective-date"
				>
					Clear
				</button>
			</div>
		{/if}
	</div>
</div>
