<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		root,
		trigger,
		portal,
		open = $bindable(false)
	}: {
		root: Snippet<[Snippet]>;
		trigger: Snippet<[boolean]>;
		portal: Snippet;
		open?: boolean;
	} = $props();

	let self: HTMLElement | null = $state(null);

	$effect(() => {
		if (open) {
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
						open = false;
						document.removeEventListener('click', onclick);
						document.removeEventListener('keydown', onkeydown);
					}
				}
			}

			function onkeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					e.preventDefault();
					open = false;
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
		<button onclick={() => (open = !open)}>
			{@render trigger(open)}
		</button>

		{#if open}
			{@render portal()}
		{/if}
	</div>
{/snippet}

{@render root(rootContents)}
