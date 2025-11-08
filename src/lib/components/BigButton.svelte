<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

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

<Button class="w-60 flex-row items-center px-4 py-2" {onclick}>
	<span>
		{@render Icon()}
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
</Button>
