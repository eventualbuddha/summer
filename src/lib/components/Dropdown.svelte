<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		root,
		trigger,
		portal,
		open: isOpen = $bindable(false),
		'content-class': contentClass
	}: {
		root: Snippet<[Snippet]>;
		trigger: Snippet<[boolean]>;
		portal: Snippet;
		open?: boolean;
		'content-class'?: ClassValue;
	} = $props();

	let self: HTMLElement | null = $state(null);

	$effect(() => {
		if (isOpen) {
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
						isOpen = false;
						document.removeEventListener('click', onclick);
						document.removeEventListener('keydown', onkeydown);
					}
				}
			}

			function onkeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					e.preventDefault();
					isOpen = false;
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

{#snippet rootContents()}
	<div class={contentClass} bind:this={self}>
		<button onclick={() => (isOpen = !isOpen)}>
			{@render trigger(isOpen)}
		</button>

		{#if isOpen}
			{@render portal()}
		{/if}
	</div>
{/snippet}

{@render root(rootContents)}
