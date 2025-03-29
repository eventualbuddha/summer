<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		icon: Icon,
		onclick
	}: {
		icon: Snippet;
		title: string | Snippet;
		subtitle?: string | Snippet;
		onclick: () => void;
	} = $props();
</script>

<button
	class="flex w-60 cursor-pointer flex-row items-center gap-2 rounded-md border-2 border-gray-400 px-4 py-2 hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600"
	{onclick}
>
	<span>
		<Icon />
	</span>
	<div class="overflow-hidden overflow-ellipsis">
		<h3 class="flex flex-row items-center gap-2 text-xl whitespace-nowrap">
			{#if typeof title === 'string'}
				{title}
			{:else}
				{@render title()}
			{/if}
		</h3>

		{#if subtitle}
			<span class="whitespace-nowrap">
				{#if typeof subtitle === 'string'}
					{subtitle}
				{:else}
					{@render subtitle()}
				{/if}
			</span>
		{/if}
	</div>
</button>
