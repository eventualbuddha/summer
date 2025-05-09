<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		children,
		class: className,
		...rest
	}: { children: Snippet } & HTMLButtonAttributes = $props();
</script>

<button
	type="button"
	class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-600 hover:dark:bg-gray-950 {className}"
	{...rest}
>
	{@render children()}
</button>
