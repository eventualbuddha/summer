<script lang="ts">
	let {
		name,
		year,
		size = 'sm',
		onremove
	}: {
		name: string;
		year?: number;
		size?: 'xs' | 'sm';
		onremove?: () => void;
	} = $props();

	let textSize = $derived(size === 'xs' ? 'text-xs' : 'text-sm');
</script>

{#if year}
	<span class="inline-flex items-center {textSize}">
		<span
			class="inline-flex items-center rounded-l-full bg-blue-100 py-0.5 pr-1.5 pl-2 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
		>
			{name}
		</span>
		<span
			class="inline-flex items-center rounded-r-full bg-blue-200 py-0.5 pl-1.5 {onremove
				? 'pr-1.5'
				: 'pr-2'} {textSize} font-medium text-blue-900 dark:bg-blue-900 dark:text-blue-100"
		>
			<span class="text-xs">{year}</span>
			{#if onremove}
				<button
					type="button"
					class="ml-1 cursor-pointer text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
					onclick={(e) => {
						e.stopPropagation();
						onremove();
					}}
					aria-label="Remove tag {name}"
				>
					&times;
				</button>
			{/if}
		</span>
	</span>
{:else}
	<span
		class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 {textSize} text-blue-800 dark:bg-blue-800 dark:text-blue-200"
	>
		{name}
		{#if onremove}
			<button
				type="button"
				class="ml-0.5 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
				onclick={(e) => {
					e.stopPropagation();
					onremove();
				}}
				aria-label="Remove tag {name}"
			>
				&times;
			</button>
		{/if}
	</span>
{/if}
