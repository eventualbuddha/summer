<script lang="ts">
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
		onclose
	}: {
		value: { month: number; year: number } | null;
		onchange: (value: { month: number; year: number } | null) => void;
		onclose: () => void;
	} = $props();

	let displayYear = $state(value?.year ?? new Date().getFullYear());

	function handleMonthClick(monthIndex: number) {
		onchange({ month: monthIndex + 1, year: displayYear });
	}

	function handleClear() {
		onchange(null);
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[60]"
	onclick={handleBackdropClick}
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
>
	<div
		class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-600 dark:bg-gray-800"
		data-testid="month-year-picker"
	>
		<div class="mb-3 flex items-center justify-between">
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={() => displayYear--}
				aria-label="Previous year"
			>
				&larr;
			</button>
			<span class="text-sm font-semibold">{displayYear}</span>
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				onclick={() => displayYear++}
				aria-label="Next year"
			>
				&rarr;
			</button>
		</div>
		<div class="grid grid-cols-4 gap-1">
			{#each MONTHS as monthName, i (monthName)}
				{@const isSelected = value !== null && value.month === i + 1 && value.year === displayYear}
				<button
					type="button"
					class="cursor-pointer rounded px-3 py-1.5 text-sm transition-colors {isSelected
						? 'bg-blue-600 text-white'
						: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}"
					onclick={() => handleMonthClick(i)}
					data-testid="month-option-{i + 1}"
				>
					{monthName}
				</button>
			{/each}
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
