<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dropdown from './Dropdown.svelte';

	let {
		label,
		'aria-label': ariaLabel,
		children
	}: { label: string; 'aria-label'?: string; children: Snippet } = $props();
</script>

<Dropdown>
	{#snippet root(contents)}
		<div class="relative inline-block bg-white text-left dark:bg-gray-800">
			{@render contents()}
		</div>
	{/snippet}
	{#snippet trigger(expanded)}
		<button
			type="button"
			class="inline-flex w-full justify-center gap-x-1.5 rounded-md px-3 py-1 text-sm font-semibold shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:ring-gray-600 hover:dark:bg-gray-950"
			id="menu-button"
			aria-label={ariaLabel}
			aria-expanded={expanded}
			aria-haspopup="true"
		>
			{label}
			<svg
				class="-mr-1 size-5 text-gray-400"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
				data-slot="icon"
			>
				<path
					fill-rule="evenodd"
					d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	{/snippet}
	{#snippet portal()}
		<div
			class="absolute left-0 z-10 mt-2 min-w-45 origin-top-left rounded-md bg-white px-2 pb-2 shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800 dark:shadow-gray-600 dark:ring-gray-600"
			role="menu"
			aria-orientation="vertical"
			aria-labelledby="menu-button"
			tabindex="-1"
		>
			<div class="p-1" role="none">
				{@render children()}
			</div>
		</div>
	{/snippet}
</Dropdown>
