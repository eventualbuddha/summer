<script lang="ts">
	import type { Category } from '$lib/db';
	import type { ClassValue } from 'svelte/elements';

	let {
		category,
		style = 'full',
		class: className
	}: { category: Category; style?: 'full' | 'short' | 'color'; class?: ClassValue } = $props();
</script>

{#if style === 'color'}
	<span class="h-8 p-1 pr-2 {category.color} {className}" title={category.name} aria-hidden="true">
	</span>
{/if}
{#if style === 'full'}
	<span class="h-8 p-1 pr-2 whitespace-nowrap {category.color} {className}" title={category.name}>
		<span aria-hidden="true">{category.emoji}</span>
		{category.name}
	</span>
{/if}
{#if style === 'short'}
	<span class="h-8 p-1 pr-2 whitespace-nowrap {category.color} {className}" title={category.name}>
		<span role="img" aria-label={category.name}>
			{category.emoji}
		</span>
	</span>
{/if}
