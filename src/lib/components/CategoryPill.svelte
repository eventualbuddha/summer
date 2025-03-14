<script lang="ts">
	import type { Category } from '$lib/db';

	let {
		category,
		style = 'full',
		class: className = ''
	}: { category: Category; style?: 'full' | 'short' | 'color'; class?: string } = $props();
</script>

{#if style === 'color'}
	<span class="h-8 p-1 pr-2 {category.color} {className}" title={category.name}></span>
{/if}
{#if style === 'full'}
	<span class="h-8 p-1 pr-2 whitespace-nowrap {category.color} {className}" title={category.name}>
		{category.emoji}
		{category.name}
	</span>
{/if}
{#if style === 'short'}
	<span class="h-8 p-1 pr-2 whitespace-nowrap {category.color} {className}" title={category.name}>
		{category.emoji}
	</span>
{/if}
