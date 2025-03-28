<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		root,
		trigger,
		portal
	}: { root: Snippet<[Snippet]>; trigger: Snippet<[boolean]>; portal: Snippet } = $props();

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

{#snippet rootContents()}
	<div bind:this={self}>
		<button onclick={() => (expanded = !expanded)}>
			{@render trigger(expanded)}
		</button>

		{#if expanded}
			{@render portal()}
		{/if}
	</div>
{/snippet}

{@render root(rootContents)}
