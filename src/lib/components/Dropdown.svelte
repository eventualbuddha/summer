<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		'aria-label': ariaLabel,
		children
	}: { label: string; 'aria-label'?: string; children: Snippet } = $props();

	let expanded = $state(false);
	let self: HTMLElement | null = $state(null);

	$effect(() => {
		if (expanded) {
			function onclick(e: MouseEvent) {
				const element = e.target;
				if (element instanceof HTMLElement) {
					let isInsideSelf = false;
					for (let parent = element.parentElement; parent; parent = parent.parentElement) {
						if (parent === self) {
							isInsideSelf = true;
							break;
						}
					}

					if (!isInsideSelf) {
						e.preventDefault();
						expanded = false;
						document.removeEventListener('click', onclick);
						document.removeEventListener('keydown', onkeydown);
					}
				}
			}

			function onkeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					e.preventDefault();
					expanded = false;
				}
			}

			document.addEventListener('click', onclick);
			document.addEventListener('keydown', onkeydown);
			return () => {
				document.removeEventListener('click', onclick);
				document.removeEventListener('keydown', onkeydown);
			};
		}
	});
</script>

<div bind:this={self} class="relative inline-block bg-white text-left dark:bg-gray-800">
	<div>
		<button
			type="button"
			class="inline-flex w-full justify-center gap-x-1.5 rounded-md px-3 py-1 text-sm font-semibold shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:ring-gray-600 hover:dark:bg-gray-950"
			id="menu-button"
			aria-label={ariaLabel}
			aria-expanded={expanded}
			aria-haspopup="true"
			onclick={() => (expanded = !expanded)}
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
	</div>

	<!--
       Dropdown menu, show/hide based on menu state.

       Entering: "transition ease-out duration-100"
         From: "transform opacity-0 scale-95"
         To: "transform opacity-100 scale-100"
       Leaving: "transition ease-in duration-75"
         From: "transform opacity-100 scale-100"
         To: "transform opacity-0 scale-95"
     -->
	{#if expanded}
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
	{/if}
</div>
