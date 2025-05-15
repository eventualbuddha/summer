<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import ButtonLike from './ButtonLike.svelte';

	let {
		children: buttonChildren,
		class: className,
		...rest
	}: { children: Snippet } & HTMLButtonAttributes = $props();
</script>

<ButtonLike class={className}>
	{#snippet children(className)}
		<button type="button" class={className} {...rest}>
			{@render buttonChildren()}
		</button>
	{/snippet}
</ButtonLike>
