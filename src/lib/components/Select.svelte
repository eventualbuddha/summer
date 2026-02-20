<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Dropdown from './Dropdown.svelte';

	let {
		label,
		'aria-label': ariaLabel,
		children,
		open: isOpen = $bindable(false)
	}: { label: string; 'aria-label'?: string; children: Snippet; open?: boolean } = $props();

	let triggerElement: HTMLElement | null = $state(null);
	let dropdownElement: HTMLElement | null = $state(null);
	let alignRight = $state(false);

	// Check if we need to right-align the dropdown when it opens
	$effect(() => {
		if (isOpen && triggerElement && dropdownElement) {
			const triggerRect = triggerElement.getBoundingClientRect();
			const dropdownWidth = dropdownElement.offsetWidth;
			const viewportWidth = window.innerWidth;

			// Check if dropdown would overflow on the right
			const wouldOverflow = triggerRect.left + dropdownWidth > viewportWidth;
			alignRight = wouldOverflow;
		}
	});
</script>

<Dropdown bind:open={isOpen}>
	{#snippet root(contents)}
		<div class="relative inline-block text-left" bind:this={triggerElement}>
			{@render contents()}
		</div>
	{/snippet}
	{#snippet trigger(isOpen, setIsOpen)}
		<Button
			id="menu-button"
			aria-label={ariaLabel}
			aria-expanded={isOpen}
			aria-haspopup="true"
			class="w-full whitespace-nowrap"
			onclick={() => setIsOpen(!isOpen)}
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
		</Button>
	{/snippet}
	{#snippet portal()}
		<div
			bind:this={dropdownElement}
			class="absolute z-10 mt-2 w-max min-w-45 rounded-md bg-white px-2 pb-2 shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800 dark:text-gray-200 dark:shadow-gray-600 dark:ring-gray-600 {alignRight
				? 'right-0 origin-top-right'
				: 'left-0 origin-top-left'}"
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
