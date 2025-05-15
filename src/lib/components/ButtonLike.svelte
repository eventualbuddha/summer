<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		children,
		class: className
	}: { children: Snippet<[ClassValue]>; class?: ClassValue | null } = $props();
</script>

{@render children([
	'inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400 dark:bg-gray-800 dark:ring-gray-600 hover:dark:bg-gray-950 disabled:dark:text-gray-600 focus:ring-blue-500',
	className
])}
